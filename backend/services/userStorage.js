const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.join(__dirname, '../data/users');
const RESUME_ROOT = path.join(__dirname, '../resumes');
const GENERATED_ROOT = path.join(__dirname, '../generated-resumes');

function assertUserId(userId) {
  if (!userId || !/^[a-zA-Z0-9_-]{1,128}$/.test(userId)) {
    throw new Error('Invalid user identity.');
  }
  return userId;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getUserDataDir(userId) {
  return ensureDir(path.join(DATA_ROOT, assertUserId(userId)));
}

function getUserResumeDir(userId) {
  return ensureDir(path.join(RESUME_ROOT, assertUserId(userId)));
}

function getUserGeneratedDir(userId) {
  return ensureDir(path.join(GENERATED_ROOT, assertUserId(userId)));
}

function getUserJsonPath(userId, filename) {
  return path.join(getUserDataDir(userId), filename);
}

function readUserJson(userId, filename, fallback) {
  const filePath = getUserJsonPath(userId, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeUserJson(userId, filename, data) {
  const filePath = getUserJsonPath(userId, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  getUserDataDir,
  getUserResumeDir,
  getUserGeneratedDir,
  getUserJsonPath,
  readUserJson,
  writeUserJson,
};
