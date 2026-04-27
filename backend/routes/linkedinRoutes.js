const express = require('express');
const router = express.Router();
const linkedinController = require('../controllers/linkedinController');

// Initiate LinkedIn OAuth flow
router.get('/auth', linkedinController.initiateAuth);

// Handle LinkedIn OAuth callback
router.get('/callback', linkedinController.handleCallback);

// Check LinkedIn connection status
router.get('/status', linkedinController.getStatus);

// Fetch a LinkedIn job page (unauthenticated / authenticated)
router.post('/fetch-job', linkedinController.fetchJobPage);

module.exports = router;
