const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { nowIso } = require('../utils/dates');
const { JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS } = require('../config/env');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// IANA special-use TLDs that Pydantic's EmailStr (via python-email-validator)
// rejects when they appear as the email domain's TLD — verified by diff-
// testing against the real Python backend: a@b.test / a@b.local /
// a@b.localhost / a@b.invalid / a@b.onion are REJECTED there, while
// a@example.com / a@test.com / a@b.example / a@b.internal are all OK
// (those aren't reserved TLDs, just ordinary or non-reserved domains).
const RESERVED_TLDS = new Set(['test', 'local', 'localhost', 'invalid', 'onion']);

function isValidEmail(email) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) return false;
  const domain = email.split('@')[1] || '';
  const labels = domain.split('.');
  if (labels.length < 2) return false; // requires a real multi-label domain
  const tld = labels[labels.length - 1].toLowerCase();
  return !RESERVED_TLDS.has(tld);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hashed) {
  return bcrypt.compareSync(password, hashed);
}

function createJwtToken(userId, email) {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    user_id: userId,
    email,
    exp: nowSec + JWT_EXPIRATION_HOURS * 60 * 60,
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM, noTimestamp: true });
}

// POST /api/auth/signup
router.post('/auth/signup', async (req, res, next) => {
  try {
    const { email, password, role } = req.body || {};

    if (!isValidEmail(email)) {
      throw new ApiError(422, [{ msg: 'value is not a valid email address', loc: ['body', 'email'] }]);
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new ApiError(422, [{ msg: 'field required', loc: ['body', 'password'] }]);
    }

    const userCount = await collections.users().countDocuments({});
    if (userCount > 0) {
      throw new ApiError(
        403,
        'Public signup is disabled. Please contact an administrator to create an account.'
      );
    }

    const existingUser = await collections.users().findOne({ email });
    if (existingUser) {
      throw new ApiError(400, 'Email already registered');
    }

    // First user is always admin — ignores `role` in the body.
    const user = {
      id: crypto.randomUUID(),
      email,
      role: 'admin',
      created_at: nowIso(),
    };
    const userDoc = { ...user, password: hashPassword(password) };
    await collections.users().insertOne(userDoc);

    const token = createJwtToken(user.id, user.email);

    res.json({
      message: 'User created successfully',
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!isValidEmail(email) || typeof password !== 'string') {
      throw new ApiError(401, 'Invalid credentials');
    }

    const user = await collections.users().findOne({ email }, { projection: { _id: 0 } });
    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }
    if (!verifyPassword(password, user.password)) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const token = createJwtToken(user.id, user.email);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, role: user.role || 'staff' },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role || 'staff' });
});

module.exports = { router, isValidEmail, hashPassword, verifyPassword, createJwtToken };
