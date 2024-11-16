const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Unit = require('../models/Unit');
const convertUnits = require('../utils/unitConversion');
const db = require('../config/db');
const moment = require('moment');

// Add a new purchase and update inventory stock
// Add a new purchase and update inventory stock
exports.addPurchase = async (req, res) => {
  try {
    const { product_name, variety, supplier_name, market_name, order_price, quantity, purchase_date, unit_id } = req.body;
    const user_id = req.user.id;

    // Fetch shop_name from Users table
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found');
    const shop_name = user[0].shop_name;

    // Fetch product details
    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error('Product not found');

    // Fetch the inventory
    let inventory = await Inventory.findByProductAndUser(product.product_id, user_id);
    if (!inventory) {
      throw new Error('Inventory not found. Please add the item to inventory first.');
    }

    // **Log the unit_ids for debugging**
    console.log(`Converting from unit_id: ${unit_id} to inventory.unit_id: ${inventory.unit_id}`);

    // Convert purchased quantity to inventory unit type
    const convertedQuantity = await convertUnits(quantity, unit_id, inventory.unit_id);

    // Update the inventory stock
    const newStock = parseFloat(inventory.current_stock) + parseFloat(convertedQuantity);
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    // Add purchase entry
    const purchase = {
      product_id: product.product_id,
      supplier_name,
      market_name,
      order_price,
      quantity,
      unit_id,
      purchase_date,
      user_id,
      shop_name,
    };
    const purchaseId = await Purchase.create(purchase);

    res.status(201).json({ purchaseId });
  } catch (error) {
    console.error('Error adding purchase:', error);
    res.status(500).json({ error: error.message });
  }
};


// Get all purchases for the authenticated user
exports.getAllPurchases = async (req, res) => {
  try {
    const user_id = req.user.id;
    const purchases = await Purchase.findAllByUser(user_id);
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get purchase by ID for the authenticated user
exports.getPurchaseById = async (req, res) => {
  try {
    const user_id = req.user.id;
    const purchaseId = req.params.id;
    const purchase = await Purchase.findByIdAndUser(purchaseId, user_id);

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    res.json(purchase);
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update a purchase and adjust inventory stock accordingly
exports.updatePurchase = async (req, res) => {
  try {
    const user_id = req.user.id;
    const purchaseId = req.params.id;
    const { product_name, variety, supplier_name, market_name, order_price, quantity, purchase_date, unit_id } = req.body;

    // Fetch the old purchase details
    const oldPurchase = await Purchase.findByIdAndUser(purchaseId, user_id);
    if (!oldPurchase) throw new Error('Purchase not found');

    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error('Product not found');

    let inventory = await Inventory.findByProductAndUser(product.product_id, user_id);
    if (!inventory) {
      throw new Error('Inventory not found. Please add the item to inventory first.');
    }

    // Convert old and new quantities to the inventory unit type
    const oldConvertedQuantity = await convertUnits(oldPurchase.quantity, oldPurchase.unit_id, inventory.unit_id);
    console.log(`This is the old Converted Quantity:${oldConvertedQuantity}`);
    console.log(`This is the unit id:${unit_id}`);
    const newConvertedQuantity = await convertUnits(quantity, unit_id, inventory.unit_id);
    console.log(`This is the new Converted Quantity:${newConvertedQuantity}`);
    // Adjust the inventory stock
    const newStock = inventory.current_stock - oldConvertedQuantity + newConvertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    // Update purchase entry
    const purchase = {
      product_id: product.product_id,
      supplier_name,
      market_name,
      order_price,
      quantity,     // Update quantity
      purchase_date,
      unit_id,      // Update with the new unit_id
      user_id,
      shop_name: oldPurchase.shop_name // Keep the old shop name
    };
    const success = await Purchase.updateByIdAndUser(purchaseId, purchase, user_id);

    if (!success) {
      return res.status(404).json({ error: 'Purchase not found or not updated' });
    }

    res.status(200).json({ message: 'Purchase updated successfully' });
  } catch (error) {
    console.error('Error updating purchase:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a purchase and adjust inventory stock accordingly
exports.deletePurchase = async (req, res) => {
  try {
    const user_id = req.user.id;
    const purchaseId = req.params.id;

    // Fetch the purchase details
    const oldPurchase = await Purchase.findByIdAndUser(purchaseId, user_id);
    if (!oldPurchase) throw new Error('Purchase not found');

    let inventory = await Inventory.findByProductAndUser(oldPurchase.product_id, user_id);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Convert old quantity to inventory unit type and adjust the stock
    const oldConvertedQuantity = await convertUnits(oldPurchase.quantity, oldPurchase.unit_id, inventory.unit_id);
    const newStock = inventory.current_stock - oldConvertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    // Delete purchase entry
    const success = await Purchase.deleteByIdAndUser(purchaseId, user_id);

    if (!success) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    res.status(200).json({ message: 'Purchase deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({ error: error.message });
  }
};
