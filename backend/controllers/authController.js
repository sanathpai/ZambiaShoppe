const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const User = require('../models/User');

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validatePhoneNumber = (phone) => {
  const re = /^\d{10}$/;
  return re.test(phone);
};

exports.register = async (req, res) => {
  const { username, password, shop_name, first_name, last_name, email, contact, address } = req.body;

  if (!shop_name) {
    return res.status(400).json({ error: 'Shop name is required' });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (email && !validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  if (contact && !validatePhoneNumber(contact)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }

  try {
    const userId = await User.create({ username, password, shop_name, first_name, last_name, email, contact, address });
    res.status(201).json({ userId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM Users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.validateToken = (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    res.status(200).json({ message: 'Token is valid' });
  });
};

exports.logout = (req, res) => {
  console.log('Logout endpoint hit'); // Log to check if the endpoint is being accessed
  res.json({ message: 'User logged out successfully' });
};
