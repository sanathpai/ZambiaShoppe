const db = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {
  create: async (user) => {
    const { username, password, shop_name, first_name, last_name, email, contact, address } = user;
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO Users (username, password, shop_name, first_name, last_name, email, contact, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, shop_name, first_name || null, last_name || null, email || null, contact || null, address || null]
    );
    return result.insertId;
  },
  findByUsername: async (username) => {
    const [rows] = await db.query('SELECT * FROM Users WHERE username = ?', [username]);
    return rows[0];
  },
  findByEmail: async (email) => {
    const [rows] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    return rows[0];
  },
  findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM Users WHERE id = ?', [id]);
    return rows[0];
  },
  checkDuplicates: async (username, email) => {
    const duplicates = { username: false, email: false };
    
    // Check for duplicate username
    if (username) {
      const existingUser = await User.findByUsername(username);
      duplicates.username = !!existingUser;
    }
    
    // Check for duplicate email
    if (email) {
      const existingEmail = await User.findByEmail(email);
      duplicates.email = !!existingEmail;
    }
    
    return duplicates;
  }
};

module.exports = User;
