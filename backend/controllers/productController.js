const Product = require('../models/Product');
const db = require('../config/db');

// Create a new product
exports.createProduct = async (req, res) => {
  const connection = await db.getConnection(); // Get the DB connection
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const { product_name, variety, category, brand, description } = req.body;

    console.log(`Starting product creation process for user: ${user_id}`);

    // Start the transaction
    await connection.beginTransaction();
    console.log('Transaction started.');

    // Check if the product with the same name, variety, and brand already exists
    const existingProduct = brand 
      ? await Product.findByNameAndVarietyAndBrandAndUser(product_name, variety, brand, user_id)
      : await Product.findByNameAndVariety(product_name, variety, user_id);
    
    if (existingProduct) {
      console.log(`Product with the same name, variety, and brand already exists for user: ${user_id}`);
      await connection.rollback(); // Rollback the transaction
      return res.status(400).json({ error: 'A product with the same name, variety, and brand already exists for this user.' });
    }

    const productData = { product_name, variety, category, brand, description, user_id };
    console.log(`Creating product: ${JSON.stringify(productData)}`);

    // Step 1: Create the product
    const productId = await Product.create(productData, connection);

    if (!productId) {
      console.log('Product creation failed, rolling back transaction.');
      await connection.rollback(); // Rollback the transaction
      return res.status(500).json({ error: 'Product creation failed due to a database error.' });
    }

    console.log(`Product created with ID: ${productId}`);

    // Commit the transaction
    await connection.commit();
    console.log('Transaction committed successfully.');

    res.status(201).json({ product_id: productId, message: 'Product created successfully! Next Step: Add Unit for the product.' });
  } catch (error) {
    console.error('Error during product creation:', error);

    // Rollback the transaction in case of error
    if (connection) {
      await connection.rollback();
      console.log('Transaction rolled back due to error.');
    }

    // Return a more specific error message to the client
    res.status(500).json({ error: `An error occurred while creating the product: ${error.message}` });
  } finally {
    if (connection) {
      connection.release(); // Release the connection
      console.log('Database connection released.');
    }
  }
};

// Copy an existing product
exports.copyProduct = async (req, res) => {
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const productId = req.params.id;

    // Fetch the product details
    const [product] = await db.query('SELECT * FROM Products WHERE product_id = ?', [productId]);
    if (!product.length) {
      console.error(`Product with ID ${productId} not found for user: ${user_id}`);
      return res.status(404).json({ error: 'Product not found. Please provide a valid product ID.' });
    }
    const productData = product[0];

    // Create a new product entry for the current user
    const newProductData = { 
      product_name: productData.product_name,
      category: productData.category,
      variety: productData.variety,
      brand: productData.brand,
      description: productData.description,
      price: productData.price,
      user_id
    };
    const newProductId = await Product.create(newProductData);

    if (!newProductId) {
      console.error(`Failed to copy product ID ${productId} for user: ${user_id}`);
      return res.status(500).json({ error: 'Failed to copy the product due to a database error.' });
    }

    res.status(201).json({ newProductId, message: 'Product copied successfully.' });
  } catch (error) {
    console.error('Error during product copying:', error);
    res.status(500).json({ error: `An error occurred while copying the product: ${error.message}` });
  }
};

// Search products
exports.searchProducts = async (req, res) => {
  try {
    const query = req.query.q; // Get the search query from the request
    const [rows] = await db.query(
      `SELECT DISTINCT product_name, variety, category, brand, description, price 
       FROM Products 
       WHERE (product_name LIKE ? OR variety LIKE ? OR brand LIKE ?)`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No products found matching the search query.' });
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error during product search:', error);
    res.status(500).json({ error: `An error occurred while searching for products: ${error.message}` });
  }
};

// Get all products for the authenticated user
exports.getAllProducts = async (req, res) => {
  try {
    const user_id = req.user.id;
    const products = await Product.findAllByUser(user_id);

    if (!products || products.length === 0) {
      return res.status(404).json({ error: 'No products found for the authenticated user.' });
    }

    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).json({ error: `An error occurred while fetching products: ${error.message}` });
  }
};

// Get a single product by its ID
exports.getProductById = async (req, res) => {
  try {
    const user_id = req.user.id;
    const product = await Product.findByIdAndUser(req.params.id, user_id);
    if (!product) {
      console.error(`Product with ID ${req.params.id} not found for user: ${user_id}`);
      return res.status(404).json({ error: 'Product not found. Please provide a valid product ID.' });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({ error: `An error occurred while fetching the product: ${error.message}` });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    const user_id = req.user.id;
    const productId = req.params.id;
    const productData = { ...req.body, user_id };

    const result = await Product.updateByIdAndUser(productId, productData);
    if (!result) {
      console.error(`Product with ID ${productId} not found or permission denied for user: ${user_id}`);
      return res.status(404).json({ error: 'Product not found or you do not have permission to update it.' });
    }
    res.status(200).json({ message: 'Product updated successfully.' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: `An error occurred while updating the product: ${error.message}` });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const user_id = req.user.id;
    const productId = req.params.id;

    // Begin the deletion process by deleting all related data in the correct order

    // 1. Delete entries from Inventories related to the product
    await db.query('DELETE FROM Inventories WHERE unit_id IN (SELECT unit_id FROM Units WHERE product_id = ? AND user_id = ?)', [productId, user_id]);

    // 2. Delete entries from Purchases related to the product
    await db.query('DELETE FROM Purchases WHERE product_id = ? AND user_id = ?', [productId, user_id]);

    // 3. Delete entries from Sales related to the product
    await db.query('DELETE FROM Sales WHERE product_id = ? AND user_id = ?', [productId, user_id]);

    // 4. Delete entries from Unit_Conversion related to the product
    await db.query('DELETE FROM Unit_Conversion WHERE product_id = ?', [productId]);

    // 5. Delete entries from Units related to the product
    await db.query('DELETE FROM Units WHERE product_id = ? AND user_id = ?', [productId, user_id]);

    // 6. Finally, delete the product itself
    const result = await Product.deleteByIdAndUser(productId, user_id);
    if (!result) {
      console.error(`Failed to delete product ID ${productId} for user: ${user_id}`);
      return res.status(404).json({ error: 'Product not found. Please provide a valid product ID.' });
    }

    res.status(200).json({ message: 'Product and all associated data deleted successfully.' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: `An error occurred while deleting the product: ${error.message}` });
  }
};

// Get product usage statistics
exports.getProductUsage = async (req, res) => {
  try {
    const query = `
      SELECT LOWER(p.product_name) as product_name, COUNT(*) as usage_count
      FROM Products p
      JOIN Purchases pur ON p.product_id = pur.product_id
      GROUP BY LOWER(p.product_name)
      ORDER BY usage_count DESC
    `;
    const [rows] = await db.query(query);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No usage statistics available for products.' });
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching product usage statistics:', error);
    res.status(500).json({ error: `An error occurred while fetching product usage statistics: ${error.message}` });
  }
};

// Get brands for a specific product name
exports.getBrandsByProductName = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { productName } = req.params;
    
    const brands = await Product.getBrandsByProductName(productName, user_id);
    
    res.status(200).json({ brands });
  } catch (error) {
    console.error('Error fetching brands for product:', error);
    res.status(500).json({ error: `An error occurred while fetching brands: ${error.message}` });
  }
};
