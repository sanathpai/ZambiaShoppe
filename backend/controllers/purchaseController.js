const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const Unit = require('../models/Unit');
const CurrentPrice = require('../models/CurrentPrice');
const convertUnits = require('../utils/unitConversion');
const db = require('../config/db');
const moment = require('moment');

// Add a new purchase and update inventory stock
exports.addPurchase = async (req, res) => {
  try {
    console.log('=== ADD PURCHASE START ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    
    const { product_name, variety, supplier_name, market_name, order_price, quantity, purchase_date, unit_id, unit_category } = req.body;
    const user_id = req.user.id;

    console.log('Extracted data:', { product_name, variety, supplier_name, market_name, order_price, quantity, purchase_date, unit_id, unit_category, user_id });

    // Fetch shop_name from Users table
    console.log('Fetching user shop_name...');
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found');
    const shop_name = user[0].shop_name;
    console.log('Shop name:', shop_name);

    // Fetch product details
    console.log('Fetching product details...');
    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error('Product not found');
    console.log('Product found:', product);

    // Check/Update CurrentPrice for this product-unit combination
    console.log('Checking/Updating current price...');
    const currentPrice = await CurrentPrice.findByProductAndUnit(product.product_id, unit_id, user_id);
    if (currentPrice) {
      // If current price exists and user provided a different price, update it
      if (order_price && parseFloat(order_price) !== parseFloat(currentPrice.order_price)) {
        console.log(`Updating order price from ${currentPrice.order_price} to ${order_price}`);
        await CurrentPrice.updateOrderPrice(product.product_id, unit_id, user_id, order_price);
      }
    } else {
      // Create new current price record
      console.log('Creating new current price record...');
      await CurrentPrice.upsert({
        product_id: product.product_id,
        unit_id: unit_id,
        user_id: user_id,
        retail_price: 0.00, // Default retail price
        order_price: order_price || 0.00
      });
    }

    // Fetch the inventory
    console.log('Fetching inventory...');
    let inventory = await Inventory.findByProductAndUser(product.product_id, user_id);
    if (!inventory) {
      throw new Error('Inventory not found. Please add the item to inventory first.');
    }
    console.log('Inventory found:', inventory);

    // **Log the unit_ids for debugging**
    console.log(`Converting from unit_id: ${unit_id} to inventory.unit_id: ${inventory.unit_id}`);

    // Convert purchased quantity to inventory unit type
    console.log('Converting units...');
    const convertedQuantity = await convertUnits(quantity, unit_id, inventory.unit_id);
    console.log('Converted quantity:', convertedQuantity);

    // Update the inventory stock
    console.log('Updating inventory stock...');
    const newStock = parseFloat(inventory.current_stock) + parseFloat(convertedQuantity);
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });
    console.log('Inventory updated, new stock:', newStock);

    // Add purchase entry
    console.log('Creating purchase entry...');
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
      unit_category,
    };
    console.log('Purchase object:', purchase);
    const purchaseId = await Purchase.create(purchase);
    console.log('Purchase created with ID:', purchaseId);

    res.status(201).json({ 
      purchaseId,
      message: 'Purchase added successfully and price records updated'
    });
    console.log('=== ADD PURCHASE SUCCESS ===');
  } catch (error) {
    console.error('=== ADD PURCHASE ERROR ===');
    console.error('Error adding purchase:', error);
    console.error('Stack trace:', error.stack);
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
    const { product_name, variety, supplier_name, market_name, order_price, quantity, purchase_date, unit_id, unit_category } = req.body;

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

// Get price suggestions for a purchase (order price)
exports.getPriceSuggestions = async (req, res) => {
  try {
    const { productId, unitId } = req.params;
    const user_id = req.user.id;

    console.log(`Getting price suggestions for product ${productId}, unit ${unitId}, user ${user_id}`);

    const currentPrice = await CurrentPrice.findByProductAndUnit(productId, unitId, user_id);
    
    if (currentPrice) {
      res.status(200).json({
        suggested_order_price: currentPrice.order_price,
        last_updated: currentPrice.last_updated,
        has_price_history: true
      });
    } else {
      res.status(200).json({
        suggested_order_price: 0.00,
        last_updated: null,
        has_price_history: false,
        message: 'No price history found for this product-unit combination'
      });
    }
  } catch (error) {
    console.error('Error fetching price suggestions:', error);
    res.status(500).json({ error: error.message });
  }
};
