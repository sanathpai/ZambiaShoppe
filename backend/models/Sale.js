const db = require('../config/db');

const Sale = {
  create: async (sale) => {
    const { product_id, retail_price, quantity, sale_date, user_id, shop_name, unit_id } = sale;
    const [result] = await db.query(
      'INSERT INTO Sales (product_id, retail_price, quantity, sale_date, user_id, shop_name, unit_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_id, retail_price, quantity, sale_date, user_id, shop_name, unit_id]
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
    const { product_id, retail_price, quantity, sale_date, shop_name, unit_id } = sale;
    const [result] = await db.query(
      'UPDATE Sales SET product_id = ?, retail_price = ?, quantity = ?, sale_date = ?, shop_name = ?, unit_id = ? WHERE sale_id = ? AND user_id = ?',
      [product_id, retail_price, quantity, sale_date, shop_name, unit_id, saleId, userId]
    );
    return result.affectedRows > 0;
  },

  deleteByIdAndUser: async (saleId, userId) => {
    const [result] = await db.query('DELETE FROM Sales WHERE sale_id = ? AND user_id = ?', [saleId, userId]);
    return result.affectedRows > 0;
  }
};

module.exports = Sale;
