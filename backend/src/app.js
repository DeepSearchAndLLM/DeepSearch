const cors = require("cors");
const express = require("express");

const { env } = require("./config/env");
const apiRoutes = require("./routes");

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "deepsearch-backend",
  });
});

app.use("/api", apiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

module.exports = app;
