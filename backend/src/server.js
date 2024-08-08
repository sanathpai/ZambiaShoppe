const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
require('../config/passport');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('DB_HOST:', process.env.DB_HOST);  // Add this line
console.log('DB_USER:', process.env.DB_USER);  // Add this line
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);  // Add this line
console.log('DB_NAME:', process.env.DB_NAME);  // Add this line
console.log('JWT_SECRET:', process.env.JWT_SECRET);  // Add this line

const authRoutes = require('../routes/AuthRoutes');
const productRoutes = require('../routes/productRoutes');
const purchaseRoutes = require('../routes/purchaseRoutes');
const saleRoutes = require('../routes/saleRoutes');
const inventoryRoutes = require('../routes/inventoryRoutes');
const shopRoutes=require('../routes/shopRoutes');
const unitRoutes=require('../routes/unitRoutes');
const productOfferingRoutes=require('../routes/productOfferingRoutes');
const marketRoutes= require('../routes/marketRoutes');
const supplierRoutes= require('../routes/supplierRoutes');

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'https://famous-meringue-6f9ba4.netlify.app',
  'https://669ae7cdf45878756250f3cd--superb-taffy-d02534.netlify.app',
  ''
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
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
