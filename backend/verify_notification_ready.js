// Quick verification script to confirm notification data is ready
const db = require('./config/db');

async function verifyNotificationReady() {
  try {
    console.log('🔍 Verifying notification system is ready...\n');
    
    // Check Soha's current state
    console.log('👤 Checking Soha (user_id 225):');
    const [sohaData] = await db.query(`
      SELECT 
        'Insights' as table_name,
        (SELECT MAX(version_number) FROM Insights WHERE user_id = 225) as latest_version,
        (SELECT MAX(created_at) FROM Insights WHERE user_id = 225) as latest_created
      UNION ALL
      SELECT 
        'UserInsightViews' as table_name,
        (SELECT last_viewed_version FROM UserInsightViews WHERE user_id = 225) as latest_version,
        (SELECT last_viewed_at FROM UserInsightViews WHERE user_id = 225) as latest_created
    `);
    
    console.table(sohaData);
    
    // Calculate notification status
    const [notificationCheck] = await db.query(`
      SELECT 
        (SELECT MAX(version_number) FROM Insights WHERE user_id = 225) as latest_insight_version,
        (SELECT COALESCE(last_viewed_version, 0) FROM UserInsightViews WHERE user_id = 225) as last_viewed_version,
        CASE 
          WHEN (SELECT MAX(version_number) FROM Insights WHERE user_id = 225) > 
               (SELECT COALESCE(last_viewed_version, 0) FROM UserInsightViews WHERE user_id = 225)
          THEN 'YES - SHOULD SHOW NOTIFICATION' 
          ELSE 'NO - NO NOTIFICATION' 
        END as notification_should_show
    `);
    
    console.log('\n📊 Notification Status Analysis:');
    console.table(notificationCheck);
    
    // Show latest insight for Soha
    const [latestInsight] = await db.query(`
      SELECT id, version_number, insight1, created_at 
      FROM Insights 
      WHERE user_id = 225 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    console.log('\n💡 Latest Insight for Soha:');
    console.log(`Version: ${latestInsight[0].version_number}`);
    console.log(`Created: ${latestInsight[0].created_at}`);
    console.log(`Content: ${latestInsight[0].insight1.substring(0, 80)}...`);
    
    const versionGap = notificationCheck[0].latest_insight_version - notificationCheck[0].last_viewed_version;
    
    console.log('\n🎯 SUMMARY:');
    console.log(`Latest insight version: ${notificationCheck[0].latest_insight_version}`);
    console.log(`Last viewed version: ${notificationCheck[0].last_viewed_version}`);
    console.log(`Version gap: ${versionGap}`);
    console.log(`Notification should show: ${notificationCheck[0].notification_should_show}`);
    
    if (versionGap > 0) {
      console.log('\n✅ SUCCESS: InsightsNotificationBox should appear on Overview page!');
      console.log('   - Refresh the browser if needed');
      console.log('   - Make sure you\'re logged in as Soha');
      console.log('   - Check browser console for any errors');
    } else {
      console.log('\n❌ ISSUE: No version gap detected');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await db.end();
  }
}

verifyNotificationReady();
