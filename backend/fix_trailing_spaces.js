const db = require('./config/db');

async function fixTrailingSpaces() {
  try {
    console.log('🧹 FIXING TRAILING SPACES IN PRODUCTS TABLE');
    console.log('='.repeat(50));
    
    // Find the user ID for Davidshop01
    const [users] = await db.query('SELECT id, shop_name FROM Users WHERE shop_name = ?', ['Davidshop01']);
    if (!users.length) {
      console.log('❌ User Davidshop01 not found!');
      return;
    }
    
    const user_id = users[0].id;
    console.log(`✅ Found user: ${users[0].shop_name} (ID: ${user_id})`);
    
    // Find products with trailing spaces
    const [products] = await db.query(
      'SELECT product_id, product_name, variety, brand FROM Products WHERE user_id = ? AND (product_name LIKE "% " OR variety LIKE "% ")',
      [user_id]
    );
    
    console.log(`\n📊 Found ${products.length} products with trailing spaces:`);
    
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const cleanName = product.product_name.trim();
      const cleanVariety = product.variety ? product.variety.trim() : product.variety;
      
      console.log(`\n${i + 1}. Product ID: ${product.product_id}`);
      console.log(`   Old: "${product.product_name}" - "${product.variety}"`);
      console.log(`   New: "${cleanName}" - "${cleanVariety}"`);
      
      // Update the product
      await db.query(
        'UPDATE Products SET product_name = ?, variety = ? WHERE product_id = ? AND user_id = ?',
        [cleanName, cleanVariety, product.product_id, user_id]
      );
      
      console.log(`   ✅ Updated!`);
    }
    
    console.log(`\n🎉 FIXED ${products.length} PRODUCTS!`);
    console.log('Now try adding your sale again.');
    console.log('\n' + '='.repeat(50));
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixTrailingSpaces(); 