const express = require('express');
const multer = require('multer');
const dmController = require('../controllers/dmController');

const router = express.Router();

// Configuration for CSV file uploads into memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files are allowed.'), false);
    }
  }
});

// Routes
router.get('/sync-key', dmController.getSyncKey);
router.get('/connections', dmController.getConnections);
router.post('/upload-connections', upload.single('csvFile'), dmController.uploadConnections);
router.post('/import-connections', express.json({ limit: '10mb' }), dmController.importConnections);
router.post('/generate-message', express.json(), dmController.generateMessage);

// Error handler for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  } else if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

module.exports = router;
