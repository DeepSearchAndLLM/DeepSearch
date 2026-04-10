const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query } = require("../config/database");
const { env } = require("../config/env");
const { badRequest, unauthorized } = require("../utils/http-errors");

function mapPublicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    team: row.team_id
      ? {
          id: row.team_id,
          name: row.team_name,
        }
      : null,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

async function findUserByEmail(email) {
  const result = await query(
    `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.password_hash,
        u.role,
        u.team_id,
        u.is_active,
        u.created_at,
        t.name AS team_name
      FROM users u
      LEFT JOIN teams t
        ON t.id = u.team_id
      WHERE u.email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await query(
    `
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.team_id,
        u.is_active,
        u.created_at,
        t.name AS team_name
      FROM users u
      LEFT JOIN teams t
        ON t.id = u.team_id
      WHERE u.id = $1
      LIMIT 1
    `,
    [id]
  );

  return mapPublicUser(result.rows[0] || null);
}

async function loginUser({ email, password }) {
  if (!email || !password) {
    throw badRequest("Email and password are required");
  }

  const user = await findUserByEmail(email);

  if (!user || !user.is_active) {
    throw unauthorized("Email or password is incorrect");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw unauthorized("Email or password is incorrect");
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: user.team_id,
    },
    env.jwtSecret,
    {
      expiresIn: env.tokenExpiresIn,
    }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      team: user.team_id
        ? {
            id: user.team_id,
            name: user.team_name,
          }
        : null,
      isActive: user.is_active,
      createdAt: user.created_at,
    },
  };
}

module.exports = {
  loginUser,
  findUserByEmail,
  findUserById,
};
