const crypto = require('crypto');
const { collections } = require('../config/db');
const { nowIso } = require('./dates');

/**
 * Inserts an ActivityLog document. Field is `timestamp`, not `created_at`
 * (verified from the Python ActivityLog model).
 */
async function logActivity(userId, userEmail, action, target = null, details = null) {
  const log = {
    id: crypto.randomUUID(),
    user_id: userId,
    user_email: userEmail,
    action,
    target: target ?? null,
    details: details ?? null,
    timestamp: nowIso(),
  };
  await collections.activityLogs().insertOne(log);
  return log;
}

module.exports = { logActivity };
