const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/gmailController');

// Check if Gmail SMTP is configured (.env has GMAIL_USER + GMAIL_APP_PASSWORD)
router.get('/status', gmailController.getStatus);

// Verify live SMTP connection
router.post('/verify', gmailController.verifyConnection);

module.exports = router;
