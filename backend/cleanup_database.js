const db = require('./config/db');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Users to preserve (as specified by professor)
const PRESERVE_USERNAMES = [
  'bibibusiness',
  'Andusshop', 
  'Aaron2025',
  'cheapest shop',
  'Lweendo Chibala'
];

const PRESERVE_SHOP_NAMES = [
  'bibi shop',
  'Andus shop',
  'ShopAMB', 
  'cheapest shop',
  'Coco\'s finds'
];

// Database backup function
const backupDatabase = () => {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `database_backup_${timestamp}.sql`;
    const backupPath = path.join(__dirname, 'exports', backupFile);
    
    // Ensure exports directory exists
    if (!fs.existsSync(path.join(__dirname, 'exports'))) {
      fs.mkdirSync(path.join(__dirname, 'exports'));
    }
    
    // MySQL dump command with full path (for keg-only installation)
    const mysqldumpPath = '/opt/homebrew/opt/mysql-client/bin/mysqldump';
    const command = `${mysqldumpPath} -h ${process.env.DB_HOST || 'localhost'} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${backupPath}`;
    
    console.log('🗄️  Creating database backup...');
    console.log(`Backup will be saved to: ${backupPath}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Backup failed:', error);
        reject(error);
      } else {
        console.log('✅ Database backup completed successfully');
        console.log(`📁 Backup saved as: ${backupFile}`);
        resolve(backupPath);
      }
    });
  });
};

// Get user IDs to preserve
const getPreserveUserIds = async () => {
  try {
    console.log('🔍 Finding user IDs to preserve...');
    
    const [users] = await db.query(`
      SELECT id, username, shop_name 
      FROM Users 
      WHERE username IN (${PRESERVE_USERNAMES.map(() => '?').join(',')}) 
         OR shop_name IN (${PRESERVE_SHOP_NAMES.map(() => '?').join(',')})
    `, [...PRESERVE_USERNAMES, ...PRESERVE_SHOP_NAMES]);
    
    console.log('👥 Users to preserve:');
    users.forEach(user => {
      console.log(`   - ID: ${user.id}, Username: ${user.username}, Shop: ${user.shop_name}`);
    });
    
    return users.map(user => user.id);
  } catch (error) {
    console.error('❌ Error finding preserve user IDs:', error);
    throw error;
  }
};

// Get all user IDs to delete
const getUsersToDelete = async (preserveIds) => {
  try {
    const [users] = await db.query(`
      SELECT id, username, shop_name 
      FROM Users 
      WHERE id NOT IN (${preserveIds.map(() => '?').join(',')})
    `, preserveIds);
    
    console.log(`🗑️  Found ${users.length} users to delete:`);
    users.forEach(user => {
      console.log(`   - ID: ${user.id}, Username: ${user.username}, Shop: ${user.shop_name}`);
    });
    
    return users.map(user => user.id);
  } catch (error) {
    console.error('❌ Error finding users to delete:', error);
    throw error;
  }
};

// Cascade delete data for specific users
const cascadeDeleteUsers = async (userIdsToDelete) => {
  if (userIdsToDelete.length === 0) {
    console.log('✅ No users to delete');
    return;
  }
  
  const userIdPlaceholders = userIdsToDelete.map(() => '?').join(',');
  
  try {
    console.log('🔄 Starting cascade deletion...');
    
    // Helper function to safely delete from table (skip if table doesn't exist)
    const safeDelete = async (tableName, query, params, description) => {
      try {
        const [result] = await db.query(query, params);
        console.log(`   Deleted ${result.affectedRows} ${description}`);
        return result.affectedRows;
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`   ⚠️  Table ${tableName} doesn't exist - skipping`);
          return 0;
        } else {
          throw error; // Re-throw other errors
        }
      }
    };
    
    // 1. Delete Inventories (both through Units and direct Product references)
    console.log('1️⃣  Deleting Inventories...');
    
    // First, delete inventories that reference products through units
    await safeDelete('Inventories', `
      DELETE FROM Inventories 
      WHERE unit_id IN (
        SELECT unit_id FROM Units 
        WHERE user_id IN (${userIdPlaceholders})
      )
    `, userIdsToDelete, 'inventory records (via units)');
    
    // Then, delete inventories that directly reference products
    await safeDelete('Inventories', `
      DELETE FROM Inventories 
      WHERE product_id IN (
        SELECT product_id FROM Products 
        WHERE user_id IN (${userIdPlaceholders})
      )
    `, userIdsToDelete, 'inventory records (direct product refs)');
    
    // Finally, delete any remaining inventories by user_id (if the table has user_id column)
    await safeDelete('Inventories', `
      DELETE FROM Inventories 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'inventory records (by user)');
    
    // 2. Delete Purchases
    console.log('2️⃣  Deleting Purchases...');
    await safeDelete('Purchases', `
      DELETE FROM Purchases 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'purchase records');
    
    // 3. Delete Sales
    console.log('3️⃣  Deleting Sales...');
    await safeDelete('Sales', `
      DELETE FROM Sales 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'sale records');
    
    // 4. Delete ProductOfferings
    console.log('4️⃣  Deleting ProductOfferings...');
    await safeDelete('ProductOfferings', `
      DELETE FROM ProductOfferings 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'product offering records');
    
    // 5. Delete CurrentPrice
    console.log('5️⃣  Deleting CurrentPrice...');
    await safeDelete('CurrentPrice', `
      DELETE FROM CurrentPrice 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'current price records');
    
    // 6. Delete Unit_Conversion (by product ownership)
    console.log('6️⃣  Deleting Unit_Conversion...');
    await safeDelete('Unit_Conversion', `
      DELETE FROM Unit_Conversion 
      WHERE product_id IN (
        SELECT product_id FROM Products 
        WHERE user_id IN (${userIdPlaceholders})
      )
    `, userIdsToDelete, 'unit conversion records');
    
    // 7. Delete Units
    console.log('7️⃣  Deleting Units...');
    await safeDelete('Units', `
      DELETE FROM Units 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'unit records');
    
    // 8. Delete Products
    console.log('8️⃣  Deleting Products...');
    await safeDelete('Products', `
      DELETE FROM Products 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'product records');
    
    // 9. Delete Shops
    console.log('9️⃣  Deleting Shops...');
    await safeDelete('Shops', `
      DELETE FROM Shops 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'shop records');
    
    // 10. Delete RegularSuppliers
    console.log('🔟 Deleting RegularSuppliers...');
    await safeDelete('RegularSuppliers', `
      DELETE FROM RegularSuppliers 
      WHERE user_id IN (${userIdPlaceholders})
    `, userIdsToDelete, 'supplier records');
    
    // NOTE: NOT deleting user accounts - only their business data
    console.log('👤 Preserving user accounts (only deleting their business data)');
    
    console.log('✅ Cascade deletion completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cascade deletion:', error);
    throw error;
  }
};

// Main cleanup function
const cleanupDatabase = async () => {
  try {
    console.log('🚀 Starting database cleanup process...');
    console.log('==========================================');
    
    // Step 1: Backup database
    await backupDatabase();
    console.log('');
    
    // Step 2: Get user IDs to preserve
    const preserveUserIds = await getPreserveUserIds();
    console.log('');
    
    // Step 3: Get user IDs to delete
    const deleteUserIds = await getUsersToDelete(preserveUserIds);
    console.log('');
    
    // Step 4: Confirm with user before proceeding
    console.log('⚠️  WARNING: This will permanently delete business data!');
    console.log(`📊 Summary:`);
    console.log(`   - Users to preserve: ${preserveUserIds.length} (business data intact)`);
    console.log(`   - Users to clean: ${deleteUserIds.length} (business data deleted, accounts preserved)`);
    console.log(`   - Insights table: PRESERVED (untouched)`);
    console.log(`   - User accounts: ALL PRESERVED`);
    console.log('');
    
    // For safety, require manual confirmation
    if (process.argv.includes('--confirm')) {
      // Step 5: Perform cascade deletion
      await cascadeDeleteUsers(deleteUserIds);
      console.log('');
      console.log('🎉 Database cleanup completed successfully!');
      console.log('✅ Preserved users\' business data intact');
      console.log('✅ Other users\' business data deleted (accounts preserved)');
      console.log('✅ Insights table untouched');
      console.log('✅ All user accounts preserved');
    } else {
      console.log('🛑 DRY RUN COMPLETE - No data was deleted');
      console.log('');
      console.log('To actually perform the deletion, run:');
      console.log('node cleanup_database.js --confirm');
    }
    
  } catch (error) {
    console.error('💥 Cleanup process failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (db && db.end) {
      await db.end();
    }
    process.exit(0);
  }
};

// Run the cleanup
cleanupDatabase(); 