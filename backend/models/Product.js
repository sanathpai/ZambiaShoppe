const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

// Create S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


const Product = {
  create: async (product, connection = null) => {
    const { product_name, variety, brand, size, user_id, image } = product;
    const dbConnection = connection || db; // Use provided connection or default db
    
    const [result] = await dbConnection.query(
      'INSERT INTO Products (product_name, variety, brand, size, user_id, image) VALUES (?, ?, ?, ?, ?, ?)',
      [product_name, variety, brand, size, user_id, image]
    );
    return result.insertId;
  },
  
  uploadToS3: async (productId, imageData, connection = null) => {
    if (!imageData || !imageData.startsWith('data:image/')) {
      throw new Error('Invalid image data format');
    }

    // Check if S3 is configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
      console.log('S3 not configured, skipping S3 upload');
      return null;
    }

    try {
      // Parse base64 data
      const matches = imageData.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
      if (!matches) {
        throw new Error('Invalid base64 image format');
      }

      const imageType = matches[1]; // jpeg, png, etc.
      const imageBuffer = Buffer.from(matches[2], 'base64');
      
      // Generate unique filename
      const filename = `products/product-${productId}-${uuidv4()}.${imageType}`;
      
      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: filename,
        Body: imageBuffer,
        ContentType: `image/${imageType}`,
        Metadata: {
          'migrated-from': 'base64',
          'product-id': productId.toString(),
          'migration-date': new Date().toISOString()
        }
      });

      await s3Client.send(uploadCommand);
      
      // Construct S3 URL
      const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
      
      // Update database with S3 URL
      const dbConnection = connection || db;
      await dbConnection.query(
        'UPDATE Products SET image_s3_url = ? WHERE product_id = ?',
        [s3Url, productId]
      );

      console.log(`✅ Successfully uploaded image to S3 for product ${productId}: ${s3Url}`);
      return s3Url;
    } catch (error) {
      console.error(`❌ Error uploading image to S3 for product ${productId}:`, error.message);
      throw error;
    }
  },

  findAllByUser: async (user_id) => {
    const [rows] = await db.query('SELECT * FROM Products WHERE user_id = ?', [user_id]);
    return rows;
  },
  findByNameAndVariety: async (productName, variety, userId) => {
    const [rows] = await db.query('SELECT * FROM Products WHERE product_name = ? AND variety = ? AND user_id = ?', [productName, variety, userId]);
    return rows[0];
  },
  findByIdAndUser: async (productId, user_id) => {
    const [rows] = await db.query('SELECT * FROM Products WHERE product_id = ? AND user_id = ?', [productId, user_id]);
    return rows[0];
  },
  updateByIdAndUser: async (productId, productData, connection = null) => {
    const { product_name, variety, brand, size, price, user_id, image } = productData;
    const dbConnection = connection || db;
    
    let query, params;
    
    // Check if image is being updated
    if (image !== undefined) {
      // Image is being updated (could be new image or null to remove)
      query = 'UPDATE Products SET product_name = ?, variety = ?, brand = ?, size = ?, price = ?, image = ? WHERE product_id = ? AND user_id = ?';
      params = [product_name, variety, brand, size, price, image, productId, user_id];
    } else {
      // No image update, use original query
      query = 'UPDATE Products SET product_name = ?, variety = ?, brand = ?, size = ?, price = ? WHERE product_id = ? AND user_id = ?';
      params = [product_name, variety, brand, size, price, productId, user_id];
    }
    
    const [result] = await dbConnection.query(query, params);
    return result.affectedRows > 0;
  },
  findByNameAndVarietyAndUser: async (product_name, variety, user_id) => {
    const [rows] = await db.query(
      'SELECT * FROM Products WHERE product_name = ? AND variety = ? AND user_id = ?',
      [product_name, variety, user_id]
    );
    return rows[0];
  },
  findByNameAndVarietyAndBrandAndUser: async (product_name, variety, brand, user_id) => {
    const [rows] = await db.query(
      'SELECT * FROM Products WHERE product_name = ? AND variety = ? AND brand = ? AND user_id = ?',
      [product_name, variety, brand, user_id]
    );
    return rows[0];
  },
  getBrandsByProductName: async (product_name) => {
    const [rows] = await db.query(
      'SELECT DISTINCT brand FROM Products WHERE product_name LIKE ? AND brand IS NOT NULL AND brand != ""',
      [`%${product_name}%`]
    );
    return rows.map(row => row.brand);
  },
  deleteByIdAndUser: async (productId, user_id) => {
    const [result] = await db.query('DELETE FROM Products WHERE product_id = ? AND user_id = ?', [productId, user_id]);
    return result.affectedRows > 0;
  }
};

module.exports = Product;
