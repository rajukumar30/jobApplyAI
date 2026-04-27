const gmailService = require('../services/gmail/gmailService');

// ── Check SMTP configuration status ─────────────────────────────────────────
function getStatus(req, res) {
  const configured = gmailService.isConfigured();
  return res.json({
    connected: configured,
    email: configured ? process.env.GMAIL_USER : null,
    method: 'smtp',
  });
}

// ── Verify live SMTP connection ──────────────────────────────────────────────
async function verifyConnection(req, res) {
  if (!gmailService.isConfigured()) {
    return res.status(400).json({
      error: 'Gmail SMTP is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.',
    });
  }
  try {
    await gmailService.verifyConnection();
    return res.json({ success: true, message: 'SMTP connection verified successfully.' });
  } catch (err) {
    console.error('SMTP verify failed:', err.message);
    return res.status(500).json({
      error: `SMTP connection failed: ${err.message}. Check your App Password and make sure 2FA is enabled.`,
    });
  }
}

module.exports = { getStatus, verifyConnection };
