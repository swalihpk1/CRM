const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const { nowIso } = require('../utils/dates');
const { pickNote } = require('../utils/serialize');

const router = express.Router();

// POST /api/notes
router.post('/notes', requireAuth, async (req, res, next) => {
  try {
    const { contact_id, content } = req.body || {};

    const note = {
      id: crypto.randomUUID(),
      contact_id,
      user_id: req.user.id,
      content,
      created_at: nowIso(),
    };
    await collections.notes().insertOne(note);

    const contact = await collections.contacts().findOne({ id: contact_id }, { projection: { _id: 0 } });
    await logActivity(
      req.user.id,
      req.user.email,
      'Added note',
      contact ? contact.phone : contact_id
    );

    res.json(pickNote(note));
  } catch (err) {
    next(err);
  }
});

// GET /api/notes/contact/:contact_id
router.get('/notes/contact/:contact_id', requireAuth, async (req, res, next) => {
  try {
    const notes = await collections.notes()
      .find({ contact_id: req.params.contact_id }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .toArray();
    res.json(notes.map(pickNote));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
