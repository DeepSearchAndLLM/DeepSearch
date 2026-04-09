const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const env = {
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "SuperSuperSecret",
  tokenExpiresIn: process.env.TOKEN_EXPIRES_IN || "12h",
  pgHost: process.env.PGHOST || "localhost",
  pgPort: Number(process.env.PGPORT || 5432),
  pgDatabase: process.env.PGDATABASE || "DeepSearch",
  pgUser: process.env.PGUSER || "postgres",
  pgPassword: process.env.PGPASSWORD || "postgres",
  pythonApiUrl: process.env.PYTHON_API_URL || "http://localhost:8000",
  documentsDir:
    process.env.DOCUMENTS_DIR ||
    path.resolve(__dirname, "../../../data/documents"),
};

module.exports = {
  env,
};
