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
const EXPECTED_DEVICE_ID = "ESP_001";
const OFFLINE_SECONDS = 30;

const clockEl = document.getElementById("clock");
const deviceStatusPill = document.getElementById("deviceStatusPill");
const offlineBanner = document.getElementById("offlineBanner");
const coValueEl = document.getElementById("coValue");
const co2ValueEl = document.getElementById("co2Value");
const systemStatusEl = document.getElementById("systemStatus");
const alertsTableBody = document.getElementById("alertsTableBody");
const testAlertBtn = document.getElementById("testAlertBtn");
const testAlertState = document.getElementById("testAlertState");

let latestLiveReading = null;
let simulationTimer = null;
let countdownTimer = null;
let simulationActive = false;
let simulationCountdown = 0;

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
  const online = secondsAgo <= OFFLINE_SECONDS;

  deviceStatusPill.textContent = online ? "🟢 Online" : "🔴 Offline";
  deviceStatusPill.className = `status-pill ${online ? "online" : "offline"}`;
  offlineBanner.classList.toggle("hidden", online);
}

function clearOverviewNoLiveData() {
  coValueEl.textContent = "--";
  co2ValueEl.textContent = "--";

  coValueEl.className = "";
  co2ValueEl.className = "";
  updateStatusBadge("NORMAL");

  deviceStatusPill.textContent = "🔴 Offline";
  deviceStatusPill.className = "status-pill offline";
  offlineBanner.classList.remove("hidden");
}

function updateOverview(latest) {
  if (!latest) return;

  const co = Number(latest.co_ppm || 0);
  const co2 = Number(latest.co2_ppm || 0);

  coValueEl.textContent = co.toFixed(2);
  co2ValueEl.textContent = co2.toFixed(2);

  coValueEl.className = getLevelClass(co, 35, 70);
  co2ValueEl.className = getLevelClass(co2, 1000, 2000);
  updateStatusBadge(latest.status || "NORMAL");
  updateOfflineState(latest.timestamp);
}

function applySimulatedDanger() {
  updateOverview({
    co_ppm: 120,
    co2_ppm: 2600,
    temperature: 35,
    status: "DANGER",
    timestamp: { seconds: Math.floor(Date.now() / 1000) },
  });
}

function updateCountdownDisplay() {
  if (simulationCountdown > 0) {
    testAlertState.textContent = `Simulating ${simulationCountdown}s`;
  }
}

function endSimulationAndRestoreLive() {
  simulationActive = false;
  if (simulationTimer) {
    clearTimeout(simulationTimer);
    simulationTimer = null;
  }
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  simulationCountdown = 0;

  // Always restore to either live data or offline state
  if (latestLiveReading) {
    updateOverview(latestLiveReading);
  } else {
    clearOverviewNoLiveData();
  }

  testAlertBtn.disabled = false;
  testAlertState.textContent = "Idle";
  testAlertState.className = "test-alert-state";
}

async function triggerTestAlert() {
  if (simulationActive) return;

  simulationActive = true;
  testAlertBtn.disabled = true;
  simulationCountdown = 20;
  testAlertState.textContent = "Simulating 20s";
  testAlertState.className = "test-alert-state active";

  try {
    const response = await fetch(`${API_BASE}/alerts/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify({ device_id: "dashboard_test_button" }),
    });

    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || "Unable to trigger test alert");
    }

    applySimulatedDanger();
    
    // Start countdown timer
    countdownTimer = setInterval(() => {
      simulationCountdown--;
      updateCountdownDisplay();
      
      if (simulationCountdown <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1000);

    simulationTimer = setTimeout(() => {
      endSimulationAndRestoreLive();
    }, 20000);
  } catch (error) {
    console.error("Test alert failed", error);
    simulationActive = false;
    testAlertBtn.disabled = false;
    simulationCountdown = 0;
    testAlertState.textContent = "Failed";
    testAlertState.className = "test-alert-state failed";
    setTimeout(() => {
      testAlertState.textContent = "Idle";
      testAlertState.className = "test-alert-state";
    }, 3500);
  }
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
    const allReadings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const readings = allReadings.filter((reading) => reading.device_id === EXPECTED_DEVICE_ID);

    if (!readings.length) {
      latestLiveReading = null;
      if (!simulationActive) {
        clearOverviewNoLiveData();
      }
      updateCharts([]);
      return;
    }

    const latestWithTimestamp = readings.find((reading) => reading.timestamp?.seconds) || readings[0];
    const readingSeconds = latestWithTimestamp.timestamp?.seconds || 0;
    const isFresh = readingSeconds > 0 && (Date.now() - readingSeconds * 1000) / 1000 <= OFFLINE_SECONDS;

    latestLiveReading = isFresh ? latestWithTimestamp : null;
    if (!simulationActive) {
      if (isFresh) {
        updateOverview(latestWithTimestamp);
      } else {
        clearOverviewNoLiveData();
      }
    }
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

  if (testAlertBtn) {
    testAlertBtn.addEventListener("click", triggerTestAlert);
  }
}

init();
