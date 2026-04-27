const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const resumeController = require('../controllers/resumeController');

// Upload one or more resumes (PDF)
router.post('/upload', upload.array('resumes', 10), resumeController.uploadResumes);

// List all parsed resumes
router.get('/', resumeController.listResumes);

// Download a resume
router.get('/download/:filename', resumeController.downloadResume);

// Delete a resume by filename
router.delete('/:filename', resumeController.deleteResume);

module.exports = router;
