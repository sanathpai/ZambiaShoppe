const db = require('../config/db');

const Sale = {
  create: async (sale) => {
    const { product_id, retail_price, quantity, sale_date, user_id, shop_name, unit_id, trans_id, discount = 0 } = sale;
    const [result] = await db.query(
      'INSERT INTO Sales (product_id, retail_price, quantity, sale_date, user_id, shop_name, unit_id, trans_id, discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [product_id, retail_price, quantity, sale_date, user_id, shop_name, unit_id, trans_id, discount]
    );
    return result.insertId;
  },
  
  findAllByUser: async (userId) => {
    const query = `
      SELECT 
        Sales.*, 
        Products.product_name, 
        Products.variety,
        Units.unit_type  -- Including the unit type from Units table
      FROM Sales
      JOIN Products ON Sales.product_id = Products.product_id
      JOIN Units ON Sales.unit_id = Units.unit_id
      WHERE Sales.user_id = ?
      ORDER BY Sales.sale_date DESC, Sales.trans_id
    `;
    const [rows] = await db.query(query, [userId]);
    return rows;
  },

  findAllByUserAndId: async (userId,prodId) => {
    const query = `
      SELECT 
        Sales.*, 
        Products.product_name, 
        Products.variety,
        Units.unit_type  -- Including the unit type from Units table
      FROM Sales
      JOIN Products ON Sales.product_id = Products.product_id
      JOIN Units ON Sales.unit_id = Units.unit_id
      WHERE Sales.user_id = ? AND Sales.product_id = ?
      ORDER BY Sales.sale_date DESC, Sales.trans_id
    `;
    const [rows] = await db.query(query, [userId,prodId]);
    return rows;
  },

  findByIdAndUser: async (saleId, userId) => {
    const query = `
      SELECT 
        Sales.*, 
        Products.product_name, 
        Products.variety,
        Units.unit_type  -- Including the unit type from Units table
      FROM Sales
      JOIN Products ON Sales.product_id = Products.product_id
      JOIN Units ON Sales.unit_id = Units.unit_id
      WHERE Sales.sale_id = ? AND Sales.user_id = ?
    `;
    const [rows] = await db.query(query, [saleId, userId]);
    return rows[0];
  },

  updateByIdAndUser: async (saleId, sale, userId) => {
    const { product_id, retail_price, quantity, sale_date, shop_name, unit_id, trans_id, discount = 0 } = sale;
    const [result] = await db.query(
      'UPDATE Sales SET product_id = ?, retail_price = ?, quantity = ?, sale_date = ?, shop_name = ?, unit_id = ?, trans_id = ?, discount = ? WHERE sale_id = ? AND user_id = ?',
      [product_id, retail_price, quantity, sale_date, shop_name, unit_id, trans_id, discount, saleId, userId]
    );
    return result.affectedRows > 0;
  },

  deleteByIdAndUser: async (saleId, userId) => {
    const [result] = await db.query('DELETE FROM Sales WHERE sale_id = ? AND user_id = ?', [saleId, userId]);
    return result.affectedRows > 0;
  },

  // New method to find sales by transaction ID
  findByTransactionId: async (transId, userId) => {
    const query = `
      SELECT 
        Sales.*, 
        Products.product_name, 
        Products.variety,
        Units.unit_type
      FROM Sales
      JOIN Products ON Sales.product_id = Products.product_id
      JOIN Units ON Sales.unit_id = Units.unit_id
      WHERE Sales.trans_id = ? AND Sales.user_id = ?
      ORDER BY Sales.sale_date DESC
    `;
    const [rows] = await db.query(query, [transId, userId]);
    return rows;
  }
};

module.exports = Sale;
