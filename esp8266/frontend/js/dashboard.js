import {
  db,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "./firebaseClient.js";
import { initCharts, updateCharts } from "./charts.js";

const API_BASE = `${window.location.origin}/api`;
const API_KEY = "veh_emission_2026_secure_9xK4pQ";

const clockEl = document.getElementById("clock");
const deviceStatusPill = document.getElementById("deviceStatusPill");
const offlineBanner = document.getElementById("offlineBanner");
const coValueEl = document.getElementById("coValue");
const co2ValueEl = document.getElementById("co2Value");
const tempValueEl = document.getElementById("tempValue");
const systemStatusEl = document.getElementById("systemStatus");
const alertsTableBody = document.getElementById("alertsTableBody");

function setClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleString();
}

function getLevelClass(value, warning, danger) {
  if (value >= danger) return "value-danger";
  if (value >= warning) return "value-warning";
  return "value-normal";
}

function updateStatusBadge(status) {
  systemStatusEl.textContent = status;
  systemStatusEl.className = "badge";
  if (status === "DANGER") systemStatusEl.classList.add("danger");
  else if (status === "WARNING") systemStatusEl.classList.add("warning");
  else systemStatusEl.classList.add("normal");
}

function updateOfflineState(timestamp) {
  if (!timestamp?.seconds) return;
  const readingTime = timestamp?.seconds ? timestamp.seconds * 1000 : 0;
  const secondsAgo = (Date.now() - readingTime) / 1000;
  const online = secondsAgo <= 30;

  deviceStatusPill.textContent = online ? "🟢 Online" : "🔴 Offline";
  deviceStatusPill.className = `status-pill ${online ? "online" : "offline"}`;
  offlineBanner.classList.toggle("hidden", online);
}

function updateOverview(latest) {
  if (!latest) return;

  const co = Number(latest.co_ppm || 0);
  const co2 = Number(latest.co2_ppm || 0);
  const temp = Number(latest.temperature || 0);

  coValueEl.textContent = co.toFixed(2);
  co2ValueEl.textContent = co2.toFixed(2);
  tempValueEl.textContent = temp.toFixed(1);

  coValueEl.className = getLevelClass(co, 35, 70);
  co2ValueEl.className = getLevelClass(co2, 1000, 2000);
  updateStatusBadge(latest.status || "NORMAL");
  updateOfflineState(latest.timestamp);
}

async function fetchTodayStats() {
  try {
    const response = await fetch(`${API_BASE}/stats/today`, {
      headers: { "X-API-KEY": API_KEY },
    });
    const payload = await response.json();
    if (!payload.success) return;

    const stats = payload.data;
    document.getElementById("avgCo").textContent = stats.avg_co;
    document.getElementById("avgCo2").textContent = stats.avg_co2;
    document.getElementById("maxCo").textContent = stats.max_co;
    document.getElementById("maxCo2").textContent = stats.max_co2;
    document.getElementById("totalReadings").textContent = stats.total_readings;
    document.getElementById("totalAlerts").textContent = stats.total_alerts;
  } catch (error) {
    console.error("Failed to fetch stats", error);
  }
}

function listenSensorReadings() {
  const q = query(
    collection(db, "sensor_readings"),
    orderBy("timestamp", "desc"),
    limit(30)
  );

  onSnapshot(q, (snapshot) => {
    const readings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!readings.length) return;

    const latestWithTimestamp = readings.find((reading) => reading.timestamp?.seconds) || readings[0];
    updateOverview(latestWithTimestamp);
    updateCharts(readings);
  });
}

function listenAlerts() {
  const q = query(
    collection(db, "alerts_log"),
    orderBy("timestamp", "desc"),
    limit(20)
  );

  onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    alertsTableBody.innerHTML = rows
      .map((row) => {
        const seconds = row.timestamp?.seconds;
        const time = seconds ? new Date(seconds * 1000).toLocaleString() : "--";
        const levelClass = row.alert_type === "BOTH" ? "alert-danger" : "alert-warning";
        return `
          <tr class="${levelClass}">
            <td>${time}</td>
            <td>${row.device_id || "--"}</td>
            <td>${row.gas_type || "--"}</td>
            <td>${row.ppm_value ?? "--"}</td>
            <td>${row.threshold_value ?? "--"}</td>
            <td>${row.alert_type || "--"}</td>
            <td>${row.status || "--"}</td>
          </tr>
        `;
      })
      .join("");
  });
}

function init() {
  setClock();
  setInterval(setClock, 1000);

  initCharts();
  listenSensorReadings();
  listenAlerts();

  fetchTodayStats();
  setInterval(fetchTodayStats, 60000);
}

init();
