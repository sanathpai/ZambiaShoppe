const db = require('../config/db');

const Sale = {
  create: async (sale) => {
    const { offering_id, retail_price, quantity, sale_date, user_id, shop_name, unit_type } = sale;
    const [result] = await db.query(
      'INSERT INTO Sales (offering_id, retail_price, quantity, sale_date, user_id, shop_name, unit_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [offering_id, retail_price, quantity, sale_date, user_id, shop_name, unit_type]
    );
    return result.insertId;
  },
  findAllByUser: async (userId) => {
    const query = `
      SELECT 
        Sales.*, 
        Products.product_name, 
        Products.variety
      FROM Sales
      JOIN ProductOfferings ON Sales.offering_id = ProductOfferings.offering_id
      JOIN Products ON ProductOfferings.product_id = Products.product_id
      WHERE Sales.user_id = ?
    `;
    const [rows] = await db.query(query, [userId]);
    return rows;
  },
  findByIdAndUser: async (saleId, userId) => {
    const query = `
      SELECT 
        Sales.*, 
        Products.product_name, 
        Products.variety
      FROM Sales
      JOIN ProductOfferings ON Sales.offering_id = ProductOfferings.offering_id
      JOIN Products ON ProductOfferings.product_id = Products.product_id
      WHERE Sales.sale_id = ? AND Sales.user_id = ?
    `;
    const [rows] = await db.query(query, [saleId, userId]);
    return rows[0];
  },
  updateByIdAndUser: async (saleId, sale, userId) => {
    const { offering_id, retail_price, quantity, sale_date, shop_name, unit_type } = sale;
    const [result] = await db.query(
      'UPDATE Sales SET offering_id = ?, retail_price = ?, quantity = ?, sale_date = ?, shop_name = ?, unit_type = ? WHERE sale_id = ? AND user_id = ?',
      [offering_id, retail_price, quantity, sale_date, shop_name, unit_type, saleId, userId]
    );
    return result.affectedRows > 0;
  },
  deleteByIdAndUser: async (saleId, userId) => {
    const [result] = await db.query('DELETE FROM Sales WHERE sale_id = ? AND user_id = ?', [saleId, userId]);
    return result.affectedRows > 0;
  }
};

module.exports = Sale;
