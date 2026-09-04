const express = require('express');
const { collections } = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { parseIsoStrict } = require('../utils/dates');

const router = express.Router();

// GET /api/productivity/staff-summary — admin only
router.get('/productivity/staff-summary', requireAdmin, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const start = parseIsoStrict(start_date);
    const end = parseIsoStrict(end_date);
    if (!start || !end) throw new ApiError(400, 'Invalid date format');

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const users = await collections.users().find({}, { projection: { _id: 0 } }).toArray();

    const results = [];
    for (const user of users) {
      const userId = user.id;
      const userEmail = user.email;
      const userName = userEmail.split('@')[0];

      const followupsCreated = await collections.followups().countDocuments({
        user_id: userId,
        created_at: { $gte: startIso, $lte: endIso },
      });

      const followupsCompleted = await collections.followups().countDocuments({
        user_id: userId,
        status: 'completed',
        created_at: { $gte: startIso, $lte: endIso },
      });

      const demosGiven = await collections.demos().countDocuments({
        user_id: userId,
        given_at: { $gte: startIso, $lte: endIso },
      });

      const demosWatched = await collections.demos().countDocuments({
        user_id: userId,
        watched: true,
        given_at: { $gte: startIso, $lte: endIso },
      });

      const meetingsCreated = await collections.meetings().countDocuments({
        user_id: userId,
        created_at: { $gte: startIso, $lte: endIso },
      });

      const freshCalls = await collections.activityLogs().countDocuments({
        user_id: userId,
        action: 'Updated contact',
        details: { $regex: 'assigned_staff', $options: 'i' },
        timestamp: { $gte: startIso, $lte: endIso },
      });

      results.push({
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        role: user.role || 'staff',
        followups_created: followupsCreated,
        followups_completed: followupsCompleted,
        demos_given: demosGiven,
        demos_watched: demosWatched,
        meetings_created: meetingsCreated,
        fresh_calls: freshCalls,
      });
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/productivity/staff-details — admin only
router.get('/productivity/staff-details', requireAdmin, async (req, res, next) => {
  try {
    const { user_id, metric_type, start_date, end_date } = req.query;
    const start = parseIsoStrict(start_date);
    const end = parseIsoStrict(end_date);
    if (!start || !end) throw new ApiError(400, 'Invalid date format');

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    if (metric_type === 'followups') {
      const followups = await collections.followups().find(
        { user_id, created_at: { $gte: startIso, $lte: endIso } },
        { projection: { _id: 0 } }
      ).sort({ created_at: -1 }).toArray();

      for (const followup of followups) {
        followup.contact = await collections.contacts().findOne(
          { id: followup.contact_id },
          { projection: { _id: 0 } }
        );
      }

      return res.json({ type: 'followups', data: followups });
    }

    if (metric_type === 'demos') {
      const demos = await collections.demos().find(
        { user_id, given_at: { $gte: startIso, $lte: endIso } },
        { projection: { _id: 0 } }
      ).sort({ given_at: -1 }).toArray();

      for (const demo of demos) {
        demo.contact = await collections.contacts().findOne(
          { id: demo.contact_id },
          { projection: { _id: 0 } }
        );
      }

      return res.json({ type: 'demos', data: demos });
    }

    if (metric_type === 'meetings') {
      const meetings = await collections.meetings().find(
        { user_id, created_at: { $gte: startIso, $lte: endIso } },
        { projection: { _id: 0 } }
      ).sort({ created_at: -1 }).toArray();

      return res.json({ type: 'meetings', data: meetings });
    }

    if (metric_type === 'calls') {
      const logs = await collections.activityLogs().find(
        {
          user_id,
          action: 'Updated contact',
          details: { $regex: 'assigned_staff', $options: 'i' },
          timestamp: { $gte: startIso, $lte: endIso },
        },
        { projection: { _id: 0 } }
      ).sort({ timestamp: -1 }).toArray();

      for (const log of logs) {
        const contact = await collections.contacts().findOne(
          { phone: log.target },
          { projection: { _id: 0 } }
        );
        if (contact) {
          log.contact = {
            phone: contact.phone,
            customer_name: contact.customer_name,
            status: contact.status,
            data: contact.data || {},
          };
        }
      }

      return res.json({ type: 'calls', data: logs });
    }

    throw new ApiError(400, 'Invalid metric type');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
