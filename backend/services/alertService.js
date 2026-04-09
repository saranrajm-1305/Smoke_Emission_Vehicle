const {
  getThresholds,
  isInCooldown,
  saveAlertLog,
} = require("./firebaseService");
const { sendEmailAlert } = require("./emailService");
const { makeAlertCall } = require("./twilioService");

function getGasType(data, thresholds) {
  const coDanger = Number(data.co_ppm) >= thresholds.CO.danger_level;
  const co2Danger = Number(data.co2_ppm) >= thresholds.CO2.danger_level;
  const coWarn = Number(data.co_ppm) >= thresholds.CO.warning_level;
  const co2Warn = Number(data.co2_ppm) >= thresholds.CO2.warning_level;

  if (coDanger || coWarn) return "CO";
  if (co2Danger || co2Warn) return "CO2";
  return "NONE";
}

function getPpmValue(data, gasType) {
  if (gasType === "CO") return Number(data.co_ppm);
  if (gasType === "CO2") return Number(data.co2_ppm);
  return 0;
}

function getThresholdValue(thresholds, gasType, level) {
  if (gasType === "CO") return level === "DANGER" ? thresholds.CO.danger_level : thresholds.CO.warning_level;
  if (gasType === "CO2") return level === "DANGER" ? thresholds.CO2.danger_level : thresholds.CO2.warning_level;
  return 0;
}

async function checkAndAlert(data, options = {}) {
  const bypassCooldown = Boolean(options.bypassCooldown);
  const thresholds = await getThresholds();
  const cooldownMinutes = Number(process.env.ALERT_COOLDOWN_MINUTES || 5);
  const cooldownActive = bypassCooldown
    ? false
    : await isInCooldown(data.device_id, cooldownMinutes);

  if (cooldownActive) {
    return { alerted: false, reason: "cooldown" };
  }

  const isDanger =
    Number(data.co_ppm) >= thresholds.CO.danger_level ||
    Number(data.co2_ppm) >= thresholds.CO2.danger_level;

  const isWarning =
    Number(data.co_ppm) >= thresholds.CO.warning_level ||
    Number(data.co2_ppm) >= thresholds.CO2.warning_level;

  if (!isDanger && !isWarning) {
    return { alerted: false, reason: "normal" };
  }

  const level = isDanger ? "DANGER" : "WARNING";
  const gasType = getGasType(data, thresholds);
  const ppmValue = getPpmValue(data, gasType);
  const thresholdValue = getThresholdValue(thresholds, gasType, level);

  // Send email and SMS in background (don't wait for them) by default.
  // For test alerts, we can wait and propagate errors.
  const emailPromise = sendEmailAlert(level, data, thresholds);
  if (options.awaitEmail) {
    await emailPromise;
  } else {
    emailPromise.catch(error => {
      console.error("Email alert failed:", error.message);
    });
  }

  if (isDanger) {
    makeAlertCall(data.co_ppm, data.co2_ppm).catch(error => {
      console.error("SMS alert failed:", error.message);
    });
  }

  // Save alert log asynchronously
  saveAlertLog({
    device_id: data.device_id,
    alert_type: isDanger ? "BOTH" : "EMAIL",
    gas_type: gasType,
    ppm_value: ppmValue,
    threshold_value: thresholdValue,
    status: "SENT",
  }).catch(error => {
    console.error("Failed to save alert log:", error.message);
  });

  return { alerted: true, level, alertType: isDanger ? "BOTH" : "EMAIL" };
}

module.exports = {
  checkAndAlert,
};
