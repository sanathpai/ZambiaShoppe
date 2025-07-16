const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const auth = require('../src/middleware/auth');
const router = express.Router();

router.post('/', auth, inventoryController.addInventory);
router.get('/', auth, inventoryController.getAllInventories);
router.get('/:id', auth, inventoryController.getInventoryById);
router.put('/:id', auth, inventoryController.updateInventory);
router.put('/:id/limit', auth, inventoryController.updateInventoryLimit);
router.delete('/:id', auth, inventoryController.deleteInventory);
router.post(
  '/reconcile/:id',
  auth,
  inventoryController.reconcileInventory
);
router.post('/restock', auth, inventoryController.restockInventory);
router.post('/convert', auth, inventoryController.convertInventoryUnit);

module.exports = router;
