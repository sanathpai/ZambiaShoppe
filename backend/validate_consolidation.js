const db = require('./config/db');

const validateConsolidation = async () => {
  console.log('🔍 VALIDATING CONSOLIDATION RESULTS...\n');
  
  try {
    // 1. Check for remaining duplicates
    console.log('1. 📦 CHECKING FOR REMAINING DUPLICATES:');
    const [duplicates] = await db.query(`
      SELECT 
        product_name, variety, brand, size, user_id, COUNT(*) as count
      FROM Products 
      GROUP BY 
        LOWER(TRIM(product_name)), 
        LOWER(TRIM(COALESCE(variety, ''))), 
        LOWER(TRIM(COALESCE(brand, ''))), 
        LOWER(TRIM(COALESCE(size, ''))), 
        user_id
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length === 0) {
      console.log('   ✅ NO DUPLICATES FOUND - Consolidation successful!');
    } else {
      console.log(`   ❌ ${duplicates.length} duplicate groups still exist:`);
      duplicates.forEach(dup => {
        console.log(`   - "${dup.product_name}" (${dup.count} duplicates)`);
      });
    }

    // 2. Check total product count
    console.log('\n2. 📊 PRODUCT COUNT SUMMARY:');
    const [productCount] = await db.query('SELECT COUNT(*) as total FROM Products');
    console.log(`   📦 Total products remaining: ${productCount[0].total}`);

    // 3. Check transaction data integrity
    console.log('\n3. 🔄 TRANSACTION DATA INTEGRITY:');
    
    const [salesCount] = await db.query('SELECT COUNT(*) as total FROM Sales');
    const [purchasesCount] = await db.query('SELECT COUNT(*) as total FROM Purchases');
    const [unitsCount] = await db.query('SELECT COUNT(*) as total FROM Units');
    const [pricesCount] = await db.query('SELECT COUNT(*) as total FROM CurrentPrice');
    
    console.log(`   💵 Total Sales records: ${salesCount[0].total}`);
    console.log(`   🛒 Total Purchase records: ${purchasesCount[0].total}`);
    console.log(`   📏 Total Units records: ${unitsCount[0].total}`);
    console.log(`   💰 Total Price records: ${pricesCount[0].total}`);

    // 4. Check for orphaned data (transactions pointing to non-existent products)
    console.log('\n4. 🔗 CHECKING FOR ORPHANED DATA:');
    
    const [orphanedSales] = await db.query(`
      SELECT COUNT(*) as count 
      FROM Sales s 
      LEFT JOIN Products p ON s.product_id = p.product_id 
      WHERE p.product_id IS NULL
    `);
    
    const [orphanedPurchases] = await db.query(`
      SELECT COUNT(*) as count 
      FROM Purchases pu 
      LEFT JOIN Products p ON pu.product_id = p.product_id 
      WHERE p.product_id IS NULL
    `);
    
    const [orphanedUnits] = await db.query(`
      SELECT COUNT(*) as count 
      FROM Units u 
      LEFT JOIN Products p ON u.product_id = p.product_id 
      WHERE p.product_id IS NULL
    `);

    if (orphanedSales[0].count === 0 && orphanedPurchases[0].count === 0 && orphanedUnits[0].count === 0) {
      console.log('   ✅ NO ORPHANED DATA - All transactions properly linked!');
    } else {
      console.log('   ❌ Found orphaned data:');
      if (orphanedSales[0].count > 0) console.log(`   - ${orphanedSales[0].count} orphaned sales`);
      if (orphanedPurchases[0].count > 0) console.log(`   - ${orphanedPurchases[0].count} orphaned purchases`);
      if (orphanedUnits[0].count > 0) console.log(`   - ${orphanedUnits[0].count} orphaned units`);
    }

    // 5. Check specific products that were consolidated
    console.log('\n5. 🎯 CHECKING SPECIFIC CONSOLIDATED PRODUCTS:');
    
    // Check the "Soft drink" consolidation (should be Product ID 1217)
    const [softDrinkCheck] = await db.query(`
      SELECT p.product_id, p.product_name, p.variety, p.brand, p.size,
             COUNT(DISTINCT s.sale_id) as sales_count,
             COUNT(DISTINCT pu.purchase_id) as purchases_count,
             COUNT(DISTINCT u.unit_id) as units_count
      FROM Products p
      LEFT JOIN Sales s ON p.product_id = s.product_id
      LEFT JOIN Purchases pu ON p.product_id = pu.product_id  
      LEFT JOIN Units u ON p.product_id = u.product_id
      WHERE p.product_name LIKE '%Soft drink%' 
        AND p.variety LIKE '%Lemon lime%' 
        AND p.brand LIKE '%Shaka%'
        AND p.size LIKE '%350ml%'
      GROUP BY p.product_id
    `);
    
    if (softDrinkCheck.length === 1) {
      const product = softDrinkCheck[0];
      console.log(`   ✅ "Soft drink" consolidated successfully:`);
      console.log(`      📦 Product ID: ${product.product_id}`);
      console.log(`      💵 Sales: ${product.sales_count}`);
      console.log(`      🛒 Purchases: ${product.purchases_count}`);
      console.log(`      📏 Units: ${product.units_count}`);
    } else if (softDrinkCheck.length === 0) {
      console.log(`   ❌ "Soft drink" product not found!`);
    } else {
      console.log(`   ❌ Multiple "Soft drink" products still exist: ${softDrinkCheck.length}`);
    }

    // 6. Check inventory integrity
    console.log('\n6. 📦 INVENTORY INTEGRITY:');
    const [inventoryCount] = await db.query('SELECT COUNT(*) as total FROM Inventories');
    const [inventoryOrphans] = await db.query(`
      SELECT COUNT(*) as count 
      FROM Inventories i 
      LEFT JOIN Products p ON i.product_id = p.product_id 
      WHERE p.product_id IS NULL
    `);
    
    console.log(`   📦 Total inventory records: ${inventoryCount[0].total}`);
    if (inventoryOrphans[0].count === 0) {
      console.log('   ✅ All inventory records properly linked!');
    } else {
      console.log(`   ❌ ${inventoryOrphans[0].count} orphaned inventory records found!`);
    }

    // 7. Summary
    console.log('\n🎉 VALIDATION SUMMARY:');
    const allGood = duplicates.length === 0 && 
                   orphanedSales[0].count === 0 && 
                   orphanedPurchases[0].count === 0 && 
                   orphanedUnits[0].count === 0 &&
                   inventoryOrphans[0].count === 0 &&
                   softDrinkCheck.length === 1;
    
    if (allGood) {
      console.log('✅ CONSOLIDATION FULLY SUCCESSFUL!');
      console.log('✅ All duplicates removed');
      console.log('✅ All data properly preserved');
      console.log('✅ No orphaned records');
      console.log('✅ Database integrity maintained');
    } else {
      console.log('⚠️  Some issues detected - review above details');
    }

  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
};

// Quick duplicate check function
const quickDuplicateCheck = async () => {
  console.log('🔍 QUICK DUPLICATE CHECK...\n');
  
  const [duplicates] = await db.query(`
    SELECT 
      product_name, variety, brand, size, user_id, 
      COUNT(*) as count,
      GROUP_CONCAT(product_id) as product_ids
    FROM Products 
    GROUP BY 
      LOWER(TRIM(product_name)), 
      LOWER(TRIM(COALESCE(variety, ''))), 
      LOWER(TRIM(COALESCE(brand, ''))), 
      LOWER(TRIM(COALESCE(size, ''))), 
      user_id
    HAVING COUNT(*) > 1
  `);
  
  if (duplicates.length === 0) {
    console.log('✅ NO DUPLICATES FOUND - Database is clean!');
  } else {
    console.log(`❌ ${duplicates.length} duplicate groups found:`);
    duplicates.forEach(dup => {
      console.log(`📦 "${dup.product_name}" - ${dup.count} duplicates (IDs: ${dup.product_ids})`);
    });
  }
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick')) {
    await quickDuplicateCheck();
  } else {
    await validateConsolidation();
  }
  
  process.exit(0);
};

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { validateConsolidation, quickDuplicateCheck }; 