const logger = require('../utils/logger');

/**
 * Mirrors FastAPI's HTTPException(status_code, detail) — every error
 * response body must be exactly {"detail": "..."} since the frontend reads
 * err.response?.data?.detail throughout (including string-matching on
 * specific messages, e.g. detail?.includes('already exists')).
 */
class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({ detail: 'Not Found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ detail: err.detail });
  }
  logger.error(`Unhandled error: ${err && err.stack ? err.stack : err}`);
  return res.status(500).json({ detail: 'Internal Server Error' });
}

module.exports = { ApiError, notFoundHandler, errorHandler };
