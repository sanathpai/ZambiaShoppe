const db = require('../config/db');

const Supplier = {
  create: async (supplier) => {
    const { supplier_name, market_name, contact_info, location, user_id } = supplier;

    const [result] = await db.query(
      'INSERT INTO RegularSuppliers (name, phone_number, location, user_id, market_name) VALUES (?, ?, ?, ?, ?)',
      [
        supplier_name ? supplier_name : null,  // If it's a supplier, set supplier_name
        contact_info,
        location,
        user_id,
        market_name ? market_name : null  // If it's a market, set market_name
      ]
    );
    return result.insertId;
  },

  findAllByUser: async (userId) => {
    const [rows] = await db.query('SELECT * FROM RegularSuppliers WHERE user_id = ?', [userId]);
    return rows;
  },

  findByIdAndUser: async (supplierId, userId) => {
    const [rows] = await db.query('SELECT * FROM RegularSuppliers WHERE supplier_id = ? AND user_id = ?', [supplierId, userId]);
    return rows[0];
  },

  updateByIdAndUser: async (supplierId, userId, updatedSupplier) => {
    const { supplier_name, market_name, contact_info, location } = updatedSupplier;
    const [result] = await db.query(
      'UPDATE RegularSuppliers SET name = ?, phone_number = ?, location = ?, market_name = ? WHERE supplier_id = ? AND user_id = ?',
      [
        supplier_name ? supplier_name : null,  // Update supplier_name if present
        contact_info,
        location,
        market_name ? market_name : null,  // Update market_name if present
        supplierId,
        userId
      ]
    );
    return result.affectedRows > 0;
  },

  deleteByIdAndUser: async (supplierId, userId) => {
    const [result] = await db.query('DELETE FROM RegularSuppliers WHERE supplier_id = ? AND user_id = ?', [supplierId, userId]);
    return result.affectedRows > 0;
  }
};

module.exports = Supplier;
