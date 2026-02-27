const { admin, db } = require("../config/firebaseAdmin");
const {
  saveSensorReading,
  getLatestReadings,
} = require("../services/firebaseService");
const { checkAndAlert } = require("../services/alertService");

function computeStatus(coPpm, co2Ppm) {
  if (coPpm >= 70 || co2Ppm >= 2000) return "DANGER";
  if ((coPpm >= 35 && coPpm <= 69) || (co2Ppm >= 1000 && co2Ppm <= 1999)) return "WARNING";
  return "NORMAL";
}

function validatePayload(body) {
  const required = ["device_id", "co_ppm", "co2_ppm", "temperature"];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `${field} is required`;
    }
  }

  if (typeof body.device_id !== "string") {
    return "device_id must be a string";
  }

  const numericFields = ["co_ppm", "co2_ppm", "temperature"];
  for (const field of numericFields) {
    if (Number.isNaN(Number(body[field]))) {
      return `${field} must be numeric`;
    }
  }

  return null;
}

async function postSensorData(req, res) {
  try {
    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const coPpm = Number(req.body.co_ppm);
    const co2Ppm = Number(req.body.co2_ppm);

    const status = computeStatus(coPpm, co2Ppm);

    const data = {
      device_id: req.body.device_id,
      co_ppm: coPpm,
      co2_ppm: co2Ppm,
      temperature: Number(req.body.temperature),
      status,
    };

    await saveSensorReading(data);
    await checkAndAlert(data);

    return res.status(201).json({ success: true, status });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getLatestSensorData(req, res) {
  try {
    const readings = await getLatestReadings(1);
    if (!readings.length) {
      return res.status(404).json({ success: false, message: "No data found" });
    }
    return res.json({ success: true, data: readings[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getSensorDataHistory(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 500);
    const readings = await getLatestReadings(limit);
    return res.json({ success: true, count: readings.length, data: readings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getAlertsHistory(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 500);

    const snapshot = await db
      .collection("alerts_log")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const alerts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getTodayStats(req, res) {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const readingsSnapshot = await db
      .collection("sensor_readings")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .get();

    const alertsSnapshot = await db
      .collection("alerts_log")
      .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
      .get();

    const readings = readingsSnapshot.docs.map((doc) => doc.data());

    if (!readings.length) {
      return res.json({
        success: true,
        data: {
          avg_co: 0,
          avg_co2: 0,
          max_co: 0,
          max_co2: 0,
          total_readings: 0,
          total_alerts: alertsSnapshot.size,
        },
      });
    }

    const coValues = readings.map((r) => Number(r.co_ppm));
    const co2Values = readings.map((r) => Number(r.co2_ppm));

    const avgCo = coValues.reduce((acc, val) => acc + val, 0) / coValues.length;
    const avgCo2 = co2Values.reduce((acc, val) => acc + val, 0) / co2Values.length;

    return res.json({
      success: true,
      data: {
        avg_co: Number(avgCo.toFixed(2)),
        avg_co2: Number(avgCo2.toFixed(2)),
        max_co: Number(Math.max(...coValues).toFixed(2)),
        max_co2: Number(Math.max(...co2Values).toFixed(2)),
        total_readings: readings.length,
        total_alerts: alertsSnapshot.size,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  postSensorData,
  getLatestSensorData,
  getSensorDataHistory,
  getAlertsHistory,
  getTodayStats,
};
