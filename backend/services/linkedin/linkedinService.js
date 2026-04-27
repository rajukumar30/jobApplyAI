const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const TOKEN_STORE_PATH = path.join(__dirname, '../../data/tokenStore.json');

// ── Browser-like headers to avoid bot detection ──────────────────────────────
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
};

// ── Token persistence ────────────────────────────────────────────────────────
function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveLinkedInToken(token) {
  const store = loadTokens();
  store.linkedin = token;
  fs.writeFileSync(TOKEN_STORE_PATH, JSON.stringify(store, null, 2));
}

function getLinkedInToken() {
  return loadTokens().linkedin || null;
}

// ── OAuth URL ────────────────────────────────────────────────────────────────
function getAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    scope: 'openid profile email',
    state: 'jobapply_ai_' + Date.now(),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

// ── Exchange code for access token ───────────────────────────────────────────
async function exchangeCode(code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    client_id: process.env.LINKEDIN_CLIENT_ID,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET,
  });

  const response = await axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const tokenData = {
    access_token: response.data.access_token,
    expires_in: response.data.expires_in,
    issued_at: Date.now(),
  };
  saveLinkedInToken(tokenData);
  return tokenData;
}

// ── Check connection status ──────────────────────────────────────────────────
function isConnected() {
  const token = getLinkedInToken();
  if (!token) return false;
  const expiresAt = token.issued_at + token.expires_in * 1000;
  return Date.now() < expiresAt;
}

/**
 * Extract job description text from raw LinkedIn HTML using cheerio.
 */
function extractJobDescription($) {
  // Try multiple selector strategies LinkedIn uses for jobs AND posts
  const selectors = [
    '.show-more-less-html__markup',
    '.description__text',
    '[data-test-id="job-description"]',
    '.job-description',
    '#job-details',
    '.jobs-description__content',
    // LinkedIn post selectors
    '.feed-shared-update-v2__description',
    '.feed-shared-text',
    '.break-words',
    '[data-test-id="main-feed-activity-content"]',
    '.update-components-text',
    '.attributed-text-segment-list__content',
  ];

  for (const sel of selectors) {
    const el = $(sel);
    if (el.length) {
      const text = el.text().trim();
      if (text.length > 30) return text;
    }
  }

  // Try meta description (LinkedIn renders this for public posts)
  const metaDesc = $('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content');
  if (metaDesc && metaDesc.length > 30) return metaDesc;

  // Fallback: grab all main text content
  return $('main').text().trim() || $('body').text().trim().slice(0, 5000);
}

/**
 * Attempt to fetch a LinkedIn job page without authentication.
 * @param {string} url - LinkedIn job URL
 * @returns {{ success: boolean, description: string, requiresLogin: boolean }}
 */
async function fetchJobPageUnauthenticated(url) {
  try {
    const response = await axios.get(url, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);
    const pageText = response.data.toLowerCase();

    // Detect login wall
    if (
      pageText.includes('sign in') && pageText.includes('continue') ||
      pageText.includes('authwall') ||
      pageText.includes('login?session_redirect')
    ) {
      return { success: false, description: null, requiresLogin: true };
    }

    const description = extractJobDescription($);

    if (!description || description.length < 50) {
      return { success: false, description: null, requiresLogin: true };
    }

    return { success: true, description, requiresLogin: false };
  } catch (err) {
    console.error('LinkedIn unauthenticated fetch error:', err.message);
    return { success: false, description: null, requiresLogin: true };
  }
}

/**
 * Fetch job page using LinkedIn access token.
 * LinkedIn's API doesn't directly expose job pages, so we use lix with the token as a cookie.
 * @param {string} url - LinkedIn job URL
 * @param {string} accessToken - LinkedIn OAuth access token
 */
async function fetchJobPageAuthenticated(url, accessToken) {
  try {
    const response = await axios.get(url, {
      headers: {
        ...BROWSER_HEADERS,
        'Authorization': `Bearer ${accessToken}`,
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const description = extractJobDescription($);
    if (description && description.length > 100) {
      return { success: true, description };
    }
    return { success: false, description: null };
  } catch (err) {
    console.error('LinkedIn authenticated fetch error:', err.message);
    return { success: false, description: null };
  }
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  isConnected,
  fetchJobPageUnauthenticated,
  fetchJobPageAuthenticated,
  getLinkedInToken,
};
