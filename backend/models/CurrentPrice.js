const db = require('../config/db');

const CurrentPrice = {
  // Get current price for a product-unit combination
  findByProductAndUnit: async (product_id, unit_id, user_id, connection = null) => {
    const dbConnection = connection || db; // Use provided connection or default db
    const [rows] = await dbConnection.query(`
      SELECT * FROM CurrentPrice 
      WHERE product_id = ? AND unit_id = ? AND user_id = ?
    `, [product_id, unit_id, user_id]);
    return rows[0];
  },

  // Get all current prices for a user
  findAllByUser: async (user_id) => {
    const [rows] = await db.query(`
      SELECT 
        cp.*,
        p.product_name,
        p.variety,
        u.unit_type,
        u.unit_category
      FROM CurrentPrice cp
      JOIN Products p ON cp.product_id = p.product_id
      JOIN Units u ON cp.unit_id = u.unit_id
      WHERE cp.user_id = ?
      ORDER BY p.product_name, u.unit_type
    `, [user_id]);
    return rows;
  },

  // Get current prices for a specific product
  findByProduct: async (product_id, user_id) => {
    const [rows] = await db.query(`
      SELECT 
        cp.*,
        u.unit_type,
        u.unit_category
      FROM CurrentPrice cp
      JOIN Units u ON cp.unit_id = u.unit_id
      WHERE cp.product_id = ? AND cp.user_id = ?
      ORDER BY u.unit_type
    `, [product_id, user_id]);
    return rows;
  },

  // Create or update current price
  upsert: async (currentPriceData, connection = null) => {
    const { product_id, unit_id, user_id, retail_price, order_price } = currentPriceData;
    const dbConnection = connection || db; // Use provided connection or default db
    
    // Try to update existing record first
    const [updateResult] = await dbConnection.query(`
      UPDATE CurrentPrice 
      SET retail_price = ?, order_price = ?, last_updated = CURRENT_TIMESTAMP
      WHERE product_id = ? AND unit_id = ? AND user_id = ?
    `, [retail_price, order_price, product_id, unit_id, user_id]);

    if (updateResult.affectedRows > 0) {
      // Record was updated, return the existing ID
      const existing = await CurrentPrice.findByProductAndUnit(product_id, unit_id, user_id, dbConnection);
      return existing.current_price_id;
    } else {
      // Create new record
      const [insertResult] = await dbConnection.query(`
        INSERT INTO CurrentPrice (product_id, unit_id, user_id, retail_price, order_price)
        VALUES (?, ?, ?, ?, ?)
      `, [product_id, unit_id, user_id, retail_price, order_price]);
      return insertResult.insertId;
    }
  },

  // Update only retail price
  updateRetailPrice: async (product_id, unit_id, user_id, retail_price) => {
    const [result] = await db.query(`
      UPDATE CurrentPrice 
      SET retail_price = ?, last_updated = CURRENT_TIMESTAMP
      WHERE product_id = ? AND unit_id = ? AND user_id = ?
    `, [retail_price, product_id, unit_id, user_id]);
    
    if (result.affectedRows === 0) {
      // Create new record if none exists
      const [insertResult] = await db.query(`
        INSERT INTO CurrentPrice (product_id, unit_id, user_id, retail_price, order_price)
        VALUES (?, ?, ?, ?, 0.00)
      `, [product_id, unit_id, user_id, retail_price]);
      return insertResult.insertId;
    }
    return true;
  },

  // Update only order price
  updateOrderPrice: async (product_id, unit_id, user_id, order_price) => {
    const [result] = await db.query(`
      UPDATE CurrentPrice 
      SET order_price = ?, last_updated = CURRENT_TIMESTAMP
      WHERE product_id = ? AND unit_id = ? AND user_id = ?
    `, [order_price, product_id, unit_id, user_id]);
    
    if (result.affectedRows === 0) {
      // Create new record if none exists
      const [insertResult] = await db.query(`
        INSERT INTO CurrentPrice (product_id, unit_id, user_id, retail_price, order_price)
        VALUES (?, ?, ?, 0.00, ?)
      `, [product_id, unit_id, user_id, order_price]);
      return insertResult.insertId;
    }
    return true;
  },

  // Delete current price record
  deleteByProductAndUnit: async (product_id, unit_id, user_id) => {
    const [result] = await db.query(`
      DELETE FROM CurrentPrice 
      WHERE product_id = ? AND unit_id = ? AND user_id = ?
    `, [product_id, unit_id, user_id]);
    return result.affectedRows > 0;
  },

  // Get price suggestions for a product (all units)
  getPriceSuggestions: async (product_id, user_id) => {
    const [rows] = await db.query(`
      SELECT 
        u.unit_id,
        u.unit_type,
        u.unit_category,
        COALESCE(cp.retail_price, 0.00) as retail_price,
        COALESCE(cp.order_price, 0.00) as order_price,
        cp.last_updated
      FROM Units u
      LEFT JOIN CurrentPrice cp ON u.unit_id = cp.unit_id AND cp.product_id = ? AND cp.user_id = ?
      WHERE u.product_id = ? AND u.user_id = ?
      ORDER BY u.unit_category, u.unit_type
    `, [product_id, user_id, product_id, user_id]);
    return rows;
  }
};

module.exports = CurrentPrice; 