const ProductOffering = require('../models/ProductOffering');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Unit = require('../models/Unit');
const db = require('../config/db');

exports.addProductOffering = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { shop_name, product_name, variety, brand, price, unit_id } = req.body;

    const shop = await Shop.findByNameAndUser(shop_name, user_id);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    const shop_id = shop.shop_id;

    // Find product by name, variety, and brand
    let product;
    if (brand) {
      product = await Product.findByNameAndVarietyAndBrandAndUser(product_name, variety || '', brand, user_id);
    } else {
      product = await Product.findByNameAndVarietyAndUser(product_name, variety || '', user_id);
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product_id = product.product_id;

    const offering = { shop_id, product_id, unit_id, price, user_id };
    const offeringId = await ProductOffering.create(offering);

    res.status(201).json({ offeringId });
  } catch (error) {
    console.error('Error adding product offering:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAllProductOfferings = async (req, res) => {
  try {
    const user_id = req.user.id;
    const offerings = await ProductOffering.findAllByUser(user_id);
    res.json(offerings);
  } catch (error) {
    console.error('Error fetching product offerings:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateProductOffering = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const { shop_name, product_name, price } = req.body;
    const { id } = req.params;

    // Fetch shop_id using shop_name
    const shop = await Shop.findByNameAndUser(shop_name, user_id);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    const shop_id = shop.shop_id;

    // Fetch product_id using product_name
    const product = await Product.findByNameAndUser(product_name, user_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product_id = product.product_id;

    // Fetch unit_id using product_id
    const unit = await Unit.findByProductIdAndUser(product_id, user_id);
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    const unit_id = unit.unit_id;

    const updatedOffering = { shop_id, product_id, unit_id, price };

    const result = await ProductOffering.updateByIdAndUser(id, user_id, updatedOffering);

    if (!result) {
      return res.status(404).json({ error: 'Product Offering not found' });
    }

    res.status(200).json({ message: 'Product Offering updated successfully' });
  } catch (error) {
    console.error('Error updating product offering:', error);
    res.status(500).json({ error: error.message });
  }
};
exports.getProductOfferingById = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const { id } = req.params;
    const offering = await ProductOffering.findByIdAndUser(id, user_id);

    if (!offering) {
      return res.status(404).json({ error: 'Product Offering not found' });
    }

    res.json(offering);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.deleteProductOffering = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    // Delete related rows in the Inventories table
    await db.query('DELETE FROM Inventories WHERE offering_id = ? AND user_id = ?', [id, user_id]);

    // Delete related rows in the Purchases table
    await db.query('DELETE FROM Purchases WHERE offering_id = ? AND user_id = ?', [id, user_id]);

    const result = await ProductOffering.deleteByIdAndUser(id, user_id);

    if (!result) {
      return res.status(404).json({ error: 'Product Offering not found' });
    }

    res.status(200).json({ message: 'Product Offering deleted successfully' });
  } catch (error) {
    console.error('Error deleting product offering:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAllProductOfferings = async (req, res) => {
  try {
    const user_id = req.user.id;
    const productOfferings = await ProductOffering.findAllByUser(user_id);
    res.status(200).json(productOfferings);
  } catch (error) {
    console.error('Error fetching product offerings:', error);
    res.status(500).json({ error: error.message });
  }
};