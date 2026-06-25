const { db } = require('./firebase/firebaseService');
const { readUserJson, writeUserJson } = require('./userStorage');

// Helper to read local applications
function readLocalApplications(userId) {
  return readUserJson(userId, 'sent-applications.json', []).map((entry, index) => ({
    id: entry.id || `local_${index}_${entry.appliedAt || entry.date || 'legacy'}`,
    ...entry,
  }));
}

// Helper to write local applications
function writeLocalApplications(userId, apps) {
  writeUserJson(userId, 'sent-applications.json', apps);
}

/**
 * Read all sent applications
 * @returns {Promise<Array>}
 */
async function readApplications(userId) {
  if (!db) {
    return readLocalApplications(userId);
  }
  try {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('applications')
      .orderBy('appliedAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Firebase read error (applications):', error.message);
    return readLocalApplications(userId);
  }
}

/**
 * Check if an application to the given company already exists.
 * @param {string} companyName
 * @returns {Promise<Array>}
 */
async function checkDuplicate(userId, companyName) {
  if (!companyName) return [];
  try {
    const normalized = companyName.toLowerCase().trim();
    const apps = await readApplications(userId);
    return apps.filter(a => a.company && a.company.toLowerCase().trim() === normalized);
  } catch (error) {
    console.error('Firebase check duplicate error:', error.message);
    return [];
  }
}

/**
 * Save a successfully sent application to the store.
 * @param {{ company, role, email, resume, date }} data
 * @returns {Promise<Object>}
 */
async function saveApplication(userId, { company, role, email, resume }) {
  const entry = {
    id: `application_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    userId,
    company: company || 'Unknown Company',
    role: role || 'Unknown Role',
    email: email || null,
    resume: resume || null,
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    appliedAt: new Date().toISOString(),
  };

  if (!db) {
    const localApps = readLocalApplications(userId);
    localApps.push(entry);
    writeLocalApplications(userId, localApps);
    console.log(`📋 Application saved to LOCAL storage: ${entry.role} @ ${entry.company}`);
    return entry;
  }

  try {
    const docRef = await db
      .collection('users')
      .doc(userId)
      .collection('applications')
      .add(entry);
    console.log(`📋 Application saved to Firebase: ${entry.role} @ ${entry.company} (ID: ${docRef.id})`);
    return { id: docRef.id, ...entry };
  } catch (error) {
    console.error('Firebase save error (applications):', error.message);
    // Fallback to local
    const localApps = readLocalApplications(userId);
    localApps.push(entry);
    writeLocalApplications(userId, localApps);
    return entry;
  }
}

/**
 * Delete a specific application record by ID.
 * @param {string} id
 */
async function deleteApplication(userId, id) {
  if (!db) {
    const localApps = readLocalApplications(userId);
    const filtered = localApps.filter(app => String(app.id) !== String(id));
    if (filtered.length === localApps.length) return false;
    writeLocalApplications(userId, filtered);
    return true;
  }
  try {
    await db
      .collection('users')
      .doc(userId)
      .collection('applications')
      .doc(id)
      .delete();
    console.log(`🗑️ Application deleted from Firebase (ID: ${id})`);
    return true;
  } catch (error) {
    console.error('Firebase delete error (applications):', error.message);
    return false;
  }
}

module.exports = { readApplications, checkDuplicate, saveApplication, deleteApplication };
