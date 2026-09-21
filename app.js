// app.js
// ==========================================
// 0. FIREBASE AUTHENTICATION CHECK
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDK-wkmz5HRWkOXI1b7ncz0wVYs7gv18qY",
    authDomain: "samudra-ai-agent.firebaseapp.com",
    projectId: "samudra-ai-agent",
    storageBucket: "samudra-ai-agent.firebasestorage.app",
    messagingSenderId: "210402465389",
    appId: "1:210402465389:web:03262776b7a6eceb391164",
    measurementId: "G-X23M482E1P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Protect the dashboard route
auth.onAuthStateChanged(user => {
    if (!user) {
        // If no user is logged in, kick them back to the login page
        window.location.href = "login.html";
    } else {
        console.log("Operator Authenticated:", user.email || "Google User");
    }
});

// Logout function triggered by the header button
function logoutApp() {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    }).catch((error) => {
        console.error("Logout error", error);
    });
}

// ==========================================
// 1. INITIALIZE DASHBOARD & GEOSPATIAL MAP
// ==========================================
// (Your existing let map; and other variables start here...)

let map;
let windChart, waveChart;
let currentMarkers = [];
let riskLayers = [];
let hotspotLayers = []; 

// ==========================================
// 1. INITIALIZE DASHBOARD & GEOSPATIAL MAP
// ==========================================
// ==========================================
// 1. INITIALIZE DASHBOARD & GEOSPATIAL MAP
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // --- LANGUAGE SYNC & UI TRANSLATION ---
    const langSelect = document.getElementById("languageSelect");
    const storedLang = localStorage.getItem("selectedLanguage");

    if (langSelect) {
        if (storedLang) {
            let exists = Array.from(langSelect.options).some(opt => opt.value === storedLang);
            if (!exists) {
                const newOpt = document.createElement("option");
                newOpt.value = storedLang;
                newOpt.innerText = storedLang;
                langSelect.appendChild(newOpt);
            }
            langSelect.value = storedLang;
        }

        // Apply translation slightly after page load to allow Google Engine to initialize
        setTimeout(() => {
            if (langSelect.value !== "English") applyPageTranslation(langSelect.value);
        }, 1200);

        // Listen for user changes
        langSelect.addEventListener("change", (e) => {
            const selectedName = e.target.value;
            localStorage.setItem("selectedLanguage", selectedName);
            applyPageTranslation(selectedName);
        });
    }

    // --- MAP INITIALIZATION ---
    map = L.map('map').setView([20.5937, 78.9629], 5); 
    
    // Ocean Basemap
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 13
    }).addTo(map);

    // CLICK LISTENER: Update map by clicking directly
    map.on('click', async (e) => {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        
        let locName = `Selected Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
        
        // Attempt reverse geocoding to retrieve area name
        try {
            const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
            const res = await fetch(nomUrl);
            const data = await res.json();
            if (data && data.name) {
                locName = data.name;
            } else if (data && data.address) {
                locName = data.address.city || data.address.state || locName;
            }
        } catch(err) {
            console.warn("Reverse geocoding failed");
        }

        addChatMessage(`Scanning selected coordinates: ${lat.toFixed(2)}, ${lon.toFixed(2)}...`, "ai-message");
        fetchDashboardData(lat, lon, locName);
    });

    highlightIndia();
    plotCoastalWindConditions();

    // Default load
    fetchDashboardData(15.0, 88.0, "Bay of Bengal");
});

// --- TRANSLATION ENGINE CONTROLLER ---
function applyPageTranslation(langName) {
    const langCodes = {
        "English": "en", "Hindi": "hi", "Bengali": "bn", "Telugu": "te",
        "Tamil": "ta", "Marathi": "mr", "Gujarati": "gu", "Malayalam": "ml",
        "Odia": "or", "Kannada": "kn", "Spanish": "es", "French": "fr",
        "Arabic": "ar", "Mandarin Chinese": "zh-CN", "Japanese": "ja",
        "German": "de", "Russian": "ru", "Portuguese": "pt"
    };

    const targetCode = langCodes[langName] || "en";
    const gtSelect = document.querySelector('.goog-te-combo');
    
    if (gtSelect) {
        gtSelect.value = targetCode;
        gtSelect.dispatchEvent(new Event('change'));
    } else {
        // Retry once if Google Engine hasn't finished loading yet
        setTimeout(() => {
            const retrySelect = document.querySelector('.goog-te-combo');
            if (retrySelect) {
                retrySelect.value = targetCode;
                retrySelect.dispatchEvent(new Event('change'));
            }
        }, 1000);
    }
}

// ==========================================
// DYNAMIC WIND STREAMLINES ALONG COAST
// ==========================================
async function plotCoastalWindConditions() {
    const coastalPoints = [
        {lat: 18.9, lon: 72.8, name: "Mumbai Coast"},
        {lat: 9.9, lon: 76.2, name: "Kochi Coast"},
        {lat: 13.0, lon: 80.2, name: "Chennai Coast"},
        {lat: 17.6, lon: 83.2, name: "Visakhapatnam Coast"},
        {lat: 21.6, lon: 88.0, name: "Sundarbans Delta"}
    ];

    for(let pt of coastalPoints) {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pt.lat}&longitude=${pt.lon}&current=wind_speed_10m,wind_direction_10m`);
            const data = await res.json();
            const speed = data.current.wind_speed_10m;
            const dir = data.current.wind_direction_10m;
            
            let windColor = "#4caf50";
            if (speed > 25) windColor = "#ff9800";
            if (speed > 45) windColor = "#f44336";

            const svgWind = `
                <div style="display:flex; flex-direction:column; align-items:center;">
                    <svg viewBox="0 0 50 50" style="transform: rotate(${dir}deg); width: 45px; height: 45px; filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.5));">
                        <path d="M10,15 Q25,5 40,15" fill="none" stroke="${windColor}" stroke-width="3" stroke-linecap="round"/>
                        <path d="M5,25 Q25,10 45,25" fill="none" stroke="${windColor}" stroke-width="4" stroke-linecap="round"/>
                        <polygon points="45,25 36,20 36,30" fill="${windColor}"/>
                        <path d="M10,35 Q25,25 40,35" fill="none" stroke="${windColor}" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                    <div style="background:rgba(255,255,255,0.9); padding:2px 6px; font-size:11px; border-radius:12px; border:1px solid ${windColor}; font-weight:bold; color:#1e293b; margin-top: 2px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        ${speed} km/h
                    </div>
                </div>`;
                
            const windIcon = L.divIcon({ html: svgWind, className: 'wind-icon', iconSize: [60, 60], iconAnchor: [30, 30] });
            L.marker([pt.lat, pt.lon], {icon: windIcon}).addTo(map).bindPopup(`Wind at ${pt.name}: ${speed} km/h`);
        } catch(e) {
            console.warn("Failed to load wind data for " + pt.name);
        }
    }
}

// ==========================================
// ACCURATE INDIA BOUNDARY HIGHLIGHT
// ==========================================
async function highlightIndia() {
    const geojsonUrls = [
        'https://raw.githubusercontent.com/geohacker/india/master/country/india.geojson',
        'https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson'
    ];

    for (let url of geojsonUrls) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue; 
            const indiaGeoJSON = await response.json();
            
            L.geoJSON(indiaGeoJSON, {
                style: {
                    color: "#FF5F1F",
                    weight: 2.0,
                    opacity: 1,             
                    fillColor: "#ffffff",
                    fillOpacity: 0.12
                }
            }).addTo(map);
            return;
        } catch (error) {
            console.warn("Retrying boundary fetch...");
        }
    }
}

// ==========================================
// 2. CONVERSATIONAL AI AGENT (CHATBOT)
// ==========================================
function triggerPrompt(text) {
    document.getElementById("chatInput").value = text;
    processChat();
}

function handleEnter(e) {
    if(e.key === 'Enter') processChat();
}

function processChat() {
    const inputField = document.getElementById("chatInput");
    const userText = inputField.value.trim();
    if(!userText) return;

    addChatMessage(userText, "user-message");
    inputField.value = "";

    analyzeIntentAndRespond(userText);
}

function addChatMessage(text, className) {
    const chatWindow = document.getElementById("chatWindow");
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${className}`;
    msgDiv.innerHTML = text;
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}


async function analyzeIntentAndRespond(intent) {
    const chatWindow = document.getElementById("chatWindow");
    const msgDiv = document.createElement("div");
    msgDiv.className = "message ai-message";
    msgDiv.innerHTML = "Processing query...";
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Reset voice queue on fresh request
    window.speechSynthesis.cancel();
    if (typeof voiceQueue !== 'undefined') voiceQueue = [];
    if (typeof isSpeaking !== 'undefined') isSpeaking = false;

    const currentCenter = map.getCenter();
    const langElement = document.getElementById("languageSelect");
    const selectedLanguage = langElement ? langElement.value : "English";

    try {
        const response = await fetch('http://127.0.0.1:5001/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: intent,
                lat: currentCenter.lat,
                lon: currentCenter.lng,
                language: selectedLanguage
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let isFirstChunk = true;
        let fullText = "";
        let buffer = ""; 
        let speechBuffer = ""; // Accumulates text to detect punctuation boundaries

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop();

            for (let line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '').trim();
                    if (!dataStr) continue;
                    
                    try {
                        const data = JSON.parse(dataStr);
                        
                        if (data.type === 'hotspots') {
                            if (data.data && data.data.length > 0) {
                                drawMarineHotspots(data.data);
                                map.setView([data.data[0].lat, data.data[0].lon], 6);
                            }
                        } else if (data.type === 'text') {
                            if (isFirstChunk) {
                                msgDiv.innerHTML = ""; 
                                isFirstChunk = false;
                            }
                            fullText += data.data;
                            speechBuffer += data.data;

                            // Stream sentence-by-sentence to TTS whenever a boundary (. ? ! \n ।) is reached
                            let match;
                            while ((match = speechBuffer.match(/([.?!।\n]+)/))) {
                                const boundaryIndex = match.index + match[0].length;
                                const sentence = speechBuffer.substring(0, boundaryIndex);
                                speechBuffer = speechBuffer.substring(boundaryIndex);
                                if (typeof enqueueSpeechSentence === 'function') enqueueSpeechSentence(sentence);
                            }

                            msgDiv.innerHTML = fullText.replace(/\n/g, '<br>');
                            chatWindow.scrollTop = chatWindow.scrollHeight;
                        } else if (data.type === 'done') {
                            // Flush any remaining characters left in the buffer
                            if (speechBuffer.trim()) {
                                if (typeof enqueueSpeechSentence === 'function') enqueueSpeechSentence(speechBuffer);
                                speechBuffer = "";
                            }
                        } else if (data.type === 'error') {
                            msgDiv.innerHTML = "⚠️ Backend Error: " + data.data;
                        }
                    } catch (e) {
                        console.error("Stream parse error on chunk:", dataStr);
                    }
                }
            }
        }
    } catch (error) {
        msgDiv.innerHTML = "⚠️ Connection failed. Ensure server.py is running on port 5001.";
    }
}
// ==========================================
// 3. ROBUST LOCATION RESOLUTION
// ==========================================
const INDIAN_COASTAL_REGIONS = {
    "bay of bengal": { lat: 15.0, lon: 88.0, name: "Bay of Bengal" },
    "arabian sea": { lat: 15.0, lon: 65.0, name: "Arabian Sea" },
    "indian ocean": { lat: -5.0, lon: 80.0, name: "Indian Ocean" },
    "andaman": { lat: 11.66, lon: 92.74, name: "Andaman and Nicobar Islands" },
    "nicobar": { lat: 7.0, lon: 93.5, name: "Nicobar Islands" },
    "lakshadweep": { lat: 10.57, lon: 72.64, name: "Lakshadweep" },
    "gujarat": { lat: 21.75, lon: 70.80, name: "Gujarat Coastal Region" },
    "maharashtra": { lat: 18.97, lon: 72.82, name: "Maharashtra Coast" },
    "goa": { lat: 15.30, lon: 73.85, name: "Goa Coast" },
    "karnataka": { lat: 13.50, lon: 74.70, name: "Karnataka Coastal Belt" },
    "kerala": { lat: 9.93, lon: 76.26, name: "Kerala Coast" },
    "tamil nadu": { lat: 11.12, lon: 79.50, name: "Tamil Nadu Coast" },
    "andhra pradesh": { lat: 16.50, lon: 81.80, name: "Andhra Pradesh Coast" },
    "odisha": { lat: 19.81, lon: 85.83, name: "Odisha Coast" },
    "orissa": { lat: 19.81, lon: 85.83, name: "Odisha Coast" },
    "west bengal": { lat: 21.80, lon: 88.20, name: "West Bengal Coast / Sundarbans" },
    "puducherry": { lat: 11.94, lon: 79.80, name: "Puducherry" },
    "pondicherry": { lat: 11.94, lon: 79.80, name: "Puducherry" },
    "daman": { lat: 20.39, lon: 72.83, name: "Daman & Diu" },
    "diu": { lat: 20.71, lon: 70.98, name: "Diu" }
};

async function resolveLocation(query) {
    const clean = query.trim().toLowerCase();

    for (const [key, val] of Object.entries(INDIAN_COASTAL_REGIONS)) {
        if (clean === key || clean.includes(key)) {
            return val;
        }
    }

    try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
        const nomRes = await fetch(nominatimUrl, { headers: { 'Accept-Language': 'en' } });
        const nomData = await nomRes.json();

        if (nomData && nomData.length > 0) {
            return {
                lat: parseFloat(nomData[0].lat),
                lon: parseFloat(nomData[0].lon),
                name: nomData[0].display_name.split(',')[0]
            };
        }
    } catch (e) {}

    try {
        const omUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=1&format=json`;
        const omRes = await fetch(omUrl);
        const omData = await omRes.json();

        if (omData.results && omData.results.length > 0) {
            return {
                lat: omData.results[0].latitude,
                lon: omData.results[0].longitude,
                name: omData.results[0].name
            };
        }
    } catch (e) {}

    return null;
}

async function getDashboardData() {
    const query = document.getElementById("cityInput").value.trim();
    if (!query) return;

    addChatMessage(`Scanning marine databases for "${query}"...`, "ai-message");

    try {
        const location = await resolveLocation(query);

        if (!location) {
            addChatMessage(`⚠️ Location "${query}" not found. Please try entering a coastal city (e.g., Visakhapatnam, Kochi, Puri) or state (e.g., Odisha, Kerala, Gujarat).`, "ai-message");
            return;
        }

        fetchDashboardData(location.lat, location.lon, location.name);
        map.setView([location.lat, location.lon], 7);

    } catch (err) {
        addChatMessage("System encountered an error resolving the location.", "ai-message");
    }
}

// ==========================================
// 4. FETCH DATA & EVALUATE CYCLONE RISKS
// ==========================================
async function fetchDashboardData(lat, lon, locName) {
    try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,pressure_msl,wind_gusts_10m&hourly=wind_speed_10m,precipitation&timezone=auto`);
        const weatherData = await weatherRes.json();

        const marineRes = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height&timezone=auto`);
        const marineData = await marineRes.json();

        // Check if point is inland by examining if the wave height returns valid numbers vs nulls
        let isCoastal = false;
        if (marineData.hourly && marineData.hourly.wave_height) {
            isCoastal = marineData.hourly.wave_height.some(val => val !== null && val > 0);
        }

        updateCharts(weatherData, marineData);
        simulateEcosystemAgent(lat, lon, isCoastal); 
        
        evaluateAndPlotCycloneRisks(lat, lon, weatherData.current, locName);
        
        currentMarkers.forEach(m => map.removeLayer(m));
        let marker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>📍 ${locName}</b><br>Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`).openPopup();
        currentMarkers.push(marker);

    } catch (error) {
        console.error("Data fetch error", error);
    }
}

// ==========================================
// 5. CYCLONE RISK ENGINE
// ==========================================
function evaluateAndPlotCycloneRisks(lat, lon, currentWeather, locName) {
    const wind = currentWeather.wind_speed_10m || 0;
    const gusts = currentWeather.wind_gusts_10m || wind * 1.2;
    const pressure = currentWeather.pressure_msl || 1010;
    const banner = document.getElementById("warningDashboard");

    riskLayers.forEach(l => map.removeLayer(l));
    riskLayers = [];

    let riskLevel = "Low";
    let riskColor = "#4caf50";
    let message = `🟢 LOW CYCLONE RISK: Stable marine weather near ${locName}. Wind: ${wind} km/h, MSLP: ${pressure} hPa. Safe for maritime activities.`;

    if (wind >= 62 || pressure <= 990 || gusts > 85) {
        riskLevel = "Extreme";
        riskColor = "#f44336";
        message = `🚨 EXTREME CYCLONE RISK (Severe Storm System): Dangerous wind speeds of ${wind} km/h (Gusts: ${gusts.toFixed(1)} km/h) & low pressure (${pressure} hPa). Port evacuation and coastal warnings active.`;
    } else if (wind >= 45 || pressure <= 998 || gusts > 60) {
        riskLevel = "High";
        riskColor = "#ff9800";
        message = `🟠 HIGH CYCLONE RISK (Deep Depression / Cyclonic Conditions): Winds at ${wind} km/h. Sea conditions rough. All fishing operations suspended.`;
    } else if (wind >= 28 || pressure <= 1004 || gusts > 40) {
        riskLevel = "Moderate";
        riskColor = "#ffeb3b";
        message = `🟡 MODERATE CYCLONE / GALE WATCH: Strong winds detected (${wind} km/h). Small craft advisories in effect.`;
    }

    banner.style.display = "block";
    banner.style.borderLeft = `6px solid ${riskColor}`;
    banner.style.background = riskLevel === "Low" ? "#f0fdf4" : (riskLevel === "Moderate" ? "#fffbeb" : "#fef2f2");
    banner.style.color = riskLevel === "Low" ? "#166534" : (riskLevel === "Moderate" ? "#854d0e" : "#991b1b");
    banner.innerHTML = message;

    const outerRing = L.circle([lat, lon], { radius: 120000, color: '#4caf50', fillColor: '#4caf50', fillOpacity: 0.12, weight: 1.5, dashArray: '4, 4' }).addTo(map);
    const midRing = L.circle([lat, lon], { radius: 70000, color: riskLevel === 'Low' ? '#4caf50' : '#ff9800', fillColor: riskLevel === 'Low' ? '#4caf50' : '#ff9800', fillOpacity: 0.20, weight: 2 }).addTo(map);
    const coreRing = L.circle([lat, lon], { radius: 35000, color: riskColor, fillColor: riskColor, fillOpacity: 0.40, weight: 2.5 }).addTo(map);
    
    riskLayers.push(outerRing, midRing, coreRing);
}

// ==========================================
// 6. MARINE ECOSYSTEM SIMULATION
// ==========================================
function simulateEcosystemAgent(lat, lon, isCoastal) {
    if (!isCoastal) {
        document.getElementById("eco-chloro").innerText = `N/A`;
        document.getElementById("eco-do").innerText = `N/A`;
        
        const polEl = document.getElementById("eco-pollution");
        polEl.innerText = "N/A";
        polEl.style.color = "#64748b";
        
        document.getElementById("eco-species").innerText = `N/A`;
        document.getElementById("eco-endangered").innerText = "N/A";
        
        hotspotLayers.forEach(l => map.removeLayer(l));
        hotspotLayers = [];
        return;
    }

    const chloro = parseFloat((Math.random() * (2.5 - 0.2) + 0.2).toFixed(2));
    const doLevel = (Math.random() * (8.0 - 4.5) + 4.5).toFixed(1);
    const pollution = doLevel < 5.5 ? "Elevated ⚠️" : "Low 🟢";
    
    const speciesCount = Math.floor(Math.random() * (600 - 350 + 1)) + 350;
    const endangered = lat > 15 ? "Olive Ridley Turtles" : "Whale Sharks";

    document.getElementById("eco-chloro").innerText = `${chloro} mg/m³`;
    document.getElementById("eco-do").innerText = `${doLevel} mg/L`;
    
    const polEl = document.getElementById("eco-pollution");
    polEl.innerText = pollution;
    polEl.style.color = pollution.includes("Elevated") ? "#e39000" : "#0284c7";
    
    document.getElementById("eco-species").innerText = `${speciesCount} Species`;
    document.getElementById("eco-endangered").innerText = endangered;

    if (chloro > 1.0) {
        const generatedHotspots = [];
        const numSpots = Math.floor(Math.random() * 3) + 3; 
        for (let i = 0; i < numSpots; i++) {
            generatedHotspots.push({
                lat: lat + (Math.random() * 1.5 - 0.75),
                lon: lon + (Math.random() * 1.5 - 0.75)
            });
        }
        drawMarineHotspots(generatedHotspots);
    } else {
        hotspotLayers.forEach(l => map.removeLayer(l));
        hotspotLayers = [];
    }
}

function drawMarineHotspots(hotspotsArray) {
    hotspotLayers.forEach(l => map.removeLayer(l));
    hotspotLayers = [];

    hotspotsArray.forEach(spot => {
        let circle = L.circleMarker([spot.lat, spot.lon], {
            color: '#0056b3',
            fillColor: '#00e5ff',
            fillOpacity: 0.85,
            radius: 7
        }).addTo(map);
        circle.bindPopup("🐟 High Marine Life & Phytoplankton Concentration");
        hotspotLayers.push(circle);
    });
}

// ==========================================
// 7. CHART VISUALIZATIONS
// ==========================================
function updateCharts(weather, marine) {
    const timeLabels = weather.hourly.time.slice(0, 12).map(t => t.substring(11, 16));
    
    // Wind data will always be available globally
    const windData = weather.hourly.wind_speed_10m.slice(0, 12);
    
    // Wave data mapping to display '0' when inland (marine API returns null)
    let waveData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    if (marine.hourly && marine.hourly.wave_height) {
        waveData = marine.hourly.wave_height.slice(0, 12).map(val => val === null ? 0 : val);
    }

    Chart.defaults.color = '#64748b';
    Chart.defaults.borderColor = '#e2e8f0';

    if (windChart) windChart.destroy();
    windChart = new Chart(document.getElementById("windChart"), {
        type: "line",
        data: {
            labels: timeLabels,
            datasets: [{
                label: "Wind Speed (km/h)",
                data: windData,
                borderColor: "#0284c7",
                backgroundColor: "rgba(2, 132, 199, 0.1)",
                fill: true,
                tension: 0.4
            }]
        }
    });

    if (waveChart) waveChart.destroy();
    waveChart = new Chart(document.getElementById("waveChart"), {
        type: "bar",
        data: {
            labels: timeLabels,
            datasets: [{
                label: "Wave Height (m)",
                data: waveData,
                backgroundColor: "#0056b3",
                borderRadius: 4
            }]
        }
    });
}

if (waveChart) waveChart.destroy();
    waveChart = new Chart(document.getElementById("waveChart"), {
        type: "bar",
        data: {
            labels: timeLabels,
            datasets: [{
                label: "Wave Height (m)",
                data: waveData,
                backgroundColor: "#0056b3",
                borderRadius: 4
            }]
        }
    });

// ==========================================
// 8. POPUP VOICE ASSISTANT ENGINE (CRASH-PROOF)
// ==========================================
let recognition = null;
let voiceQueue = [];
let isSpeaking = false;
let currentTranscript = "";

const VOICE_BCP47_CODES = {
    "English": "en-US", "Hindi": "hi-IN", "Bengali": "bn-IN", "Telugu": "te-IN",
    "Tamil": "ta-IN", "Marathi": "mr-IN", "Gujarati": "gu-IN", "Malayalam": "ml-IN",
    "Kannada": "kn-IN", "Odia": "or-IN", "Spanish": "es-ES", "French": "fr-FR",
    "Arabic": "ar-SA", "Mandarin Chinese": "zh-CN", "Japanese": "ja-JP",
    "German": "de-DE", "Russian": "ru-RU", "Portuguese": "pt-BR"
};

function getActiveVoiceLocale() {
    const langSelect = document.getElementById("languageSelect");
    return langSelect ? (VOICE_BCP47_CODES[langSelect.value] || "en-US") : "en-US";
}

window.openVoiceModal = function() {
    // Renamed to WebSpeechAPI to prevent any scoping crashes
    const WebSpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!WebSpeechAPI) {
        alert("Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.");
        return;
    }

    document.getElementById("voiceModal").style.display = "flex";
    const liveBox = document.getElementById("liveTranscript");
    liveBox.innerText = "Listening...";
    liveBox.style.color = "#94a3b8";
    currentTranscript = "";

    window.speechSynthesis.cancel();
    voiceQueue = [];
    isSpeaking = false;

    // Use the newly named API safely
    recognition = new WebSpeechAPI();
    recognition.lang = getActiveVoiceLocale();
    recognition.continuous = true;      
    recognition.interimResults = true;  

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        currentTranscript += finalTranscript;
        const displayString = currentTranscript + interimTranscript;
        if (displayString.trim()) {
            liveBox.innerText = displayString;
            liveBox.style.color = "#0f172a";
        }
    };

    recognition.onerror = (event) => {
        if (event.error !== "no-speech") liveBox.innerText = "Error: " + event.error;
    };

    recognition.start();
};

window.cancelVoiceModal = function() {
    document.getElementById("voiceModal").style.display = "none";
    if (recognition) recognition.stop();
};

window.finishVoiceModal = function() {
    document.getElementById("voiceModal").style.display = "none";
    if (recognition) recognition.stop();
    
    const finalResult = document.getElementById("liveTranscript").innerText;
    if (finalResult && finalResult !== "Listening..." && finalResult !== "Speak now...") {
        document.getElementById("chatInput").value = finalResult;
        if (typeof processChat === "function") {
            processChat();
        }
    }
};