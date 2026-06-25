const express = require('express');
const router = express.Router();
const linkedinController = require('../controllers/linkedinController');
const { requireAuth } = require('../middleware/auth');

// Initiate LinkedIn OAuth flow
router.get('/auth', requireAuth, linkedinController.initiateAuth);

// Handle LinkedIn OAuth callback
router.get('/callback', linkedinController.handleCallback);

// Check LinkedIn connection status
router.get('/status', requireAuth, linkedinController.getStatus);

// Fetch a LinkedIn job page (unauthenticated / authenticated)
router.post('/fetch-job', requireAuth, linkedinController.fetchJobPage);

module.exports = router;
