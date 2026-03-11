const express = require("express");
const {
  postSensorData,
  getLatestSensorData,
  getSensorDataHistory,
  getAlertsHistory,
  getTodayStats,
  triggerTestAlert,
} = require("../controllers/sensorController");

const router = express.Router();

router.post("/sensor-data", postSensorData);
router.get("/sensor-data/latest", getLatestSensorData);
router.get("/sensor-data/history", getSensorDataHistory);
router.get("/alerts/history", getAlertsHistory);
router.post("/alerts/test", triggerTestAlert);
router.get("/stats/today", getTodayStats);

module.exports = router;
