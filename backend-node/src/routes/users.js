const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activity');
const { nowIso } = require('../utils/dates');
const { isValidEmail, hashPassword } = require('./auth');

const router = express.Router();

// GET /api/users — admin only
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const users = await collections.users()
      .find({}, { projection: { _id: 0, password: 0 } })
      .toArray();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/users — admin only
router.post('/users', requireAdmin, async (req, res, next) => {
  try {
    const { email, password, role: bodyRole } = req.body || {};
    const role = bodyRole || 'staff';

    if (!isValidEmail(email)) {
      throw new ApiError(422, [{ msg: 'value is not a valid email address', loc: ['body', 'email'] }]);
    }

    const existingUser = await collections.users().findOne({ email });
    if (existingUser) {
      throw new ApiError(400, 'Email already registered');
    }

    if (!['staff', 'admin'].includes(role)) {
      throw new ApiError(400, "Invalid role. Must be 'staff' or 'admin'");
    }

    const user = {
      id: crypto.randomUUID(),
      email,
      role,
      created_at: nowIso(),
    };
    const userDoc = { ...user, password: hashPassword(password) };
    await collections.users().insertOne(userDoc);

    await logActivity(
      req.user.id,
      req.user.email,
      'Created user',
      user.email,
      `Role: ${user.role}`
    );

    res.json({
      message: 'User created successfully',
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:user_id — admin only. Backend-node-only addition, not in
// the Python source (see backend-node/CLAUDE.md exception). Edits a
// user's role via the generic Edit User form/modal (kept as a separate
// route from PUT /users/:user_id/role for the newer modal to call).
// Reuses the same "cannot demote yourself" guard as that route.
router.put('/users/:user_id', requireAdmin, async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { role, email } = req.body || {};

    const user = await collections.users().findOne({ id: user_id }, { projection: { _id: 0 } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const updateData = {};
    if (email !== undefined && email !== user.email) {
      if (!isValidEmail(email)) {
        throw new ApiError(422, [{ msg: 'value is not a valid email address', loc: ['body', 'email'] }]);
      }
      const existingUser = await collections.users().findOne({ email });
      if (existingUser) {
        throw new ApiError(400, 'Email already registered');
      }
      updateData.email = email;
    }
    if (role !== undefined) {
      if (!['staff', 'admin'].includes(role)) {
        throw new ApiError(400, "Invalid role. Must be 'staff' or 'admin'");
      }
      if (user_id === req.user.id && role !== 'admin') {
        throw new ApiError(400, 'Cannot demote yourself');
      }
      updateData.role = role;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No update data provided');
    }

    await collections.users().updateOne({ id: user_id }, { $set: updateData });

    const details = Object.entries(updateData)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    await logActivity(req.user.id, req.user.email, 'Updated user', user.email, details);

    const updatedUser = await collections.users().findOne(
      { id: user_id },
      { projection: { _id: 0, password: 0 } }
    );
    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:user_id/reset-password — admin only. Backend-node-only
// addition, not in the Python source (see backend-node/CLAUDE.md
// exception). The admin sets a new password directly (no email/reset-link
// flow) — the simplest option for an admin-only user management screen
// with no SMTP dependency.
router.put('/users/:user_id/reset-password', requireAdmin, async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { password } = req.body || {};

    if (!password || typeof password !== 'string' || password.length < 1) {
      throw new ApiError(400, 'Password is required');
    }

    const user = await collections.users().findOne({ id: user_id }, { projection: { _id: 0 } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    await collections.users().updateOne(
      { id: user_id },
      { $set: { password: hashPassword(password) } }
    );

    await logActivity(req.user.id, req.user.email, 'Reset user password', user.email);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:user_id/role — admin only
router.put('/users/:user_id/role', requireAdmin, async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { role } = req.body || {};

    if (!['staff', 'admin'].includes(role)) {
      throw new ApiError(400, "Invalid role. Must be 'staff' or 'admin'");
    }

    const user = await collections.users().findOne({ id: user_id }, { projection: { _id: 0 } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user_id === req.user.id && role !== 'admin') {
      throw new ApiError(400, 'Cannot demote yourself');
    }

    await collections.users().updateOne({ id: user_id }, { $set: { role } });

    await logActivity(
      req.user.id,
      req.user.email,
      'Updated user role',
      user.email,
      `From ${user.role || 'staff'} to ${role}`
    );

    res.json({ message: 'User role updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:user_id — admin only
router.delete('/users/:user_id', requireAdmin, async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const user = await collections.users().findOne({ id: user_id }, { projection: { _id: 0 } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user_id === req.user.id) {
      throw new ApiError(400, 'Cannot delete yourself');
    }

    await collections.users().deleteOne({ id: user_id });

    await logActivity(
      req.user.id,
      req.user.email,
      'Deleted user',
      user.email,
      `Role: ${user.role || 'staff'}`
    );

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
