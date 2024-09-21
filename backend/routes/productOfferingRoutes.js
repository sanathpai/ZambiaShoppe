const express = require('express');
const router = express.Router();
const productOfferingController = require('../controllers/productOfferingController');
const auth = require('../src/middleware/auth');

router.post('/', auth, productOfferingController.addProductOffering);
router.get('/', auth, productOfferingController.getAllProductOfferings);
router.get('/:id', auth, productOfferingController.getProductOfferingById);
router.put('/:id', auth, productOfferingController.updateProductOffering); 
router.delete('/:id', auth, productOfferingController.deleteProductOffering); 

module.exports = router;
