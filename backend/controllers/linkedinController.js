const linkedinService = require('../services/linkedin/linkedinService');

function initiateAuth(req, res) {
  return res.status(410).json({
    error: 'LinkedIn OAuth is disabled because it does not provide reliable job-post access. Paste the job description text instead.',
  });
}

function handleCallback(req, res) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return res.redirect(`${frontendUrl}?linkedin_error=oauth_disabled`);
}

function getStatus(req, res) {
  return res.json({ connected: false, supported: false });
}

async function fetchJobPage(req, res) {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required.' });
  if (!url.includes('linkedin.com')) {
    return res.status(400).json({ error: 'Only LinkedIn URLs are supported.' });
  }

  const result = await linkedinService.fetchJobPageUnauthenticated(url);
  if (result.success) {
    return res.json({ success: true, description: result.description, source: 'scraped' });
  }

  return res.status(422).json({
    success: false,
    requiresLinkedInLogin: false,
    error: 'LinkedIn blocked automated access. Copy the job description and paste it into the description field.',
  });
}

module.exports = { initiateAuth, handleCallback, getStatus, fetchJobPage };
