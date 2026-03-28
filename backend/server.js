require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");

const sensorRoutes = require("./routes/sensorRoutes");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON payload" });
  }
  return next(err);
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for test alert endpoint
    return req.path === "/api/alerts/test" && req.method === "POST";
  },
});

app.use("/api", limiter);
app.use("/api", (req, res, next) => {
  const key = req.header("X-API-KEY");
  if (!key || key !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ success: false, message: "Invalid API key" });
  }
  return next();
});

app.use("/api", sensorRoutes);
app.use("/frontend", express.static(path.join(__dirname, "..", "esp8266", "frontend")));

app.get("/", (req, res) => {
  return res.redirect("/frontend/index.html");
});

app.listen(PORT, () => {
  console.log(`✓ Server listening on port ${PORT}`);
  console.log(`✓ API endpoints available at http://localhost:${PORT}/api`);
  console.log(`✓ Dashboard available at http://localhost:${PORT}/`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
