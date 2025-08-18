require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const db = require('./config/db');

async function quickClipTest(imagePath) {
  console.log('⚡ Quick CLIP Test (Limited Database)');
  console.log('='.repeat(50));
  console.log(`🔍 Testing: ${path.basename(imagePath)}\n`);

  try {
    // Get only 50 random products to make it faster
    const [products] = await db.query(`
      SELECT product_id, product_name, brand, variety, size,
             COALESCE(image_s3_url, image) as image_data
      FROM Products 
      WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
      ORDER BY RAND()
      LIMIT 50
    `);

    console.log(`📦 Testing against ${products.length} products (random sample)`);
    
    const results = await runQuickClip(imagePath, products);
    
    console.log('\n📋 Top 5 matches:');
    console.log('-'.repeat(30));
    
    results.forEach((result, index) => {
      let formatted = result.product_name;
      
      if (result.brand) {
        formatted += ` (${result.brand})`;
      }
      
      const details = [];
      if (result.variety) details.push(result.variety);
      if (result.size) details.push(result.size);
      
      if (details.length > 0) {
        formatted += ` - ${details.join(', ')}`;
      }
      
      console.log(`${index + 1}. ${formatted}`);
      console.log(`   Similarity: ${result.similarity.toFixed(3)}`);
    });
    
    return results;

  } catch (error) {
    console.error('❌ Quick test failed:', error);
    throw error;
  }
}

async function runQuickClip(queryImagePath, products) {
  return new Promise((resolve, reject) => {
    console.log('🧠 Running quick CLIP analysis...');
    
    const pythonScript = `
import sys
import os
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
    print(f"Error importing: {e}")
    sys.exit(1)

class QuickCLIP:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
    def setup_clip(self):
        print("Loading CLIP model...")
        try:
            self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32", use_fast=False)
            self.model.to(self.device)
            print("✅ CLIP model loaded")
        except Exception as e:
            print(f"Error loading CLIP: {e}")
            raise
            
    def get_image_embedding(self, image_path):
        try:
            image = Image.open(image_path).convert('RGB')
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                
            return image_features.cpu().numpy().flatten()
        except Exception as e:
            print(f"Error getting embedding: {e}")
            raise
            
    def load_image_from_data(self, image_data):
        try:
            if image_data.startswith('data:image/'):
                header, data = image_data.split(',', 1)
                image_bytes = base64.b64decode(data)
                return Image.open(io.BytesIO(image_bytes)).convert('RGB')
            elif image_data.startswith('http'):
                import requests
                response = requests.get(image_data, timeout=10)
                return Image.open(io.BytesIO(response.content)).convert('RGB')
            else:
                raise ValueError("Invalid image format")
        except Exception as e:
            print(f"Error loading image data: {e}")
            raise
            
    def get_embedding_from_data(self, image_data):
        try:
            image = self.load_image_from_data(image_data)
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                
            return image_features.cpu().numpy().flatten()
        except Exception as e:
            print(f"Error getting embedding from data: {e}")
            raise
            
    def cosine_similarity(self, vec1, vec2):
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
        
    def find_similar(self, query_image_path, products_data):
        try:
            query_embedding = self.get_image_embedding(query_image_path)
            similarities = []
            
            print(f"🔍 Comparing against {len(products_data)} products...")
            
            for i, product in enumerate(products_data):
                try:
                    if i % 10 == 0:
                        print(f"   Progress: {i+1}/{len(products_data)}")
                    
                    product_embedding = self.get_embedding_from_data(product['image_data'])
                    similarity = self.cosine_similarity(query_embedding, product_embedding)
                    
                    similarities.append({
                        'product_id': product['product_id'],
                        'product_name': product['product_name'],
                        'brand': product['brand'],
                        'variety': product['variety'],
                        'size': product['size'],
                        'similarity': float(similarity)
                    })
                except Exception as e:
                    print(f"   ⚠️ Error with product {product['product_id']}: {e}")
                    continue
            
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            return similarities[:5]
            
        except Exception as e:
            print(f"Error in similarity search: {e}")
            raise

# Main execution
try:
    clip = QuickCLIP()
    clip.setup_clip()
    
    // Parse products data from Node.js
    products_data = ${JSON.stringify(products)}
    
    results = clip.find_similar("${queryImagePath}", products_data)
    print(json.dumps(results, indent=2))
    
except Exception as e:
    print(f"Script failed: {e}")
    sys.exit(1)
    `;

    const fs = require('fs');
    const tempScriptPath = path.join(__dirname, 'temp_quick_clip.py');
    fs.writeFileSync(tempScriptPath, pythonScript);

    const pythonProcess = spawn('bash', ['-c', 
      `source ${path.join(__dirname, 'clip_env/bin/activate')} && python3 ${tempScriptPath}`
    ]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      process.stdout.write(data); // Show progress in real-time
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) {}

      if (code === 0) {
        try {
          // Extract JSON from the output
          const jsonMatch = outputData.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const results = JSON.parse(jsonMatch[0]);
            resolve(results);
          } else {
            reject(new Error('No JSON results found in output'));
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          reject(new Error('Failed to parse results'));
        }
      } else {
        reject(new Error(`Python script failed: ${errorData}`));
      }
    });
  });
}

// Run if called directly
if (require.main === module) {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.log('Usage: node quick_clip_test.js <image_path>');
    process.exit(1);
  }

  quickClipTest(imagePath)
    .then(() => {
      console.log('\n✅ Quick test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { quickClipTest }; 