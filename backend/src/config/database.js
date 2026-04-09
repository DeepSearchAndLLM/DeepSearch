const { Pool } = require("pg");

const { env } = require("./env");

const pool = new Pool({
  host: env.pgHost,
  port: env.pgPort,
  database: env.pgDatabase,
  user: env.pgUser,
  password: env.pgPassword,
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};
