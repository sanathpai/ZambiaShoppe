// src/app.js
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());

// Increase payload size limit to handle large base64-encoded images (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Trim whitespace from all string fields automatically
const trimFields = require('../middleware/trimFields');
app.use(trimFields);

// Routes
const authRoutes = require('../routes/AuthRoutes');
const productRoutes = require('../routes/ProductRoutes');
const purchaseRoutes = require('../routes/purchaseRoutes');
const saleRoutes = require('../routes/saleRoutes');
const inventoryRoutes = require('../routes/inventoryRoutes');
const shopRoutes = require('../routes/shopRoutes');
const unitRoutes = require('../routes/unitRoutes');
const productOfferingRoutes= require('../routes/productOfferingRoutes');
const marketRoutes= require('../routes/marketRoutes');
const supplierRoutes= require('../routes/supplierRoutes');
const overviewRoutes=require('../routes/overviewRoutes');
const clipRoutes=require('../routes/clipRoutes');

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
app.use('api/products/usage', productRoutes);
app.use('/api/overview',overviewRoutes);
app.use('/api/clip', clipRoutes);
// Test log to ensure routes are being set up
console.log('Routes are set up');

module.exports = app;