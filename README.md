# Vehicle Smoke Emission Detection System (Firebase Edition)

## Stack
- Backend: Node.js + Express
- Database: Firebase Firestore
- Frontend: HTML + CSS + JavaScript + Chart.js
- Email: Nodemailer (Gmail SMTP)
- Call: Twilio Voice API

## Project Structure

```text
/emission-system
  /backend
  /esp8266
    /frontend
  firestore.rules
  railway.json
```

## Backend Setup
1. Place your real Firebase Admin key in `backend/serviceAccountKey.json`.
2. Update `backend/.env` values.
3. Install dependencies:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
4. API base URL: `http://localhost:3000/api`

## API Endpoints
- `POST /api/sensor-data`
- `GET /api/sensor-data/latest`
- `GET /api/sensor-data/history?limit=50`
- `GET /api/alerts/history?limit=20`
- `GET /api/stats/today`

All `/api` routes require `X-API-KEY` matching `API_SECRET_KEY`.

## Frontend Setup
- Open `http://localhost:3000/frontend/dashboard.html`
- Edit Firebase client config in `esp8266/frontend/js/firebaseClient.js`.
- Edit API key constant in `esp8266/frontend/js/dashboard.js` to match backend key.

## Arduino Uno + MQ-7 + MQ-135 (5V) Setup

Firmware file:
- `esp8266/vehicle_emission_monitor_uno.ino`

Connections (Arduino Uno):
- MQ-7 `VCC` -> Uno `5V`
- MQ-7 `GND` -> Uno `GND`
- MQ-7 `AO` -> Uno `A0`
- MQ-135 `VCC` -> Uno `5V`
- MQ-135 `GND` -> Uno `GND`
- MQ-135 `AO` -> Uno `A1`

Important power note:
- MQ sensor heaters can draw noticeable current. If readings are unstable, power sensors from an external regulated 5V source and connect external `GND` to Uno `GND` (common ground required).

Upload steps:
1. Open `esp8266/vehicle_emission_monitor_uno.ino` in Arduino IDE.
2. Select board: `Arduino Uno`.
3. Select correct COM port.
4. Upload and open Serial Monitor at `9600` baud.

## Arduino Uno -> ESP8266 Sensor Bridge

Use this when MQ sensors are connected to Arduino Uno, and ESP8266 only handles WiFi/API.

Firmware files:
- Uno (sensor reader + UART sender): `esp8266/vehicle_emission_monitor_uno.ino`
- ESP8266 (UART receiver + HTTP sender): `esp8266/vehicle_emission_monitor_esp_bridge.ino`

Connections (UNO + NodeMCU ESP8266):
- UNO `GND` -> ESP8266 `GND` (mandatory common ground)
- UNO `D3` (software TX) -> ESP8266 `D6` (software RX) **through voltage divider**
  - Divider example: UNO D3 -> `1k` -> ESP D6, and ESP D6 -> `2k` -> GND
- ESP8266 `D5` (software TX, optional) -> UNO `D2` (software RX)
- MQ-7 `AO` -> UNO `A0`, MQ-135 `AO` -> UNO `A1`
- MQ sensor `VCC` -> regulated `5V`; both sensor grounds tied to UNO GND

Important:
- Do not connect UNO 5V TX directly to ESP8266 RX pin; ESP8266 GPIO is 3.3V logic.
- Power ESP8266 from stable 5V USB (or proper 3.3V regulator) and keep grounds common.

Upload order:
1. Upload Uno sketch first.
2. Upload ESP8266 bridge sketch and set `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL`, `API_KEY`.
3. Start backend (`npm --prefix backend start`) and open `http://localhost:3000/frontend/dashboard.html`.

## Railway Deployment
1. Push this repo to GitHub.
2. In Railway, create a new project from this GitHub repo.
3. Railway will use `railway.json` automatically:
  - Build: `npm install --prefix backend`
  - Start: `npm --prefix backend start`
4. Add environment variables in Railway (same keys as `backend/.env`).
5. In Railway variables, set `PORT` automatically (Railway injects it) and keep `API_SECRET_KEY`.
6. Upload your real Firebase service-account JSON to `backend/serviceAccountKey.json` in deployment (or mount via secure variable/file strategy).

## Firestore Collections
- `sensor_readings`
- `alerts_log`
- `threshold_config/CO`
- `threshold_config/CO2`

Seed thresholds:
- `CO`: warning_level=35, danger_level=70
- `CO2`: warning_level=1000, danger_level=2000

## Setup Order
1. Create Firebase project and Firestore.
2. Download service account key.
3. Configure backend `.env`.
4. Seed `threshold_config` docs.
5. Test POST endpoint with Postman.
6. Configure Gmail app password + Twilio credentials.
7. Flash `esp8266/vehicle_emission_monitor.ino` and set server URL.
8. Deploy backend and update ESP endpoint.
