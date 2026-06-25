const express = require('express');
const router = express.Router();
const gmailController = require('../controllers/gmailController');
const { requireAuth } = require('../middleware/auth');

router.get('/callback', gmailController.handleCallback);

router.use(requireAuth);

router.get('/auth-url', gmailController.getAuthUrl);
router.post('/connect-token', gmailController.connectWithToken);
router.get('/status', gmailController.getStatus);
router.post('/verify', gmailController.verifyConnection);
router.delete('/connection', gmailController.disconnect);

module.exports = router;
