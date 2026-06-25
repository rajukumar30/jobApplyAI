const { parse } = require('csv-parse');
const { db } = require('./firebase/firebaseService');
const crypto = require('crypto');
const HR_KEYWORDS = [
  'recruiter',
  'technical recruiter',
  'talent acquisition',
  'talent partner',
  'hr manager',
  'hr business partner',
  'people operations',
  'people partner',
  'talent scout',
  'campus recruiter',
  'hr executive',
  'hr specialist',
  'hiring manager',
];

// Memory cache handling
let parsedConnectionsCache = null;
let rawAccumulatorCache = [];
let cacheExpirationTime = null;

const CACHE_LIFETIME_MS = 30 * 60 * 1000; // 30 minutes

function getConnectionsCache() {
  if (parsedConnectionsCache && cacheExpirationTime && Date.now() < cacheExpirationTime) {
    return parsedConnectionsCache;
  }
  // Clear expired cache
  parsedConnectionsCache = null;
  cacheExpirationTime = null;
  return null;
}

function setConnectionsCache(data) {
  parsedConnectionsCache = data;
  cacheExpirationTime = Date.now() + CACHE_LIFETIME_MS;
}

function clearConnectionsCache() {
  parsedConnectionsCache = null;
  rawAccumulatorCache = [];
  cacheExpirationTime = null;
}

function processAccumulatedRawData() {
  const hrContacts = [];
  const seenKeys = new Set();
  
  rawAccumulatorCache.forEach(contact => {
    // Check HR Key again just in case
    const isHR = HR_KEYWORDS.some(keyword => contact.title.toLowerCase().includes(keyword));
    
    if (isHR) {
      const uniqueKey = `${contact.name.toLowerCase()}|${contact.company.toLowerCase()}`;
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        hrContacts.push({
          name: contact.name,
          title: contact.title,
          companyName: contact.company || 'Unknown Company',
          location: '', // extensions usually don't have location on this page
          profileUrl: contact.profileUrl
        });
      }
    }
  });

  // Group by Company
  const groupedData = {};
  hrContacts.forEach(contact => {
    const company = contact.companyName;
    if (!groupedData[company]) {
      groupedData[company] = {
        companyName: company,
        hrConnectionsCount: 0,
        primaryLocation: contact.location,
        topRole: '',
        contacts: [],
        _roleCounts: {}
      };
    }

    const group = groupedData[company];
    group.contacts.push(contact);
    group.hrConnectionsCount++;

    const role = contact.title;
    group._roleCounts[role] = (group._roleCounts[role] || 0) + 1;
  });

  const finalArray = Object.values(groupedData).map(group => {
    let maxCount = 0;
    let topRole = '';
    for (const [role, count] of Object.entries(group._roleCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topRole = role;
      }
    }
    group.topRole = topRole;
    delete group._roleCounts;
    return group;
  });

  finalArray.sort((a, b) => b.hrConnectionsCount - a.hrConnectionsCount);

  const resultPayload = {
    totalAnalyzed: rawAccumulatorCache.length,
    companiesFound: finalArray.length,
    data: finalArray
  };

  setConnectionsCache(resultPayload);
  return resultPayload;
}

function processRawConnections(connectionsBatch) {
  // Clear stale accumulator
  if (cacheExpirationTime && Date.now() > cacheExpirationTime) {
    rawAccumulatorCache = [];
  }
  
  rawAccumulatorCache.push(...connectionsBatch);
  return processAccumulatedRawData();
}

/**
 * Gets or creates a JobApply Sync Key for a Firebase UID.
 */
async function getOrCreateSyncKey(uid) {
  if (!db) {
    throw new Error('Firebase is not initialized. Ensure firebase-service-account.json is present.');
  }

  const userRef = db.collection('users').doc(uid);
  const docSnap = await userRef.get();

  if (docSnap.exists) {
    const data = docSnap.data();
    if (data.syncKey) return data.syncKey;
  }

  // Generate a random sync key like JA-XXXX-XXXX
  const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
  const syncKey = `JA-${randomStr.substring(0, 4)}-${randomStr.substring(4)}`;

  await userRef.set({ syncKey, updatedAt: new Date().toISOString() }, { merge: true });
  return syncKey;
}

/**
 * Parses accumulated raw connections and saves HR contacts straight to Firebase.
 */
async function processRawConnectionsToFirebase(connectionsBatch, syncKey) {
  if (!db) {
    throw new Error('Firebase is not initialized. Ensure firebase-service-account.json is present.');
  }

  // 1. Resolve SyncKey to UID
  let uid = null;
  const usersSnapshot = await db.collection('users').where('syncKey', '==', syncKey).limit(1).get();
  
  if (usersSnapshot.empty) {
    throw new Error('Invalid Sync Key provided.');
  }
  
  uid = usersSnapshot.docs[0].id;

  const hrContacts = [];
  
  connectionsBatch.forEach(contact => {
    const title = contact.title || '';
    const isHR = HR_KEYWORDS.some(keyword => title.toLowerCase().includes(keyword));
    
    if (isHR) {
      hrContacts.push({
        name: contact.name || '',
        title: contact.title || '',
        companyName: contact.company || 'Unknown Company',
        location: '', 
        profileUrl: contact.profileUrl || ''
      });
    }
  });

  if (hrContacts.length > 0) {
    const batch = db.batch();
    const connectionsRef = db.collection('users').doc(uid).collection('connections');
    
    hrContacts.forEach(contact => {
      // Use base64 profileUrl or name-company string as doc id to prevent duplicates
      const uniqueIdStr = (contact.profileUrl || `${contact.name}-${contact.companyName}`).replace(/[^a-z0-9]/gi, '_');
      const docRef = connectionsRef.doc(uniqueIdStr);
      batch.set(docRef, { ...contact, importedAt: new Date().toISOString() }, { merge: true });
    });

    await batch.commit();
  }

  return { 
    hrContactsCount: hrContacts.length,
    message: `Batch processed. ${hrContacts.length} HR contacts saved to Firebase.` 
  };
}

/**
 * Fetches user connections from Firebase and groups them for the dashboard.
 */
async function getConnectionsFromFirebase(syncKey) {
  if (!db) {
    throw new Error('Firebase is not initialized.');
  }

  // Resolve syncKey to UID
  let uid = null;
  const usersSnapshot = await db.collection('users').where('syncKey', '==', syncKey).limit(1).get();
  
  if (usersSnapshot.empty) {
    throw new Error('Invalid Sync Key.');
  }
  
  uid = usersSnapshot.docs[0].id;

  const connectionsRef = db.collection('users').doc(uid).collection('connections');
  const snapshot = await connectionsRef.get();
  
  const hrContacts = [];
  snapshot.forEach(doc => {
    hrContacts.push(doc.data());
  });

  // Group by Company
  const groupedData = {};
  hrContacts.forEach(contact => {
    const company = contact.companyName;
    if (!groupedData[company]) {
      groupedData[company] = {
        companyName: company,
        hrConnectionsCount: 0,
        primaryLocation: contact.location || '',
        topRole: '',
        contacts: [],
        _roleCounts: {}
      };
    }

    const group = groupedData[company];
    group.contacts.push(contact);
    group.hrConnectionsCount++;

    const role = contact.title;
    group._roleCounts[role] = (group._roleCounts[role] || 0) + 1;
  });

  const finalArray = Object.values(groupedData).map(group => {
    let maxCount = 0;
    let topRole = '';
    for (const [role, count] of Object.entries(group._roleCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topRole = role;
      }
    }
    group.topRole = topRole;
    delete group._roleCounts;
    return group;
  });

  finalArray.sort((a, b) => b.hrConnectionsCount - a.hrConnectionsCount);

  return {
    totalAnalyzed: hrContacts.length, 
    companiesFound: finalArray.length,
    data: finalArray
  };
}

async function getConnectionsForUser(uid) {
  if (!db) {
    throw new Error('Firebase is not initialized.');
  }

  const connectionsRef = db.collection('users').doc(uid).collection('connections');
  const snapshot = await connectionsRef.get();
  const hrContacts = snapshot.docs.map(doc => doc.data());

  const groupedData = {};
  for (const contact of hrContacts) {
    const company = contact.companyName || 'Unknown Company';
    if (!groupedData[company]) {
      groupedData[company] = {
        companyName: company,
        hrConnectionsCount: 0,
        primaryLocation: contact.location || '',
        topRole: '',
        contacts: [],
        _roleCounts: {},
      };
    }
    const group = groupedData[company];
    group.contacts.push(contact);
    group.hrConnectionsCount++;
    group._roleCounts[contact.title] = (group._roleCounts[contact.title] || 0) + 1;
  }

  const data = Object.values(groupedData).map(group => {
    group.topRole = Object.entries(group._roleCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    delete group._roleCounts;
    return group;
  }).sort((a, b) => b.hrConnectionsCount - a.hrConnectionsCount);

  return { totalAnalyzed: hrContacts.length, companiesFound: data.length, data };
}

async function saveConnectionsForUser(uid, contacts) {
  if (!db) {
    throw new Error('Firebase is not initialized.');
  }
  if (!Array.isArray(contacts) || contacts.length === 0) return;

  const batch = db.batch();
  const connectionsRef = db.collection('users').doc(uid).collection('connections');
  for (const contact of contacts) {
    const uniqueId = (contact.profileUrl || `${contact.name}-${contact.companyName}`)
      .replace(/[^a-z0-9]/gi, '_')
      .slice(0, 120);
    batch.set(connectionsRef.doc(uniqueId), {
      ...contact,
      importedAt: new Date().toISOString(),
    }, { merge: true });
  }
  await batch.commit();
}

/**
 * Parses raw CSV content, validates headers, and extracts HR contacts.
 *
 * @param {string} csvContent
 * @returns {Promise<{
 *   success: boolean,
 *   error?: string,
 *   totalAnalyzed: number,
 *   companiesFound: number,
 *   data?: Object
 * }>}
 */
async function processConnectionsCsv(csvContent) {
  return new Promise((resolve) => {
    parse(csvContent, {
      columns: (headers) => headers.map(h => h.trim().toLowerCase()),
      skip_empty_lines: true,
      relax_quotes: true,
    }, (err, records) => {
      if (err) {
        return resolve({ success: false, error: 'Failed to parse CSV file' });
      }

      if (records.length === 0) {
        return resolve({ success: false, error: 'The uploaded CSV file is empty' });
      }

      // 1. Validate required normalized headers
      const sampleRecord = records[0];
      const requiredColumns = ['first name', 'last name', 'company', 'position'];
      
      const missingColumns = requiredColumns.filter(col => !(col in sampleRecord));
      if (missingColumns.length > 0) {
        return resolve({
          success: false,
          error: `Invalid LinkedIn CSV format. Missing required columns: ${missingColumns.join(', ')}. Please upload the official LinkedIn Connections export.`
        });
      }

      // 2. Identify HR Contacts and Handle Deduplication
      const hrContacts = [];
      const seenKeys = new Set();

      records.forEach(row => {
        const firstName = (row['first name'] || '').trim();
        const lastName = (row['last name'] || '').trim();
        const company = (row['company'] || '').trim();
        const position = (row['position'] || '').trim();
        
        if (!firstName && !lastName) return; // Skip empty rows

        // Check if position contains any HR keywords
        const isHR = HR_KEYWORDS.some(keyword => position.toLowerCase().includes(keyword));

        if (isHR) {
          // Deduplication key
          const uniqueKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${company.toLowerCase()}`;
          
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            
            // Extract optional fields or create fallbacks
            let profileUrl = (row['profile url'] || '').trim();
            if (!profileUrl) {
              const urlSafeName = encodeURIComponent(`${firstName} ${lastName} ${company}`.trim());
              profileUrl = `https://www.linkedin.com/search/results/people/?keywords=${urlSafeName}`;
            }

            hrContacts.push({
              name: `${firstName} ${lastName}`.trim(),
              title: position,
              companyName: company || 'Unknown Company',
              location: (row['location'] || '').trim(),
              profileUrl: profileUrl
            });
          }
        }
      });

      // 3. Group by Company and calculate Top Roles
      const groupedData = {};

      hrContacts.forEach(contact => {
        const company = contact.companyName;
        if (!groupedData[company]) {
          groupedData[company] = {
            companyName: company,
            hrConnectionsCount: 0,
            primaryLocation: contact.location, // Assign first detected location
            topRole: '',
            contacts: [],
            _roleCounts: {} // Internal tracker for top role
          };
        }

        const group = groupedData[company];
        group.contacts.push(contact);
        group.hrConnectionsCount++;

        // Track role frequency for Top Role calculation
        const role = contact.title;
        group._roleCounts[role] = (group._roleCounts[role] || 0) + 1;
      });

      // 4. Calculate Top Role and format final array
      const finalArray = Object.values(groupedData).map(group => {
        // Evaluate highest frequency role
        let maxCount = 0;
        let topRole = '';
        for (const [role, count] of Object.entries(group._roleCounts)) {
          if (count > maxCount) {
            maxCount = count;
            topRole = role;
          }
        }
        
        group.topRole = topRole;
        delete group._roleCounts; // Cleanup internal prop
        return group;
      });

      // 5. Sort Default: Most HR connections first
      finalArray.sort((a, b) => b.hrConnectionsCount - a.hrConnectionsCount);

      const resultPayload = {
        totalAnalyzed: records.length,
        companiesFound: finalArray.length,
        data: finalArray
      };

      // Save to cache
      setConnectionsCache(resultPayload);

      return resolve({
        success: true,
        ...resultPayload
      });
    });
  });
}

/**
 * Returns mock HR connections structured identically to CSV grouping logic for testing.
 */
function getMockConnections() {
  return [
    {
      companyName: "NitiGlobal",
      hrConnectionsCount: 3,
      topRole: "Talent Acquisition",
      primaryLocation: "Bangalore",
      contacts: [
        { name: "Pooja Sharma", title: "Talent Acquisition Specialist", companyName: "NitiGlobal", location: "Bangalore", profileUrl: "https://linkedin.com/in/poojasharma" },
        { name: "Rahul Mehta", title: "HR Manager", companyName: "NitiGlobal", location: "Delhi", profileUrl: "https://linkedin.com/in/rahulmehta" },
        { name: "Amit Verma", title: "Campus Recruiter", companyName: "NitiGlobal", location: "Bangalore", profileUrl: "https://linkedin.com/in/amitverma" }
      ]
    },
    {
      companyName: "Accenture",
      hrConnectionsCount: 2,
      topRole: "Recruiter",
      primaryLocation: "Mumbai",
      contacts: [
        { name: "Anita Singh", title: "Recruiter", companyName: "Accenture", location: "Mumbai", profileUrl: "https://linkedin.com/in/anitasingh" },
        { name: "Vikram Reddy", title: "Technical Recruiter", companyName: "Accenture", location: "Pune", profileUrl: "https://www.linkedin.com/search/results/people/?keywords=Vikram%20Reddy%20Accenture" }
      ]
    },
    {
      companyName: "Deloitte",
      hrConnectionsCount: 1,
      topRole: "Talent Partner",
      primaryLocation: "Gurgaon",
      contacts: [
        { name: "Neha Gupta", title: "Talent Partner", companyName: "Deloitte", location: "Gurgaon", profileUrl: "https://linkedin.com/in/nehagupta" }
      ]
    }
  ];
}

module.exports = {
  processConnectionsCsv,
  processRawConnections,
  getConnectionsCache,
  clearConnectionsCache,
  getMockConnections,
  getOrCreateSyncKey,
  processRawConnectionsToFirebase,
  getConnectionsFromFirebase,
  getConnectionsForUser,
  saveConnectionsForUser,
};
