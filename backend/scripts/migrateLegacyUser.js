const fs = require('fs');
const path = require('path');
const {
  getUserResumeDir,
  getUserGeneratedDir,
  readUserJson,
  writeUserJson,
} = require('../services/userStorage');

const userId = process.env.FIREBASE_UID;
if (!userId) {
  throw new Error('Set FIREBASE_UID to the Firebase account that owns the legacy data.');
}

function moveFiles(sourceDir, destinationDir) {
  if (!fs.existsSync(sourceDir)) return 0;
  let moved = 0;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = path.join(sourceDir, entry.name);
    const destination = path.join(destinationDir, entry.name);
    if (!fs.existsSync(destination)) {
      fs.renameSync(source, destination);
      moved++;
    }
  }
  return moved;
}

function migrateJson(sourcePath, destinationName) {
  if (!fs.existsSync(sourcePath)) return 0;
  const legacy = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  if (!Array.isArray(legacy)) return 0;

  const existing = readUserJson(userId, destinationName, []);
  const migrated = legacy.map(item => ({ ...item, userId }));
  const seen = new Set(existing.map(item => item.id || item.filename || item.appliedAt));
  const additions = migrated.filter(item => !seen.has(item.id || item.filename || item.appliedAt));
  writeUserJson(userId, destinationName, [...existing, ...additions]);
  return additions.length;
}

const backendDir = path.join(__dirname, '..');
const resumeCount = migrateJson(
  path.join(backendDir, 'data', 'resumeStore.json'),
  'resumeStore.json'
);
const applicationCount = migrateJson(
  path.join(backendDir, 'data', 'sent-applications.json'),
  'sent-applications.json'
);
const resumeFiles = moveFiles(path.join(backendDir, 'resumes'), getUserResumeDir(userId));
const generatedFiles = moveFiles(
  path.join(backendDir, 'generated-resumes'),
  getUserGeneratedDir(userId)
);

console.log(JSON.stringify({
  userId,
  resumeRecordsMigrated: resumeCount,
  applicationRecordsMigrated: applicationCount,
  resumeFilesMoved: resumeFiles,
  generatedFilesMoved: generatedFiles,
}, null, 2));
