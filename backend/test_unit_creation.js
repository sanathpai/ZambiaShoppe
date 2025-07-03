require('dotenv').config();
const axios = require('axios');
const db = require('./config/db');

const testUnitCreation = async () => {
  try {
    console.log('=== TESTING UNIT CREATION WITH PRICES ===');
    
    // First, let's get a valid user token and product ID
    console.log('1. Getting valid product ID...');
    const [products] = await db.query('SELECT product_id, product_name, variety FROM Products WHERE user_id = 225 LIMIT 1');
    
    if (products.length === 0) {
      console.error('❌ No products found for user 225');
      return;
    }
    
    const testProduct = products[0];
    console.log('Using product:', testProduct);
    
    // Check if units already exist for this product
    const [existingUnits] = await db.query('SELECT * FROM Units WHERE product_id = ? AND user_id = 225', [testProduct.product_id]);
    console.log(`Found ${existingUnits.length} existing units for this product`);
    
    // Simulate the frontend request data
    const requestData = existingUnits.length === 0 ? {
      // First-time unit creation (buying + selling)
      product_id: testProduct.product_id,
      buying_unit_type: 'test_kg',
      selling_unit_type: 'test_pieces',
      conversion_rate: '2.5',
      prepackaged: false,
      prepackaged_b: false,
      retail_price: '15.75',  // This should create CurrentPrice for selling unit
      order_price: '10.50'    // This should create CurrentPrice for buying unit
    } : {
      // Subsequent unit creation
      product_id: testProduct.product_id,
      newUnitType: 'test_grams',
      selectedExistingUnit: existingUnits[0].unit_id,
      conversion_rate: '1000',
      prepackaged: false,
      unitCategory: 'buying',
      retail_price: '0',      // Not used for buying units
      order_price: '8.25'     // This should create CurrentPrice for new buying unit
    };
    
    console.log('2. Request data to be sent:', JSON.stringify(requestData, null, 2));
    
    // Make the request to the units endpoint
    console.log('3. Making request to /units endpoint...');
    
    const response = await axios.post('http://localhost:8000/api/units', requestData, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjI1LCJlbWFpbCI6InNvaGFAZ21haWwuY29tIiwiaWF0IjoxNzM1Nzg0MjY5LCJleHAiOjE3MzU4NzA2Njl9.OiJIUzI1NiIs',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('4. Response:', response.status, response.data);
    
    // Wait a moment for transaction to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check CurrentPrice table
    console.log('5. Checking CurrentPrice table...');
    const [prices] = await db.query('SELECT * FROM CurrentPrice ORDER BY created_at DESC LIMIT 3');
    
    if (prices.length === 0) {
      console.log('❌ No records found in CurrentPrice table after unit creation');
    } else {
      console.log('✅ Found CurrentPrice records:');
      console.table(prices);
    }
    
    // Check the units that were just created
    console.log('6. Checking newly created units...');
    const [newUnits] = await db.query(`
      SELECT u.*, p.product_name 
      FROM Units u 
      LEFT JOIN Products p ON u.product_id = p.product_id 
      WHERE u.product_id = ? AND u.user_id = 225 
      ORDER BY u.unit_id DESC LIMIT 3
    `, [testProduct.product_id]);
    
    console.table(newUnits);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  } finally {
    process.exit(0);
  }
};

testUnitCreation(); 