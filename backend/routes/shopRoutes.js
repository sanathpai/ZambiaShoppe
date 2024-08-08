const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const auth = require('../src/middleware/auth');

router.post('/', auth, shopController.addShop);
router.get('/:id', auth, shopController.getShop);
router.get('/', auth, shopController.getAllShops);
router.put('/:id', auth, shopController.updateShop);
router.delete('/:id', auth, shopController.deleteShop);

module.exports = router;
