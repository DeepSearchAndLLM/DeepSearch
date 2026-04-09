function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function badRequest(message) {
  return createHttpError(400, message);
}

function unauthorized(message) {
  return createHttpError(401, message);
}

function forbidden(message) {
  return createHttpError(403, message);
}

function notFound(message) {
  return createHttpError(404, message);
}

module.exports = {
  createHttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
};
