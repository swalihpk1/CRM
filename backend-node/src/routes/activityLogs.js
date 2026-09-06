const express = require('express');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { pickActivityLog } = require('../utils/serialize');
const { dayStart, dayEnd } = require('../utils/dates');

const router = express.Router();

// GET /api/activity-logs
router.get('/activity-logs', requireAuth, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 100;

    const query = {};
    if (req.user.role !== 'admin') query.user_id = req.user.id;

    // target is a backend-node-only addition, not in the Python source
    // (see backend-node/CLAUDE.md exception) — lets a caller scope the
    // log to one contact by phone number, since `target` is consistently
    // set to the contact's phone across contacts/notes/followups logging.
    // Used by ContactDetailModal's "Activity" section.
    if (req.query.target) query.target = req.query.target;

    // from_date/to_date are a backend-node-only addition, not in the
    // Python source (see backend-node/CLAUDE.md exception) — lets the
    // Activity Log page filter to a specific date or range. Uses
    // dayStart/dayEnd (not new Date().toISOString()) so the generated
    // bounds match the +00:00-suffixed, microsecond-precision format the
    // timestamp field is actually stored in — a plain ISO string would
    // silently miss rows near the boundary (see the timestamp-format note
    // in backend-node/CLAUDE.md).
    const fromDate = req.query.from_date || null;
    const toDate = req.query.to_date || null;
    if (fromDate || toDate) {
      const start = fromDate ? dayStart(new Date(fromDate)) : null;
      const end = toDate ? dayEnd(new Date(toDate)) : null;
      query.timestamp = {};
      if (start) query.timestamp.$gte = start;
      if (end) query.timestamp.$lte = end;
    }

    const logs = await collections.activityLogs()
      .find(query, { projection: { _id: 0 } })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    res.json(logs.map(pickActivityLog));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
