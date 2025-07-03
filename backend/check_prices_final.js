require('dotenv').config();
const db = require('./config/db');

const checkPrices = async () => {
  try {
    const [prices] = await db.query('SELECT * FROM CurrentPrice ORDER BY created_at DESC LIMIT 5');
    
    console.log('=== CURRENTPRICE TABLE STATUS ===');
    if (prices.length === 0) {
      console.log('❌ No records found in CurrentPrice table');
    } else {
      console.log(`✅ Found ${prices.length} records:`);
      console.table(prices);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
};

checkPrices(); 