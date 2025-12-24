const express = require('express');
const router = express.Router();
const { analyzeResume } = require('../controllers/atsController');

// POST /api/ats/analyze
router.post('/analyze', analyzeResume);

module.exports = router;
