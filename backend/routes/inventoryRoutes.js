const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const auth = require('../src/middleware/auth'); // Ensure this is the correct path to your auth middleware

router.post('/', auth, inventoryController.addInventory);
router.get('/', auth, inventoryController.getAllInventories);
router.put('/:id', auth, inventoryController.updateInventory);
router.get('/:id', auth, inventoryController.getInventoryById);
router.delete('/:id', auth, inventoryController.deleteInventory);
router.post('/restock', auth, inventoryController.restockInventory);
router.post('/reconcile/:id', auth, inventoryController.reconcileInventory);
router.post('/convert', auth, inventoryController.convertInventoryUnit);

module.exports = router;
