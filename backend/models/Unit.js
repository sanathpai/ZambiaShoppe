const db = require('../config/db');

const Unit = {
  create: async (unit) => {
    const { product_id, buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b, user_id } = unit;
    const [result] = await db.query(
      'INSERT INTO Units (product_id, buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [product_id, buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b, user_id]
    );
    return result.insertId;
  },
  findById: async (unitId) => {
    const [rows] = await db.query('SELECT * FROM Units WHERE unit_id = ?', [unitId]);
    return rows[0];
  },
  findAllByUser: async (userId) => {
    const [rows] = await db.query(`
      SELECT Units.*, Products.product_name, Products.variety
      FROM Units 
      JOIN Products ON Units.product_id = Products.product_id 
      WHERE Units.user_id = ?`, 
      [userId]
    );
    return rows;
  },
  findByProductIdAndUser: async (product_id, user_id) => {
    const [rows] = await db.query('SELECT * FROM Units WHERE product_id = ? AND user_id = ?', [product_id, user_id]);
    return rows;
  },
  findByProductId: async (productId, userId) => {
    const [rows] = await db.query(`
      SELECT Units.*, Products.product_name 
      FROM Units 
      JOIN Products ON Units.product_id = Products.product_id 
      WHERE Units.product_id = ? AND Units.user_id = ?`, 
      [productId, userId]
    );
    return rows;
  },
  findByIdAndUser: async (unitId, userId) => {
    const [rows] = await db.query('SELECT * FROM Units WHERE unit_id = ? AND user_id = ?', [unitId, userId]);
    return rows[0];
  },
  updateByIdAndUser: async (unitId, userId, updatedUnit) => {
    const { product_id, buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b } = updatedUnit;
    const [result] = await db.query(
      'UPDATE Units SET product_id = ?, buying_unit_size = ?, selling_unit_size = ?, buying_unit_type = ?, selling_unit_type = ?, prepackaged = ?, prepackaged_b = ? WHERE unit_id = ? AND user_id = ?',
      [product_id, buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b, unitId, userId]
    );
    return result.affectedRows > 0;
  },
  updateByProductIdAndUser: async (productId, userId, updatedUnit) => {
    const { buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b } = updatedUnit;
    const [result] = await db.query(
      'UPDATE Units SET buying_unit_size = ?, selling_unit_size = ?, buying_unit_type = ?, selling_unit_type = ?, prepackaged = ?, prepackaged_b = ? WHERE product_id = ? AND user_id = ?',
      [buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b, productId, userId]
    );
    return result.affectedRows > 0;
  },
  findDefaultUnitByProduct: async (productId, userId) => {
    const [rows] = await db.query(`
      SELECT * FROM Units 
      WHERE product_id = ? AND user_id = ? AND buying_unit_type = 'default' AND selling_unit_type = 'default'`,
      [productId, userId]
    );
    return rows[0];
  },
  deleteByIdAndUser: async (unitId, userId) => {
    const [result] = await db.query('DELETE FROM Units WHERE unit_id = ? AND user_id = ?', [unitId, userId]);
    return result.affectedRows > 0;
  }
};

module.exports = Unit;
