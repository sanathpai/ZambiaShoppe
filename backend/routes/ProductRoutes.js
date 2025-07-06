const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../src/middleware/auth');

router.post('/', auth, productController.createProduct);
router.get('/', auth, productController.getAllProducts);
router.get('/search', auth, productController.searchProducts); // New search route
router.get('/usage', auth, productController.getProductUsage); // Move this before parameterized routes
router.get('/brands/:productName', auth, productController.getBrandsByProductName); // Get brands for a product
router.post('/copy/:id', auth, productController.copyProduct);
router.get('/:id', auth, productController.getProductById);
router.put('/:id', auth, productController.updateProduct);
router.delete('/:id', auth, productController.deleteProduct);

module.exports = router;
