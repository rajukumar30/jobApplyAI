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

  // If Firebase Admin failed to initialize (e.g. the service-account env var is
  // missing in production), verifyIdToken throws and the user sees a misleading
  // "Invalid or expired authentication token." Detect that misconfiguration
  // explicitly so the real cause is obvious in logs and the response.
  if (!admin.apps || admin.apps.length === 0) {
    console.error(
      '❌ Auth misconfigured: Firebase Admin is not initialized. ' +
      'Set FIREBASE_SERVICE_ACCOUNT_JSON (full JSON) in the backend environment.'
    );
    return res.status(500).json({ error: 'Server authentication is not configured.' });
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
    // Surface the underlying Firebase error code (e.g. auth/id-token-expired,
    // auth/argument-error) so production failures are diagnosable.
    console.warn(`Firebase token verification failed [${error.code || 'unknown'}]:`, error.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

module.exports = { requireAuth, getBearerToken };
