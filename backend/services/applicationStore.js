const path = require('path');
const fs = require('fs');
const { db } = require('./firebase/firebaseService');

const LOCAL_STORE_PATH = path.join(__dirname, '../data/sent-applications.json');

// Helper to read local applications
function readLocalApplications() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

// Helper to write local applications
function writeLocalApplications(apps) {
  fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(apps, null, 2));
}

/**
 * Read all sent applications
 * @returns {Promise<Array>}
 */
async function readApplications() {
  if (!db) {
    return readLocalApplications();
  }
  try {
    const snapshot = await db.collection('applications').orderBy('appliedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Firebase read error (applications):', error.message);
    return readLocalApplications(); // Fallback to local on error
  }
}

/**
 * Check if an application to the given company already exists.
 * @param {string} companyName
 * @returns {Promise<Array>}
 */
async function checkDuplicate(companyName) {
  if (!companyName) return [];
  try {
    const normalized = companyName.toLowerCase().trim();
    const apps = await readApplications();
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
async function saveApplication({ company, role, email, resume }) {
  const entry = {
    company: company || 'Unknown Company',
    role: role || 'Unknown Role',
    email: email || null,
    resume: resume || null,
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    appliedAt: new Date().toISOString(),
  };

  if (!db) {
    const localApps = readLocalApplications();
    localApps.push(entry);
    writeLocalApplications(localApps);
    console.log(`📋 Application saved to LOCAL storage: ${entry.role} @ ${entry.company}`);
    return entry;
  }

  try {
    const docRef = await db.collection('applications').add(entry);
    console.log(`📋 Application saved to Firebase: ${entry.role} @ ${entry.company} (ID: ${docRef.id})`);
    return { id: docRef.id, ...entry };
  } catch (error) {
    console.error('Firebase save error (applications):', error.message);
    // Fallback to local
    const localApps = readLocalApplications();
    localApps.push(entry);
    writeLocalApplications(localApps);
    return entry;
  }
}

/**
 * Delete a specific application record by ID.
 * @param {string} id
 */
async function deleteApplication(id) {
  if (!db) {
    return false;
  }
  try {
    await db.collection('applications').doc(id).delete();
    console.log(`🗑️ Application deleted from Firebase (ID: ${id})`);
    return true;
  } catch (error) {
    console.error('Firebase delete error (applications):', error.message);
    return false;
  }
}

module.exports = { readApplications, checkDuplicate, saveApplication, deleteApplication };
