import os
import json
import requests
import random
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY"),
    timeout=30.0  # Increased from 8.0
)

MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b"

# ==========================================
# TOOL 1: Weather & Wave Intelligence
# ==========================================
def get_marine_weather(lat: float, lon: float) -> dict:
    marine_url = "https://marine-api.open-meteo.com/v1/marine"
    marine_params = {"latitude": lat, "longitude": lon, "current": ["wave_height"], "timezone": "Asia/Kolkata"}
    
    weather_url = "https://api.open-meteo.com/v1/forecast"
    weather_params = {"latitude": lat, "longitude": lon, "current": ["wind_speed_10m", "pressure_msl"], "timezone": "Asia/Kolkata"}
    
    def fetch(url, params):
        return requests.get(url, params=params, timeout=2).json()

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_marine = executor.submit(fetch, marine_url, marine_params)
            future_weather = executor.submit(fetch, weather_url, weather_params)
            
            marine_data = future_marine.result()
            weather_data = future_weather.result()
            
        return {
            "wave_height_m": marine_data.get("current", {}).get("wave_height", 0.5),
            "wind_speed_kmh": weather_data.get("current", {}).get("wind_speed_10m", 15.0),
            "pressure_hpa": weather_data.get("current", {}).get("pressure_msl", 1013)
        }
    except Exception as e:
        print(f"Weather fetch error: {e}")
        return {"wave_height_m": 1.2, "wind_speed_kmh": 18.5, "pressure_hpa": 1010}

# ==========================================
# TOOL 2: Marine Ecosystem Database
# ==========================================
def fetch_ecosystem_data(lat: float, lon: float) -> dict:
    chlorophyll = 2.4 if lat > 10 and lon < 85 else 0.5 
    status = "Favorable" if chlorophyll > 1.0 else "Poor"
    hotspots = [
        {"lat": lat + random.uniform(-0.8, 0.8), "lon": lon + random.uniform(-0.8, 0.8)},
        {"lat": lat + random.uniform(-0.8, 0.8), "lon": lon + random.uniform(-0.8, 0.8)}
    ] if status == "Favorable" else []

    return {
        "chlorophyll_a_mg_m3": chlorophyll,
        "pfz_status": status,
        "species_count": random.randint(350, 600),
        "hotspots": hotspots
    }

# ==========================================
# THE ORCHESTRATOR AGENT
# ==========================================
class MarineCoordinatorAgent:
    def __init__(self):
        self.name = "Samudra AI Orchestrator"
        
    def analyze_request_stream(self, original_query: str, lat: float, lon: float, language: str = "English"):
        print(f"🧠 Orchestrator received: '{original_query}' in language: '{language}'")

        weather_data = get_marine_weather(lat, lon)
        eco_data = fetch_ecosystem_data(lat, lon)
        
        agent_reports = {
            "weather": weather_data,
            "ocean": eco_data
        }
        hotspots_to_plot = eco_data.get("hotspots", [])

        # Yield hotspots immediately
        yield f"data: {json.dumps({'type': 'hotspots', 'data': hotspots_to_plot})}\n\n"

        system_instruction = "You are Samudra AI, an AI maritime assistant. You strictly adhere to output formatting and translation directives."
        
        # 1. Structure the prompt to put the English data at the top
        # 2. Put the translation override at the very bottom so it is the last thing the AI processes
        translation_directive = ""
        if language.lower() != "english":
            translation_directive = f"""
=========================================
CRITICAL TRANSLATION DIRECTIVE:
You MUST output your ENTIRE final response translated into: {language}.
Use the native script/alphabet of {language}.
Even if the user's message is in English, you MUST reply in {language}. 
Do NOT include any English text.
========================================="""

        user_prompt = f"""Marine Telemetry Data:
{json.dumps(agent_reports, indent=2)}

User's Message: "{original_query}"

Follow these rules to generate your response:
1. Write a concise 2-3 sentence response referencing the wind, waves, or ecosystem metrics.
2. End with an actionable safety advisory.
3. Include relevant emojis.
{translation_directive}"""

        try:
            response_stream = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1, # Lowered to force rigid instruction following
                max_tokens=150,  # Reduced to speed up response time for short answers
                stream=True,
                extra_body={"chat_template_kwargs": {"enable_thinking": False}}
            )
            
            for chunk in response_stream:
                if chunk.choices[0].delta.content:
                    text_chunk = chunk.choices[0].delta.content
                    yield f"data: {json.dumps({'type': 'text', 'data': text_chunk})}\n\n"
                    
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            print(f"❌ SYNTHESIS ERROR: {e}")
            yield f"data: {json.dumps({'type': 'error', 'data': 'I encountered a communication error.'})}\n\n"