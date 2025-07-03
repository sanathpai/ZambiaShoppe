require('dotenv').config();
const db = require('./config/db');
const unitController = require('./controllers/unitController');

const testUnitCreationDirect = async () => {
  try {
    console.log('=== TESTING UNIT CREATION DIRECTLY ===');
    
    // Get a valid product ID
    console.log('1. Getting valid product ID...');
    const [products] = await db.query('SELECT product_id, product_name, variety FROM Products WHERE user_id = 225 LIMIT 1');
    
    if (products.length === 0) {
      console.error('❌ No products found for user 225');
      return;
    }
    
    const testProduct = products[0];
    console.log('Using product:', testProduct);
    
    // Check existing units
    const [existingUnits] = await db.query('SELECT * FROM Units WHERE product_id = ? AND user_id = 225', [testProduct.product_id]);
    console.log(`Found ${existingUnits.length} existing units for this product`);
    
    // Create mock request and response objects
    const mockReq = {
      user: { id: 225 },
      body: existingUnits.length === 0 ? {
        // First-time unit creation
        product_id: testProduct.product_id,
        buying_unit_type: 'test_kg',
        selling_unit_type: 'test_pieces',
        conversion_rate: '2.5',
        prepackaged: false,
        prepackaged_b: false,
        retail_price: '15.75',
        order_price: '10.50'
      } : {
        // Subsequent unit creation
        product_id: testProduct.product_id,
        newUnitType: 'test_grams',
        selectedExistingUnit: existingUnits[0].unit_id,
        conversion_rate: '1000',
        prepackaged: false,
        unitCategory: 'buying',
        retail_price: '',
        order_price: '8.25'
      }
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response ${code}:`, data);
          return data;
        }
      })
    };
    
    console.log('2. Request body:', JSON.stringify(mockReq.body, null, 2));
    
    // Check CurrentPrice before
    console.log('3. CurrentPrice table BEFORE unit creation:');
    const [pricesBefore] = await db.query('SELECT COUNT(*) as count FROM CurrentPrice');
    console.log(`Records in CurrentPrice: ${pricesBefore[0].count}`);
    
    // Call the controller directly
    console.log('4. Calling unitController.addUnit directly...');
    await unitController.addUnit(mockReq, mockRes);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check CurrentPrice after
    console.log('5. CurrentPrice table AFTER unit creation:');
    const [pricesAfter] = await db.query('SELECT * FROM CurrentPrice ORDER BY created_at DESC LIMIT 5');
    
    if (pricesAfter.length === 0) {
      console.log('❌ No records found in CurrentPrice table');
    } else {
      console.log('✅ Found CurrentPrice records:');
      console.table(pricesAfter);
    }
    
    // Check the newest units
    console.log('6. Checking newest units...');
    const [newUnits] = await db.query(`
      SELECT u.unit_id, u.product_id, u.unit_type, u.unit_category, p.product_name 
      FROM Units u 
      LEFT JOIN Products p ON u.product_id = p.product_id 
      WHERE u.product_id = ? AND u.user_id = 225 
      ORDER BY u.unit_id DESC LIMIT 3
    `, [testProduct.product_id]);
    
    console.table(newUnits);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    process.exit(0);
  }
};

testUnitCreationDirect(); 