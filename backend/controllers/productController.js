const Product = require('../models/Product');
const db = require('../config/db');

// Create a new product
exports.createProduct = async (req, res) => {
  const connection = await db.getConnection(); // Get the DB connection
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const { product_name, variety, brand, size, image } = req.body;

    console.log(`Starting product creation process for user: ${user_id}`);
    
    // Debug image data
    if (image) {
      console.log('📸 IMAGE DEBUG - Image received from frontend');
      console.log('📸 Image data type:', typeof image);
      console.log('📸 Image data length:', image ? image.length : 'null');
      console.log('📸 Image data preview (first 100 chars):', image ? image.substring(0, 100) : 'null');
      
      // Check if it's a valid base64 image
      if (image.startsWith('data:image/')) {
        console.log('✅ Valid base64 image format detected');
      } else {
        console.warn('⚠️ Image does not appear to be valid base64 format');
      }
    } else {
      console.log('📸 No image data received');
    }

    // Start the transaction
    await connection.beginTransaction();
    console.log('Transaction started.');

    // Check if the product with the same name, variety, brand, and size already exists
    const existingProduct = await Product.findByNameAndVarietyAndBrandAndSizeAndUser(
      product_name, 
      variety || '', 
      brand || '', 
      size || '', 
      user_id
    );
    
    if (existingProduct) {
      console.log(`Product with the same name, variety, brand, and size already exists for user: ${user_id}`);
      await connection.rollback(); // Rollback the transaction
      return res.status(400).json({ 
        error: 'A product with the same name, variety, brand, and size already exists for this user.' 
      });
    }

    const productData = { product_name, variety, brand, size, user_id, image };
    console.log(`Creating product:`, {
      ...productData,
      image: image ? `[IMAGE_DATA_${image.length}_CHARS]` : 'NO_IMAGE'
    });

    // Step 1: Create the product
    const productId = await Product.create(productData, connection);

    if (!productId) {
      console.log('Product creation failed, rolling back transaction.');
      await connection.rollback(); // Rollback the transaction
      return res.status(500).json({ error: 'Product creation failed due to a database error.' });
    }

    console.log(`Product created with ID: ${productId}`);
    
    // Step 2: Upload image to S3 if image exists
    if (image) {
      try {
        const s3Url = await Product.uploadToS3(productId, image, connection);
        if (s3Url) {
          console.log(`✅ Image uploaded to S3: ${s3Url}`);
        } else {
          console.log('S3 upload skipped (S3 not configured)');
        }
      } catch (error) {
        console.error('⚠️ S3 upload failed, but continuing with product creation:', error.message);
        // Don't fail the entire operation if S3 upload fails
      }
    }
    
    // Verify the image was saved by checking the database
    if (image) {
      console.log('📸 Verifying image was saved to database...');
      const [savedProduct] = await connection.query(
        'SELECT product_id, LENGTH(image) as image_length FROM Products WHERE product_id = ?',
        [productId]
      );
      
      if (savedProduct && savedProduct[0] && savedProduct[0].image_length > 0) {
        console.log('✅ Image successfully saved to database. Length:', savedProduct[0].image_length);
      } else {
        console.warn('⚠️ Image may not have been saved to database');
      }
    }

    // Commit the transaction
    await connection.commit();
    console.log('Transaction committed successfully.');

    res.status(201).json({ product_id: productId, message: 'Product created successfully! Next Step: Add Unit for the product.' });
  } catch (error) {
    console.error('Error during product creation:', error);
    
    // Check if it's a database size limit error
    if (error.code === 'ER_DATA_TOO_LONG' || error.message.includes('Data too long')) {
      console.error('❌ DATABASE ERROR - Image data too large for database field');
    }

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
      variety: productData.variety,
      brand: productData.brand,
      size: productData.size || productData.description, // Handle both old and new field names
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
    const user_id = req.user.id; // Get authenticated user's ID
    const [rows] = await db.query(
      `SELECT DISTINCT product_id, product_name, variety, brand, size 
       FROM Products 
       WHERE (product_name LIKE ? OR variety LIKE ? OR brand LIKE ?) AND user_id = ?`,
      [`%${query}%`, `%${query}%`, `%${query}%`, user_id]
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
  const connection = await db.getConnection();
  try {
    const user_id = req.user.id;
    const productId = req.params.id;
    const { product_name, variety, brand, size, image } = req.body;

    console.log(`Starting product update process for product ${productId}, user: ${user_id}`);
    
    // Debug image data if provided
    if (image !== undefined) {
      if (image === null) {
        console.log('📸 IMAGE UPDATE - Removing product image');
      } else if (image) {
        console.log('📸 IMAGE UPDATE - New image provided');
        console.log('📸 Image data type:', typeof image);
        console.log('📸 Image data length:', image ? image.length : 'null');
        console.log('📸 Image data preview (first 100 chars):', image ? image.substring(0, 100) : 'null');
        
        // Check if it's a valid base64 image
        if (image.startsWith('data:image/')) {
          console.log('✅ Valid base64 image format detected');
        } else {
          console.warn('⚠️ Image does not appear to be valid base64 format');
        }
      }
    } else {
      console.log('📸 No image changes requested');
    }

    // Start the transaction
    await connection.beginTransaction();
    console.log('Transaction started for product update.');

    // Verify product exists and belongs to user
    const existingProduct = await Product.findByIdAndUser(productId, user_id);
    if (!existingProduct) {
      await connection.rollback();
      console.error(`Product with ID ${productId} not found or permission denied for user: ${user_id}`);
      return res.status(404).json({ error: 'Product not found or you do not have permission to update it.' });
    }

    // Prepare update data
    const productData = { 
      product_name, 
      variety, 
      brand: brand || null, 
      size, 
      price: existingProduct.price, // Keep existing price if not provided
      user_id 
    };

    // Include image in update if provided
    if (image !== undefined) {
      productData.image = image;
    }

    console.log(`Updating product:`, {
      ...productData,
      image: image !== undefined ? 
        (image === null ? 'REMOVE_IMAGE' : 
         image ? `[IMAGE_DATA_${image.length}_CHARS]` : 'NO_IMAGE') : 'NO_CHANGE'
    });

    // Update the product
    const updateResult = await Product.updateByIdAndUser(productId, productData, connection);
    
    if (!updateResult) {
      console.log('Product update failed, rolling back transaction.');
      await connection.rollback();
      return res.status(500).json({ error: 'Product update failed due to a database error.' });
    }

    console.log(`Product updated successfully with ID: ${productId}`);
    
    // Handle S3 upload if new image is provided
    if (image && image !== null && image.startsWith('data:image/')) {
      try {
        const s3Url = await Product.uploadToS3(productId, image, connection);
        if (s3Url) {
          console.log(`✅ Updated image uploaded to S3: ${s3Url}`);
        } else {
          console.log('S3 upload skipped (S3 not configured)');
        }
      } catch (error) {
        console.error('⚠️ S3 upload failed for updated image, but continuing with product update:', error.message);
        // Don't fail the entire operation if S3 upload fails
      }
    }
    
    // Verify the image was saved if provided
    if (image && image !== null) {
      console.log('📸 Verifying updated image was saved to database...');
      const [updatedProduct] = await connection.query(
        'SELECT product_id, LENGTH(image) as image_length FROM Products WHERE product_id = ?',
        [productId]
      );
      
      if (updatedProduct && updatedProduct[0] && updatedProduct[0].image_length > 0) {
        console.log('✅ Updated image successfully saved to database. Length:', updatedProduct[0].image_length);
      } else {
        console.warn('⚠️ Updated image may not have been saved to database');
      }
    } else if (image === null) {
      console.log('📸 Image removal confirmed');
    }

    // Commit the transaction
    await connection.commit();
    console.log('Transaction committed successfully for product update.');

    res.status(200).json({ message: 'Product updated successfully.' });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Check if it's a database size limit error
    if (error.code === 'ER_DATA_TOO_LONG' || error.message.includes('Data too long')) {
      console.error('❌ DATABASE ERROR - Image data too large for database field');
    }

    // Rollback the transaction in case of error
    if (connection) {
      await connection.rollback();
      console.log('Transaction rolled back due to error in product update.');
    }

    // Return a more specific error message to the client
    res.status(500).json({ error: `An error occurred while updating the product: ${error.message}` });
  } finally {
    if (connection) {
      connection.release();
      console.log('Database connection released after product update.');
    }
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

