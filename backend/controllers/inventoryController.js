const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Unit = require('../models/Unit');
const db = require('../config/db');
const convertUnits = require('../utils/unitConversion');

// Add new inventory
exports.addInventory = async (req, res) => {
  try {
    const { product_id, current_stock, unit_id, stock_limit } = req.body; // Accept product_id directly
    const user_id = req.user.id;

    // Fetch shop_name from Users table
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found. Please ensure the user is logged in.');

    const shop_name = user[0].shop_name;

    // Verify product exists and belongs to user
    const product = await Product.findByIdAndUser(product_id, user_id);
    if (!product) throw new Error(`Product with ID "${product_id}" not found for the user.`);

    // Check if the inventory already exists for the product and user
    const [existingInventory] = await db.query(
      'SELECT * FROM Inventories WHERE product_id = ? AND user_id = ?',
      [product_id, user_id]
    );
    if (existingInventory.length > 0) {
      return res.status(400).json({ error: `Inventory for the product "${product.product_name}" with variety "${product.variety || ''}" already exists.` });
    }

    // Create the inventory with unit_id and stock_limit
    const inventory = {
      shop_name,
      product_id,
      current_stock,
      stock_limit, // Include stock_limit here
      user_id,
      unit_id
    };
    const inventoryId = await Inventory.create(inventory);

    res.status(201).json({ inventoryId });
  } catch (error) {
    console.error('Error adding inventory:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred while adding the inventory. Please try again later.' });
  }
};


// Get all inventories for the authenticated user
exports.getAllInventories = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Fetch inventories
    const inventories = await Inventory.findAllByUser(user_id);
    if (!inventories || inventories.length === 0) {
      return res.status(404).json({ error: 'No inventories found for the current user.' });
    }

    // Add available units for each inventory item
    const inventoriesWithUnits = await Promise.all(
      inventories.map(async (inventory) => {
        // Fetch available units with conversion rates for this product and user
        const availableUnits = await Unit.findAllByProductIdAndUser(inventory.product_id, user_id);

        return {
          ...inventory,
          available_units: availableUnits
        };
      })
    );

    res.json(inventoriesWithUnits);
  } catch (error) {
    console.error('Error fetching inventories:', error.message);
    res.status(500).json({ error: 'An error occurred while retrieving inventories. Please try again later.' });
  }
};

// Get inventory by ID for the authenticated user
exports.getInventoryById = async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({ error: `Inventory with ID ${inventoryId} not found.` });
    }
    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error.message);
    res.status(500).json({ error: 'An error occurred while fetching the inventory. Please try again later.' });
  }
};

// Update inventory
exports.updateInventory = async (req, res) => {
  try {
    const { product_name, variety, current_stock, unit_id } = req.body;
    const user_id = req.user.id;
    const inventoryId = req.params.id;

    // Fetch shop_name from Users table
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found. Please ensure the user is logged in.');

    const shop_name = user[0].shop_name;

    // Fetch product details
    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error(`Product with name "${product_name}" and variety "${variety}" not found for the user.`);

    const product_id = product.product_id;

    const inventory = { shop_name, product_id, current_stock, user_id, unit_id };
    const result = await Inventory.update(inventoryId, inventory);

    if (result === 0) {
      return res.status(404).json({ error: `Inventory with ID ${inventoryId} not found or no changes were made.` });
    }

    res.status(200).json({ message: 'Inventory updated successfully.' });
  } catch (error) {
    console.error('Error updating inventory:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred while updating the inventory. Please try again later.' });
  }
};

// Update inventory limit (reminder limit)
exports.updateInventoryLimit = async (req, res) => {
  try {
    const { stock_limit } = req.body;
    const user_id = req.user.id;
    const inventoryId = req.params.id;

    // First verify the inventory belongs to the user
    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({ error: `Inventory with ID ${inventoryId} not found.` });
    }

    // Update only the stock limit
    const [result] = await db.query(
      'UPDATE Inventories SET stock_limit = ? WHERE inventory_id = ? AND user_id = ?',
      [stock_limit, inventoryId, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `Inventory with ID ${inventoryId} not found or you don't have permission to update it.` });
    }

    res.status(200).json({ message: 'Reminder limit updated successfully.' });
  } catch (error) {
    console.error('Error updating inventory limit:', error.message);
    res.status(500).json({ error: 'An unexpected error occurred while updating the reminder limit. Please try again later.' });
  }
};

// Delete inventory
exports.deleteInventory = async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const result = await Inventory.delete(inventoryId);

    if (result === 0) {
      return res.status(404).json({ error: `Inventory with ID ${inventoryId} not found.` });
    }

    res.status(200).json({ message: 'Inventory deleted successfully.' });
  } catch (error) {
    console.error('Error deleting inventory:', error.message);
    res.status(500).json({ error: 'An error occurred while deleting the inventory. Please try again later.' });
  }
};

// Restock inventory (updated with unit conversion)
exports.restockInventory = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { product_name, variety, quantity, unit_id } = req.body;

    // Fetch shop_name from Users table
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found. Please ensure the user is logged in.');

    const shop_name = user[0].shop_name;

    // Fetch product details
    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error(`Product with name "${product_name}" and variety "${variety}" not found for the user.`);

    const product_id = product.product_id;

    let inventory = await Inventory.findByProductAndUser(product_id, user_id);

    if (!inventory) {
      // Create a new inventory entry if none exists
      inventory = await Inventory.create({ product_id, shop_name, current_stock: 0, user_id, unit_id });
    }

    // Convert the restock quantity to match the inventory's unit
    const convertedQuantity = await convertUnits(quantity, unit_id, inventory.unit_id);

    const newStock = inventory.current_stock + convertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    res.status(200).json({ message: 'Inventory restocked successfully.', newStock });
  } catch (error) {
    console.error('Error restocking inventory:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred while restocking the inventory. Please try again later.' });
  }
};

// Reconcile inventory (updated with unit conversion)
exports.reconcileInventory = async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const { actual_stock, actual_unit_id } = req.body;

    // Validate that actual_stock is not negative
    if (parseFloat(actual_stock) < 0) {
      return res.status(400).json({ error: 'Actual stock cannot be negative. Please enter a valid positive stock value.' });
    }

    const inventory = await Inventory.findById(inventoryId);
    if (!inventory) {
      return res.status(404).json({ error: `Inventory with ID ${inventoryId} not found.` });
    }

    // Convert the actual stock to match the inventory's unit
    const convertedStock = await convertUnits(actual_stock, actual_unit_id, inventory.unit_id);
    
    // Double-check after conversion that the result is not negative
    if (convertedStock < 0) {
      return res.status(400).json({ error: 'Converted stock value cannot be negative. Please check your units and stock value.' });
    }
    
    await Inventory.update(inventoryId, {
      ...inventory,
      current_stock: convertedStock
    });

    res.status(200).json({ message: 'Inventory reconciled successfully.' });
  } catch (error) {
    console.error('Error reconciling inventory:', error.message);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred while reconciling the inventory. Please try again later.' });
  }
};

// Convert inventory unit
exports.convertInventoryUnit = async (req, res) => {
  try {
    const { quantity, fromUnitId, toUnitId } = req.body;

    // Call the conversion utility function
    const convertedQuantity = await convertUnits(quantity, fromUnitId, toUnitId);

    res.status(200).json({ convertedQuantity });
  } catch (error) {
    console.error('Error converting units:', error.message);
    res.status(500).json({ error: 'An error occurred while converting the units. Please check the unit IDs and try again.' });
  }
};
