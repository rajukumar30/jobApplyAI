const linkedinService = require('../services/linkedin/linkedinService');

// ── Initiate LinkedIn OAuth ──────────────────────────────────────────────────
function initiateAuth(req, res) {
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'LinkedIn OAuth is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env',
    });
  }
  try {
    const authUrl = linkedinService.getAuthUrl();
    console.log('🔐 Redirecting to LinkedIn OAuth...');
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).json({ error: `Failed to generate LinkedIn auth URL: ${err.message}` });
  }
}

// ── Handle LinkedIn Callback ─────────────────────────────────────────────────
async function handleCallback(req, res) {
  const { code, error, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error) {
    console.error('❌ LinkedIn OAuth error:', error);
    return res.redirect(`${frontendUrl}?linkedin_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}?linkedin_error=no_code`);
  }

  try {
    await linkedinService.exchangeCode(code);
    console.log('✅ LinkedIn connected successfully');
    return res.redirect(`${frontendUrl}?linkedin_connected=true`);
  } catch (err) {
    console.error('❌ LinkedIn token exchange error:', err.message);
    return res.redirect(`${frontendUrl}?linkedin_error=${encodeURIComponent(err.message)}`);
  }
}

// ── Check LinkedIn Status ────────────────────────────────────────────────────
function getStatus(req, res) {
  const connected = linkedinService.isConnected();
  return res.json({ connected });
}

// ── Fetch Job Page ───────────────────────────────────────────────────────────
async function fetchJobPage(req, res) {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  if (!url.includes('linkedin.com')) {
    return res.status(400).json({ error: 'Only LinkedIn URLs are supported.' });
  }

  console.log(`🔗 Fetching LinkedIn job page: ${url}`);

  // Try unauthenticated scraping first
  const unauth = await linkedinService.fetchJobPageUnauthenticated(url);

  if (unauth.success) {
    return res.json({ success: true, description: unauth.description, source: 'scraped' });
  }

  // Try with stored LinkedIn token (if connected)
  const token = linkedinService.getLinkedInToken();
  if (token && linkedinService.isConnected()) {
    const auth = await linkedinService.fetchJobPageAuthenticated(url, token.access_token);
    if (auth.success) {
      return res.json({ success: true, description: auth.description, source: 'authenticated' });
    }
  }

  // Could not scrape — tell user to paste manually instead of broken OAuth
  console.log('⚠️ LinkedIn page requires login or is blocked. Asking user to paste description manually.');
  return res.status(422).json({
    success: false,
    requiresLinkedInLogin: false,
    error: 'Could not extract the job description from this LinkedIn URL. LinkedIn blocks automated access for most pages. Please copy the job/post description text and paste it in the "Paste Description" tab instead.',
  });
}

module.exports = { initiateAuth, handleCallback, getStatus, fetchJobPage };
