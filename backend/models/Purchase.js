const db = require('../config/db');

const Purchase = {
  // Create a new purchase
  create: async (purchase) => {
    const { product_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_id, shop_name, market_name } = purchase;
    const [result] = await db.query(
      'INSERT INTO Purchases (product_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_id, shop_name, market_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [product_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_id, shop_name, market_name]
    );
    return result.insertId;
  },

  // Find all purchases by a specific user
  findAllByUser: async (userId) => {
    console.log(`User Id is: ${userId}`);
    const query = `
      SELECT 
        Purchases.*, 
        Products.product_name,
        Products.variety,
        Units.unit_type  -- Now including the unit type
      FROM Purchases
      JOIN Products ON Purchases.product_id = Products.product_id
      JOIN Units ON Purchases.unit_id = Units.unit_id  -- Join with Units table to get the unit details
      WHERE Purchases.user_id = ?
      ORDER BY Purchases.purchase_date DESC
    `;
    const [rows] = await db.query(query, [userId]);
    return rows;
  },

  findAllByUserAndId: async (userId, productId) => {
    console.log(`User Id is: ${userId}, Product Id is: ${productId}`);
    
    const query = `
      SELECT 
        Purchases.*, 
        Products.product_name,
        Units.unit_type  -- Including the unit type
      FROM Purchases
      JOIN Products ON Purchases.product_id = Products.product_id
      JOIN Units ON Purchases.unit_id = Units.unit_id  -- Join with Units table to get the unit details
      WHERE Purchases.user_id = ? AND Purchases.product_id = ?  -- Added filter by productId
      ORDER BY Purchases.purchase_date DESC
      
    `;
  
    const [rows] = await db.query(query, [userId, productId]);  // Pass userId and productId
    console.log(rows);
    return rows;
  },
  

  // Find a specific purchase by purchaseId and userId
  findByIdAndUser: async (purchaseId, userId) => {
    const query = `
      SELECT 
        Purchases.*, 
        Products.product_name,
        Units.unit_type  -- Now including the unit type
      FROM Purchases
      JOIN Products ON Purchases.product_id = Products.product_id
      JOIN Units ON Purchases.unit_id = Units.unit_id  -- Join with Units table to get the unit details
      WHERE Purchases.purchase_id = ? AND Purchases.user_id = ?
    `;
    const [rows] = await db.query(query, [purchaseId, userId]);
    return rows[0];
  },

  // Update an existing purchase by purchaseId and userId
  updateByIdAndUser: async (purchaseId, purchase, userId) => {
    const { product_id, supplier_name, order_price, quantity, purchase_date, unit_id, shop_name, market_name } = purchase;
    const [result] = await db.query(
      'UPDATE Purchases SET product_id = ?, supplier_name = ?, order_price = ?, quantity = ?, purchase_date = ?, unit_id = ?, shop_name = ?, market_name = ? WHERE purchase_id = ? AND user_id = ?',
      [product_id, supplier_name, order_price, quantity, purchase_date, unit_id, shop_name, market_name, purchaseId, userId]
    );
    return result.affectedRows > 0;
  },

  // Delete a purchase by purchaseId and userId
  deleteByIdAndUser: async (purchaseId, userId) => {
    const [result] = await db.query('DELETE FROM Purchases WHERE purchase_id = ? AND user_id = ?', [purchaseId, userId]);
    return result.affectedRows > 0;
  }
};

module.exports = Purchase; 