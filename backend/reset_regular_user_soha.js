const crypto = require('crypto');
const db = require('./config/db');

async function generateResetForRegularUserSoha() {
  try {
    console.log('🔑 Generating password reset link for REGULAR USER "Soha"...\n');
    
    // Get the regular user "Soha" from Users table (not admin table)
    const [userRows] = await db.query('SELECT * FROM Users WHERE username = ?', ['Soha']);
    
    if (userRows.length === 0) {
      console.log('❌ Regular user "Soha" not found in Users table');
      return;
    }
    
    const user = userRows[0];
    
    console.log('✅ FOUND REGULAR USER ACCOUNT:');
    console.log(`   - User ID: ${user.id}`);
    console.log(`   - Username: ${user.username}`);
    console.log(`   - Shop Name: ${user.shop_name}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Account Type: REGULAR USER (not admin)`);
    console.log('');
    
    // Generate a reset token
    const token = crypto.randomBytes(20).toString('hex');
    const expireTime = Date.now() + 3600000; // 1 hour expiration
    
    // Save the token to the user's record in Users table
    await db.query(
      'UPDATE Users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?', 
      [token, expireTime, user.id]
    );
    
    // Create reset URL
    const resetURL = `https://frontend.shoppeappnow.com/reset-password/${token}`;
    
    console.log('🎯 PASSWORD RESET LINK FOR REGULAR USER "Soha":');
    console.log('');
    console.log('🔗 Reset Link:');
    console.log(`   ${resetURL}`);
    console.log('');
    console.log('📝 Instructions:');
    console.log('   1. Copy the link above');
    console.log('   2. Open it in your browser');
    console.log('   3. Enter your new password');
    console.log('   4. Link expires in 1 hour');
    console.log('   5. After reset, login with username: "Soha"');
    console.log('');
    console.log('⚠️  IMPORTANT: This is for REGULAR USER account, not admin');
    
  } catch (error) {
    console.error('❌ Error generating reset link:', error);
  } finally {
    process.exit(0);
  }
}

// Run the reset generation
generateResetForRegularUserSoha(); 