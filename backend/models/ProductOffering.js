const db = require('../config/db');

const ProductOfferings = {
  create: async (offering) => {
    const { product_id, user_id, shop_name, price, unit_id } = offering;
    const [result] = await db.query(
      'INSERT INTO ProductOfferings (product_id, user_id, shop_name, price, unit_id) VALUES (?, ?, ?, ?, ?)',
      [product_id, user_id, shop_name, price, unit_id]
    );
    return result.insertId;
  },
  findByUnitIdAndUser: async (unitId, userId) => {
    const [rows] = await db.query('SELECT * FROM ProductOfferings WHERE unit_id = ? AND user_id = ?', [unitId, userId]);
    return rows;
  },
  findByIdAndUser: async (offeringId, userId) => {
    const [rows] = await db.query(
      'SELECT * FROM ProductOfferings WHERE offering_id = ? AND user_id = ?',
      [offeringId, userId]
    );
    return rows[0];
  },
  deleteByUnitIdAndUser: async (unitId, userId) => {
    const [result] = await db.query('DELETE FROM ProductOfferings WHERE unit_id = ? AND user_id = ?', [unitId, userId]);
    return result.affectedRows > 0;
  },
  findByShopProductVarietyAndUser: async (shop_name, product_name, variety, user_id) => {
    const [rows] = await db.query(
      `SELECT po.* 
       FROM ProductOfferings po
       JOIN Products p ON po.product_id = p.product_id
       WHERE po.shop_name = ? AND p.product_name = ? AND p.variety = ? AND po.user_id = ?`,
      [shop_name, product_name, variety, user_id]
    );
    return rows[0];
  },
  findByShopProductAndUser: async (shop_name, product_id, user_id) => {
    const [rows] = await db.query(
      `SELECT * 
       FROM ProductOfferings 
       WHERE shop_name = ? AND product_id = ? AND user_id = ?`,
      [shop_name, product_id, user_id]
    );
    return rows[0];
  },
  findByProductVarietyAndUser: async (product_name, variety, user_id) => {
    const query = `
      SELECT po.*
      FROM ProductOfferings po
      JOIN Products p ON po.product_id = p.product_id
      WHERE p.product_name = ? AND p.variety = ? AND po.user_id = ?
    `;
    const [rows] = await db.query(query, [product_name, variety, user_id]);
    return rows[0];
  },
  findAllByUser: async (userId) => {
    const query = `
      SELECT 
        ProductOfferings.offering_id, 
        Products.product_name, 
        Products.variety 
      FROM ProductOfferings
      JOIN Products ON ProductOfferings.product_id = Products.product_id
      WHERE ProductOfferings.user_id = ?
    `;
    const [rows] = await db.query(query, [userId]);
    return rows;
  }
};

module.exports = ProductOfferings;
