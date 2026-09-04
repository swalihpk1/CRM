const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activity');
const { nowIso, parseIsoStrict } = require('../utils/dates');
const { pickDemo } = require('../utils/serialize');
const { shopNameFromData } = require('./contacts');

const router = express.Router();

// POST /api/demos
router.post('/demos', requireAuth, async (req, res, next) => {
  try {
    const { contact_id, notes } = req.body || {};

    const contact = await collections.contacts().findOne({ id: contact_id }, { projection: { _id: 0 } });
    if (!contact) throw new ApiError(404, 'Contact not found');

    const givenAt = nowIso();
    const demo = {
      id: crypto.randomUUID(),
      contact_id,
      user_id: req.user.id,
      user_email: req.user.email,
      given_at: givenAt,
      watched: false,
      watched_at: null,
      notes: notes ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await collections.demos().insertOne(demo);

    const shopName = shopNameFromData(contact.data || {});
    await logActivity(
      req.user.id,
      req.user.email,
      'Demo given',
      contact.phone,
      `Shop: ${shopName}, Given at: ${demo.given_at}`
    );

    res.json(pickDemo(demo));
  } catch (err) {
    next(err);
  }
});

// PUT /api/demos/:demo_id/watched
router.put('/demos/:demo_id/watched', requireAuth, async (req, res, next) => {
  try {
    const demoId = req.params.demo_id;
    const demo = await collections.demos().findOne({ id: demoId }, { projection: { _id: 0 } });
    if (!demo) throw new ApiError(404, 'Demo not found');

    if (req.user.role !== 'admin' && demo.user_id !== req.user.id) {
      throw new ApiError(403, 'Not authorized');
    }

    const watchedAt = (req.body && req.body.watched_at) || nowIso();

    await collections.demos().updateOne(
      { id: demoId },
      { $set: { watched: true, watched_at: watchedAt, updated_at: nowIso() } }
    );

    const contact = await collections.contacts().findOne(
      { id: demo.contact_id },
      { projection: { _id: 0 } }
    );
    if (contact) {
      const shopName = shopNameFromData(contact.data || {});
      await logActivity(
        req.user.id,
        req.user.email,
        'Demo watched',
        contact.phone,
        `Shop: ${shopName}, Watched at: ${watchedAt}`
      );
    }

    res.json({ message: 'Demo marked as watched', watched_at: watchedAt });
  } catch (err) {
    next(err);
  }
});

// GET /api/contacts/:contact_id/demos
router.get('/contacts/:contact_id/demos', requireAuth, async (req, res, next) => {
  try {
    const query = { contact_id: req.params.contact_id };
    if (req.user.role !== 'admin') query.user_id = req.user.id;

    const demos = await collections.demos()
      .find(query, { projection: { _id: 0 } })
      .sort({ given_at: -1 })
      .toArray();
    res.json(demos.map(pickDemo));
  } catch (err) {
    next(err);
  }
});

const GROUP_BY_FORMATS = {
  day: '%Y-%m-%d',
  week: '%Y-%U',
  month: '%Y-%m',
};

// GET /api/demos/report
// NOTE: date-parse errors are validated BEFORE group_by — order preserved so
// a request with both invalid returns the date error, matching Python.
router.get('/demos/report', requireAuth, async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const groupBy = req.query.group_by || 'day';

    const startDate = parseIsoStrict(start);
    const endDate = parseIsoStrict(end);
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Invalid date format');
    }

    const dateFormat = GROUP_BY_FORMATS[groupBy];
    if (!dateFormat) {
      throw new ApiError(400, 'Invalid group_by parameter');
    }

    const matchQuery = {
      given_at: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
    };
    if (req.user.role !== 'admin') matchQuery.user_id = req.user.id;

    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: { $dateFromString: { dateString: '$given_at' } },
            },
          },
          given: { $sum: 1 },
          watched: { $sum: { $cond: [{ $eq: ['$watched', true] }, 1, 0] } },
        },
      },
      {
        $addFields: {
          conversion: {
            $cond: [{ $gt: ['$given', 0] }, { $divide: ['$watched', '$given'] }, 0],
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const result = await collections.demos().aggregate(pipeline).toArray();

    const formattedResult = result.map((item) => ({
      period: item._id,
      given: item.given,
      watched: item.watched,
      conversion: Math.round(item.conversion * 1000) / 1000,
    }));

    res.json(formattedResult);
  } catch (err) {
    next(err);
  }
});

// GET /api/demos/summary
router.get('/demos/summary', requireAuth, async (req, res, next) => {
  try {
    const { start, end } = req.query;

    const startDate = parseIsoStrict(start);
    const endDate = parseIsoStrict(end);
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Invalid date format');
    }

    const matchQuery = {
      given_at: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
    };
    if (req.user.role !== 'admin') matchQuery.user_id = req.user.id;

    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          given: { $sum: 1 },
          watched: { $sum: { $cond: [{ $eq: ['$watched', true] }, 1, 0] } },
        },
      },
      {
        $addFields: {
          conversion: {
            $cond: [{ $gt: ['$given', 0] }, { $divide: ['$watched', '$given'] }, 0],
          },
        },
      },
    ];

    const result = await collections.demos().aggregate(pipeline).toArray();

    if (result.length === 0) {
      return res.json({ given: 0, watched: 0, conversion: 0 });
    }

    const data = result[0];
    res.json({
      given: data.given,
      watched: data.watched,
      conversion: Math.round(data.conversion * 1000) / 1000,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
