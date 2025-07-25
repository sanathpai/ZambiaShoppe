const db = require('./config/db');

async function checkAllSohaUsers() {
  try {
    console.log('🔍 Searching for all users with "soha" in their information...\n');
    
    // Search for users with "soha" in username (case insensitive)
    const [userRows] = await db.query(
      'SELECT * FROM Users WHERE LOWER(username) LIKE ? OR LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?', 
      ['%soha%', '%soha%', '%soha%']
    );
    
    if (userRows.length === 0) {
      console.log('❌ No users found with "soha" in their information');
      return;
    }
    
    console.log(`👥 Found ${userRows.length} user(s) with "soha" in their information:\n`);
    
    userRows.forEach((user, index) => {
      console.log(`📋 User ${index + 1}:`);
      console.log(`   - User ID: ${user.id}`);
      console.log(`   - Username: "${user.username}" (exact format)`);
      console.log(`   - Shop Name: ${user.shop_name || 'Not provided'}`);
      console.log(`   - First Name: ${user.first_name || 'Not provided'}`);
      console.log(`   - Last Name: ${user.last_name || 'Not provided'}`);
      console.log(`   - Email: ${user.email || 'NO EMAIL ADDRESS'}`);
      console.log(`   - Contact: ${user.contact || 'Not provided'}`);
      console.log(`   - Has Password: ${user.password ? 'Yes (encrypted)' : 'No'}`);
      console.log('');
    });
    
    // Also check admin table for any "soha" admins
    console.log('🔍 Checking admin table for "soha"...\n');
    const [adminRows] = await db.query(
      'SELECT * FROM admin WHERE LOWER(username) LIKE ?', 
      ['%soha%']
    );
    
    if (adminRows.length > 0) {
      console.log(`👑 Found ${adminRows.length} admin(s) with "soha":\n`);
      adminRows.forEach((admin, index) => {
        console.log(`📋 Admin ${index + 1}:`);
        console.log(`   - Admin ID: ${admin.id}`);
        console.log(`   - Username: "${admin.username}" (exact format)`);
        console.log('');
      });
    } else {
      console.log('ℹ️ No admins found with "soha" in username\n');
    }
    
    console.log('💡 NEXT STEPS:');
    console.log('   Please specify the exact username you want to reset password for');
    
  } catch (error) {
    console.error('❌ Error searching for users:', error);
  } finally {
    process.exit(0);
  }
}

// Run the search
checkAllSohaUsers(); 