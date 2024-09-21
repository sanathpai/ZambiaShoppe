const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const auth = require('../src/middleware/auth');

router.post('/', auth, purchaseController.addPurchase);
router.get('/', auth, purchaseController.getAllPurchases);
router.get('/:id', auth, purchaseController.getPurchaseById); 
router.put('/:id', auth, purchaseController.updatePurchase); 
router.delete('/:id', auth, purchaseController.deletePurchase);

module.exports = router;
