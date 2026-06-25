const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.post('/analyze', jobController.analyzeJob);
router.post('/match-resumes', jobController.matchResumes);
router.get('/progress', jobController.progressStream);

module.exports = router;
