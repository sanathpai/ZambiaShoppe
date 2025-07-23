const db = require('./config/db');

const consolidateDuplicateProducts = async () => {
  console.log('🚀 Starting duplicate product consolidation...');
  console.log('📋 Strategy: Move ALL transactions to product with MOST CURRENT INVENTORY');
  console.log('📋 "Most Current" = Highest inventory_id (most recently created inventory record)');
  console.log('📦 Inventory: Keep ONLY the most recent inventory amount (discard old amounts)');
  console.log('✅ Preserving ALL existing data - no deletions of transactions\n');
  
  let connection = null;
  
  try {
    // Get database connection for main transaction
    connection = await db.getConnection();
    
    // Step 1: Find all duplicate products (same name, variety, brand, size, user_id)
    const [duplicateGroups] = await connection.query(`
      SELECT 
        product_name, 
        COALESCE(variety, '') as variety, 
        COALESCE(brand, '') as brand, 
        COALESCE(size, '') as size, 
        user_id,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(product_id ORDER BY product_id) as product_ids
      FROM Products 
      GROUP BY 
        LOWER(TRIM(product_name)), 
        LOWER(TRIM(COALESCE(variety, ''))), 
        LOWER(TRIM(COALESCE(brand, ''))), 
        LOWER(TRIM(COALESCE(size, ''))), 
        user_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate products found! Database is clean.');
      return;
    }

    console.log(`📊 Found ${duplicateGroups.length} groups of duplicate products\n`);

    let totalConsolidated = 0;
    let totalProductsRemoved = 0;
    let totalTransactionsMoved = 0;

    // Step 2: Process each group of duplicates
    for (const group of duplicateGroups) {
      console.log(`\n🔄 Processing duplicate group: "${group.product_name}"`);
      console.log(`   📝 Details: variety="${group.variety}", brand="${group.brand}", size="${group.size}"`);
      console.log(`   👥 User ID: ${group.user_id}`);
      console.log(`   🔢 Duplicates: ${group.duplicate_count}`);
      
      const productIds = group.product_ids.split(',').map(id => parseInt(id));
      console.log(`   🆔 Product IDs: [${productIds.join(', ')}]`);

      // Step 3: Find which product to keep - THE ONE WITH MOST CURRENT INVENTORY (most recently created)
      const [inventoryData] = await connection.query(`
        SELECT 
          p.product_id,
          p.product_name,
          p.variety,
          p.brand,
          p.size,
          COALESCE(i.current_stock, 0) as current_stock,
          i.inventory_id
        FROM Products p
        LEFT JOIN Inventories i ON p.product_id = i.product_id
        WHERE p.product_id IN (${productIds.map(() => '?').join(',')})
        ORDER BY 
          i.inventory_id DESC,
          COALESCE(i.current_stock, 0) DESC,
          p.product_id ASC
      `, productIds);

      if (inventoryData.length === 0) {
        console.log('   ⚠️ No products found for this group, skipping...');
        continue;
      }

      const keepProduct = inventoryData[0];
      const duplicateProducts = inventoryData.slice(1);

      console.log(`   ✅ KEEPING: Product ID ${keepProduct.product_id}`);
      console.log(`      📦 Current Stock: ${keepProduct.current_stock}`);
      console.log(`      🆔 Inventory ID: ${keepProduct.inventory_id || 'None'} (most recent)`);
      console.log(`   🔄 CONSOLIDATING: ${duplicateProducts.length} duplicate(s): [${duplicateProducts.map(p => p.product_id).join(', ')}]`);

      // Step 4: For each duplicate product, move ALL related data to the main product
      for (const duplicate of duplicateProducts) {
        console.log(`\n   📦 Moving all data from Product ID ${duplicate.product_id} → ${keepProduct.product_id}`);
        
        try {
          await connection.beginTransaction();

          let transactionCount = 0;

          // 4a. Move Units (preserving all unit data)
          const [unitsResult] = await connection.query(`
            UPDATE Units 
            SET product_id = ? 
            WHERE product_id = ? AND user_id = ?
          `, [keepProduct.product_id, duplicate.product_id, group.user_id]);
          console.log(`      📏 Units moved: ${unitsResult.affectedRows}`);
          transactionCount += unitsResult.affectedRows;

          // 4b. Move Unit_Conversion records (preserving conversion rates)
          const [conversionResult] = await connection.query(`
            UPDATE Unit_Conversion 
            SET product_id = ? 
            WHERE product_id = ?
          `, [keepProduct.product_id, duplicate.product_id]);
          console.log(`      🔄 Unit conversions moved: ${conversionResult.affectedRows}`);
          transactionCount += conversionResult.affectedRows;

          // 4c. Move CurrentPrice records (preserving price history)
          const [priceResult] = await connection.query(`
            UPDATE CurrentPrice 
            SET product_id = ? 
            WHERE product_id = ? AND user_id = ?
          `, [keepProduct.product_id, duplicate.product_id, group.user_id]);
          console.log(`      💰 Price records moved: ${priceResult.affectedRows}`);
          transactionCount += priceResult.affectedRows;

          // 4d. Move ALL Purchases (preserving transaction history)
          const [purchaseResult] = await connection.query(`
            UPDATE Purchases 
            SET product_id = ? 
            WHERE product_id = ? AND user_id = ?
          `, [keepProduct.product_id, duplicate.product_id, group.user_id]);
          console.log(`      🛒 Purchases moved: ${purchaseResult.affectedRows}`);
          transactionCount += purchaseResult.affectedRows;

          // 4e. Move ALL Sales (preserving transaction history)
          const [salesResult] = await connection.query(`
            UPDATE Sales 
            SET product_id = ? 
            WHERE product_id = ? AND user_id = ?
          `, [keepProduct.product_id, duplicate.product_id, group.user_id]);
          console.log(`      💵 Sales moved: ${salesResult.affectedRows}`);
          transactionCount += salesResult.affectedRows;

          // 4f. Handle Inventories - Keep only the most recent inventory, discard others
          const [duplicateInventory] = await connection.query(`
            SELECT inventory_id, current_stock, stock_limit 
            FROM Inventories 
            WHERE product_id = ? AND user_id = ?
          `, [duplicate.product_id, group.user_id]);

          if (duplicateInventory.length > 0) {
            const [keepInventory] = await connection.query(`
              SELECT inventory_id, current_stock, stock_limit 
              FROM Inventories 
              WHERE product_id = ? AND user_id = ?
            `, [keepProduct.product_id, group.user_id]);

            if (keepInventory.length > 0) {
              // Both have inventory - KEEP only the most recent (from keepProduct), DELETE the duplicate
              console.log(`      📦 Keeping RECENT inventory: Product ${keepProduct.product_id} stock=${keepInventory[0].current_stock}`);
              console.log(`      🗑️ Discarding OLD inventory: Product ${duplicate.product_id} stock=${duplicateInventory[0].current_stock}`);
              
              // Delete duplicate inventory record (we keep the recent one as-is)
              await connection.query(`DELETE FROM Inventories WHERE inventory_id = ?`, [duplicateInventory[0].inventory_id]);
            } else {
              // Only duplicate has inventory - move it entirely to keep product
              await connection.query(`
                UPDATE Inventories 
                SET product_id = ? 
                WHERE product_id = ? AND user_id = ?
              `, [keepProduct.product_id, duplicate.product_id, group.user_id]);
              console.log(`      📦 Inventory MOVED: ${duplicateInventory[0].current_stock} stock → Product ${keepProduct.product_id}`);
            }
          }

          // 4g. Move any ProductOfferings (if table exists)
          try {
            const [offeringResult] = await connection.query(`
              UPDATE ProductOffering 
              SET product_id = ? 
              WHERE product_id = ? AND user_id = ?
            `, [keepProduct.product_id, duplicate.product_id, group.user_id]);
            console.log(`      🏪 Product offerings moved: ${offeringResult.affectedRows}`);
            transactionCount += offeringResult.affectedRows;
          } catch (offeringError) {
            if (offeringError.code === 'ER_NO_SUCH_TABLE') {
              console.log(`      🏪 Product offerings table doesn't exist - skipping`);
            } else {
              throw offeringError;
            }
          }

          // 4h. Finally, delete ONLY the empty duplicate product record (transactions are preserved)
          const [deleteResult] = await connection.query(`
            DELETE FROM Products 
            WHERE product_id = ? AND user_id = ?
          `, [duplicate.product_id, group.user_id]);
          
          if (deleteResult.affectedRows > 0) {
            console.log(`      ✅ Empty duplicate product record ${duplicate.product_id} removed`);
            console.log(`      📊 Total data moved: ${transactionCount} records`);
            totalProductsRemoved++;
            totalTransactionsMoved += transactionCount;
          }

          await connection.commit();
          
        } catch (error) {
          await connection.rollback();
          console.error(`      ❌ Error consolidating product ${duplicate.product_id}:`, error.message);
          throw error;
        }
      }

      totalConsolidated++;
      console.log(`   ✅ Group consolidation COMPLETED - All transactions preserved!`);
    }

    console.log(`\n🎉 CONSOLIDATION SUMMARY:`);
    console.log(`✅ Product groups processed: ${totalConsolidated}`);
    console.log(`✅ Empty duplicate records removed: ${totalProductsRemoved}`);
    console.log(`✅ Total transactions/data moved: ${totalTransactionsMoved}`);
    console.log(`✅ ALL transaction history PRESERVED`);
    console.log(`✅ Consolidated under products with MOST CURRENT INVENTORY`);
    console.log(`✅ Kept ONLY most recent inventory amounts (old amounts discarded)`);
    console.log(`✅ Database integrity maintained`);

  } catch (error) {
    console.error('❌ Error during consolidation:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Preview function to show what would be consolidated (dry run)
const previewConsolidation = async () => {
  console.log('🔍 PREVIEW: Finding duplicate products that would be consolidated...\n');
  
  let connection = null;
  
  try {
    connection = await db.getConnection();
    
    const [duplicateGroups] = await connection.query(`
      SELECT 
        product_name, 
        COALESCE(variety, '') as variety, 
        COALESCE(brand, '') as brand, 
        COALESCE(size, '') as size, 
        user_id,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(product_id ORDER BY product_id) as product_ids
      FROM Products 
      GROUP BY 
        LOWER(TRIM(product_name)), 
        LOWER(TRIM(COALESCE(variety, ''))), 
        LOWER(TRIM(COALESCE(brand, ''))), 
        LOWER(TRIM(COALESCE(size, ''))), 
        user_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate products found! Database is clean.');
      return;
    }

    console.log(`📊 Found ${duplicateGroups.length} groups of duplicate products:\n`);

    let totalTransactionsToMove = 0;

    for (const group of duplicateGroups) {
      console.log(`📦 "${group.product_name}" - ${group.duplicate_count} duplicates`);
      console.log(`   📝 Details: variety="${group.variety}", brand="${group.brand}", size="${group.size}"`);
      console.log(`   👥 User: ${group.user_id}`);
      console.log(`   🆔 Product IDs: [${group.product_ids}]`);
      
      // Show which one would be kept (highest inventory)
      const productIds = group.product_ids.split(',').map(id => parseInt(id));
      const [inventoryData] = await connection.query(`
        SELECT 
          p.product_id,
          COALESCE(i.current_stock, 0) as current_stock,
          i.inventory_id
        FROM Products p
        LEFT JOIN Inventories i ON p.product_id = i.product_id
        WHERE p.product_id IN (${productIds.map(() => '?').join(',')})
        ORDER BY 
          i.inventory_id DESC,
          COALESCE(i.current_stock, 0) DESC,
          p.product_id ASC
      `, productIds);
      
      if (inventoryData.length > 0) {
        console.log(`   ✅ Would KEEP: Product ID ${inventoryData[0].product_id} (stock: ${inventoryData[0].current_stock}, inventory_id: ${inventoryData[0].inventory_id || 'None'})`);
        console.log(`   🔄 Would CONSOLIDATE: [${inventoryData.slice(1).map(p => p.product_id).join(', ')}]`);
         
        // Count transactions that would be moved
        for (const duplicate of inventoryData.slice(1)) {
          const [transactionCount] = await connection.query(`
            SELECT 
              (SELECT COUNT(*) FROM Units WHERE product_id = ? AND user_id = ?) +
              (SELECT COUNT(*) FROM Purchases WHERE product_id = ? AND user_id = ?) +
              (SELECT COUNT(*) FROM Sales WHERE product_id = ? AND user_id = ?) +
              (SELECT COUNT(*) FROM CurrentPrice WHERE product_id = ? AND user_id = ?) as total_transactions
          `, [duplicate.product_id, group.user_id, duplicate.product_id, group.user_id, 
              duplicate.product_id, group.user_id, duplicate.product_id, group.user_id]);
          
          if (transactionCount[0] && transactionCount[0].total_transactions > 0) {
            console.log(`   📊 Product ${duplicate.product_id} has ${transactionCount[0].total_transactions} transactions to move`);
            totalTransactionsToMove += transactionCount[0].total_transactions;
          }
        }
      }
      console.log('');
    }

    console.log(`📈 TOTAL transactions that would be preserved and moved: ${totalTransactionsToMove}`);
    console.log(`🛡️ NO transaction data will be lost - everything preserved!`);
  } catch (error) {
    console.error('❌ Error during preview consolidation:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

 // Main execution
 const main = async () => {
   const args = process.argv.slice(2);
   
   if (args.includes('--preview')) {
     await previewConsolidation();
   } else if (args.includes('--consolidate')) {
     const readline = require('readline');
     const rl = readline.createInterface({
       input: process.stdin,
       output: process.stdout
     });

     console.log('⚠️  CONSOLIDATION OPERATION');
     console.log('✅ This will PRESERVE all transactions');
     console.log('✅ Will consolidate under products with MOST CURRENT INVENTORY');
     console.log('✅ Will move ALL purchase/sale/inventory data');
     console.log('📦 Will keep ONLY the most recent inventory amount');
     console.log('❌ Will only remove empty duplicate product records\n');

     rl.question('Continue with consolidation? (yes/no): ', async (answer) => {
       if (answer.toLowerCase() === 'yes') {
         await consolidateDuplicateProducts();
       } else {
         console.log('Operation cancelled.');
       }
       rl.close();
       process.exit(0);
     });
   } else {
     console.log('🔧 DUPLICATE PRODUCT CONSOLIDATION TOOL');
     console.log('');
     console.log('Usage:');
     console.log('  node consolidate_duplicate_products.js --preview     # Show what would be consolidated (safe)');
     console.log('  node consolidate_duplicate_products.js --consolidate # Actually consolidate duplicates');
     console.log('');
     console.log('✅ Preserves ALL transactions and data');
     console.log('✅ Consolidates under product with MOST CURRENT INVENTORY');
     console.log('📦 Keeps ONLY most recent inventory amount (discards old amounts)');
     console.log('✅ Professor Ajay approved approach');
   }
 };

 if (require.main === module) {
   main().catch(console.error);
 }

 module.exports = { consolidateDuplicateProducts, previewConsolidation };