const fallbackThresholds = {
  CO: {
    warning_level: Number(process.env.CO_WARNING_PPM || 35),
    danger_level: Number(process.env.CO_DANGER_PPM || 70),
  },
  CO2: {
    warning_level: Number(process.env.CO2_WARNING_PPM || 1000),
    danger_level: Number(process.env.CO2_DANGER_PPM || 2000),
  },
};

module.exports = {
  fallbackThresholds,
};
