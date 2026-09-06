const express = require('express');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activity');
const { nowIso } = require('../utils/dates');
const { pickNote } = require('../utils/serialize');
const { shopNameFromData } = require('../utils/shopName');

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
      contact ? contact.phone : contact_id,
      null,
      contact ? shopNameFromData(contact.data) : null
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

// PUT /api/notes/:note_id — backend-node-only addition, not in the Python
// source (see backend-node/CLAUDE.md exception). Creator-or-admin only,
// same authorization pattern as PUT /followups/:id.
router.put('/notes/:note_id', requireAuth, async (req, res, next) => {
  try {
    const noteId = req.params.note_id;
    const note = await collections.notes().findOne({ id: noteId }, { projection: { _id: 0 } });
    if (!note) throw new ApiError(404, 'Note not found');
    if (req.user.role !== 'admin' && note.user_id !== req.user.id) {
      throw new ApiError(403, 'Not authorized to edit this note');
    }

    const { content } = req.body || {};
    if (content === undefined || content === null || !String(content).trim()) {
      throw new ApiError(400, 'Content is required');
    }

    await collections.notes().updateOne({ id: noteId }, { $set: { content } });

    const contact = await collections.contacts().findOne(
      { id: note.contact_id },
      { projection: { _id: 0 } }
    );
    await logActivity(
      req.user.id,
      req.user.email,
      'Updated note',
      contact ? contact.phone : note.contact_id,
      null,
      contact ? shopNameFromData(contact.data) : null
    );

    const updatedNote = await collections.notes().findOne({ id: noteId }, { projection: { _id: 0 } });
    res.json(pickNote(updatedNote));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notes/:note_id — backend-node-only addition, not in the
// Python source (see backend-node/CLAUDE.md exception). Same
// creator-or-admin authorization as the PUT above.
router.delete('/notes/:note_id', requireAuth, async (req, res, next) => {
  try {
    const noteId = req.params.note_id;
    const note = await collections.notes().findOne({ id: noteId }, { projection: { _id: 0 } });
    if (!note) throw new ApiError(404, 'Note not found');
    if (req.user.role !== 'admin' && note.user_id !== req.user.id) {
      throw new ApiError(403, 'Not authorized to delete this note');
    }

    const contact = await collections.contacts().findOne(
      { id: note.contact_id },
      { projection: { _id: 0 } }
    );

    await collections.notes().deleteOne({ id: noteId });

    await logActivity(
      req.user.id,
      req.user.email,
      'Deleted note',
      contact ? contact.phone : note.contact_id,
      null,
      contact ? shopNameFromData(contact.data) : null
    );

    res.json({ message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
