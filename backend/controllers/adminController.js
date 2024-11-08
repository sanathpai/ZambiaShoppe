// /controllers/adminController.js
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const db = require('../config/db');

// Get All Users with Pagination
exports.getUsers = async (req, res) => {
    const { page = 1, limit = 10 } = req.query; // Default values for pagination

    try {
        const offset = (page - 1) * limit;
        const [users] = await db.query('SELECT * FROM Users LIMIT ?, ?', [offset, parseInt(limit)]);
        const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM Users');

        res.status(200).json({
            users,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get Activity of a Specific User
exports.getUserActivity = async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch user's purchases, sales, and products added
        const userPurchases = await Purchase.findAllByUser(id);
        const userSales = await Sale.findAllByUser(id);
        const userProducts = await Product.findAllByUser(id);

        res.status(200).json({
            purchases: userPurchases,
            sales: userSales,
            products: userProducts
        });
    } catch (error) {
        console.error("Error fetching user activity:", error);
        res.status(500).json({ message: 'Server error' });
    }
};


exports.getUserPurchases = async (req, res) => {
    try {
     // Get the user ID from the request parameters
  
      const query = `SELECT 
        Purchases.*, 
        Products.product_name,
        Products.variety
      FROM Purchases
      JOIN Products ON Purchases.product_id = Products.product_id
      ORDER BY Purchases.purchase_date DESC;`;
  
      // Execute the query with the userId as a parameter
      const [rows] = await db.query(query);
  
      // Send the rows as the response
      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      console.error('Error fetching user purchases:', error);
      res.status(500).json({ success: false, message: 'Error fetching user purchases' });
    }
  };


  exports.getUserSales=async (req,res)=>{

    try{
    const query = `
    SELECT 
  Sales.*, 
  Products.product_name,
  Products.variety,
  Units.unit_type
FROM Sales
JOIN Products ON Sales.product_id = Products.product_id
JOIN Units ON Sales.unit_id = Units.unit_id
ORDER BY Sales.sale_date DESC;
  `;
  const [rows] = await db.query(query);
        res.status(200).json({success: true, data: rows});
    }catch(error)
    {
        res.status(500).json({ success: false, message: 'Error fetching user purchases' });
    }

  };
