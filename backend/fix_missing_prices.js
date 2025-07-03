const db = require('./config/db');
const CurrentPrice = require('./models/CurrentPrice');

const fixMissingPrices = async () => {
  try {
    console.log('=== FIXING MISSING CURRENTPRICE RECORDS ===');
    
    // Find all units without CurrentPrice records
    const [unitsWithoutPrices] = await db.query(`
      SELECT u.unit_id, u.product_id, u.user_id, u.unit_type, u.unit_category, p.product_name 
      FROM Units u 
      LEFT JOIN Products p ON u.product_id = p.product_id
      LEFT JOIN CurrentPrice cp ON u.unit_id = cp.unit_id AND u.product_id = cp.product_id AND u.user_id = cp.user_id
      WHERE cp.unit_id IS NULL 
      ORDER BY u.product_id, u.unit_category
    `);
    
    console.log(`Found ${unitsWithoutPrices.length} units without CurrentPrice records`);
    
    let created = 0;
    let errors = 0;
    
    for (const unit of unitsWithoutPrices) {
      try {
        console.log(`Creating price record for Unit ID ${unit.unit_id} (${unit.unit_type} - ${unit.unit_category}) of product "${unit.product_name}"`);
        
        // Create default price record with 0.00 for both prices
        const priceId = await CurrentPrice.upsert({
          product_id: unit.product_id,
          unit_id: unit.unit_id,
          user_id: unit.user_id,
          retail_price: 0.00,
          order_price: 0.00
        });
        
        console.log(`✅ Created CurrentPrice record with ID: ${priceId}`);
        created++;
        
      } catch (error) {
        console.error(`❌ Error creating price for Unit ID ${unit.unit_id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Successfully created: ${created} price records`);
    console.log(`Errors: ${errors}`);
    console.log(`Total processed: ${unitsWithoutPrices.length}`);
    
    // Verify the fix
    const [remainingUnits] = await db.query(`
      SELECT COUNT(*) as count
      FROM Units u 
      LEFT JOIN CurrentPrice cp ON u.unit_id = cp.unit_id AND u.product_id = cp.product_id AND u.user_id = cp.user_id
      WHERE cp.unit_id IS NULL 
    `);
    
    console.log(`\nRemaining units without prices: ${remainingUnits[0].count}`);
    
    await db.end();
    
  } catch (error) {
    console.error('Error during fix process:', error);
    await db.end();
  }
};

// Run the fix if this file is executed directly
if (require.main === module) {
  fixMissingPrices();
}

module.exports = fixMissingPrices; 