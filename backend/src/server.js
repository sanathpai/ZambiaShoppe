const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const cron = require('node-cron'); // Import node-cron
require('../config/passport');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER.toString(),
    pass: process.env.EMAIL_PASS.toString(),
  },
});

const authRoutes = require('../routes/AuthRoutes');
const productRoutes = require('../routes/ProductRoutes');
const purchaseRoutes = require('../routes/purchaseRoutes');
const saleRoutes = require('../routes/saleRoutes');
const inventoryRoutes = require('../routes/inventoryRoutes');
const shopRoutes = require('../routes/shopRoutes');
const unitRoutes = require('../routes/unitRoutes');
const productOfferingRoutes = require('../routes/productOfferingRoutes');
const marketRoutes = require('../routes/marketRoutes');
const supplierRoutes = require('../routes/supplierRoutes');
const overviewRoutes = require('../routes/overviewRoutes');
const adminRoutes=require('../routes/AdminRoutes');
const insightsRoutes = require('../routes/insightsRoutes');

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'https://famous-meringue-6f9ba4.netlify.app',
  'https://669ae7cdf45878756250f3cd--superb-taffy-d02534.netlify.app',
  'https://frontend.shoppeappnow.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
}));

app.use(express.json());
app.use(bodyParser.json());
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/inventories', inventoryRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/productOfferings', productOfferingRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/products/usage', productRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/insights', insightsRoutes);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Function to fetch data and export to Excel
async function fetchDataAndExportToExcel() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
  });

  try {
    const [tables] = await connection.execute("SHOW TABLES");
    const tableNames = tables.map(row => Object.values(row)[0]);
    const workbook = XLSX.utils.book_new();

    for (let tableName of tableNames) {
      const [rows] = await connection.execute(`SELECT * FROM ${tableName}`);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, tableName);
    }

    const filePath = path.resolve(__dirname, 'database_export.xlsx');
    XLSX.writeFile(workbook, filePath);

    sendEmail(process.env.EMAIL_RECEIVER.toString(),"Exported Database details for the day.",filePath);
    console.log('Excel file created and emailed successfully.');
  } catch (err) {
    console.error('Error exporting data:', err);
  } finally {
    await connection.end();
  }
}

// Function to send an email with the Excel attachment
function sendEmail(to, subject, attachmentPath) {
  const mailOptions = {
    from: process.env.EMAIL_USER.toString(),
    to,
    subject,
    text: 'Please find the attached Excel file with the exported database details.',
    attachments: [
      {
        filename: path.basename(attachmentPath),
        path: attachmentPath,
      },
    ],
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
}
});
}

// sendEmail(process.env.EMAIL_RECEIVER.toString(),"test","texttt testing");

// Endpoint to trigger data export and email
app.get('/api/export-data', async (req, res) => {
  try {
    await fetchDataAndExportToExcel();
    res.status(200).send('Data exported and emailed successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error exporting data.');
  }
});

// Schedule the task to run every 24 hours
cron.schedule('0 0 * * *', async () => {
  console.log('Running scheduled task to export data and send email.');
  await fetchDataAndExportToExcel();
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});