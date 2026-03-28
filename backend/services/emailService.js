const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 5000,
  socketTimeout: 5000,
});

function buildEmailHtml(level, data, thresholds) {
  const isDanger = level === "DANGER";
  const color = isDanger ? "#e53935" : "#fb8c00";
  const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000/frontend/dashboard.html";
  const timestamp = new Date().toLocaleString();

  return `
    <div style="font-family: Arial, sans-serif; background:#121212; color:#f1f1f1; padding:24px;">
      <div style="background:${color}; color:#fff; padding:14px 18px; border-radius:8px 8px 0 0; font-size:18px; font-weight:bold;">
        ${isDanger ? "🚨 [DANGER]" : "⚠️ [WARNING]"} Vehicle Emission Alert
      </div>
      <div style="background:#1f1f1f; border-radius:0 0 8px 8px; padding:18px;">
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          <tr><td style="padding:8px; border-bottom:1px solid #333;">Device ID</td><td style="padding:8px; border-bottom:1px solid #333;">${data.device_id}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #333;">CO (PPM)</td><td style="padding:8px; border-bottom:1px solid #333;">${Number(data.co_ppm).toFixed(2)}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #333;">CO2 (PPM)</td><td style="padding:8px; border-bottom:1px solid #333;">${Number(data.co2_ppm).toFixed(2)}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #333;">Temperature (°C)</td><td style="padding:8px; border-bottom:1px solid #333;">${Number(data.temperature).toFixed(1)}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #333;">Status</td><td style="padding:8px; border-bottom:1px solid #333;">${data.status}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #333;">Timestamp</td><td style="padding:8px; border-bottom:1px solid #333;">${timestamp}</td></tr>
          <tr><td style="padding:8px; border-bottom:1px solid #333;">Thresholds</td><td style="padding:8px; border-bottom:1px solid #333;">CO: ${thresholds.CO.warning_level}/${thresholds.CO.danger_level}, CO2: ${thresholds.CO2.warning_level}/${thresholds.CO2.danger_level}</td></tr>
        </table>
        <a href="${dashboardUrl}" style="display:inline-block; background:#00bcd4; color:#fff; text-decoration:none; padding:10px 16px; border-radius:6px;">Open Dashboard</a>
        <p style="margin-top:16px; color:#bdbdbd; font-size:12px;">This is an automated alert from Vehicle Emission Detection System.</p>
      </div>
    </div>
  `;
}

async function sendEmailAlert(level, data, thresholds) {
  const subject = `${level === "DANGER" ? "🚨 [DANGER]" : "⚠️ [WARNING]"} Vehicle Emission Alert — Device ${data.device_id}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: process.env.ALERT_RECIPIENT,
    subject,
    html: buildEmailHtml(level, data, thresholds),
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  sendEmailAlert,
};
