const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const CurrentPrice = require('../models/CurrentPrice');
const convertUnits = require('../utils/unitConversion');
const db = require('../config/db');
const moment = require('moment');

// Add a new sale and update inventory stock
exports.addSale = async (req, res) => {
  try {
    const { product_name, variety, retail_price, quantity, sale_date, unit_id, brand } = req.body;
    const user_id = req.user.id;

    // Fetch shop_name from Users table
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    if (!user.length) throw new Error('User not found');
    const shop_name = user[0].shop_name;

    // Fetch product details - try with brand first, then without
    let product;
    if (brand) {
      console.log('Trying to find product with brand...');
      product = await Product.findByNameAndVarietyAndBrandAndUser(product_name, variety, brand, user_id);
    }
    if (!product) {
      console.log('Trying to find product without brand...');
      product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    }
    if (!product) throw new Error('Product not found');

    // Check/Update CurrentPrice for this product-unit combination
    console.log('Checking/Updating current retail price...');
    const currentPrice = await CurrentPrice.findByProductAndUnit(product.product_id, unit_id, user_id);
    if (currentPrice) {
      // If current price exists and user provided a different price, update it
      if (retail_price && parseFloat(retail_price) !== parseFloat(currentPrice.retail_price)) {
        console.log(`Updating retail price from ${currentPrice.retail_price} to ${retail_price}`);
        await CurrentPrice.updateRetailPrice(product.product_id, unit_id, user_id, retail_price);
      }
    } else {
      // Create new current price record
      console.log('Creating new current price record...');
      await CurrentPrice.upsert({
        product_id: product.product_id,
        unit_id: unit_id,
        user_id: user_id,
        retail_price: retail_price || 0.00,
        order_price: 0.00 // Default order price
      });
    }

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

    res.status(201).json({ 
      saleId,
      message: 'Sale added successfully and price records updated'
    });
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
    const { product_name, variety, retail_price, quantity, sale_date, unit_id, brand } = req.body;

    // Fetch the old sale details
    const oldSale = await Sale.findByIdAndUser(saleId, user_id);
    if (!oldSale) throw new Error('Sale not found');

    // Fetch product details - try with brand first, then without
    let product;
    if (brand) {
      console.log('Trying to find product with brand...');
      product = await Product.findByNameAndVarietyAndBrandAndUser(product_name, variety, brand, user_id);
    }
    if (!product) {
      console.log('Trying to find product without brand...');
      product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    }
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

// Get price suggestions for a sale (retail price)
exports.getPriceSuggestions = async (req, res) => {
  try {
    const { productId, unitId } = req.params;
    const user_id = req.user.id;

    console.log(`Getting retail price suggestions for product ${productId}, unit ${unitId}, user ${user_id}`);

    // First, get the selected unit details to check its category
    const [unitRows] = await db.query(`
      SELECT unit_id, unit_type, unit_category, opposite_unit_id
      FROM Units 
      WHERE unit_id = ? AND user_id = ?
    `, [unitId, user_id]);

    if (!unitRows.length) {
      return res.status(404).json({
        suggested_retail_price: 0.00,
        last_updated: null,
        has_price_history: false,
        message: 'Unit not found'
      });
    }

    const selectedUnit = unitRows[0];
    console.log(`Selected unit: ${selectedUnit.unit_type} (${selectedUnit.unit_category})`);

    // Get current price for the selected unit
    const currentPrice = await CurrentPrice.findByProductAndUnit(productId, unitId, user_id);
    
    // If we have a price record and retail_price > 0, use it
    if (currentPrice && currentPrice.retail_price > 0) {
      console.log(`Found retail price ${currentPrice.retail_price} for selected unit`);
      return res.status(200).json({
        suggested_retail_price: currentPrice.retail_price,
        last_updated: currentPrice.last_updated,
        has_price_history: true,
        source: `${selectedUnit.unit_type} (${selectedUnit.unit_category})`
      });
    }

    // NEW: If selected unit is a buying unit and has order_price > 0, show that as reference
    if (selectedUnit.unit_category === 'buying' && currentPrice && currentPrice.order_price > 0) {
      console.log(`Found order price ${currentPrice.order_price} for buying unit - showing as reference`);
      return res.status(200).json({
        suggested_retail_price: currentPrice.order_price,
        last_updated: currentPrice.last_updated,
        has_price_history: true,
        source: `${selectedUnit.unit_type} (${selectedUnit.unit_category}) - Order Price as Reference`
      });
    }

    // If selected unit is a buying unit or has retail_price = 0, 
    // try to find a selling unit for this product with a valid retail price
    if (selectedUnit.unit_category === 'buying' || !currentPrice || currentPrice.retail_price === 0) {
      console.log(`Selected unit is buying or has no retail price. Looking for selling units...`);
      
      const [sellingUnitsWithPrices] = await db.query(`
        SELECT u.unit_id, u.unit_type, u.unit_category, cp.retail_price, cp.last_updated
        FROM Units u
        LEFT JOIN CurrentPrice cp ON u.unit_id = cp.unit_id AND u.product_id = cp.product_id AND u.user_id = cp.user_id
        WHERE u.product_id = ? AND u.user_id = ? AND u.unit_category = 'selling' AND cp.retail_price > 0
        ORDER BY cp.last_updated DESC
        LIMIT 1
      `, [productId, user_id]);

      if (sellingUnitsWithPrices.length > 0) {
        const sellingUnit = sellingUnitsWithPrices[0];
        console.log(`Found retail price ${sellingUnit.retail_price} from selling unit ${sellingUnit.unit_type}`);
        return res.status(200).json({
          suggested_retail_price: sellingUnit.retail_price,
          last_updated: sellingUnit.last_updated,
          has_price_history: true,
          source: `${sellingUnit.unit_type} (${sellingUnit.unit_category})`
        });
      }
    }

    // No valid retail price found anywhere
    console.log(`No retail price found for product ${productId}`);
    res.status(200).json({
      suggested_retail_price: 0.00,
      last_updated: null,
      has_price_history: false,
      message: 'No retail price history found for this product'
    });
  } catch (error) {
    console.error('Error fetching retail price suggestions:', error);
    res.status(500).json({ error: error.message });
  }
};
