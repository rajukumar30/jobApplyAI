const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Generate email from job + resume data
router.post('/generate', emailController.generateEmail);

// Send email via Gmail API
router.post('/send', emailController.sendEmail);

module.exports = router;
