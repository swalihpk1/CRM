const crypto = require('crypto');
const { collections } = require('../config/db');
const { nowIso } = require('./dates');

/**
 * Inserts an ActivityLog document. Field is `timestamp`, not `created_at`
 * (verified from the Python ActivityLog model).
 *
 * `shopName` is a backend-node-only addition, not in the Python source
 * (see backend-node/CLAUDE.md exception) — the shop name is resolved and
 * embedded at write time, wherever the caller already has the contact in
 * hand, instead of leaving the Activity Log page to guess it later from a
 * capped, partial contacts list. Pass null/omit when there's no relevant
 * contact (e.g. user-management actions).
 */
async function logActivity(userId, userEmail, action, target = null, details = null, shopName = null) {
  const log = {
    id: crypto.randomUUID(),
    user_id: userId,
    user_email: userEmail,
    action,
    target: target ?? null,
    details: details ?? null,
    shop_name: shopName ?? null,
    timestamp: nowIso(),
  };
  await collections.activityLogs().insertOne(log);
  return log;
}

module.exports = { logActivity };
