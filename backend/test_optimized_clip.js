const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Test script to compare optimized vs traditional CLIP performance
 */

const BASE_URL = 'http://localhost:8000'; // Adjust to your server port

async function testOptimizedClip() {
  console.log('🔬 Testing Optimized CLIP Performance\n');
  
  try {
    // Check service health first
    console.log('1️⃣ Checking CLIP service health...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/api/optimized-clip/service-health`);
      console.log('   Health check:', healthResponse.data);
      
      if (healthResponse.data.status !== 'healthy') {
        console.log('   ⚠️ Service not ready, waiting 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (error) {
      console.log('   ❌ Health check failed:', error.message);
      console.log('   Make sure your server is running on port 3001');
      return;
    }
    
    // Test with a sample image (you can replace with actual test image)
    console.log('\n2️⃣ Preparing test image...');
    
    // Create a simple test image data (1x1 pixel PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const testImageData = `data:image/png;base64,${testImageBase64}`;
    
    console.log('   ✅ Test image prepared (1x1 pixel sample)');
    
    // Test performance comparison
    console.log('\n3️⃣ Running performance comparison...');
    try {
      const perfResponse = await axios.post(`${BASE_URL}/api/optimized-clip/performance-test`, {
        image: testImageData
      });
      
      const perf = perfResponse.data.performance_comparison;
      
      console.log('\n📊 PERFORMANCE RESULTS:');
      console.log('='.repeat(50));
      console.log(`🚀 Optimized Method: ${perf.optimized_method.time_ms}ms`);
      console.log(`🐌 Traditional Method: ${perf.traditional_method.time_ms}ms (estimated)`);
      console.log(`⚡ Time Saved: ${perf.improvement.time_saved_ms}ms`);
      console.log(`📈 Speed Improvement: ${perf.improvement.percentage_faster}`);
      console.log(`🏎️ Speedup Factor: ${perf.improvement.speedup_factor}`);
      console.log('='.repeat(50));
      
    } catch (error) {
      console.log('   ❌ Performance test failed:', error.response?.data || error.message);
    }
    
    // Test actual search
    console.log('\n4️⃣ Testing optimized search...');
    try {
      const startTime = Date.now();
      const searchResponse = await axios.post(`${BASE_URL}/api/optimized-clip/optimized-search`, {
        image: testImageData
      });
      const endTime = Date.now();
      
      console.log('   ✅ Search completed successfully!');
      console.log(`   ⏱️ Total request time: ${endTime - startTime}ms`);
      console.log(`   🎯 Found ${searchResponse.data.count} similar products`);
      
      if (searchResponse.data.performance) {
        const p = searchResponse.data.performance;
        console.log(`   📊 Server-side breakdown:`);
        console.log(`      - Embedding generation: ${p.embedding_time_ms}ms`);
        console.log(`      - Database search: ${p.search_time_ms}ms`);
        console.log(`      - Total server time: ${p.total_time_ms}ms`);
      }
      
    } catch (error) {
      console.log('   ❌ Optimized search failed:', error.response?.data || error.message);
    }
    
    // Test with a real product image if available
    console.log('\n5️⃣ Looking for real test images...');
    const realTestDirs = [
      path.join(__dirname, 'temp', 'real_test_images'),
      path.join(__dirname, 'temp', 'failed_test_images')
    ];
    
    let realImageFound = false;
    for (const testDir of realTestDirs) {
      if (fs.existsSync(testDir)) {
        const files = fs.readdirSync(testDir).filter(f => f.endsWith('.jpg'));
        if (files.length > 0) {
          const testImagePath = path.join(testDir, files[0]);
          console.log(`   📸 Testing with real image: ${files[0]}`);
          
          try {
            const imageBuffer = fs.readFileSync(testImagePath);
            const realImageData = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
            
            const startTime = Date.now();
            const realSearchResponse = await axios.post(`${BASE_URL}/api/optimized-clip/optimized-search`, {
              image: realImageData
            });
            const endTime = Date.now();
            
            console.log(`   ✅ Real image search completed in ${endTime - startTime}ms`);
            console.log(`   🎯 Found ${realSearchResponse.data.count} similar products`);
            
            if (realSearchResponse.data.results.length > 0) {
              console.log(`   🥇 Top match: ${realSearchResponse.data.results[0].product_name} (${(realSearchResponse.data.results[0].similarity * 100).toFixed(1)}% similarity)`);
            }
            
            realImageFound = true;
            break;
            
          } catch (error) {
            console.log(`   ❌ Real image test failed: ${error.message}`);
          }
        }
      }
    }
    
    if (!realImageFound) {
      console.log('   📝 No real test images found - test with synthetic image only');
    }
    
    console.log('\n🎉 Optimized CLIP testing completed!');
    console.log('\n💡 KEY BENEFITS:');
    console.log('   • Persistent Python service eliminates model loading overhead');
    console.log('   • Optimized database queries for faster similarity search');
    console.log('   • Improved error handling and performance monitoring');
    console.log('   • Should achieve sub-1-second search times vs 8.9s previously');
    
  } catch (error) {
    console.error('❌ Test script error:', error.message);
  }
}

// Helper function to format time
function formatTime(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  } else {
    return `${(ms / 1000).toFixed(1)}s`;
  }
}

// Run the test
if (require.main === module) {
  testOptimizedClip();
}

module.exports = { testOptimizedClip };
