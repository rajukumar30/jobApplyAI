const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the resumes directory exists
const resumesDir = path.join(__dirname, '../resumes');
if (!fs.existsSync(resumesDir)) {
  fs.mkdirSync(resumesDir, { recursive: true });
}

// Storage configuration — keep original filename with timestamp prefix
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resumesDir);
  },
  filename: (req, file, cb) => {
    // Sanitize original name and add timestamp to avoid collisions
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    cb(null, `${timestamp}_${sanitized}`);
  },
});

// Filter — only allow PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max per file
    files: 10, // max 10 files at once
  },
});

module.exports = upload;
