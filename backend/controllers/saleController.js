const Sale = require('../models/Sale');
const ProductOffering = require('../models/ProductOffering');
const Inventory = require('../models/Inventory');
const Unit = require('../models/Unit');
const convertUnits = require('../utils/unitConversion');
const Product = require('../models/Product');

exports.addSale = async (req, res) => {
  try {
    const { product_name, variety, retail_price, quantity, sale_date, unit_type } = req.body;
    const user_id = req.user.id;

    console.log('Adding Sale:', { product_name, variety, retail_price, quantity, sale_date, unit_type });

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
    const newStock = inventory.current_stock - convertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    // Add sale entry
    const sale = {
      offering_id: productOffering.offering_id,
      retail_price,
      quantity,
      sale_date,
      user_id,
      unit_type,
      shop_name: inventory.shop_name // assuming inventory has shop_name
    };
    const saleId = await Sale.create(sale);

    res.status(201).json({ saleId });
  } catch (error) {
    console.error('Error adding sale:', error);
    res.status(500).json({ error: error.message });
  }
};

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

exports.updateSale = async (req, res) => {
  try {
    const user_id = req.user.id;
    const saleId = req.params.id;
    const { product_name, variety, retail_price, quantity, sale_date, unit_type } = req.body;

    const oldSale = await Sale.findByIdAndUser(saleId, user_id);
    if (!oldSale) throw new Error('Sale not found');

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

    const oldConvertedQuantity = convertToInventoryUnit(units, parseFloat(oldSale.quantity), oldSale.unit_type, inventory.unit_type);
    const newConvertedQuantity = convertToInventoryUnit(units, parseFloat(quantity), unit_type, inventory.unit_type);

    const newStock = inventory.current_stock + oldConvertedQuantity - newConvertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

    const sale = {
      offering_id: productOffering.offering_id,
      retail_price,
      quantity,
      sale_date,
      unit_type,
      user_id,
      shop_name: oldSale.shop_name
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

exports.deleteSale = async (req, res) => {
  try {
    const user_id = req.user.id;
    const saleId = req.params.id;

    const sale = await Sale.findByIdAndUser(saleId, user_id);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const productOffering = await ProductOffering.findByIdAndUser(sale.offering_id, user_id);
    if (!productOffering) throw new Error('Product Offering not found');

    const unit = await Unit.findByIdAndUser(productOffering.unit_id, user_id);
    if (!unit) throw new Error('Unit not found');

    let inventory = await Inventory.findByOfferingAndUser(productOffering.offering_id, user_id);
    if (!inventory) {
      inventory = await Inventory.create({ offering_id: productOffering.offering_id, current_stock: 0, user_id, unit_type: unit.selling_unit_type });
    }

    let convertedQuantity = parseFloat(sale.quantity);
    if (sale.unit_type !== inventory.unit_type) {
      convertedQuantity = convertToInventoryUnit(units, parseFloat(sale.quantity), sale.unit_type, inventory.unit_type);
    }

    const newStock = inventory.current_stock + convertedQuantity;
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: newStock });

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

