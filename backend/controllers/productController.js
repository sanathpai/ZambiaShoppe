const Product = require('../models/Product');
const ProductOfferings = require('../models/ProductOffering');
const Unit = require('../models/Unit');
const db = require('../config/db');

exports.createProduct = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const { product_name, variety } = req.body;

    // Check if the product with the same name and variety already exists
    const existingProduct = await Product.findByNameAndVariety(product_name, variety, user_id);
    if (existingProduct) {
      return res.status(400).json({ error: 'Product with the same name and variety already exists.' });
    }

    const productData = { ...req.body, user_id };

    // Create the product
    const productId = await Product.create(productData);

    // Create a default unit
    const defaultUnitData = {
      product_id: productId,
      buying_unit_size: 0,
      selling_unit_size: 0,
      buying_unit_type: 'default',
      selling_unit_type: 'default',
      prepackaged: false,
      user_id: user_id
    };
    const unitId = await Unit.create(defaultUnitData);

    // Fetch shop_name from Users table
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    const shop_name = user[0].shop_name;

    // Create product offering
    const offeringData = {
      product_id: productId,
      user_id: user_id,
      shop_name: shop_name,
      price: productData.price || 0, // Set default price if not provided
      unit_id: unitId // Use the created unit ID
    };
    await ProductOfferings.create(offeringData);

    res.status(201).json({ product_id: productId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};




exports.copyProduct = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const productId = req.params.id;

    // Fetch the product details
    const [product] = await db.query('SELECT * FROM Products WHERE product_id = ?', [productId]);
    if (!product.length) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const productData = product[0];

    // Create a new product entry for the current user
    const newProductData = { 
      product_name: productData.product_name,
      category: productData.category,
      variety: productData.variety,
      description: productData.description,
      price: productData.price,
      user_id: user_id
    };
    const newProductId = await Product.create(newProductData);

    // Create a default unit
    const defaultUnitData = {
      product_id: newProductId,
      buying_unit_size: 0,
      selling_unit_size: 0,
      buying_unit_type: 'default',
      selling_unit_type: 'default',
      prepackaged: false,
      user_id: user_id
    };
    const unitId = await Unit.create(defaultUnitData);

    // Fetch shop_name from Users table
    const [user] = await db.query('SELECT shop_name FROM Users WHERE id = ?', [user_id]);
    const shop_name = user[0].shop_name;

    // Create product offering
    const offeringData = {
      product_id: newProductId,
      user_id: user_id,
      shop_name: shop_name,
      price: newProductData.price,
      unit_id: unitId // Use the created unit ID
    };
    await ProductOfferings.create(offeringData);

    res.status(201).json({ newProductId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const query = req.query.q; // Get the search query from the request
    const [rows] = await db.query(
      `SELECT DISTINCT product_name, variety, category, description, price 
       FROM Products 
       WHERE product_name LIKE ? OR variety LIKE ?`,
      [`%${query}%`, `%${query}%`]
    );
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    console.log('User ID in getAllProducts:', user_id); // Debugging
    const products = await Product.findAllByUser(user_id);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const product = await Product.findByIdAndUser(req.params.id, user_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const productId = req.params.id;
    const productData = { ...req.body, user_id };

    const result = await Product.updateByIdAndUser(productId, productData);
    if (!result) {
      return res.status(404).json({ error: 'Product not found or you do not have permission to update it' });
    }
    res.status(200).json({ message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const productId = req.params.id;
    console.log(`Attempting to delete product with ID: ${productId} by User ID: ${user_id}`); // Debugging

    // Fetch all offerings related to the product
    const [offerings] = await db.query('SELECT offering_id FROM ProductOfferings WHERE product_id = ? AND user_id = ?', [productId, user_id]);
    const offeringIds = offerings.map(offering => offering.offering_id);

    if (offeringIds.length > 0) {
      // Delete dependent rows in Inventories
      const deleteInventories = await db.query('DELETE FROM Inventories WHERE offering_id IN (?)', [offeringIds]);
      console.log('Deleted rows from Inventories:', deleteInventories[0].affectedRows);

      // Delete dependent rows in ProductOfferings
      const deleteProductOfferings = await db.query('DELETE FROM ProductOfferings WHERE product_id = ? AND user_id = ?', [productId, user_id]);
      console.log('Deleted rows from ProductOfferings:', deleteProductOfferings[0].affectedRows);
    }

    // Then delete dependent rows in Units
    const deleteUnits = await db.query('DELETE FROM Units WHERE product_id = ? AND user_id = ?', [productId, user_id]);
    console.log('Deleted rows from Units:', deleteUnits[0].affectedRows);

    // Now delete the product
    const result = await Product.deleteByIdAndUser(productId, user_id);
    if (!result) {
      console.log('Product not found');
      return res.status(404).json({ error: 'Product not found' });
    }
    console.log('Product deleted successfully');
    res.status(200).json({ message: 'Product and associated units and offerings deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getProductUsage = async (req, res) => {
  try {
    const query = `
      SELECT LOWER(p.product_name) as product_name, COUNT(*) as usage_count
      FROM Products p
      JOIN ProductOfferings po ON p.product_id = po.product_id
      JOIN Purchases pur ON po.offering_id = pur.offering_id
      GROUP BY LOWER(p.product_name)
      ORDER BY usage_count DESC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching product usage data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
