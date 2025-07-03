require('dotenv').config();
const db = require('./config/db');
const unitController = require('./controllers/unitController');

const testFirstTimeUnits = async () => {
  try {
    console.log('=== TESTING FIRST-TIME UNIT CREATION ===');
    
    // Find a product with no units
    console.log('1. Finding a product with no units...');
    const [products] = await db.query(`
      SELECT p.product_id, p.product_name, p.variety 
      FROM Products p 
      LEFT JOIN Units u ON p.product_id = u.product_id 
      WHERE p.user_id = 225 AND u.unit_id IS NULL 
      LIMIT 1
    `);
    
    let testProduct;
    if (products.length === 0) {
      // Create a test product if none exists without units
      console.log('Creating a test product...');
      const [insertResult] = await db.query(`
        INSERT INTO Products (product_name, variety, user_id) 
        VALUES ('test_product', 'test_variety', 225)
      `);
      testProduct = {
        product_id: insertResult.insertId,
        product_name: 'test_product',
        variety: 'test_variety'
      };
    } else {
      testProduct = products[0];
    }
    
    console.log('Using product:', testProduct);
    
    // Create mock request for first-time unit creation
    const mockReq = {
      user: { id: 225 },
      body: {
        product_id: testProduct.product_id,
        buying_unit_type: 'test_kg',
        selling_unit_type: 'test_pieces',
        conversion_rate: '2.5',
        prepackaged: false,
        prepackaged_b: false,
        retail_price: '15.75',  // Should create CurrentPrice for selling unit
        order_price: '10.50'    // Should create CurrentPrice for buying unit
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
    
    // Count CurrentPrice records before
    const [pricesBefore] = await db.query('SELECT COUNT(*) as count FROM CurrentPrice');
    console.log(`3. CurrentPrice records before: ${pricesBefore[0].count}`);
    
    // Call the controller
    console.log('4. Creating first-time units...');
    await unitController.addUnit(mockReq, mockRes);
    
    // Check results
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const [pricesAfter] = await db.query('SELECT * FROM CurrentPrice WHERE product_id = ? ORDER BY created_at DESC', [testProduct.product_id]);
    
    console.log('5. CurrentPrice records created:');
    if (pricesAfter.length === 0) {
      console.log('❌ No CurrentPrice records created');
    } else {
      console.log(`✅ Found ${pricesAfter.length} CurrentPrice records:`);
      console.table(pricesAfter);
    }
    
    // Check units created
    const [newUnits] = await db.query(`
      SELECT u.unit_id, u.unit_type, u.unit_category 
      FROM Units u 
      WHERE u.product_id = ? 
      ORDER BY u.unit_id DESC
    `, [testProduct.product_id]);
    
    console.log('6. Units created:');
    console.table(newUnits);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    process.exit(0);
  }
};

testFirstTimeUnits(); 