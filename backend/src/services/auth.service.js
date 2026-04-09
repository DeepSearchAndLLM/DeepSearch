const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query } = require("../config/database");
const { env } = require("../config/env");
const { badRequest, unauthorized } = require("../utils/http-errors");

async function findUserByEmail(email) {
  const result = await query(
    `
      SELECT id, email, full_name, password_hash, role, is_active, created_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await query(
    `
      SELECT id, email, full_name, role, is_active, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
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
