const Inventory = require('../models/Inventory');
const Shop = require('../models/Shop');
const ProductOffering = require('../models/ProductOffering');
const Product = require('../models/Product');
const Unit = require('../models/Unit');
const db = require('../config/db');
const convertUnits = require('../utils/unitConversion');



exports.addInventory = async (req, res) => {
  try {
    const { product_name, variety, current_stock, unit_type } = req.body;
    const user_id = req.user.id;

    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found');
    const shop_name = user[0].shop_name;

    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error('Product not found');
    const product_id = product.product_id;

    const offering = await ProductOffering.findByShopProductVarietyAndUser(shop_name, product_name, variety, user_id);
    if (!offering) throw new Error('Offering not found');
    const offering_id = offering.offering_id;

    // Check if the offering_id already exists in the inventory for the user
    const [existingInventory] = await db.query(
      'SELECT * FROM Inventories WHERE offering_id = ? AND user_id = ?',
      [offering_id, user_id]
    );

    if (existingInventory.length > 0) {
      return res.status(400).json({ error: 'Inventory for this offering already exists' });
    }

    const inventory = {
      shop_name,
      offering_id,
      current_stock,
      user_id,
      unit_type
    };
    const inventoryId = await Inventory.create(inventory);

    res.status(201).json({ inventoryId });
  } catch (error) {
    console.error('Error adding inventory:', error);
    res.status(500).json({ error: error.message });
  }
};





exports.getAllInventories = async (req, res) => {
  try {
    const user_id = req.user.id;
    const inventories = await Inventory.findAllByUser(user_id);
    res.json(inventories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateInventory = async (req, res) => {
  try {
    const { product_name, current_stock, unit_type } = req.body;
    const user_id = req.user.id;
    const inventoryId = req.params.id;

    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found');
    const shop_name = user[0].shop_name;

    const product = await Product.findByNameAndUser(product_name, user_id);
    if (!product) throw new Error('Product not found');
    const product_id = product.product_id;

    const offering = await ProductOffering.findByShopAndProductAndUser(shop_name, product_id, user_id);
    if (!offering) throw new Error('Offering not found');
    const offering_id = offering.offering_id;

    const inventory = { shop_name, offering_id, current_stock, user_id, unit_type };
    const result = await Inventory.update(inventoryId, inventory);

    if (result === 0) {
      return res.status(404).json({ error: 'Inventory not found or no changes made' });
    }

    res.status(200).json({ message: 'Inventory updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteInventory = async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const result = await Inventory.delete(inventoryId);

    if (result === 0) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    res.status(200).json({ message: 'Inventory deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.restockInventory = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { offering_id, quantity, unit_type } = req.body;

    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found');
    const shop_name = user[0].shop_name;

    let inventory = await Inventory.findByOfferingAndShopAndUser(offering_id, shop_name, user_id);

    if (!inventory) {
      inventory = await Inventory.create({ offering_id, shop_name, current_stock: 0, user_id, unit_type });
    }

    const convertedQuantity = convertUnits(quantity, unit_type, inventory.unit_type);

    const newStock = inventory.current_stock + convertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    res.status(200).json({ message: 'Inventory restocked successfully', newStock });
  } catch (error) {
    console.error('Error restocking inventory:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryById = async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.reconcileInventory = async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const { actual_stock } = req.body;

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    // Update the inventory with the actual stock
    await Inventory.update(inventoryId, {
      ...inventory,
      current_stock: actual_stock
    });

    res.status(200).json({ message: 'Inventory reconciled successfully' });
  } catch (error) {
    console.error('Error reconciling inventory:', error);
    res.status(500).json({ error: error.message });
  }
};

