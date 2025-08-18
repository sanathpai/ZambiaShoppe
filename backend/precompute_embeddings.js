require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');

async function precomputeAllEmbeddings() {
  console.log('🚀 Pre-computing CLIP Embeddings for Production');
  console.log('='.repeat(60));
  console.log('📊 This will process ALL products in the database');
  console.log('⚡ After this, similarity search will be instant!\n');

  try {
    // Create embeddings table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_embeddings (
        product_id INT PRIMARY KEY,
        embedding JSON NOT NULL,
        embedding_model VARCHAR(100) DEFAULT 'clip-vit-base-patch32',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES Products(product_id)
      )
    `);

    // Get all products with images (clean query)
    console.log('📂 Loading all products with images...');
    const [allProducts] = await db.query(`
      SELECT product_id, product_name, 
             IFNULL(brand, '') as brand, 
             IFNULL(variety, '') as variety, 
             IFNULL(size, '') as size,
             COALESCE(image_s3_url, image) as image_data
      FROM Products 
      WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
      AND COALESCE(image_s3_url, image) != ''
      ORDER BY product_id
    `);

    console.log(`✅ Found ${allProducts.length} products with images`);

    // Check which products already have embeddings
    const [existingEmbeddings] = await db.query(`
      SELECT product_id FROM product_embeddings
    `);
    const existingIds = new Set(existingEmbeddings.map(e => e.product_id));
    
    const productsToProcess = allProducts.filter(p => !existingIds.has(p.product_id));
    console.log(`📝 Need to process ${productsToProcess.length} new products`);
    console.log(`⏭️  Already have embeddings for ${existingIds.size} products\n`);

    if (productsToProcess.length === 0) {
      console.log('🎉 All embeddings are already computed!');
      return;
    }

    // Process in batches for stability
    const batchSize = 10;
    let processed = 0;
    
    for (let i = 0; i < productsToProcess.length; i += batchSize) {
      const batch = productsToProcess.slice(i, i + batchSize);
      
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(productsToProcess.length/batchSize)}`);
      console.log(`   Products ${i + 1}-${Math.min(i + batchSize, productsToProcess.length)} of ${productsToProcess.length}`);
      
      try {
        const embeddings = await computeBatchEmbeddings(batch);
        
        // Save embeddings to database
        for (const embedding of embeddings) {
          if (embedding.success) {
            await db.query(`
              INSERT INTO product_embeddings (product_id, embedding) 
              VALUES (?, ?)
              ON DUPLICATE KEY UPDATE 
              embedding = VALUES(embedding),
              created_at = CURRENT_TIMESTAMP
            `, [embedding.product_id, JSON.stringify(embedding.embedding)]);
            
            processed++;
            console.log(`   ✅ Saved embedding for product ${embedding.product_id}`);
          } else {
            console.log(`   ❌ Failed for product ${embedding.product_id}: ${embedding.error}`);
          }
        }
        
        console.log(`   📊 Batch complete. Total processed: ${processed}/${productsToProcess.length}\n`);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Batch failed:`, error.message);
        continue;
      }
    }

    console.log('='.repeat(60));
    console.log('🎉 EMBEDDING GENERATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`✅ Successfully processed: ${processed} products`);
    console.log(`📊 Total embeddings in database: ${processed + existingIds.size}`);
    console.log(`🚀 Ready for instant similarity search!`);

    return { processed, total: allProducts.length };

  } catch (error) {
    console.error('❌ Pre-computation failed:', error);
    throw error;
  }
}

async function computeBatchEmbeddings(products) {
  return new Promise((resolve, reject) => {
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
    import requests
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

class EmbeddingComputer:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cpu"
        
    def setup(self):
        print("Loading CLIP model for embedding computation...")
        self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        print("✅ CLIP model loaded successfully")
            
    def get_embedding_from_url(self, image_url):
        try:
            response = requests.get(image_url, timeout=15)
            image = Image.open(io.BytesIO(response.content)).convert('RGB')
            
            inputs = self.processor(images=image, return_tensors="pt")
            with torch.no_grad():
                features = self.model.get_image_features(**inputs)
                features = features / features.norm(dim=-1, keepdim=True)
            
            return features.cpu().numpy().flatten().tolist()
        except Exception as e:
            raise Exception(f"Failed to process image: {str(e)}")

products_data = ${JSON.stringify(products)}

try:
    computer = EmbeddingComputer()
    computer.setup()
    
    results = []
    
    for i, product in enumerate(products_data):
        print(f"Processing product {i+1}/{len(products_data)}: {product['product_id']}")
        
        try:
            if product['image_data'] and product['image_data'].startswith('http'):
                embedding = computer.get_embedding_from_url(product['image_data'])
                
                results.append({
                    'product_id': product['product_id'],
                    'embedding': embedding,
                    'success': True
                })
                print(f"✅ Success for product {product['product_id']}")
            else:
                results.append({
                    'product_id': product['product_id'],
                    'success': False,
                    'error': 'Invalid image URL'
                })
                print(f"❌ Invalid image URL for product {product['product_id']}")
                
        except Exception as e:
            results.append({
                'product_id': product['product_id'],
                'success': False,
                'error': str(e)
            })
            print(f"❌ Error for product {product['product_id']}: {str(e)}")
    
    print("BATCH_COMPLETE")
    print(json.dumps(results))
    
except Exception as e:
    print(f"BATCH_FAILED: {e}")
    sys.exit(1)
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript]);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString();
      outputData += text;
      
      // Show progress
      if (text.includes('Processing product') || text.includes('✅') || text.includes('❌')) {
        console.log('   ', text.trim());
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Find the JSON result
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
            reject(new Error('No valid results found'));
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          reject(new Error('Failed to parse batch results'));
        }
      } else {
        console.error('Python error:', errorData);
        reject(new Error('Batch processing failed'));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(error);
    });
  });
}

// Run if called directly
if (require.main === module) {
  precomputeAllEmbeddings()
    .then((results) => {
      console.log(`\n🎉 Embedding generation completed successfully!`);
      if (results) {
        console.log(`📊 Processed ${results.processed} new embeddings`);
        console.log(`📈 Total database now has ${results.total} products with embeddings`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Embedding generation failed:', error.message);
      process.exit(1);
    });
}

module.exports = { precomputeAllEmbeddings }; 