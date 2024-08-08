const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const auth = require('../src/middleware/auth');

router.post('/', auth, supplierController.addSupplier);
router.get('/', auth, supplierController.getAllSuppliers);
router.get('/:id', auth, supplierController.getSupplier);
router.put('/:id', auth, supplierController.updateSupplier);
router.delete('/:id', auth, supplierController.deleteSupplier);

module.exports = router;
