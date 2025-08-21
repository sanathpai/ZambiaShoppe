const db = require('./config/db');

async function fixCurrentPriceCorruption() {
  console.log('🔧 Starting CurrentPrice corruption fix...');
  
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Step 1: Identify all corrupted CurrentPrice entries
    console.log('\n📊 Step 1: Identifying corrupted CurrentPrice entries...');
    
    const [corruptedEntries] = await connection.query(`
      SELECT cp.current_price_id, cp.product_id as cp_product_id, cp.unit_id, cp.user_id,
             u.product_id as u_product_id, u.unit_type, u.unit_category,
             p1.product_name as cp_product_name, p2.product_name as u_product_name,
             cp.retail_price, cp.order_price, cp.created_at, cp.last_updated
      FROM CurrentPrice cp
      JOIN Units u ON cp.unit_id = u.unit_id
      JOIN Products p1 ON cp.product_id = p1.product_id
      JOIN Products p2 ON u.product_id = p2.product_id
      WHERE cp.product_id != u.product_id
      ORDER BY cp.unit_id, cp.created_at
    `);
    
    console.log(`❌ Found ${corruptedEntries.length} corrupted CurrentPrice entries:`);
    
    if (corruptedEntries.length === 0) {
      console.log('✅ No corruption found. Database is clean!');
      await connection.rollback();
      connection.release();
      return;
    }
    
    // Log details of corrupted entries
    corruptedEntries.forEach((entry, index) => {
      console.log(`\n${index + 1}. CurrentPrice ID: ${entry.current_price_id}`);
      console.log(`   Unit ID: ${entry.unit_id} (${entry.unit_type} ${entry.unit_category})`);
      console.log(`   ❌ CurrentPrice product: ${entry.cp_product_id} (${entry.cp_product_name})`);
      console.log(`   ✅ Unit belongs to product: ${entry.u_product_id} (${entry.u_product_name})`);
      console.log(`   User: ${entry.user_id}`);
      console.log(`   Prices: retail=${entry.retail_price}, order=${entry.order_price}`);
      console.log(`   Created: ${entry.created_at}`);
    });
    
    // Step 2: Create backup of corrupted data
    console.log('\n💾 Step 2: Creating backup of corrupted data...');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS CurrentPrice_Corruption_Backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')} AS
      SELECT cp.*, 'CORRUPTED' as backup_reason, NOW() as backup_timestamp
      FROM CurrentPrice cp
      JOIN Units u ON cp.unit_id = u.unit_id
      WHERE cp.product_id != u.product_id
    `);
    
    console.log('✅ Backup table created');
    
    // Step 3: Fix strategy - determine what to do with each corrupted entry
    console.log('\n🔧 Step 3: Applying fix strategy...');
    
    let deletedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    
    // Group corrupted entries by unit_id to handle each unit's corruption
    const unitGroups = {};
    corruptedEntries.forEach(entry => {
      if (!unitGroups[entry.unit_id]) {
        unitGroups[entry.unit_id] = [];
      }
      unitGroups[entry.unit_id].push(entry);
    });
    
    for (const [unitId, entries] of Object.entries(unitGroups)) {
      console.log(`\n🔄 Processing unit_id ${unitId} with ${entries.length} corrupted entries...`);
      
      // Get the correct product_id for this unit
      const [unitInfo] = await connection.query(
        'SELECT product_id, unit_type, unit_category FROM Units WHERE unit_id = ?',
        [unitId]
      );
      
      if (unitInfo.length === 0) {
        console.log(`⚠️ Unit ${unitId} not found in Units table, skipping...`);
        continue;
      }
      
      const correctProductId = unitInfo[0].product_id;
      const unitType = unitInfo[0].unit_type;
      const unitCategory = unitInfo[0].unit_category;
      
      console.log(`   Correct product for unit ${unitId}: ${correctProductId} (${unitType} ${unitCategory})`);
      
      // Check if there's already a correct CurrentPrice entry for this unit
      const [existingCorrect] = await connection.query(
        'SELECT * FROM CurrentPrice WHERE product_id = ? AND unit_id = ? AND user_id = ?',
        [correctProductId, unitId, entries[0].user_id]
      );
      
      if (existingCorrect.length > 0) {
        // There's already a correct entry, so delete all corrupted ones
        console.log(`   ✅ Correct CurrentPrice entry already exists, deleting ${entries.length} corrupted entries`);
        
        for (const entry of entries) {
          await connection.query(
            'DELETE FROM CurrentPrice WHERE current_price_id = ?',
            [entry.current_price_id]
          );
          deletedCount++;
        }
      } else {
        // No correct entry exists, keep the most recent corrupted entry but fix its product_id
        entries.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
        const entryToKeep = entries[0];
        const entriesToDelete = entries.slice(1);
        
        console.log(`   🔧 Updating most recent entry (ID: ${entryToKeep.current_price_id}) to correct product_id`);
        console.log(`   🗑️ Deleting ${entriesToDelete.length} older corrupted entries`);
        
        // Update the most recent entry to have the correct product_id
        await connection.query(
          'UPDATE CurrentPrice SET product_id = ? WHERE current_price_id = ?',
          [correctProductId, entryToKeep.current_price_id]
        );
        updatedCount++;
        
        // Delete the older corrupted entries
        for (const entry of entriesToDelete) {
          await connection.query(
            'DELETE FROM CurrentPrice WHERE current_price_id = ?',
            [entry.current_price_id]
          );
          deletedCount++;
        }
      }
    }
    
    // Step 4: Add database constraint to prevent future corruption
    console.log('\n🛡️ Step 4: Adding database constraint to prevent future corruption...');
    
    try {
      // First, check if constraint already exists
      const [existingConstraints] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_NAME = 'CurrentPrice' 
        AND CONSTRAINT_TYPE = 'CHECK'
        AND CONSTRAINT_NAME = 'chk_currentprice_unit_product_match'
      `);
      
      if (existingConstraints.length === 0) {
        // Add check constraint using a foreign key approach
        await connection.query(`
          ALTER TABLE CurrentPrice 
          ADD CONSTRAINT chk_currentprice_unit_product_match 
          FOREIGN KEY (product_id, unit_id) 
          REFERENCES Units (product_id, unit_id)
        `);
        console.log('✅ Database constraint added successfully');
      } else {
        console.log('✅ Database constraint already exists');
      }
    } catch (constraintError) {
      console.log('⚠️ Could not add foreign key constraint (Units table may need composite index)');
      console.log('Creating composite index on Units table...');
      
      try {
        await connection.query(`
          ALTER TABLE Units 
          ADD INDEX idx_product_unit (product_id, unit_id)
        `);
        
        await connection.query(`
          ALTER TABLE CurrentPrice 
          ADD CONSTRAINT chk_currentprice_unit_product_match 
          FOREIGN KEY (product_id, unit_id) 
          REFERENCES Units (product_id, unit_id)
        `);
        console.log('✅ Index created and constraint added successfully');
      } catch (indexError) {
        console.log('⚠️ Warning: Could not add database constraint:', indexError.message);
        console.log('Manual validation will be required in application code');
      }
    }
    
    // Step 5: Verify fix
    console.log('\n✅ Step 5: Verifying fix...');
    
    const [remainingCorruption] = await connection.query(`
      SELECT COUNT(*) as count
      FROM CurrentPrice cp
      JOIN Units u ON cp.unit_id = u.unit_id
      WHERE cp.product_id != u.product_id
    `);
    
    if (remainingCorruption[0].count === 0) {
      console.log('🎉 SUCCESS: All CurrentPrice corruption has been fixed!');
    } else {
      console.log(`❌ WARNING: ${remainingCorruption[0].count} corrupted entries still remain`);
    }
    
    // Commit the transaction
    await connection.commit();
    
    console.log('\n📊 SUMMARY:');
    console.log(`   Updated entries: ${updatedCount}`);
    console.log(`   Deleted entries: ${deletedCount}`);
    console.log(`   Total corrupted entries processed: ${corruptedEntries.length}`);
    console.log(`   Remaining corruption: ${remainingCorruption[0].count}`);
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Run the fix
if (require.main === module) {
  fixCurrentPriceCorruption()
    .then(() => {
      console.log('\n🎉 CurrentPrice corruption fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixCurrentPriceCorruption };
