const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const auth = require('../src/middleware/auth');

// DEBUG MIDDLEWARE for unit routes
router.use((req, res, next) => {
  console.log(`=== UNIT ROUTES DEBUG ===`);
  console.log(`Unit route hit - Method: ${req.method}, URL: ${req.url}`);
  console.log(`=========================`);
  next();
});

router.post('/', auth, unitController.addUnit);
router.get('/debug-db', auth, unitController.debugDatabaseInfo);
router.get('/:id', auth, unitController.getUnit);
router.get('/', auth, unitController.getAllUnits);
router.get('/product/:productId', auth, unitController.getUnitsByProductId);
router.put('/:id', auth, unitController.updateUnit); // Ensure this is defined
router.delete('/:id', auth, unitController.deleteUnit);
router.get('/product/:productId/unitInfo',auth, unitController.getUnitsByProduct);

module.exports = router;
