require('dotenv').config();
const db = require('./backend/config/db');

async function testCleanVsCluttered() {
  console.log('🧹 CLIP Test: Clean vs Cluttered Images');
  console.log('='.repeat(50));

  try {
    // Step 1: Manually categorize images based on visual inspection
    const testGroups = [
      {
        name: "Coca Cola",
        clean_images: [1663, 2076], // Product IDs with clean backgrounds
        cluttered_images: [2119, 2156, 2361] // Product IDs with store/shelf backgrounds
      },
      {
        name: "Fanta", 
        clean_images: [2527, 2603],
        cluttered_images: [2717, 2812]
      }
    ];

    for (const group of testGroups) {
      console.log(`\n🔬 Testing: ${group.name}`);
      
      // Test clean images
      const cleanAccuracy = await testImageSet(group.clean_images, group.name);
      console.log(`   🧹 Clean images accuracy: ${(cleanAccuracy * 100).toFixed(1)}%`);
      
      // Test cluttered images  
      const clutteredAccuracy = await testImageSet(group.cluttered_images, group.name);
      console.log(`   📦 Cluttered images accuracy: ${(clutteredAccuracy * 100).toFixed(1)}%`);
      
      const improvement = ((cleanAccuracy - clutteredAccuracy) * 100);
      console.log(`   📈 Clean vs Cluttered difference: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function testImageSet(productIds, groupName) {
  // Simulate CLIP testing on specific image sets
  // Use first image as query, test against others
  if (productIds.length < 2) return 0;
  
  const queryId = productIds[0];
  const targetIds = productIds.slice(1);
  
  // Placeholder for actual CLIP similarity testing
  // Replace with real CLIP calls
  console.log(`     Query: Product ${queryId} against [${targetIds.join(', ')}]`);
  
  // Mock results based on clean vs cluttered expectations
  const mockAccuracy = Math.random() * 0.4 + 0.6; // 60-100% range
  return mockAccuracy;
}

testCleanVsCluttered(); 