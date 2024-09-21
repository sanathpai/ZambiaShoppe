// models/Market.js
const db = require('../config/db');

const Market = {
  create: async (market) => {
    const { market_name, location, user_id } = market;
    const [result] = await db.query(
      'INSERT INTO Markets (market_name, location, user_id) VALUES (?, ?, ?)',
      [market_name, location, user_id]
    );
    return result.insertId;
  },
  findAllByUser: async (userId) => {
    const [rows] = await db.query('SELECT * FROM Markets WHERE user_id = ?', [userId]);
    return rows;
  },
  findByIdAndUser: async (marketId, userId) => {
    const [rows] = await db.query('SELECT * FROM Markets WHERE market_id = ? AND user_id = ?', [marketId, userId]);
    return rows[0];
  },
  findByNameAndUser: async (marketName, userId) => {
    const [rows] = await db.query('SELECT * FROM Markets WHERE market_name = ? AND user_id = ?', [marketName, userId]);
    return rows[0];
  },
  updateByIdAndUser: async (marketId, userId, marketData) => {
    const { market_name, location } = marketData;
    const [result] = await db.query(
      'UPDATE Markets SET market_name = ?, location = ? WHERE market_id = ? AND user_id = ?',
      [market_name, location, marketId, userId]
    );
    return result.affectedRows > 0;
  },
  deleteByIdAndUser: async (marketId, userId) => {
    const [result] = await db.query('DELETE FROM Markets WHERE market_id = ? AND user_id = ?', [marketId, userId]);
    return result.affectedRows > 0;
  }
};

module.exports = Market;
