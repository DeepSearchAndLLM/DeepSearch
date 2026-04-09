const jwt = require("jsonwebtoken");

const { env } = require("../config/env");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authorization token is missing",
    });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    next();
  } catch (_error) {
    return res.status(401).json({
      message: "Authorization token is invalid",
    });
  }
}

module.exports = {
  authenticate,
};
