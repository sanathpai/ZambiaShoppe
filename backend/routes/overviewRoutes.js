const express = require('express');
const router = express.Router();
const overviewController = require('../controllers/overviewController');
const auth = require('../src/middleware/auth');

// router.get('/', auth, overviewController.getOverviewData);
router.get('/',auth, overviewController.getProfitsData);
router.get('/calculate-profit',auth, overviewController.getProfitInSelectedUnit);

module.exports = router;
