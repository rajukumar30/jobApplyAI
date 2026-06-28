const multer = require('multer');
const path = require('path');

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const ALLOWED_EXT = new Set(['.pdf', '.txt', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_MIMES.has(file.mimetype) || ALLOWED_EXT.has(ext)) {
    cb(null, true);
    return;
  }
  cb(new Error('Unsupported file type. Use PDF, TXT, DOC, DOCX, or an image (JPG/PNG/WebP).'), false);
}

const jdUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

module.exports = jdUpload;
