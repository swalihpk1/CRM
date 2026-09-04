const express = require('express');
const { collections } = require('../config/db');

const router = express.Router();

// GET /api/test-search — intentionally unauthenticated, kept unchanged from
// the Python source (debug endpoint to verify search/regex query works).
router.get('/test-search', async (req, res) => {
  try {
    const query = { $or: [{ phone: { $regex: 'test', $options: 'i' } }] };
    const result = await collections.contacts().find(query, { projection: { _id: 0 } }).limit(1).toArray();
    res.json({ status: 'success', query_works: true, sample_count: result.length });
  } catch (err) {
    res.json({ status: 'error', message: err.message });
  }
});

module.exports = router;
