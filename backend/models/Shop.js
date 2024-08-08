const db = require('../config/db');

const Shop = {
  create: async (shop) => {
    const { shop_name, location, phone_number, user_id } = shop;
    const [result] = await db.query(
      'INSERT INTO Shops (shop_name, location, phone_number, user_id) VALUES (?, ?, ?, ?)',
      [shop_name, location, phone_number, user_id]
    );
    return result.insertId;
  },
  findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM Shops WHERE shop_id = ?', [id]);
    return rows[0];
  },
  findByName: async (name) => {
    const [rows] = await db.query('SELECT * FROM Shops WHERE shop_name = ?', [name]);
    return rows[0];
  },
  findByNameAndUser: async (name, userId) => {
    const [rows] = await db.query('SELECT * FROM Shops WHERE shop_name = ? AND user_id = ?', [name, userId]);
    return rows[0];
  },
  findAllByUser: async (userId) => {
    const [rows] = await db.query('SELECT * FROM Shops WHERE user_id = ?', [userId]);
    return rows;
  },
  update: async (id, shop) => {
    const { shop_name, location, phone_number } = shop;
    const [result] = await db.query(
      'UPDATE Shops SET shop_name = ?, location = ?, phone_number = ? WHERE shop_id = ?',
      [shop_name, location, phone_number, id]
    );
    return result.affectedRows;
  },
  deleteRelatedRecords: async (shopId) => {
    await db.query('DELETE FROM ProductOfferings WHERE shop_id = ?', [shopId]);
    await db.query('DELETE FROM Purchases WHERE shop_id = ?', [shopId]);
    await db.query('DELETE FROM Sales WHERE shop_id = ?', [shopId]);
    await db.query('DELETE FROM Inventories WHERE shop_id = ?', [shopId]);
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM Shops WHERE shop_id = ?', [id]);
    return result.affectedRows;
  }
};

module.exports = Shop;
