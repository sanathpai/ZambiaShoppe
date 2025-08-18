require('dotenv').config();
const { spawn } = require('child_process');
const db = require('./config/db');

async function testTopKAccuracy() {
  console.log('🎯 CLIP Top-K Accuracy Test (Professor\'s Use Case)');
  console.log('='.repeat(60));
  console.log('Testing: At least 1 correct match in top 5 results\n');

  try {
    // Get duplicate groups 
    const [duplicateGroups] = await db.query(`
      SELECT product_name, brand, variety, COUNT(*) as count
      FROM Products 
      WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
      GROUP BY product_name, brand, variety
      HAVING count > 1
      ORDER BY count DESC
      LIMIT 10
    `);

    let totalTests = 0;
    let successfulTests = 0;
    const results = [];

    for (const group of duplicateGroups) {
      console.log(`🔬 Testing: ${group.product_name} (${group.brand || 'no brand'})`);
      
      // Get all products in this group
      const [groupProducts] = await db.query(`
        SELECT product_id, product_name, brand, variety, size, 
               COALESCE(image_s3_url, image) as image_data
        FROM Products 
        WHERE product_name = ? AND 
              (brand = ? OR (brand IS NULL AND ? IS NULL)) AND
              (variety = ? OR (variety IS NULL AND ? IS NULL)) AND
              (image IS NOT NULL OR image_s3_url IS NOT NULL)
      `, [group.product_name, group.brand, group.brand, group.variety, group.variety]);

      if (groupProducts.length < 2) {
        console.log('   ⏭️  Not enough products, skipping\n');
        continue;
      }

      // Test each product as query against the database
      for (let i = 0; i < Math.min(groupProducts.length, 3); i++) {
        const queryProduct = groupProducts[i];
        console.log(`   📷 Query: Product ${queryProduct.product_id}`);
        
        try {
          // Get top 5 similar products from entire database
          const top5Results = await getTop5SimilarProducts(queryProduct.image_data);
          
          // Check if any of the top 5 match our group
          const hasMatch = top5Results.some(result => 
            groupProducts.some(gp => gp.product_id === result.product_id)
          );
          
          totalTests++;
          if (hasMatch) {
            successfulTests++;
            console.log('   ✅ SUCCESS: Correct match found in top 5');
          } else {
            console.log('   ❌ MISS: No correct match in top 5');
          }
          
        } catch (error) {
          console.log(`   ⚠️  Error testing product ${queryProduct.product_id}: ${error.message}`);
        }
      }
      
      console.log(''); // Empty line for readability
    }

    const accuracy = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
    
    console.log('='.repeat(60));
    console.log('📊 TOP-K ACCURACY RESULTS');
    console.log('='.repeat(60));
    console.log(`🎯 Success Rate: ${accuracy.toFixed(1)}% (${successfulTests}/${totalTests})`);
    console.log(`📋 Target: 80-90% for production readiness`);
    
    if (accuracy >= 80) {
      console.log('🟢 EXCELLENT: Ready for production!');
    } else if (accuracy >= 70) {
      console.log('🟡 GOOD: Close to target, minor optimization needed');
    } else {
      console.log('🔴 NEEDS WORK: Below target, requires improvement');
    }

    console.log('\n💡 This measures: "Does at least 1 correct product appear in top 5 suggestions?"');
    console.log('📱 Perfect for mobile UI showing 3-5 product suggestions');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

async function getTop5SimilarProducts(queryImageData) {
  // Mock function - replace with actual CLIP similarity search
  // Returns top 5 products with similarity scores
  
  // For now, return sample results
  return [
    { product_id: 1234, similarity: 0.95, product_name: "Mock Product 1" },
    { product_id: 5678, similarity: 0.87, product_name: "Mock Product 2" },
    { product_id: 9012, similarity: 0.82, product_name: "Mock Product 3" },
    { product_id: 3456, similarity: 0.78, product_name: "Mock Product 4" },
    { product_id: 7890, similarity: 0.73, product_name: "Mock Product 5" }
  ];
}

async function findSimilarProductsFromDatabase(queryImageData, topK = 5) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
sys.path.append('/Users/soha/ZambiaShoppe/backend/utils')
import json

# This would be replaced with actual CLIP similarity search
# For now, return mock data
results = [
    {"product_id": 1234, "similarity": 0.95, "product_name": "Sample Product"},
    {"product_id": 5678, "similarity": 0.87, "product_name": "Another Product"}
]
print(json.dumps(results[:${topK}]))
    `;

    const pythonProcess = spawn('python3', ['-c', pythonScript]);
    
    let outputData = '';
    pythonProcess.stdout.on('data', (data) => outputData += data.toString());
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(outputData.trim()));
        } catch (e) {
          reject(new Error('Failed to parse results'));
        }
      } else {
        reject(new Error('Python script failed'));
      }
    });
  });
}

testTopKAccuracy(); 