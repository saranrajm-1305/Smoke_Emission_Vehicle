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
