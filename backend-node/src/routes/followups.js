const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activity');
const { nowIso, buildDateRange } = require('../utils/dates');
const { pickFollowUp } = require('../utils/serialize');

const router = express.Router();

// POST /api/followups
router.post('/followups', requireAuth, async (req, res, next) => {
  try {
    const { contact_id, follow_up_date, notes } = req.body || {};

    const followup = {
      id: crypto.randomUUID(),
      contact_id,
      user_id: req.user.id,
      user_email: req.user.email,
      follow_up_date,
      notes: notes ?? null,
      status: 'pending',
      created_at: nowIso(),
      notified: false,
    };
    await collections.followups().insertOne(followup);

    const contact = await collections.contacts().findOne({ id: contact_id }, { projection: { _id: 0 } });
    await logActivity(
      req.user.id,
      req.user.email,
      'Created follow-up',
      contact ? contact.phone : contact_id,
      `Scheduled for ${follow_up_date}`
    );

    res.json(pickFollowUp(followup));
  } catch (err) {
    next(err);
  }
});

// GET /api/followups
router.get('/followups', requireAuth, async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role !== 'admin') query.user_id = req.user.id;
    if (req.query.status) query.status = req.query.status;

    const followups = await collections.followups()
      .find(query, { projection: { _id: 0 } })
      .sort({ follow_up_date: 1 })
      .toArray();
    res.json(followups.map(pickFollowUp));
  } catch (err) {
    next(err);
  }
});

// GET /api/followups/upcoming
// NOTE: no response_model in Python -> raw docs pass through, embedding
// `contact` (possibly null) on every item, unlike /by-date which drops them.
router.get('/followups/upcoming', requireAuth, async (req, res, next) => {
  try {
    const now = nowIso();
    const query = { status: { $in: ['pending', 'overdue'] } };
    if (req.user.role !== 'admin') query.user_id = req.user.id;

    const followups = await collections.followups()
      .find(query, { projection: { _id: 0 } })
      .sort({ follow_up_date: 1 })
      .toArray();

    const upcoming = [];
    const overdue = [];

    for (const followup of followups) {
      const contact = await collections.contacts().findOne(
        { id: followup.contact_id },
        { projection: { _id: 0 } }
      );
      if (contact) followup.contact = contact;

      if (followup.follow_up_date < now) {
        if (followup.status !== 'overdue') {
          followup.status = 'overdue';
          await collections.followups().updateOne({ id: followup.id }, { $set: { status: 'overdue' } });
        }
        overdue.push(followup);
      } else {
        upcoming.push(followup);
      }
    }

    res.json({ overdue, upcoming: upcoming.slice(0, 20) });
  } catch (err) {
    next(err);
  }
});

// GET /api/followups/by-date
router.get('/followups/by-date', requireAuth, async (req, res, next) => {
  try {
    const dateFilter = req.query.date_filter;
    if (!dateFilter) throw new ApiError(422, [{ msg: 'field required', loc: ['query', 'date_filter'] }]);

    const query = { status: { $in: ['pending', 'overdue'] } };
    if (req.user.role !== 'admin') query.user_id = req.user.id;

    const { start, end } = buildDateRange(dateFilter, null);
    if (start && end) {
      query.follow_up_date = { $gte: start, $lte: end };
    }

    const followups = await collections.followups()
      .find(query, { projection: { _id: 0 } })
      .sort({ follow_up_date: 1 })
      .toArray();

    const result = [];
    for (const followup of followups) {
      const contact = await collections.contacts().findOne(
        { id: followup.contact_id },
        { projection: { _id: 0 } }
      );
      if (contact) {
        followup.contact = contact;
        result.push(followup);
      }
    }

    res.json({ filter: dateFilter, count: result.length, followups: result });
  } catch (err) {
    next(err);
  }
});

// PUT /api/followups/:followup_id/complete
router.put('/followups/:followup_id/complete', requireAuth, async (req, res, next) => {
  try {
    const followupId = req.params.followup_id;
    const followup = await collections.followups().findOne({ id: followupId }, { projection: { _id: 0 } });
    if (!followup) throw new ApiError(404, 'Follow-up not found');

    const contact = await collections.contacts().findOne(
      { id: followup.contact_id },
      { projection: { _id: 0 } }
    );
    const target = contact ? contact.phone : followup.contact_id;

    await collections.followups().updateOne({ id: followupId }, { $set: { status: 'completed' } });

    await logActivity(req.user.id, req.user.email, 'Completed follow-up', target);

    res.json({ message: 'Follow-up marked as completed' });
  } catch (err) {
    next(err);
  }
});

// GET /api/followups/paginated
router.get('/followups/paginated', requireAuth, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 20;
    const dateFilter = req.query.date_filter || 'all';
    const customDate = req.query.custom_date || null;

    const query = { status: { $in: ['pending', 'overdue'] } };
    if (req.user.role !== 'admin') query.user_id = req.user.id;

    const { start, end } = buildDateRange(dateFilter, customDate);
    if (start && end) {
      query.follow_up_date = { $gte: start, $lte: end };
    }

    const followups = await collections.followups()
      .find(query, { projection: { _id: 0 } })
      .sort({ follow_up_date: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const now = nowIso();
    const result = [];
    for (const followup of followups) {
      if (followup.follow_up_date < now && followup.status !== 'overdue') {
        followup.status = 'overdue';
        await collections.followups().updateOne({ id: followup.id }, { $set: { status: 'overdue' } });
      }

      const contact = await collections.contacts().findOne(
        { id: followup.contact_id },
        { projection: { _id: 0 } }
      );
      if (contact) {
        followup.contact = contact;
        result.push(followup);
      }
    }

    res.json({ followups: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/followups/completed
router.get('/followups/completed', requireAuth, async (req, res, next) => {
  try {
    const dateFilter = req.query.date_filter || 'today';
    const customDate = req.query.custom_date || null;

    const query = { status: 'completed' };
    if (req.user.role !== 'admin') query.user_id = req.user.id;

    const { start, end } = buildDateRange(dateFilter, customDate);
    if (start && end) {
      query.follow_up_date = { $gte: start, $lte: end };
    }

    const followups = await collections.followups()
      .find(query, { projection: { _id: 0 } })
      .sort({ follow_up_date: -1 })
      .toArray();

    const result = [];
    for (const followup of followups) {
      const contact = await collections.contacts().findOne(
        { id: followup.contact_id },
        { projection: { _id: 0 } }
      );
      if (contact) {
        followup.contact = contact;
        result.push(followup);
      }
    }

    res.json({ followups: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
