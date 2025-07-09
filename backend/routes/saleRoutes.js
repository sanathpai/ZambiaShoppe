const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const auth = require('../src/middleware/auth');

router.post('/', auth, saleController.addSale);
router.get('/price-suggestions/:productId/:unitId', auth, saleController.getPriceSuggestions);
router.get('/diagnose', auth, saleController.diagnoseSaleIssues);
router.get('/', auth, saleController.getAllSales);
router.get('/:id', auth, saleController.getSaleById);
router.put('/:id', auth, saleController.updateSale);
router.delete('/:id', auth, saleController.deleteSale);

module.exports = router;
