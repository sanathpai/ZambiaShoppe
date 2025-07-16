// /controllers/adminController.js
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const getDateRange = (filter) => {
  const now = new Date();
  let startDate, endDate;

  if (filter === "current_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (filter === "last_quarter") {
      const quarter = Math.floor((now.getMonth() + 1) / 3);
      startDate = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      endDate = new Date(now.getFullYear(), quarter * 3, 0);
  } else if (filter === "year_end") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
  }

  return { startDate, endDate };
};


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
        Products.variety,
        Users.username,
        Users.shop_name
      FROM Purchases
      JOIN Products ON Purchases.product_id = Products.product_id
      JOIN Users ON Purchases.user_id = Users.id
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
  Units.unit_type,
  Users.username,
  Users.shop_name
FROM Sales
JOIN Products ON Sales.product_id = Products.product_id
JOIN Units ON Sales.unit_id = Units.unit_id
JOIN Users ON Sales.user_id=Users.id
ORDER BY Sales.sale_date DESC, Sales.trans_id;
  `;
  const [rows] = await db.query(query);
        res.status(200).json({success: true, data: rows});
    }catch(error)
    {
        res.status(500).json({ success: false, message: 'Error fetching user purchases' });
    }

  };




// Export all data to an Excel file
exports.exportDataToExcel = async (req, res) => {
  try {
      // Fetch data from different tables
      const [users] = await db.query(`SELECT * FROM Users`);
      const [products] = await db.query(`SELECT * FROM Products`);
      const [purchases] = await db.query(`
          SELECT 
              Purchases.*, 
              Products.product_name,
              Products.variety,
              Users.username,
              Users.shop_name
          FROM Purchases
          JOIN Products ON Purchases.product_id = Products.product_id
          JOIN Users ON Purchases.user_id = Users.id
          ORDER BY Purchases.purchase_date DESC;
      `);
      const [sales] = await db.query(`
          SELECT 
              Sales.*, 
              Products.product_name,
              Products.variety,
              Units.unit_type,
              Users.username,
              Users.shop_name
          FROM Sales
          JOIN Products ON Sales.product_id = Products.product_id
          JOIN Units ON Sales.unit_id = Units.unit_id
          JOIN Users ON Sales.user_id = Users.id
          ORDER BY Sales.sale_date DESC, Sales.trans_id;
      `);

      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Convert JSON data to worksheets and append to workbook
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(users), "Users");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(products), "Products");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(purchases), "Purchases");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sales), "Sales");

      // Define file path
      const filePath = path.join(__dirname, '..', 'exports', 'database_export.xlsx');

      // Ensure the exports directory exists
      if (!fs.existsSync(path.join(__dirname, '..', 'exports'))) {
          fs.mkdirSync(path.join(__dirname, '..', 'exports'), { recursive: true });
      }

      // Write Excel file
      XLSX.writeFile(workbook, filePath);

      // Send file as response for download
      res.download(filePath, 'database_export.xlsx', (err) => {
          if (err) {
              console.error("Error downloading file:", err);
              res.status(500).json({ message: 'Error downloading file' });
          }
      });

  } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ message: 'Error exporting data' });
  }
};
exports.exportFilteredData = async (req, res) => {
  try {
      const { filter } = req.query;
      const { startDate, endDate } = getDateRange(filter);

      // Fetch filtered data
      const [purchases] = await db.query(`SELECT 
    Purchases.*, 
    Products.product_name,
    Products.variety,
    Users.username,
    Users.shop_name
FROM Purchases
JOIN Products ON Purchases.product_id = Products.product_id
JOIN Users ON Purchases.user_id = Users.id
WHERE Purchases.purchase_date BETWEEN ? AND ?
ORDER BY Purchases.purchase_date DESC;
`, [startDate, endDate]);
      const [sales] = await db.query(`SELECT 
    Sales.*, 
    Products.product_name,
    Products.variety,
    Units.unit_type,
    Users.username,
    Users.shop_name
FROM Sales
JOIN Products ON Sales.product_id = Products.product_id
JOIN Units ON Sales.unit_id = Units.unit_id
JOIN Users ON Sales.user_id = Users.id
WHERE Sales.sale_date BETWEEN ? AND ? 
ORDER BY Sales.sale_date DESC;
`, [startDate, endDate]);

      // Create a workbook
      const workbook = XLSX.utils.book_new();

      // Append worksheets
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(purchases), "Purchases");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sales), "Sales");

      // Define file path
      const filePath = path.join(__dirname, '..', 'exports', `${filter}_report.xlsx`);

      // Write Excel file
      XLSX.writeFile(workbook, filePath);

      // Send file for download
      res.download(filePath, `${filter}_report.xlsx`);

  } catch (error) {
      console.error("Error exporting filtered data:", error);
      res.status(500).json({ message: 'Error exporting data' });
  }
};