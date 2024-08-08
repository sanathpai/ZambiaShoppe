// routes/marketRoutes.js
const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');
const auth = require('../src/middleware/auth');

router.post('/', auth, marketController.addMarket);
router.get('/', auth, marketController.getAllMarkets);
router.get('/:id', auth, marketController.getMarketById);
router.put('/:id', auth, marketController.updateMarket); 
router.delete('/:id', auth, marketController.deleteMarket);

module.exports = router;
