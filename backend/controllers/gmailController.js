const gmailService = require('../services/gmail/gmailService');

async function getAuthUrl(req, res) {
  try {
    return res.json({ authUrl: gmailService.getAuthUrl(req.user) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleCallback(req, res) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    if (!req.query.code || !req.query.state) {
      throw new Error('Missing OAuth code or state.');
    }
    await gmailService.exchangeCode(req.query.state, req.query.code);
    return res.redirect(`${frontendUrl}/profile?gmail=connected`);
  } catch (error) {
    console.error('Gmail OAuth callback failed:', error.message);
    return res.redirect(`${frontendUrl}/profile?gmail=error`);
  }
}

async function connectWithToken(req, res) {
  try {
    const { accessToken } = req.body || {};
    console.log('[gmail/connect-token] uid=%s email=%s tokenLen=%s', req.user.uid, req.user.email, accessToken ? accessToken.length : 0);
    if (!accessToken) {
      console.warn('[gmail/connect-token] missing access token in request body');
      return res.status(400).json({ error: 'Missing Google access token.' });
    }
    const result = await gmailService.saveTokenConnection(req.user.uid, accessToken, req.user.email);
    console.log('[gmail/connect-token] saved connection for %s (email=%s)', req.user.uid, result.email);
    return res.json({ success: true, email: result.email });
  } catch (error) {
    console.error('[gmail/connect-token] failed:', error.message);
    return res.status(400).json({ error: error.message });
  }
}

async function getStatus(req, res) {
  try {
    const status = await gmailService.getStatus(req.user.uid);
    console.log('[gmail/status] uid=%s connected=%s method=%s', req.user.uid, status.connected, status.method);
    return res.json(status);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function verifyConnection(req, res) {
  try {
    await gmailService.verifyConnection(req.user.uid);
    return res.json({ success: true, message: 'Gmail connection verified successfully.' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function disconnect(req, res) {
  try {
    await gmailService.disconnect(req.user.uid);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { getAuthUrl, handleCallback, connectWithToken, getStatus, verifyConnection, disconnect };
