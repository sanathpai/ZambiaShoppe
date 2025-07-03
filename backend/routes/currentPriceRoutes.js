const express = require('express');
const router = express.Router();
const currentPriceController = require('../controllers/currentPriceController');
const auth = require('../src/middleware/auth');

// Get all current prices for the authenticated user
router.get('/', auth, currentPriceController.getAllCurrentPrices);

// Get price suggestions for a product (includes units without prices)
router.get('/suggestions/:productId', auth, currentPriceController.getPriceSuggestions);

// Get current prices for a specific product (all units)
router.get('/product/:productId', auth, currentPriceController.getCurrentPricesByProduct);

// Get current price for specific product-unit combination
router.get('/:productId/:unitId', auth, currentPriceController.getCurrentPrice);

// Create or update current price
router.post('/', auth, currentPriceController.upsertCurrentPrice);

// Update only retail price
router.patch('/:productId/:unitId/retail', auth, currentPriceController.updateRetailPrice);

// Update only order price
router.patch('/:productId/:unitId/order', auth, currentPriceController.updateOrderPrice);

// Delete current price
router.delete('/:productId/:unitId', auth, currentPriceController.deleteCurrentPrice);

module.exports = router; 