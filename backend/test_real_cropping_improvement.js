require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');
const https = require('https');

async function testRealCroppingImprovement() {
  console.log('🎯 REAL CROPPING IMPROVEMENT TEST');
  console.log('='.repeat(60));
  console.log('📋 Testing against actual database with real similarity matching');
  console.log('🔍 Failed products: 3631, 1464, 1905\n');

  try {
    // Get failed products
    const failedIds = [3631, 1464, 1905];
    const failedProducts = [];
    
    for (const id of failedIds) {
      const [results] = await db.query(`
        SELECT product_id, product_name, brand, variety, size, 
               COALESCE(image_s3_url, image) as image_url 
        FROM Products 
        WHERE product_id = ?
      `, [id]);
      
      if (results.length > 0) {
        failedProducts.push(results[0]);
      }
    }
    
    console.log(`📊 Testing ${failedProducts.length} failed products against real database`);
    
    // Download images
    const tempDir = path.join(__dirname, 'temp', 'real_test_images');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const realTestResults = [];
    
    for (const product of failedProducts) {
      console.log(`\n🔍 Testing ${product.product_name} (ID: ${product.product_id})`);
      console.log(`   Brand: ${product.brand || 'N/A'}`);
      console.log('-'.repeat(50));
      
      try {
        // Download image
        const imagePath = await downloadImage(product.image_url, tempDir, product.product_id);
        
        if (!imagePath) {
          console.log('   ❌ Failed to download image');
          continue;
        }
        
        // Test original CLIP against database
        console.log('   📊 Testing original CLIP against database...');
        const originalResults = await testAgainstDatabase(imagePath, 'original');
        
        // Test enhanced CLIP with cropping against database
        console.log('   🎯 Testing enhanced CLIP with cropping against database...');
        const enhancedResults = await testAgainstDatabase(imagePath, 'enhanced');
        
        // Find if the correct product appears in results
        const originalRank = findProductRank(originalResults, product.product_id);
        const enhancedRank = findProductRank(enhancedResults, product.product_id);
        
        const improvement = calculateImprovement(originalRank, enhancedRank);
        
        console.log(`   📊 REAL DATABASE RESULTS:`);
        console.log(`      Original: ${originalRank === -1 ? 'Not found in top 10' : `Rank ${originalRank + 1}`}`);
        console.log(`      Enhanced: ${enhancedRank === -1 ? 'Not found in top 10' : `Rank ${enhancedRank + 1}`}`);
        console.log(`      Improvement: ${improvement}`);
        
        realTestResults.push({
          product_id: product.product_id,
          product_name: product.product_name,
          brand: product.brand,
          original_rank: originalRank,
          enhanced_rank: enhancedRank,
          improvement: improvement,
          original_found: originalRank !== -1,
          enhanced_found: enhancedRank !== -1
        });
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    // Generate real test report
    generateRealTestReport(realTestResults);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await db.end();
  }
}

function downloadImage(imageUrl, tempDir, productId) {
  return new Promise((resolve, reject) => {
    if (!imageUrl || !imageUrl.startsWith('http')) {
      resolve(null);
      return;
    }
    
    const imagePath = path.join(tempDir, `product_${productId}.jpg`);
    
    if (fs.existsSync(imagePath)) {
      resolve(imagePath);
      return;
    }
    
    const file = fs.createWriteStream(imagePath);
    
    https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`   📥 Downloaded image`);
        resolve(imagePath);
      });
      
      file.on('error', (err) => {
        fs.unlink(imagePath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function testAgainstDatabase(imagePath, mode) {
  return new Promise((resolve, reject) => {
    let pythonScript;
    
    if (mode === 'enhanced') {
      pythonScript = `
import sys
import os
sys.path.append('${path.join(__dirname, 'utils')}')

try:
    from enhancedClipWithCropping import EnhancedCLIPWithCropping
    import json
    
    enhancer = EnhancedCLIPWithCropping()
    strategies = ['center_crop', 'object_detection', 'saliency_crop', 'text_aware', 'multi_region']
    embedding = enhancer.enhanced_search("${imagePath}", strategies)
    
    if embedding:
        print("ENHANCED_EMBEDDING_READY")
        print(json.dumps(embedding))
    else:
        print("ERROR: Failed to generate enhanced embedding", file=sys.stderr)
        sys.exit(1)
        
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;
    } else {
      pythonScript = `
import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import json

try:
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    image = Image.open("${imagePath}").convert('RGB')
    inputs = processor(images=image, return_tensors="pt")
    
    with torch.no_grad():
        features = model.get_image_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
        embedding = features.cpu().numpy().flatten().tolist()
    
    print("ORIGINAL_EMBEDDING_READY")
    print(json.dumps(embedding))
    
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;
    }

    const pythonProcess = spawn(path.join(__dirname, 'clip_env', 'bin', 'python'), ['-c', pythonScript]);
    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`${mode} CLIP failed: ${errorOutput}`));
        return;
      }

      try {
        const lines = output.trim().split('\n');
        let embeddingLine = null;
        
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].startsWith('[') && lines[i].endsWith(']')) {
            embeddingLine = lines[i];
            break;
          }
        }
        
        if (embeddingLine) {
          const embedding = JSON.parse(embeddingLine);
          
          // Search against real database
          const searchResults = await searchSimilarProductsReal(embedding, 10);
          resolve(searchResults);
        } else {
          reject(new Error(`Failed to get valid ${mode} embedding`));
        }
      } catch (error) {
        reject(new Error(`Failed to parse ${mode} embedding: ${error.message}`));
      }
    });
  });
}

async function searchSimilarProductsReal(queryEmbedding, topK = 10) {
  try {
    const [embeddings] = await db.query(`
      SELECT 
        pe.product_id,
        CAST(pe.embedding AS CHAR(100000)) as embedding_text,
        p.product_name,
        IFNULL(p.brand, '') as brand,
        IFNULL(p.variety, '') as variety,
        IFNULL(p.size, '') as size
      FROM product_embeddings pe
      JOIN Products p ON pe.product_id = p.product_id
      LIMIT 500
    `);

    const similarities = [];
    
    for (const row of embeddings) {
      try {
        let embeddingText = row.embedding_text.trim();
        if (embeddingText.endsWith('...')) {
          continue;
        }
        
        const productEmbedding = JSON.parse(embeddingText);
        
        if (productEmbedding.length !== queryEmbedding.length) {
          continue;
        }
        
        if (productEmbedding.some(v => isNaN(v) || !isFinite(v))) {
          continue;
        }
        
        // Calculate cosine similarity
        let dotProduct = 0;
        let queryNorm = 0;
        let productNorm = 0;
        
        for (let i = 0; i < queryEmbedding.length; i++) {
          dotProduct += queryEmbedding[i] * productEmbedding[i];
          queryNorm += queryEmbedding[i] * queryEmbedding[i];
          productNorm += productEmbedding[i] * productEmbedding[i];
        }
        
        if (queryNorm === 0 || productNorm === 0) {
          continue;
        }
        
        const similarity = dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(productNorm));
        
        if (similarity >= -1 && similarity <= 1) {
          similarities.push({
            product_id: row.product_id,
            product_name: row.product_name,
            brand: row.brand,
            variety: row.variety,
            size: row.size,
            similarity: similarity
          });
        }
      } catch (e) {
        continue;
      }
    }

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);

  } catch (error) {
    throw new Error(`Real database search failed: ${error.message}`);
  }
}

function findProductRank(results, targetProductId) {
  for (let i = 0; i < results.length; i++) {
    if (results[i].product_id === targetProductId) {
      return i; // Return 0-based rank
    }
  }
  return -1; // Not found
}

function calculateImprovement(originalRank, enhancedRank) {
  if (originalRank === -1 && enhancedRank === -1) {
    return "No improvement (not found in either)";
  }
  if (originalRank === -1 && enhancedRank !== -1) {
    return `MAJOR IMPROVEMENT: Found at rank ${enhancedRank + 1} (was not found)`;
  }
  if (originalRank !== -1 && enhancedRank === -1) {
    return `REGRESSION: Lost from rank ${originalRank + 1}`;
  }
  if (enhancedRank < originalRank) {
    return `IMPROVED: Rank ${originalRank + 1} → ${enhancedRank + 1}`;
  }
  if (enhancedRank > originalRank) {
    return `WORSE: Rank ${originalRank + 1} → ${enhancedRank + 1}`;
  }
  return `SAME: Rank ${originalRank + 1}`;
}

function generateRealTestReport(testResults) {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('📋 REAL DATABASE CROPPING IMPROVEMENT REPORT');
  console.log('='.repeat(60));
  
  if (testResults.length === 0) {
    console.log('❌ No test results available');
    return;
  }
  
  const originalFoundCount = testResults.filter(r => r.original_found).length;
  const enhancedFoundCount = testResults.filter(r => r.enhanced_found).length;
  
  console.log(`📊 DISCOVERY RESULTS:`);
  console.log(`   Original CLIP: ${originalFoundCount}/${testResults.length} products found in top 10`);
  console.log(`   Enhanced CLIP: ${enhancedFoundCount}/${testResults.length} products found in top 10`);
  console.log(`   Improvement: ${enhancedFoundCount - originalFoundCount} additional products found`);
  
  console.log(`\n📋 DETAILED RESULTS:`);
  testResults.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.product_name} (ID: ${result.product_id}):`);
    console.log(`      ${result.improvement}`);
  });
  
  // Assessment
  console.log(`\n🎯 PROFESSOR'S REAL TEST ASSESSMENT:`);
  if (enhancedFoundCount > originalFoundCount) {
    console.log('🟢 SUCCESS: Enhanced CLIP finds more failed products!');
    console.log('✅ Cropping algorithms deliver real improvement');
    console.log('🚀 Deploy enhanced system to production');
  } else if (enhancedFoundCount === originalFoundCount) {
    console.log('🟡 NEUTRAL: Same number found, but ranks may have improved');
    console.log('💡 Check individual rank improvements');
  } else {
    console.log('🔴 CONCERN: Enhanced system found fewer products');
    console.log('🔧 Review cropping strategies or try alternative approaches');
  }
  
  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportContent = `
REAL DATABASE CROPPING IMPROVEMENT TEST
${new Date().toLocaleString()}
${'='.repeat(60)}

FAILED PRODUCTS TESTED:
${testResults.map(r => `- Product ${r.product_id}: ${r.product_name}`).join('\n')}

DISCOVERY RESULTS:
- Original CLIP: ${originalFoundCount}/${testResults.length} found
- Enhanced CLIP: ${enhancedFoundCount}/${testResults.length} found
- Net Improvement: ${enhancedFoundCount - originalFoundCount} products

DETAILED IMPROVEMENTS:
${testResults.map((r, i) => `${i+1}. ${r.product_name}: ${r.improvement}`).join('\n')}

RECOMMENDATION:
${enhancedFoundCount > originalFoundCount ? 'DEPLOY: Real improvement demonstrated' : 
  enhancedFoundCount === originalFoundCount ? 'ANALYZE: Check rank improvements' : 
  'INVESTIGATE: Fewer products found with enhanced system'}
`;

  const reportPath = path.join(__dirname, `real_cropping_test_${timestamp}.txt`);
  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n💾 Real test report saved: ${reportPath}`);
}

testRealCroppingImprovement().catch(console.error);
