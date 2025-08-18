require('dotenv').config();
const db = require('./config/db');

async function testFormatOutput() {
  console.log('🧪 Testing Output Format');
  console.log('='.repeat(40));
  
  try {
    // Get some sample products from database to test formatting
    const [sampleProducts] = await db.query(`
      SELECT product_id, product_name, brand, variety, size
      FROM Products 
      WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
      ORDER BY RAND()
      LIMIT 5
    `);
    
    console.log('📋 Sample products formatted as requested by professor:');
    console.log('-'.repeat(40));
    
    sampleProducts.forEach((product, index) => {
      let formatted = product.product_name;
      
      // Add brand if available
      if (product.brand) {
        formatted += ` (${product.brand})`;
      }
      
      // Add variety and size if available
      const details = [];
      if (product.variety) details.push(product.variety);
      if (product.size) details.push(product.size);
      
      if (details.length > 0) {
        formatted += ` - ${details.join(', ')}`;
      }
      
      console.log(`${index + 1}. ${formatted}`);
      console.log(`   Product ID: ${product.product_id}`);
    });
    
    console.log('\n✅ Format test completed successfully!');
    console.log('📝 Format: "Product (Brand) - Variety, Size"');
    
  } catch (error) {
    console.error('❌ Format test failed:', error);
  } finally {
    process.exit(0);
  }
}

testFormatOutput(); 