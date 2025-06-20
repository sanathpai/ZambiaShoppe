const express = require('express');
const router = express.Router();
const insightsController = require('../controllers/insightsController');
const auth = require('../src/middleware/auth');

// Get insights data for a specific user
router.get('/:userId', auth, insightsController.getInsightsData);

// Check if user has new insights since last viewed
router.get('/:userId/check-new', auth, insightsController.checkNewInsights);

// Mark insights as viewed by user
router.post('/:userId/mark-viewed', auth, insightsController.markInsightsViewed);

// Get insights statistics for a user
router.get('/:userId/stats', auth, insightsController.getInsightsStats);

// Create or update insights (for professor's use - might need different auth)
router.post('/', auth, insightsController.createOrUpdateInsights);

module.exports = router; 