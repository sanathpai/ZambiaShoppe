const db = require('./config/db');

const findAndFixOrphanedData = async () => {
  console.log('🔍 FINDING AND FIXING ORPHANED DATA...\n');
  
  try {
    // 1. Find the orphaned unit record
    console.log('1. 🔍 FINDING ORPHANED UNIT:');
    const [orphanedUnits] = await db.query(`
      SELECT u.*, p.product_id as existing_product
      FROM Units u 
      LEFT JOIN Products p ON u.product_id = p.product_id 
      WHERE p.product_id IS NULL
    `);
    
    if (orphanedUnits.length === 0) {
      console.log('   ✅ No orphaned units found!');
      return;
    }
    
    console.log(`   📦 Found ${orphanedUnits.length} orphaned unit(s):`);
    orphanedUnits.forEach(unit => {
      console.log(`   - Unit ID: ${unit.unit_id}, Product ID: ${unit.product_id}, Unit Type: ${unit.unit_type}, Category: ${unit.unit_category}`);
    });

    // 2. Try to find a matching product for each orphaned unit
    console.log('\n2. 🔍 LOOKING FOR MATCHING PRODUCTS:');
    
    for (const orphanedUnit of orphanedUnits) {
      console.log(`\n   🔍 Analyzing Unit ID ${orphanedUnit.unit_id} (Product ID: ${orphanedUnit.product_id})`);
      
      // Try to find products with similar names/data that might be the correct match
      const [similarProducts] = await db.query(`
        SELECT product_id, product_name, variety, brand, size 
        FROM Products 
        WHERE user_id = ?
        ORDER BY product_id DESC
        LIMIT 10
      `, [orphanedUnit.user_id]);
      
      if (similarProducts.length > 0) {
        console.log(`   📦 Recent products for user ${orphanedUnit.user_id}:`);
        similarProducts.forEach(product => {
          console.log(`      - ID: ${product.product_id}, Name: "${product.product_name}", Brand: "${product.brand}"`);
        });
        
        // Check if there's a product with a similar ID (maybe the next one up)
        const possibleMatch = similarProducts.find(p => p.product_id > orphanedUnit.product_id);
        if (possibleMatch) {
          console.log(`   💡 POSSIBLE MATCH: Product ID ${possibleMatch.product_id} ("${possibleMatch.product_name}")`);
        }
      }
    }

    // 3. Provide options for fixing
    console.log('\n3. 🛠️  FIXING OPTIONS:');
    console.log('   Option 1: Delete the orphaned unit record (safest)');
    console.log('   Option 2: Try to reassign to a matching product (manual review needed)');
    
    // For now, let's provide the safe option - delete the orphaned record
    console.log('\n4. 🛠️  APPLYING SAFE FIX (DELETE ORPHANED UNIT):');
    
    for (const orphanedUnit of orphanedUnits) {
      console.log(`   🗑️  Deleting orphaned Unit ID ${orphanedUnit.unit_id} (Product ID: ${orphanedUnit.product_id})`);
      
      await db.query('DELETE FROM Units WHERE unit_id = ?', [orphanedUnit.unit_id]);
      console.log(`   ✅ Orphaned unit ${orphanedUnit.unit_id} deleted successfully`);
    }

    console.log('\n🎉 ORPHANED DATA CLEANUP COMPLETED!');
    console.log('✅ All orphaned units removed');
    console.log('✅ Database integrity restored');

  } catch (error) {
    console.error('❌ Error during orphaned data cleanup:', error);
  }
};

// Preview mode - just show what would be done
const previewOrphanedData = async () => {
  console.log('🔍 PREVIEWING ORPHANED DATA...\n');
  
  try {
    const [orphanedUnits] = await db.query(`
      SELECT u.unit_id, u.product_id, u.unit_type, u.unit_category, u.user_id
      FROM Units u 
      LEFT JOIN Products p ON u.product_id = p.product_id 
      WHERE p.product_id IS NULL
    `);
    
    if (orphanedUnits.length === 0) {
      console.log('✅ No orphaned units found!');
      return;
    }
    
    console.log(`❌ Found ${orphanedUnits.length} orphaned unit record(s):`);
    orphanedUnits.forEach(unit => {
      console.log(`📦 Unit ID: ${unit.unit_id}`);
      console.log(`   Product ID: ${unit.product_id} (MISSING)`);
      console.log(`   Unit Type: ${unit.unit_type}`);
      console.log(`   Unit Category: ${unit.unit_category}`);
      console.log(`   User ID: ${unit.user_id}`);
      console.log(`   Action: Would DELETE this orphaned record\n`);
    });

  } catch (error) {
    console.error('❌ Error during preview:', error);
  }
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--preview')) {
    await previewOrphanedData();
  } else if (args.includes('--fix')) {
    await findAndFixOrphanedData();
  } else {
    console.log('🛠️  ORPHANED DATA FIXER');
    console.log('Usage:');
    console.log('  node fix_orphaned_data.js --preview  (see what would be fixed)');
    console.log('  node fix_orphaned_data.js --fix      (actually fix the issues)');
  }
  
  process.exit(0);
};

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { findAndFixOrphanedData, previewOrphanedData };