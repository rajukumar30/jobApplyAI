const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;
let bucket = null;

function configureFirestore(instance) {
  if (!instance || instance.__settingsApplied) return instance;
  try {
    instance.settings({ ignoreUndefinedProperties: true });
    instance.__settingsApplied = true;
  } catch (error) {
    // settings() can only be called once before first use; ignore if already set.
  }
  return instance;
}

function initFirebase() {
  if (admin.apps.length > 0) {
    db = configureFirestore(admin.firestore());
    return { db, bucket };
  }

  try {
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson && !fs.existsSync(serviceAccountPath)) {
      console.warn('⚠️ Firebase Warning: firebase-service-account.json not found in backend directory. Firebase features will not work until you add it.');
      return { db: null, bucket: null };
    }

    const serviceAccount = serviceAccountJson
      ? JSON.parse(serviceAccountJson)
      : require(serviceAccountPath);
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

    if (!storageBucket || storageBucket === 'your-project-id.appspot.com') {
      console.warn('⚠️ Firebase Warning: FIREBASE_STORAGE_BUCKET is not set correctly in .env.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket || undefined
    });

    db = configureFirestore(admin.firestore());
    bucket = storageBucket ? admin.storage().bucket(storageBucket) : null;

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
