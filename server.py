# server.py
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from marine_agents import MarineCoordinatorAgent

app = Flask(__name__)
CORS(app)

coordinator = MarineCoordinatorAgent()

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    user_query = data.get('query', '')
    lat = data.get('lat', 15.0)  
    lon = data.get('lon', 88.0)
    
    # 1. Extract the language sent by the frontend (defaults to English if missing)
    language = data.get('language', 'English')

    try:
        return Response(
            coordinator.analyze_request_stream(user_query, lat, lon, language),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    print("🌊 Samudra AI Backend is running on http://127.0.0.1:5001")
    app.run(port=5001, debug=True)