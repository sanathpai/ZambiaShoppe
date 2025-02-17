const db = require('../config/db');
const bcrypt = require('bcryptjs');

const Product = {
  create: async (product) => {
    const { product_name, category, variety, description, user_id } = product;
    const [result] = await db.query(
      'INSERT INTO Products (product_name, category, variety, description, user_id) VALUES (?, ?, ?, ?, ?)',
      [product_name, category, variety, description, user_id]
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
    const { product_name, category, variety, description, price, user_id } = productData;
    const [result] = await db.query(
      'UPDATE Products SET product_name = ?, category = ?, variety = ?, description = ?, price = ? WHERE product_id = ? AND user_id = ?',
      [product_name, category, variety, description, price, productId, user_id]
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
  deleteByIdAndUser: async (productId, user_id) => {
    const [result] = await db.query('DELETE FROM Products WHERE product_id = ? AND user_id = ?', [productId, user_id]);
    return result.affectedRows > 0;
  }
};

module.exports = Product;
