const { admin } = require('../services/firebase/firebaseService');

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }

  // EventSource and browser downloads cannot set Authorization headers.
  if (typeof req.query?.authToken === 'string') {
    return req.query.authToken;
  }

  return null;
}

async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      picture: decoded.picture || null,
    };
    return next();
  } catch (error) {
    console.warn('Firebase token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

module.exports = { requireAuth, getBearerToken };
