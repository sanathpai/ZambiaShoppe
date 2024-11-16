const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const convertUnits = require('../utils/unitConversion');
const db = require('../config/db');
const moment = require('moment');

// Add a new sale and update inventory stock
exports.addSale = async (req, res) => {
  try {
    const { product_name, variety, retail_price, quantity, sale_date, unit_id } = req.body;
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

    // Convert sale quantity to inventory unit type
    const convertedQuantity = await convertUnits(quantity, unit_id, inventory.unit_id);

    // Ensure sufficient stock is available
    if (parseFloat(inventory.current_stock) < parseFloat(convertedQuantity)) {
      throw new Error('Insufficient stock available');
    }

    // Update the inventory stock
    const newStock = parseFloat(inventory.current_stock) - parseFloat(convertedQuantity);
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    // Add sale entry
    const sale = {
      product_id: product.product_id,
      retail_price,
      quantity,
      unit_id,
      sale_date,
      user_id,
      shop_name
    };
    const saleId = await Sale.create(sale);

    res.status(201).json({ saleId });
  } catch (error) {
    console.error('Error adding sale:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all sales for the authenticated user
exports.getAllSales = async (req, res) => {
  try {
    const user_id = req.user.id;
    const sales = await Sale.findAllByUser(user_id);
    res.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get sale by ID for the authenticated user
exports.getSaleById = async (req, res) => {
  try {
    const user_id = req.user.id;
    const saleId = req.params.id;
    const sale = await Sale.findByIdAndUser(saleId, user_id);

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update a sale and adjust inventory stock accordingly
exports.updateSale = async (req, res) => {
  try {
    const user_id = req.user.id;
    const saleId = req.params.id;
    const { product_name, variety, retail_price, quantity, sale_date, unit_id } = req.body;

    // Fetch the old sale details
    const oldSale = await Sale.findByIdAndUser(saleId, user_id);
    if (!oldSale) throw new Error('Sale not found');

    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error('Product not found');

    let inventory = await Inventory.findByProductAndUser(product.product_id, user_id);
    if (!inventory) {
      throw new Error('Inventory not found. Please add the item to inventory first.');
    }

    // Convert old and new quantities to the inventory unit type
    const oldConvertedQuantity = await convertUnits(
      parseFloat(oldSale.quantity), 
      oldSale.unit_id, 
      inventory.unit_id
    );

    const newConvertedQuantity = await convertUnits(
      parseFloat(quantity), 
      unit_id, 
      inventory.unit_id
    );

    console.log(`Converted Quantities - Old: ${oldConvertedQuantity}, New: ${newConvertedQuantity}`);

    if (isNaN(oldConvertedQuantity) || isNaN(newConvertedQuantity)) {
      throw new Error('Conversion resulted in NaN. Check unit conversions and inputs.');
    }

    // Adjust the inventory stock
    const currentStock = parseFloat(inventory.current_stock);
    const newStock = currentStock + oldConvertedQuantity - newConvertedQuantity;

    if (isNaN(newStock)) {
      throw new Error(`Calculated stock is NaN. Current stock: ${currentStock}`);
    }

    if (newStock < 0) throw new Error('Insufficient stock available for this update.');

    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    // Update sale entry
    const sale = {
      product_id: product.product_id,
      retail_price,
      quantity,
      sale_date,
      unit_id,
      user_id,
      shop_name: oldSale.shop_name // Keep the old shop name
    };
    const success = await Sale.updateByIdAndUser(saleId, sale, user_id);

    if (!success) {
      return res.status(404).json({ error: 'Sale not found or not updated' });
    }

    res.status(200).json({ message: 'Sale updated successfully' });
  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a sale and adjust inventory stock accordingly
exports.deleteSale = async (req, res) => {
  try {
    const user_id = req.user.id;
    const saleId = req.params.id;

    // Fetch the sale details
    const oldSale = await Sale.findByIdAndUser(saleId, user_id);
    if (!oldSale) throw new Error('Sale not found');

    let inventory = await Inventory.findByProductAndUser(oldSale.product_id, user_id);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Convert old quantity to inventory unit type and adjust the stock
    const oldConvertedQuantity = await convertUnits(oldSale.quantity, oldSale.unit_id, inventory.unit_id);
    const newStock = inventory.current_stock + oldConvertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    // Delete sale entry
    const success = await Sale.deleteByIdAndUser(saleId, user_id);

    if (!success) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.status(200).json({ message: 'Sale deleted successfully' });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({ error: error.message });
  }
};
