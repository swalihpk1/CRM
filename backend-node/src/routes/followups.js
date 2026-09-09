const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activity');
const { nowIso, buildDateRange } = require('../utils/dates');
const { pickFollowUp } = require('../utils/serialize');
const { shopNameFromData } = require('../utils/shopName');

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
      `Scheduled for ${follow_up_date}`,
      contact ? shopNameFromData(contact.data) : null
    );

    res.json(pickFollowUp(followup));
  } catch (err) {
    next(err);
  }
});

// GET /api/followups
// `contact_id` is a backend-node-only addition (see backend-node/CLAUDE.md
// exception) — when present, returns EVERY follow-up ever scheduled against
// that contact regardless of who created it (bypassing the normal
// non-admin user_id scoping), sorted most-recent-first by whichever date is
// relevant to that follow-up's state (completed_at for completed ones,
// follow_up_date otherwise) so the ContactDetailModal's follow-up history
// section can show a single recency-ordered list mixing pending/overdue/
// completed items. Omitting contact_id preserves the original behavior
// (role-scoped, ascending by follow_up_date) exactly.
router.get('/followups', requireAuth, async (req, res, next) => {
  try {
    const query = {};
    if (req.query.contact_id) {
      query.contact_id = req.query.contact_id;
    } else if (req.user.role !== 'admin') {
      query.user_id = req.user.id;
    }
    if (req.query.status) query.status = req.query.status;

    let followups = await collections.followups()
      .find(query, { projection: { _id: 0 } })
      .toArray();

    if (req.query.contact_id) {
      followups.sort((a, b) => {
        const dateOf = (f) => new Date(f.completed_at || f.follow_up_date).getTime();
        return dateOf(b) - dateOf(a);
      });
    } else {
      followups.sort((a, b) => new Date(a.follow_up_date) - new Date(b.follow_up_date));
    }

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

    // completed_at is a backend-node-only addition, not in the Python
    // source (see backend-node/CLAUDE.md exception) — the original model
    // only recorded that a follow-up was completed (status), never when.
    // Added so productivity metrics can count completions by the date
    // they actually happened, not by the follow-up's created_at.
    await collections.followups().updateOne(
      { id: followupId },
      { $set: { status: 'completed', completed_at: nowIso() } }
    );

    await logActivity(
      req.user.id,
      req.user.email,
      'Completed follow-up',
      target,
      null,
      contact ? shopNameFromData(contact.data) : null
    );

    res.json({ message: 'Follow-up marked as completed' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/followups/:followup_id — backend-node-only addition, not in the
// Python source (see backend-node/CLAUDE.md exception). Lets the creator
// or an admin edit a scheduled follow-up's date/notes from the Follow-ups
// page card. Anyone else gets 403; a nonexistent id gets 404.
router.put('/followups/:followup_id', requireAuth, async (req, res, next) => {
  try {
    const followupId = req.params.followup_id;
    const followup = await collections.followups().findOne({ id: followupId }, { projection: { _id: 0 } });
    if (!followup) throw new ApiError(404, 'Follow-up not found');
    if (req.user.role !== 'admin' && followup.user_id !== req.user.id) {
      throw new ApiError(403, 'Not authorized to edit this follow-up');
    }

    const body = req.body || {};
    const updateData = {};
    if (body.follow_up_date !== undefined && body.follow_up_date !== null) {
      updateData.follow_up_date = body.follow_up_date;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }
    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No update data provided');
    }

    await collections.followups().updateOne({ id: followupId }, { $set: updateData });

    const contact = await collections.contacts().findOne(
      { id: followup.contact_id },
      { projection: { _id: 0 } }
    );
    await logActivity(
      req.user.id,
      req.user.email,
      'Updated follow-up',
      contact ? contact.phone : followup.contact_id,
      `Fields: ${Object.keys(updateData).join(', ')}`,
      contact ? shopNameFromData(contact.data) : null
    );

    const updatedFollowup = await collections.followups().findOne({ id: followupId }, { projection: { _id: 0 } });
    res.json(pickFollowUp(updatedFollowup));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/followups/:followup_id — backend-node-only addition, not in
// the Python source (see backend-node/CLAUDE.md exception). Same
// creator-or-admin authorization as the PUT above.
router.delete('/followups/:followup_id', requireAuth, async (req, res, next) => {
  try {
    const followupId = req.params.followup_id;
    const followup = await collections.followups().findOne({ id: followupId }, { projection: { _id: 0 } });
    if (!followup) throw new ApiError(404, 'Follow-up not found');
    if (req.user.role !== 'admin' && followup.user_id !== req.user.id) {
      throw new ApiError(403, 'Not authorized to delete this follow-up');
    }

    const contact = await collections.contacts().findOne(
      { id: followup.contact_id },
      { projection: { _id: 0 } }
    );
    const target = contact ? contact.phone : followup.contact_id;

    await collections.followups().deleteOne({ id: followupId });

    await logActivity(
      req.user.id,
      req.user.email,
      'Deleted follow-up',
      target,
      null,
      contact ? shopNameFromData(contact.data) : null
    );

    res.json({ message: 'Follow-up deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/followups/paginated
router.get('/followups/paginated', requireAuth, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 20;
    // Frontend resolves any quick filter (today/yesterday/last_week/etc.)
    // to explicit dates itself and always sends only from_date/to_date —
    // no filter keyword crosses the wire.
    const fromDate = req.query.from_date || null;
    const toDate = req.query.to_date || null;
    // Optional status narrowing — a backend-node-only addition, not in the
    // Python source. Lets the frontend show "Overdue" and "Pending" as two
    // independently paginated sub-lists (each its own request) instead of
    // one combined list where hundreds of overdue items bury the pending
    // ones many pages deep. Omitting it keeps the original combined
    // pending+overdue behavior exactly as before.
    const statusFilter = req.query.status;
    const validStatuses = ['pending', 'overdue'];

    const query = {
      status: validStatuses.includes(statusFilter) ? statusFilter : { $in: validStatuses },
    };
    if (req.user.role !== 'admin') {
      query.user_id = req.user.id;
    } else if (req.query.created_by) {
      // Admin-only staff filter — a backend-node-only addition, not in the
      // Python source. Lets an admin narrow the follow-up list down to
      // just the follow-ups a specific staff member scheduled. Ignored
      // for non-admins (they're already scoped to their own user_id
      // above, so this would be redundant/pointless for them anyway).
      query.user_id = req.query.created_by;
    }

    const { start, end } = buildDateRange(null, null, fromDate, toDate);
    if (start && end) {
      query.follow_up_date = { $gte: start, $lte: end };
    }

    // Overdue items first, then still-pending ones, each group ordered by
    // due date — not just chronological across both. Relies on the string
    // sort 'overdue' < 'pending' (verified, not incidental) rather than a
    // separate numeric priority field, since the only two values in this
    // query's status field are exactly those two strings (see the $in
    // above); if a third status is ever added to this query, this sort
    // must be revisited.
    const followups = await collections.followups()
      .find(query, { projection: { _id: 0 } })
      .sort({ status: 1, follow_up_date: 1 })
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
      // Backend-node fix, not in the Python source: a followup whose
      // contact was since deleted used to be silently DROPPED from
      // `result` entirely, while still being counted in `skip`/`limit` at
      // the DB-query level. That desynced the returned page's length from
      // how many documents were actually consumed — the frontend's
      // useInfiniteList derives `hasMore` from `page.length === pageSize`,
      // so any page containing even one orphaned-contact followup returned
      // a short page and permanently (and wrongly) looked like "the last
      // page," silently truncating pagination for the rest of that list.
      // Matches /followups/upcoming's existing behavior instead (embeds
      // `contact: null` and keeps the item) rather than dropping it.
      followup.contact = contact || null;
      result.push(followup);
    }

    // total_count/overdue_count are backend-node-only additions (not in
    // Python's response shape) so the frontend can show accurate stat
    // cards without fetching every page. They reflect the full query
    // (ignoring skip/limit), not just this page's result length.
    const [totalCount, overdueCount] = await Promise.all([
      collections.followups().countDocuments(query),
      collections.followups().countDocuments({ ...query, status: 'overdue' }),
    ]);

    res.json({ followups: result, total_count: totalCount, overdue_count: overdueCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/followups/completed
router.get('/followups/completed', requireAuth, async (req, res, next) => {
  try {
    // Frontend resolves any quick filter (today/yesterday/last_week/etc.)
    // to explicit dates itself and always sends only from_date/to_date —
    // no filter keyword crosses the wire.
    const fromDate = req.query.from_date || null;
    const toDate = req.query.to_date || null;
    // skip/limit are a backend-node-only addition (Python always returns
    // the full unpaginated list here) — added so the frontend's follow-up
    // list can page in 15-at-a-time instead of fetching everything.
    // Omitting both preserves the original unpaginated behavior exactly.
    const hasPaging = req.query.skip !== undefined || req.query.limit !== undefined;
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 20;

    const query = { status: 'completed' };
    if (req.user.role !== 'admin') {
      query.user_id = req.user.id;
    } else if (req.query.created_by) {
      // Admin-only staff filter — see the matching comment on
      // /followups/paginated. Ignored for non-admins.
      query.user_id = req.query.created_by;
    }

    const { start, end } = buildDateRange(null, null, fromDate, toDate);
    if (start && end) {
      query.follow_up_date = { $gte: start, $lte: end };
    }

    let cursor = collections.followups()
      .find(query, { projection: { _id: 0 } })
      .sort({ follow_up_date: -1 });
    if (hasPaging) cursor = cursor.skip(skip).limit(limit);

    const followups = await cursor.toArray();

    const result = [];
    for (const followup of followups) {
      const contact = await collections.contacts().findOne(
        { id: followup.contact_id },
        { projection: { _id: 0 } }
      );
      // Backend-node fix, not in the Python source — see the matching
      // comment on /followups/paginated: dropping an orphaned-contact
      // followup here desynced this page's returned length from what was
      // actually skip/limit-ed at the DB level, silently truncating
      // useInfiniteList's pagination for the Completed tab whenever a page
      // happened to contain one. Keep the item with contact: null instead.
      followup.contact = contact || null;
      result.push(followup);
    }

    // total_count is a backend-node-only addition (not in Python's response
    // shape), reflecting the full query regardless of skip/limit, so the
    // frontend can show an accurate stat card without fetching every page.
    const totalCount = await collections.followups().countDocuments(query);

    res.json({ followups: result, total_count: totalCount });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
