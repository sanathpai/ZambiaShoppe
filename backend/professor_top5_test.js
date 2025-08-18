require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');

async function professorTop5Test() {
  console.log('🎓 Professor CLIP Top-5 Test Results');
  console.log('='.repeat(60));
  console.log('Testing: Top 5 matches for professor\'s test images');
  console.log('Goal: Verify 80-90% accuracy (at least 1 correct match in top 5)\n');

  const testImageFolder = '/Users/soha/Downloads';
  const testImages = [
    'test1.jpg', 'test2.jpg', 'test3.jpg', 
    'test4.jpg', 'test5.jpg', 'test6.jpg'
  ];

  try {
    // Get all products from database for similarity comparison
    console.log('📂 Loading product database...');
    const [allProducts] = await db.query(`
      SELECT product_id, product_name, brand, variety, size, user_id,
             COALESCE(image_s3_url, image) as image_data
      FROM Products 
      WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
      ORDER BY product_id
    `);

    console.log(`✅ Loaded ${allProducts.length} products with images\n`);

    const allResults = [];

    // Process each professor test image
    for (let i = 0; i < testImages.length; i++) {
      const imageFile = testImages[i];
      const imagePath = path.join(testImageFolder, imageFile);
      
      if (!fs.existsSync(imagePath)) {
        console.log(`⚠️  ${imageFile} not found, skipping`);
        continue;
      }

      console.log(`🔍 Processing ${i + 1}/${testImages.length}: ${imageFile}`);
      console.log('-'.repeat(50));

      try {
        const top5Results = await runClipTop5Analysis(imagePath, allProducts);
        
        console.log(`📋 Top 5 matches for ${imageFile}:`);
        top5Results.forEach((result, index) => {
          const formattedName = formatProductName(result);
          console.log(`${index + 1}. ${formattedName} (similarity: ${result.similarity.toFixed(3)})`);
        });
        
        allResults.push({
          imageFile: imageFile,
          imagePath: imagePath,
          results: top5Results.map(r => ({
            ...r,
            formatted: formatProductName(r)
          }))
        });
        
        console.log('✅ Completed successfully\n');
        
      } catch (error) {
        console.log(`❌ Error processing ${imageFile}: ${error.message}\n`);
        allResults.push({
          imageFile: imageFile,
          imagePath: imagePath,
          error: error.message
        });
      }
    }

    // Test top-K accuracy
    console.log('='.repeat(60));
    console.log('📊 TOP-K ACCURACY ANALYSIS');
    console.log('='.repeat(60));
    
    await testTopKAccuracy();

    // Generate final summary report
    console.log('\n' + '='.repeat(60));
    console.log('📋 PROFESSOR\'S TEST IMAGE RESULTS SUMMARY');
    console.log('='.repeat(60));

    allResults.forEach((result, index) => {
      console.log(`\n${index + 1}. IMAGE: ${result.imageFile}`);
      console.log('-'.repeat(30));
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else {
        console.log('Top 5 matches:');
        result.results.forEach((match, matchIndex) => {
          console.log(`   ${matchIndex + 1}. ${match.formatted}`);
        });
      }
    });

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputFile = path.join(__dirname, `professor_clip_results_${timestamp}.txt`);
    
    let reportContent = 'CLIP Top-5 Analysis Results for Professor Shenoy\n';
    reportContent += '='.repeat(50) + '\n';
    reportContent += `Date: ${new Date().toLocaleString()}\n`;
    reportContent += `Images processed: ${allResults.length}\n\n`;

    allResults.forEach((result, index) => {
      reportContent += `${index + 1}. IMAGE: ${result.imageFile}\n`;
      reportContent += '-'.repeat(30) + '\n';
      
      if (result.error) {
        reportContent += `Error: ${result.error}\n\n`;
      } else {
        reportContent += 'Top 5 matches:\n';
        result.results.forEach((match, matchIndex) => {
          reportContent += `   ${matchIndex + 1}. ${match.formatted}\n`;
        });
        reportContent += '\n';
      }
    });

    fs.writeFileSync(outputFile, reportContent);
    console.log(`\n💾 Results saved to: ${outputFile}`);
    console.log('\n🎉 Professor test completed successfully!');

    return allResults;

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    if (db) {
      await db.end();
    }
  }
}

async function runClipTop5Analysis(queryImagePath, products) {
  return new Promise((resolve, reject) => {
    console.log('🧠 Running CLIP analysis...');
    
    // Clean products data and handle null values properly
    const cleanProducts = products.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name || '',
      brand: p.brand || '',
      variety: p.variety || '',
      size: p.size || '',
      user_id: p.user_id || 0,
      image_data: p.image_data || ''
    }));

    const pythonScript = `
import sys
import json
import base64
import io
import warnings
warnings.filterwarnings("ignore")

try:
    import torch
    import numpy as np
    from PIL import Image
    from transformers import CLIPProcessor, CLIPModel
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

class ClipMatcher:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cpu"  # Use CPU for stability
        
    def setup(self):
        print("Loading CLIP model...")
        try:
            self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            print("✅ CLIP loaded successfully")
        except Exception as e:
            print(f"CLIP loading error: {e}")
            raise
            
    def get_embedding(self, image_path):
        try:
            image = Image.open(image_path).convert('RGB')
            inputs = self.processor(images=image, return_tensors="pt")
            
            with torch.no_grad():
                features = self.model.get_image_features(**inputs)
                features = features / features.norm(dim=-1, keepdim=True)
                
            return features.cpu().numpy().flatten()
        except Exception as e:
            print(f"Embedding error for {image_path}: {e}")
            raise
            
    def get_embedding_from_data(self, image_data):
        try:
            if image_data.startswith('data:image/'):
                header, data = image_data.split(',', 1)
                image_bytes = base64.b64decode(data)
                image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            elif image_data.startswith('http'):
                import requests
                response = requests.get(image_data, timeout=15)
                image = Image.open(io.BytesIO(response.content)).convert('RGB')
            else:
                raise ValueError("Invalid image format")
                
            inputs = self.processor(images=image, return_tensors="pt")
            
            with torch.no_grad():
                features = self.model.get_image_features(**inputs)
                features = features / features.norm(dim=-1, keepdim=True)
                
            return features.cpu().numpy().flatten()
        except Exception as e:
            return None  # Skip problematic images
            
    def similarity(self, vec1, vec2):
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

# Process the data
products_data = ${JSON.stringify(cleanProducts)}
query_image_path = "${queryImagePath}"

try:
    matcher = ClipMatcher()
    matcher.setup()
    
    print(f"Getting query embedding from: {query_image_path}")
    query_embedding = matcher.get_embedding(query_image_path)
    
    print(f"Processing {len(products_data)} products...")
    similarities = []
    
    for i, product in enumerate(products_data):
        if i % 10 == 0:
            print(f"Progress: {i}/{len(products_data)}")
            
        try:
            if not product['image_data']:
                continue
                
            product_embedding = matcher.get_embedding_from_data(product['image_data'])
            if product_embedding is not None:
                similarity = matcher.similarity(query_embedding, product_embedding)
                
                similarities.append({
                    'product_id': product['product_id'],
                    'product_name': product['product_name'],
                    'brand': product['brand'],
                    'variety': product['variety'],
                    'size': product['size'],
                    'similarity': float(similarity)
                })
        except Exception as e:
            continue  # Skip problematic products
    
    # Sort by similarity and get top 5
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    top5 = similarities[:5]
    
    print(f"Found {len(similarities)} valid matches, returning top 5")
    print(json.dumps(top5))
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
`;

    // Run Python script
    const pythonProcess = spawn('python3', ['-c', pythonScript]);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString();
      outputData += text;
      
      // Show progress messages
      if (text.includes('Progress:') || text.includes('Loading') || text.includes('✅')) {
        console.log('   ', text.trim());
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Extract JSON from the output
          const lines = outputData.trim().split('\n');
          let jsonResult = null;
          
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('[') && line.endsWith(']')) {
              jsonResult = JSON.parse(line);
              break;
            }
          }
          
          if (jsonResult) {
            resolve(jsonResult);
          } else {
            throw new Error('No valid JSON result found');
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          console.error('Output was:', outputData);
          reject(new Error('Failed to parse results'));
        }
      } else {
        console.error('Python error:', errorData);
        reject(new Error(`CLIP analysis failed with code ${code}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
}

function formatProductName(product) {
  let name = product.product_name || 'Unknown Product';
  
  if (product.brand) {
    name += ` (${product.brand})`;
  }
  
  const details = [];
  if (product.variety) details.push(product.variety);
  if (product.size) details.push(product.size);
  
  if (details.length > 0) {
    name += ` - ${details.join(', ')}`;
  }
  
  return name;
}

async function testTopKAccuracy() {
  console.log('🎯 Testing Top-K Accuracy (Professor\'s Success Metric)');
  console.log('Testing: Does at least 1 correct match appear in top 5 results?\n');

  try {
    // Get duplicate groups for testing
    const [duplicateGroups] = await db.query(`
      SELECT product_name, brand, variety, COUNT(*) as count
      FROM Products 
      WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
      GROUP BY product_name, brand, variety
      HAVING count > 1
      ORDER BY count DESC
      LIMIT 8
    `);

    let totalTests = 0;
    let successfulTests = 0;

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
        LIMIT 5
      `, [group.product_name, group.brand, group.brand, group.variety, group.variety]);

      if (groupProducts.length < 2) {
        console.log('   ⏭️  Not enough products, skipping\n');
        continue;
      }

      // Test first product as query
      const queryProduct = groupProducts[0];
      const otherProducts = groupProducts.slice(1);
      
      console.log(`   📷 Testing product ${queryProduct.product_id} against database`);
      
      try {
        // Get all products for comparison
        const [allProducts] = await db.query(`
          SELECT product_id, product_name, brand, variety, size,
                 COALESCE(image_s3_url, image) as image_data
          FROM Products 
          WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
          LIMIT 100
        `);

        // Create a temporary image file from the query product's data
        const tempImagePath = path.join(__dirname, `temp_query_${queryProduct.product_id}.jpg`);
        
        if (queryProduct.image_data.startsWith('http')) {
          // Download S3 image
          const https = require('https');
          const file = fs.createWriteStream(tempImagePath);
          https.get(queryProduct.image_data, (response) => {
            response.pipe(file);
            file.on('finish', async () => {
              file.close();
              await performAccuracyTest();
            });
          });
        } else {
          // Handle base64 data
          const base64Data = queryProduct.image_data.replace(/^data:image\/[a-z]+;base64,/, '');
          fs.writeFileSync(tempImagePath, base64Data, 'base64');
          await performAccuracyTest();
        }

        async function performAccuracyTest() {
          try {
            const top5Results = await runClipTop5Analysis(tempImagePath, allProducts);
            
            // Check if any of the same-group products appear in top 5
            const hasMatch = top5Results.some(result => 
              otherProducts.some(other => other.product_id === result.product_id)
            );
            
            totalTests++;
            if (hasMatch) {
              successfulTests++;
              console.log('   ✅ SUCCESS: Correct match found in top 5');
            } else {
              console.log('   ❌ MISS: No correct match in top 5');
            }
            
            // Clean up temp file
            if (fs.existsSync(tempImagePath)) {
              fs.unlinkSync(tempImagePath);
            }
            
          } catch (error) {
            console.log(`   ⚠️  Error in accuracy test: ${error.message}`);
          }
        }
        
      } catch (error) {
        console.log(`   ⚠️  Error testing product ${queryProduct.product_id}: ${error.message}`);
      }
      
      console.log(''); // Empty line for readability
    }

    const accuracy = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
    
    console.log('📊 TOP-K ACCURACY RESULTS');
    console.log('-'.repeat(30));
    console.log(`🎯 Success Rate: ${accuracy.toFixed(1)}% (${successfulTests}/${totalTests})`);
    console.log(`📋 Target: 80-90% for production readiness`);
    
    if (accuracy >= 80) {
      console.log('🟢 EXCELLENT: Ready for production use!');
    } else if (accuracy >= 70) {
      console.log('🟡 GOOD: Close to target, minor improvements could help');
    } else {
      console.log('🔴 NEEDS WORK: Below target, significant improvements needed');
    }

    console.log('\n💡 This metric answers the professor\'s key question:');
    console.log('   "Will users see at least 1 correct product in the top 3-5 suggestions?"');
    
  } catch (error) {
    console.error('❌ Accuracy test failed:', error);
  }
}

// Main execution
if (require.main === module) {
  professorTop5Test()
    .then((results) => {
      console.log(`\n🎉 Successfully processed ${results.length} test images!`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { professorTop5Test, runClipTop5Analysis }; 