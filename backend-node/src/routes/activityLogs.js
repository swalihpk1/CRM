const express = require('express');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { pickActivityLog } = require('../utils/serialize');

const router = express.Router();

// GET /api/activity-logs
router.get('/activity-logs', requireAuth, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 100;

    const query = {};
    if (req.user.role !== 'admin') query.user_id = req.user.id;

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
