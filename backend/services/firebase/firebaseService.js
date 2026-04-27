const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;
let bucket = null;

function initFirebase() {
  if (admin.apps.length > 0) {
    db = admin.firestore();
    bucket = admin.storage().bucket();
    return { db, bucket };
  }

  try {
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('⚠️ Firebase Warning: firebase-service-account.json not found in backend directory. Firebase features will not work until you add it.');
      return { db: null, bucket: null };
    }

    const serviceAccount = require(serviceAccountPath);
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!storageBucket || storageBucket === 'your-project-id.appspot.com') {
      console.warn('⚠️ Firebase Warning: FIREBASE_STORAGE_BUCKET is not set correctly in .env.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket || undefined
    });

    db = admin.firestore();
    bucket = admin.storage().bucket();

    console.log('🔥 Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
  }

  return { db, bucket };
}

// Auto-initialize on import
const { db: firestore, bucket: storageBucket } = initFirebase();

module.exports = {
  admin,
  db: firestore,
  bucket: storageBucket,
  initFirebase
};
