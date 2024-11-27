const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const auth = require('../src/middleware/auth');

router.post('/', auth, unitController.addUnit);
router.get('/:id', auth, unitController.getUnit);
router.get('/', auth, unitController.getAllUnits);
router.get('/product/:productId', auth, unitController.getUnitsByProductId);
router.put('/:id', auth, unitController.updateUnit); // Ensure this is defined
router.delete('/:id', auth, unitController.deleteUnit);
router.get('/product/:productId/unitInfo',auth, unitController.getUnitsByProduct);

module.exports = router;
