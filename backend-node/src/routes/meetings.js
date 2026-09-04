const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activity');
const { nowIso } = require('../utils/dates');
const { pickMeeting } = require('../utils/serialize');

const router = express.Router();

// Shared attendee/contact-lookup helper for activity-log context, used by
// create/update/status-update/delete. Mirrors the repeated logic in the
// Python source verbatim.
async function buildMeetingLogContext(meeting) {
  let targetContact = null;
  if (meeting.attendees && meeting.attendees.length > 0) {
    const firstAttendee = meeting.attendees[0];
    if (firstAttendee && firstAttendee.phone) {
      targetContact = await collections.contacts().findOne(
        { phone: firstAttendee.phone },
        { projection: { _id: 0 } }
      );
    }
  }
  const logTarget = targetContact ? targetContact.phone : meeting.title;

  const attendeeInfo = (meeting.attendees || []).map((a) => {
    if (a && a.phone) return `${a.name || 'Unknown'} (${a.phone})`;
    return (a && a.name) || 'Unknown';
  });
  const attendeeDetails = attendeeInfo.length > 0 ? attendeeInfo.join(', ') : 'No attendees';

  return { logTarget, attendeeDetails };
}

// POST /api/meetings
router.post('/meetings', requireAuth, async (req, res, next) => {
  try {
    const { title, date, time, location, notes, attendees } = req.body || {};

    const meeting = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      user_email: req.user.email,
      title,
      date,
      time: time ?? null,
      location: location ?? null,
      notes: notes ?? null,
      attendees: attendees || [],
      status: 'scheduled',
      created_at: nowIso(),
    };
    await collections.meetings().insertOne(meeting);

    const { logTarget, attendeeDetails } = await buildMeetingLogContext(meeting);

    await logActivity(
      req.user.id,
      req.user.email,
      'Created meeting',
      logTarget,
      `Meeting: ${meeting.title}, Date: ${meeting.date} ${meeting.time || ''}, Attendees: ${attendeeDetails}`
    );

    res.json(pickMeeting(meeting));
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings
router.get('/meetings', requireAuth, async (req, res, next) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 100;
    const status = req.query.status;

    const query = {};
    if (req.user.role !== 'admin') query.user_id = req.user.id;
    if (status) query.status = status;

    const meetings = await collections.meetings()
      .find(query, { projection: { _id: 0 } })
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    res.json(meetings.map(pickMeeting));
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings/:meeting_id
// Self-scoped by user_id EVEN FOR ADMINS — asymmetry vs. GET /meetings
// preserved exactly from the Python source (not a bug to "fix").
router.get('/meetings/:meeting_id', requireAuth, async (req, res, next) => {
  try {
    const meeting = await collections.meetings().findOne(
      { id: req.params.meeting_id, user_id: req.user.id },
      { projection: { _id: 0 } }
    );
    if (!meeting) throw new ApiError(404, 'Meeting not found');
    res.json(pickMeeting(meeting));
  } catch (err) {
    next(err);
  }
});

// PUT /api/meetings/:meeting_id — self-scoped, same as GET single.
router.put('/meetings/:meeting_id', requireAuth, async (req, res, next) => {
  try {
    const meetingId = req.params.meeting_id;
    const meeting = await collections.meetings().findOne(
      { id: meetingId, user_id: req.user.id },
      { projection: { _id: 0 } }
    );
    if (!meeting) throw new ApiError(404, 'Meeting not found');

    const body = req.body || {};
    const updateData = {};
    for (const key of ['title', 'date', 'time', 'location', 'notes', 'attendees', 'status']) {
      if (body[key] !== undefined && body[key] !== null) {
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new ApiError(400, 'No update data provided');
    }

    // No updated_at — the Meeting model has no such field.
    await collections.meetings().updateOne({ id: meetingId }, { $set: updateData });

    const { logTarget, attendeeDetails } = await buildMeetingLogContext(meeting);

    let action = 'Updated meeting';
    let details = `Meeting: ${meeting.title}, Attendees: ${attendeeDetails}`;

    if ('date' in updateData || 'time' in updateData) {
      action = 'Rescheduled meeting';
      const oldDatetime = `${meeting.date || ''} ${meeting.time || ''}`.trim();
      const newDatetime = `${updateData.date ?? meeting.date ?? ''} ${updateData.time ?? meeting.time ?? ''}`.trim();
      details = `Meeting: ${meeting.title}, From: ${oldDatetime}, To: ${newDatetime}, Attendees: ${attendeeDetails}`;
    } else if ('status' in updateData) {
      action = `Updated meeting status to ${updateData.status}`;
      details = `Meeting: ${meeting.title}, Status: ${updateData.status}, Attendees: ${attendeeDetails}`;
    }

    await logActivity(req.user.id, req.user.email, action, logTarget, details);

    res.json({ message: 'Meeting updated successfully' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/meetings/:meeting_id/status — self-scoped.
router.put('/meetings/:meeting_id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
      throw new ApiError(400, 'Invalid status');
    }

    const meetingId = req.params.meeting_id;
    const meeting = await collections.meetings().findOne(
      { id: meetingId, user_id: req.user.id },
      { projection: { _id: 0 } }
    );
    if (!meeting) throw new ApiError(404, 'Meeting not found');

    await collections.meetings().updateOne({ id: meetingId }, { $set: { status } });

    const { logTarget, attendeeDetails } = await buildMeetingLogContext(meeting);

    let action;
    if (status === 'completed') action = 'Completed meeting';
    else if (status === 'cancelled') action = 'Cancelled meeting';
    else action = `Updated meeting status to ${status}`;

    await logActivity(
      req.user.id,
      req.user.email,
      action,
      logTarget,
      `Meeting: ${meeting.title}, Date: ${meeting.date || ''} ${meeting.time || ''}, Attendees: ${attendeeDetails}`
    );

    res.json({ message: `Meeting status updated to ${status}` });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meetings/:meeting_id — self-scoped.
router.delete('/meetings/:meeting_id', requireAuth, async (req, res, next) => {
  try {
    const meetingId = req.params.meeting_id;
    const meeting = await collections.meetings().findOne(
      { id: meetingId, user_id: req.user.id },
      { projection: { _id: 0 } }
    );
    if (!meeting) throw new ApiError(404, 'Meeting not found');

    const { logTarget, attendeeDetails } = await buildMeetingLogContext(meeting);

    await collections.meetings().deleteOne({ id: meetingId });

    await logActivity(
      req.user.id,
      req.user.email,
      'Deleted meeting',
      logTarget,
      `Meeting: ${meeting.title}, Date: ${meeting.date || ''} ${meeting.time || ''}, Attendees: ${attendeeDetails}`
    );

    res.json({ message: 'Meeting deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
