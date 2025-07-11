const db = require('../config/db');
const bcrypt = require('bcryptjs');

const Product = {
  create: async (product, connection = null) => {
    const { product_name, category, variety, brand, description, user_id, image } = product;
    const dbConnection = connection || db; // Use provided connection or default db
    
    const [result] = await dbConnection.query(
      'INSERT INTO Products (product_name, category, variety, brand, description, user_id, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_name, category, variety, brand, description, user_id, image]
    );
    return result.insertId;
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
  updateByIdAndUser: async (productId, productData) => {
    const { product_name, category, variety, brand, description, price, user_id } = productData;
    const [result] = await db.query(
      'UPDATE Products SET product_name = ?, category = ?, variety = ?, brand = ?, description = ?, price = ? WHERE product_id = ? AND user_id = ?',
      [product_name, category, variety, brand, description, price, productId, user_id]
    );
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
  getBrandsByProductName: async (product_name, user_id) => {
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
