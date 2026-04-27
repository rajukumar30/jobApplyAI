const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');

// List all sent applications
router.get('/', applicationController.listApplications);

// Check if a company is a duplicate
router.get('/check', applicationController.checkDuplicate);

// Delete an application record by ID
router.delete('/:id', applicationController.deleteApplication);

module.exports = router;
