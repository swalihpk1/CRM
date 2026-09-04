const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_ALGORITHM } = require('../config/env');
const { collections } = require('../config/db');
const { ApiError } = require('./errorHandler');

/**
 * Replicates FastAPI's HTTPBearer() dependency behavior:
 *  - missing Authorization header -> 403 "Not authenticated"
 *  - header present but not a Bearer scheme -> 403 "Invalid authentication credentials"
 * (FastAPI's HTTPBearer uses 403, not 401, for both of these — a genuine
 * quirk of the framework, preserved here.)
 * Then decodes the JWT:
 *  - expired -> 401 "Token has expired"
 *  - otherwise invalid -> 401 "Invalid token"
 *  - user not found in DB -> 401 "User not found"
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers['authorization'];
    if (!header) {
      throw new ApiError(403, 'Not authenticated');
    }
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new ApiError(403, 'Invalid authentication credentials');
    }
    const token = parts[1];

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    } catch (err) {
      if (err && err.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Token has expired');
      }
      throw new ApiError(401, 'Invalid token');
    }

    const user = await collections.users().findOne(
      { id: payload.user_id },
      { projection: { _id: 0 } }
    );
    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!req.user || req.user.role !== 'admin') {
      return next(new ApiError(403, 'Admin access required'));
    }
    next();
  });
}

// Included for parity of module surface — matches Python's get_staff_or_admin
// dependency, which is defined but unused by any route in the source.
async function requireStaffOrAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!req.user || !['staff', 'admin'].includes(req.user.role)) {
      return next(new ApiError(403, 'Staff or admin access required'));
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin, requireStaffOrAdmin };
