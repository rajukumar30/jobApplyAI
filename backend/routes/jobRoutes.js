const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

router.post('/analyze', jobController.analyzeJob);
router.post('/match-resumes', jobController.matchResumes);
router.get('/progress', jobController.progressStream);

module.exports = router;
