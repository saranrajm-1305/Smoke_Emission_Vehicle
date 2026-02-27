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

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
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
  console.log(`Server running on http://localhost:${PORT}`);
});
