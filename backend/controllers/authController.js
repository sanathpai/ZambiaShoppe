const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');
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
dotenv.config({ path: path.resolve(__dirname, '../.env') });
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
    // First, check if the user is an admin
    const [adminRows] = await db.query('SELECT * FROM admin WHERE username = ?', [username]);
    if (adminRows.length > 0) {
      const admin = adminRows[0];
      // Check if the password matches for the admin (plain text comparison)
      if (password !== admin.password) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      // Generate JWT for admin
      const token = jwt.sign(
        { adminId: admin.id, username: admin.username, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      return res.json({ token, role: 'admin' });
    }

    // If not an admin, check in the Users table
    const [userRows] = await db.query('SELECT * FROM Users WHERE username = ?', [username]);
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Invalid user credentials' });
    }

    const user = userRows[0];
    // Check if the password matches for the user (bcrypt comparison)
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid user credentials' });
    }

    // Generate JWT for regular user
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token, role: 'user' });
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
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your email password
  },
});

// Forgot password request
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the user with this email exists
    const [rows] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(400).json({ error: 'User not found' });

    const user = rows[0];

    // Generate a reset token
    const token = crypto.randomBytes(20).toString('hex');

    // Set an expiration time for the token (e.g., 1 hour)
    const expireTime = Date.now() + 3600000;

    // Save the token and its expiration to the user's record
    await db.query('UPDATE Users SET reset_password_token = ?, reset_password_expires = ? WHERE email = ?', [token, expireTime, email]);

    // Send the reset link via email
    const resetURL = `http://localhost:3000/reset-password/${token}`;
    const mailOptions = {
      to: email,
      from: process.env.EMAIL_USER,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Click the link to reset your password: ${resetURL}`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Error sending password reset email' });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;  // Use "password" here to match the front-end

  try {
    // Find the user by reset token and check if token is still valid
    const [rows] = await db.query('SELECT * FROM Users WHERE reset_password_token = ? AND reset_password_expires > ?', [token, Date.now()]);
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });

    const user = rows[0];

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);  // Hash the "password" instead of "newPassword"

    // Update the user's password
    await db.query('UPDATE Users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?', [hashedPassword, user.id]);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);  // Log the actual error for debugging
    res.status(500).json({ error: 'Error resetting password' });
  }
};



