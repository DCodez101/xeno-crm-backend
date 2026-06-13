require("dotenv").config();
const express = require("express");
const cors = require("cors");

const sendRoute = require("./routes/send");
const healthRoute = require("./routes/health");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/send", sendRoute);
app.use("/health", healthRoute);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[channel-service] Running on port ${PORT}`);
  console.log(`[channel-service] Callbacks → ${process.env.CRM_RECEIPT_URL || "http://localhost:5000/api/receipts"}`);
});
