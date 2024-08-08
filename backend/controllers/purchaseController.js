

const Purchase = require('../models/Purchase');
const ProductOffering = require('../models/ProductOffering');
const Inventory = require('../models/Inventory');
const Unit = require('../models/Unit');
const convertUnits = require('../utils/unitConversion');
const Product = require('../models/Product');
const db = require('../config/db');

exports.addPurchase = async (req, res) => {
  try {
    const { product_name, variety, supplier_name, market_name, order_price, quantity, purchase_date, unit_type } = req.body;
    const user_id = req.user.id;

    // Fetch shop_name from Users table
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    const shop_name = user[0].shop_name;

    // Fetch product details
    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error('Product not found');

    // Fetch product offering details
    const productOffering = await ProductOffering.findByProductVarietyAndUser(product_name, variety, user_id);
    if (!productOffering) throw new Error('Product Offering not found');

    // Fetch the inventory
    let inventory = await Inventory.findByOfferingAndUser(productOffering.offering_id, user_id);
    if (!inventory) {
      throw new Error('Inventory not found. Please add the item to inventory first.');
    }

    // Fetch unit details for conversion
    const units = await Unit.findByProductIdAndUser(product.product_id, user_id);
    if (!units || units.length === 0) throw new Error('Unit not found');

    // Conversion logic
    const convertToInventoryUnit = (unitEntries, quantity, fromUnit, toUnit) => {
      let conversionRate = 1;
      let foundConversion = false;

      // Direct Conversion
      for (const entry of unitEntries) {
        if (entry.buying_unit_type === fromUnit && entry.selling_unit_type === toUnit) {
          conversionRate = entry.selling_unit_size / entry.buying_unit_size;
          foundConversion = true;
          break;
        } else if (entry.selling_unit_type === fromUnit && entry.buying_unit_type === toUnit) {
          conversionRate = entry.buying_unit_size / entry.selling_unit_size;
          foundConversion = true;
          break;
        }
      }

      // Indirect Conversion
      if (!foundConversion) {
        // Try to find an indirect path
        for (const entry1 of unitEntries) {
          for (const entry2 of unitEntries) {
            if (entry1.selling_unit_type === fromUnit && entry1.buying_unit_type === entry2.selling_unit_type && entry2.buying_unit_type === toUnit) {
              conversionRate = (entry1.buying_unit_size / entry1.selling_unit_size) * (entry2.buying_unit_size / entry2.selling_unit_size);
              foundConversion = true;
              break;
            } else if (entry1.buying_unit_type === fromUnit && entry1.selling_unit_type === entry2.buying_unit_type && entry2.selling_unit_type === toUnit) {
              conversionRate = (entry1.selling_unit_size / entry1.buying_unit_size) * (entry2.selling_unit_size / entry2.buying_unit_size);
              foundConversion = true;
              break;
            }
          }
          if (foundConversion) break;
        }
      }

      return quantity * conversionRate;
    };

    // Convert purchased quantity to inventory unit type
    const convertedQuantity = convertToInventoryUnit(units, parseFloat(quantity), unit_type, inventory.unit_type);

    // Update the inventory
    const newStock = inventory.current_stock + convertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    // Add purchase entry
    const purchase = {
      offering_id: productOffering.offering_id,
      supplier_name,
      market_name,
      order_price,
      quantity,
      purchase_date,
      user_id,
      unit_type,
      shop_name
    };
    const purchaseId = await Purchase.create(purchase);

    res.status(201).json({ purchaseId });
  } catch (error) {
    console.error('Error adding purchase:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAllPurchases = async (req, res) => {
  try {
    const user_id = req.user.id;
    const purchases = await Purchase.findAllByUser(user_id);
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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

exports.updatePurchase = async (req, res) => {
  try {
    const user_id = req.user.id;
    const purchaseId = req.params.id;
    const { product_name, variety, supplier_name, market_name, order_price, quantity, purchase_date, unit_type } = req.body;

    const oldPurchase = await Purchase.findByIdAndUser(purchaseId, user_id);
    if (!oldPurchase) throw new Error('Purchase not found');

    const product = await Product.findByNameAndVarietyAndUser(product_name, variety, user_id);
    if (!product) throw new Error('Product not found');

    const productOffering = await ProductOffering.findByProductVarietyAndUser(product_name, variety, user_id);
    if (!productOffering) throw new Error('Product Offering not found');

    let inventory = await Inventory.findByOfferingAndUser(productOffering.offering_id, user_id);
    if (!inventory) {
      throw new Error('Inventory not found. Please add the item to inventory first.');
    }

    const units = await Unit.findByProductIdAndUser(product.product_id, user_id);
    if (!units || units.length === 0) throw new Error('Unit not found');

    const convertToInventoryUnit = (unitEntries, quantity, fromUnit, toUnit) => {
      let conversionRate = 1;
      let foundConversion = false;

      for (const entry of unitEntries) {
        if (entry.buying_unit_type === fromUnit && entry.selling_unit_type === toUnit) {
          conversionRate = entry.selling_unit_size / entry.buying_unit_size;
          foundConversion = true;
          break;
        } else if (entry.selling_unit_type === fromUnit && entry.buying_unit_type === toUnit) {
          conversionRate = entry.buying_unit_size / entry.selling_unit_size;
          foundConversion = true;
          break;
        }
      }

      if (!foundConversion) {
        for (const entry1 of unitEntries) {
          for (const entry2 of unitEntries) {
            if (entry1.selling_unit_type === fromUnit && entry1.buying_unit_type === entry2.selling_unit_type && entry2.buying_unit_type === toUnit) {
              conversionRate = (entry1.buying_unit_size / entry1.selling_unit_size) * (entry2.buying_unit_size / entry2.selling_unit_size);
              foundConversion = true;
              break;
            } else if (entry1.buying_unit_type === fromUnit && entry1.selling_unit_type === entry2.buying_unit_type && entry2.selling_unit_type === toUnit) {
              conversionRate = (entry1.selling_unit_size / entry1.buying_unit_size) * (entry2.selling_unit_size / entry2.buying_unit_size);
              foundConversion = true;
              break;
            }
          }
          if (foundConversion) break;
        }
      }

      return quantity * conversionRate;
    };

    const oldConvertedQuantity = convertToInventoryUnit(units, parseFloat(oldPurchase.quantity), oldPurchase.unit_type, inventory.unit_type);
    const newConvertedQuantity = convertToInventoryUnit(units, parseFloat(quantity), unit_type, inventory.unit_type);

    const newStock = inventory.current_stock - oldConvertedQuantity + newConvertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    const purchase = {
      offering_id: productOffering.offering_id,
      supplier_name,
      market_name,
      order_price,
      quantity,
      purchase_date,
      user_id,
      unit_type,
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


exports.deletePurchase = async (req, res) => {
  try {
    const user_id = req.user.id;
    const purchaseId = req.params.id;

    const oldPurchase = await Purchase.findByIdAndUser(purchaseId, user_id);
    if (!oldPurchase) throw new Error('Purchase not found');

    const productOffering = await ProductOffering.findByIdAndUser(oldPurchase.offering_id, user_id);
    if (!productOffering) throw new Error('Product Offering not found');

    const product = await Product.findByIdAndUser(productOffering.product_id, user_id);
    if (!product) throw new Error('Product not found');

    const units = await Unit.findByProductIdAndUser(product.product_id, user_id);
    if (!units || units.length === 0) throw new Error('Unit not found');

    let inventory = await Inventory.findByOfferingAndUser(productOffering.offering_id, user_id);
    if (!inventory) {
      inventory = await Inventory.create({ offering_id: productOffering.offering_id, current_stock: 0, user_id, unit_type: units[0].buying_unit_type });
    }

    const convertToInventoryUnit = (unitEntries, quantity, fromUnit, toUnit) => {
      let conversionRate = 1;
      let foundConversion = false;

      for (const entry of unitEntries) {
        if (entry.buying_unit_type === fromUnit && entry.selling_unit_type === toUnit) {
          conversionRate = entry.selling_unit_size / entry.buying_unit_size;
          foundConversion = true;
          break;
        } else if (entry.selling_unit_type === fromUnit && entry.buying_unit_type === toUnit) {
          conversionRate = entry.buying_unit_size / entry.selling_unit_size;
          foundConversion = true;
          break;
        }
      }

      if (!foundConversion) {
        for (const entry1 of unitEntries) {
          for (const entry2 of unitEntries) {
            if (entry1.selling_unit_type === fromUnit && entry1.buying_unit_type === entry2.selling_unit_type && entry2.buying_unit_type === toUnit) {
              conversionRate = (entry1.buying_unit_size / entry1.selling_unit_size) * (entry2.buying_unit_size / entry2.selling_unit_size);
              foundConversion = true;
              break;
            } else if (entry1.buying_unit_type === fromUnit && entry1.selling_unit_type === entry2.buying_unit_type && entry2.selling_unit_type === toUnit) {
              conversionRate = (entry1.selling_unit_size / entry1.buying_unit_size) * (entry2.selling_unit_size / entry2.buying_unit_size);
              foundConversion = true;
              break;
            }
          }
          if (foundConversion) break;
        }
      }

      return quantity * conversionRate;
    };

    const convertedQuantity = convertToInventoryUnit(units, parseFloat(oldPurchase.quantity), oldPurchase.unit_type, inventory.unit_type);
    if (isNaN(convertedQuantity)) {
      throw new Error('Invalid conversion rate resulting in NaN value');
    }

    const newStock = inventory.current_stock - convertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

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

