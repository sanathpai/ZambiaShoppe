// const db = require('../config/db');

// const Purchase = {
//   create: async (purchase) => {
//     const { offering_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_type, shop_name, market_name } = purchase;
//     const [result] = await db.query(
//       'INSERT INTO Purchases (offering_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_type, shop_name, market_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
//       [offering_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_type, shop_name, market_name]
//     );
//     return result.insertId;
//   },
//   findAllByUser: async (userId) => {
//     const query = `
//       SELECT 
//         Purchases.*, 
//         Products.product_name,
//         Users.shop_name
//       FROM Purchases
//       JOIN ProductOfferings ON Purchases.offering_id = ProductOfferings.offering_id
//       JOIN Products ON ProductOfferings.product_id = Products.product_id
//       JOIN Users ON Purchases.user_id = Users.id
//       WHERE Purchases.user_id = ?
//     `;
//     const [rows] = await db.query(query, [userId]);
//     return rows;
//   },
//   findByIdAndUser: async (purchaseId, userId) => {
//     const query = `
//       SELECT 
//         Purchases.*, 
//         Products.product_name 
//       FROM Purchases
//       JOIN ProductOfferings ON Purchases.offering_id = ProductOfferings.offering_id
//       JOIN Products ON ProductOfferings.product_id = Products.product_id
//       WHERE Purchases.purchase_id = ? AND Purchases.user_id = ?
//     `;
//     const [rows] = await db.query(query, [purchaseId, userId]);
//     return rows[0];
//   },
//   findByOfferingAndUser: async (offeringId, userId) => {
//     const [rows] = await db.query('SELECT * FROM Inventories WHERE offering_id = ? AND user_id = ?', [offeringId, userId]);
//     return rows[0];
//   },
//   updateByIdAndUser: async (purchaseId, purchase, userId) => {
//     const { offering_id, supplier_name, order_price, quantity, purchase_date, unit_type, shop_name, market_name } = purchase;
//     const [result] = await db.query(
//       'UPDATE Purchases SET offering_id = ?, supplier_name = ?, order_price = ?, quantity = ?, purchase_date = ?, unit_type = ?, shop_name = ?, market_name = ? WHERE purchase_id = ? AND user_id = ?',
//       [offering_id, supplier_name, order_price, quantity, purchase_date, unit_type, shop_name, market_name, purchaseId, userId]
//     );
//     return result.affectedRows > 0;
//   },
//   deleteByIdAndUser: async (purchaseId, userId) => {
//     const [result] = await db.query('DELETE FROM Purchases WHERE purchase_id = ? AND user_id = ?', [purchaseId, userId]);
//     return result.affectedRows > 0;
//   },
  
// };

// module.exports = Purchase;

const db = require('../config/db');

const Purchase = {
  create: async (purchase) => {
    const { offering_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_type, shop_name, market_name } = purchase;
    const [result] = await db.query(
      'INSERT INTO Purchases (offering_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_type, shop_name, market_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [offering_id, supplier_name, order_price, quantity, purchase_date, user_id, unit_type, shop_name, market_name]
    );
    return result.insertId;
  },
  findAllByUser: async (userId) => {
    const query = `
      SELECT 
        Purchases.*, 
        Products.product_name,
        Users.shop_name
      FROM Purchases
      JOIN ProductOfferings ON Purchases.offering_id = ProductOfferings.offering_id
      JOIN Products ON ProductOfferings.product_id = Products.product_id
      JOIN Users ON Purchases.user_id = Users.id
      WHERE Purchases.user_id = ?
    `;
    const [rows] = await db.query(query, [userId]);
    return rows;
  },
  findByIdAndUser: async (purchaseId, userId) => {
    const query = `
      SELECT 
        Purchases.*, 
        Products.product_name 
      FROM Purchases
      JOIN ProductOfferings ON Purchases.offering_id = ProductOfferings.offering_id
      JOIN Products ON ProductOfferings.product_id = Products.product_id
      WHERE Purchases.purchase_id = ? AND Purchases.user_id = ?
    `;
    const [rows] = await db.query(query, [purchaseId, userId]);
    return rows[0];
  },
  updateByIdAndUser: async (purchaseId, purchase, userId) => {
    const { offering_id, supplier_name, order_price, quantity, purchase_date, unit_type, shop_name, market_name } = purchase;
    const [result] = await db.query(
      'UPDATE Purchases SET offering_id = ?, supplier_name = ?, order_price = ?, quantity = ?, purchase_date = ?, unit_type = ?, shop_name = ?, market_name = ? WHERE purchase_id = ? AND user_id = ?',
      [offering_id, supplier_name, order_price, quantity, purchase_date, unit_type, shop_name, market_name, purchaseId, userId]
    );
    return result.affectedRows > 0;
  },
  deleteByIdAndUser: async (purchaseId, userId) => {
    const [result] = await db.query('DELETE FROM Purchases WHERE purchase_id = ? AND user_id = ?', [purchaseId, userId]);
    return result.affectedRows > 0;
  }
};

module.exports = Purchase;

