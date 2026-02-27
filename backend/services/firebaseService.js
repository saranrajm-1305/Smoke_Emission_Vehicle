const { admin, db } = require("../config/firebaseAdmin");
const { fallbackThresholds } = require("../config/thresholds");

async function saveSensorReading(data) {
  const payload = {
    device_id: data.device_id,
    co_ppm: Number(data.co_ppm),
    co2_ppm: Number(data.co2_ppm),
    temperature: Number(data.temperature),
    status: data.status,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("sensor_readings").add(payload);
  return { id: docRef.id, ...payload };
}

async function getLatestReadings(n = 1) {
  const limitCount = Number.isFinite(Number(n)) ? Number(n) : 1;
  const snapshot = await db
    .collection("sensor_readings")
    .orderBy("timestamp", "desc")
    .limit(limitCount)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function saveAlertLog(alertData) {
  const payload = {
    ...alertData,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection("alerts_log").add(payload);
  return { id: docRef.id, ...payload };
}

async function getThresholds() {
  try {
    const [coDoc, co2Doc] = await Promise.all([
      db.collection("threshold_config").doc("CO").get(),
      db.collection("threshold_config").doc("CO2").get(),
    ]);

    if (!coDoc.exists || !co2Doc.exists) {
      return fallbackThresholds;
    }

    return {
      CO: {
        warning_level:
          Number(coDoc.data().warning_level) || fallbackThresholds.CO.warning_level,
        danger_level:
          Number(coDoc.data().danger_level) || fallbackThresholds.CO.danger_level,
      },
      CO2: {
        warning_level:
          Number(co2Doc.data().warning_level) || fallbackThresholds.CO2.warning_level,
        danger_level:
          Number(co2Doc.data().danger_level) || fallbackThresholds.CO2.danger_level,
      },
    };
  } catch (error) {
    return fallbackThresholds;
  }
}

async function isInCooldown(device_id, minutes = 5) {
  const safeMinutes = Number(minutes) > 0 ? Number(minutes) : 5;
  const thresholdDate = new Date(Date.now() - safeMinutes * 60 * 1000);

  const snapshot = await db
    .collection("alerts_log")
    .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(thresholdDate))
    .orderBy("timestamp", "desc")
    .limit(50)
    .get();

  if (snapshot.empty) {
    return false;
  }

  return snapshot.docs.some((doc) => doc.data().device_id === device_id);
}

module.exports = {
  saveSensorReading,
  getLatestReadings,
  saveAlertLog,
  getThresholds,
  isInCooldown,
};
