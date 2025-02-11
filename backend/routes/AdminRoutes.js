// /routes/adminRoute.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../src/middleware/auth'); // Assuming you have an auth middleware

// Route to get paginated users
router.get('/users', auth, adminController.getUsers);
router.get('/users/purchases',auth, adminController.getUserPurchases);
router.get('/users/sales',auth, adminController.getUserSales);
router.get('/export-full-database', auth, adminController.exportDataToExcel);
router.get('/export-report', auth, adminController.exportFilteredData);
// Route to get activity of a specific user by user ID
router.get('/users/:id/activity', auth, adminController.getUserActivity);

module.exports = router;
