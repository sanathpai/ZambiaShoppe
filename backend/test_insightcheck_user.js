// Test script specifically for user "insightcheck" to demonstrate date_first_viewed
const db = require('./config/db');

async function testInsightCheckUser() {
  try {
    console.log('🧪 Testing date_first_viewed for user "insightcheck"...\n');
    
    const testUserId = 396; // insightcheck user ID
    const testUsername = 'insightcheck';
    
    console.log(`📋 Testing with user: ${testUsername} (ID: ${testUserId})`);
    
    // Step 1: Create insights for insightcheck user
    console.log('\n📋 1. Creating insights for user insightcheck...');
    
    const [result] = await db.execute(`
      INSERT INTO Insights (user_id, insight1, insight2, insight3, insight4, insight5, version_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      testUserId,
      'Your shop shows excellent growth potential in the beverage category.',
      'Customer traffic peaks between 12-2 PM - consider promotional offers during this time.',
      'Inventory turnover rate is 15% above average for similar shops in your area.',
      'Seasonal trend: Soft drinks see 25% increase during hot weather periods.',
      'Recommendation: Stock up on energy drinks during exam seasons for student customers.',
      1
    ]);
    
    console.log(`✅ Created insights with ID: ${result.insertId}`);
    
    // Step 2: Simulate user viewing insights for the FIRST time
    console.log('\n📋 2. Simulating insightcheck viewing insights for the FIRST time...');
    
    const beforeFirstView = new Date();
    console.log(`   Time before first view: ${beforeFirstView.toISOString()}`);
    
    // Get the version number (mimics the controller logic)
    const [versionResults] = await db.execute(`
      SELECT version_number 
      FROM Insights 
      WHERE user_id = ? 
      ORDER BY last_updated DESC 
      LIMIT 1
    `, [testUserId]);
    
    const currentVersion = versionResults[0].version_number;
    
    // This is exactly what happens when user views insights (from markInsightsViewed controller)
    await db.execute(`
      INSERT INTO UserInsightViews (user_id, last_viewed_at, last_viewed_version)
      VALUES (?, NOW(), ?)
      ON DUPLICATE KEY UPDATE
      last_viewed_at = NOW(),
      last_viewed_version = ?
    `, [testUserId, currentVersion, currentVersion]);
    
    const afterFirstView = new Date();
    console.log(`   Time after first view: ${afterFirstView.toISOString()}`);
    console.log('✅ First view recorded!');
    
    // Step 3: Check what was recorded
    console.log('\n📋 3. Checking database after FIRST view...');
    
    const [firstViewResults] = await db.query(`
      SELECT 
        id,
        user_id, 
        last_viewed_at, 
        date_first_viewed,
        last_viewed_version,
        TIMESTAMPDIFF(SECOND, date_first_viewed, last_viewed_at) as seconds_difference
      FROM UserInsightViews 
      WHERE user_id = ?
    `, [testUserId]);
    
    if (firstViewResults.length > 0) {
      const record = firstViewResults[0];
      console.log('\n📊 FIRST VIEW RESULTS:');
      console.table([{
        user_id: record.user_id,
        date_first_viewed: record.date_first_viewed,
        last_viewed_at: record.last_viewed_at,
        seconds_difference: record.seconds_difference,
        version: record.last_viewed_version
      }]);
      
      if (record.seconds_difference === 0) {
        console.log('✅ PERFECT: date_first_viewed = last_viewed_at (first time viewing)');
      } else {
        console.log('❌ ISSUE: Should be 0 seconds difference for first view');
      }
    }
    
    // Step 4: Wait and simulate viewing again
    console.log('\n📋 4. Waiting 2 seconds and simulating SECOND view...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const beforeSecondView = new Date();
    console.log(`   Time before second view: ${beforeSecondView.toISOString()}`);
    
    // View insights again (this should update last_viewed_at but NOT date_first_viewed)
    await db.execute(`
      INSERT INTO UserInsightViews (user_id, last_viewed_at, last_viewed_version)
      VALUES (?, NOW(), ?)
      ON DUPLICATE KEY UPDATE
      last_viewed_at = NOW(),
      last_viewed_version = ?
    `, [testUserId, currentVersion, currentVersion]);
    
    const afterSecondView = new Date();
    console.log(`   Time after second view: ${afterSecondView.toISOString()}`);
    console.log('✅ Second view recorded!');
    
    // Step 5: Check final results
    console.log('\n📋 5. Checking database after SECOND view...');
    
    const [secondViewResults] = await db.query(`
      SELECT 
        id,
        user_id, 
        date_first_viewed,
        last_viewed_at,
        last_viewed_version,
        TIMESTAMPDIFF(SECOND, date_first_viewed, last_viewed_at) as seconds_between_views
      FROM UserInsightViews 
      WHERE user_id = ?
    `, [testUserId]);
    
    if (secondViewResults.length > 0) {
      const record = secondViewResults[0];
      console.log('\n📊 FINAL RESULTS AFTER SECOND VIEW:');
      console.table([{
        user_id: record.user_id,
        date_first_viewed: record.date_first_viewed,
        last_viewed_at: record.last_viewed_at,
        seconds_between_views: record.seconds_between_views,
        version: record.last_viewed_version
      }]);
      
      if (record.seconds_between_views >= 2) {
        console.log('✅ SUCCESS: date_first_viewed stayed the same, last_viewed_at updated!');
        console.log('🎯 The date_first_viewed column is working perfectly for user insightcheck!');
        
        console.log('\n📈 Analytics Value:');
        console.log(`   • First viewed insights: ${record.date_first_viewed}`);
        console.log(`   • Last viewed insights: ${record.last_viewed_at}`);
        console.log(`   • Time between first and recent view: ${record.seconds_between_views} seconds`);
        console.log('   • This data is now available for export and analysis!');
        
      } else {
        console.log('❌ ISSUE: date_first_viewed should have stayed the same');
      }
    }
    
    console.log('\n🎉 Test completed for user insightcheck!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await db.end();
  }
}

// Run the test
testInsightCheckUser();
