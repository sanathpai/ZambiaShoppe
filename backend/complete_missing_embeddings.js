require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');

async function completeMissingEmbeddings() {
  console.log('🔍 Finding and Processing Missing Embeddings');
  console.log('='.repeat(60));

  try {
    // Find products that don't have embeddings yet
    console.log('📊 Checking for missing embeddings...');
    const [missingProducts] = await db.query(`
      SELECT p.product_id, p.product_name, 
             IFNULL(p.brand, '') as brand, 
             IFNULL(p.variety, '') as variety, 
             IFNULL(p.size, '') as size,
             COALESCE(p.image_s3_url, p.image) as image_data
      FROM Products p
      LEFT JOIN product_embeddings pe ON p.product_id = pe.product_id
      WHERE pe.product_id IS NULL
      AND (p.image IS NOT NULL OR p.image_s3_url IS NOT NULL)
      AND COALESCE(p.image_s3_url, p.image) != ''
      ORDER BY p.product_id
    `);

    console.log(`\n📈 Found ${missingProducts.length} products missing embeddings`);
    
    if (missingProducts.length === 0) {
      console.log('✅ All products already have embeddings!');
      
      // Show total statistics
      const [totalStats] = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM Products WHERE image IS NOT NULL OR image_s3_url IS NOT NULL) as total_products_with_images,
          (SELECT COUNT(*) FROM product_embeddings) as total_embeddings
      `);
      
      console.log(`\n📊 Database Statistics:`);
      console.log(`   Products with images: ${totalStats[0].total_products_with_images}`);
      console.log(`   Products with embeddings: ${totalStats[0].total_embeddings}`);
      console.log(`   Coverage: ${((totalStats[0].total_embeddings / totalStats[0].total_products_with_images) * 100).toFixed(1)}%`);
      
      return;
    }

    // Process missing products in batches
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < missingProducts.length; i += batchSize) {
      const batch = missingProducts.slice(i, i + batchSize);
      console.log(`\n🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missingProducts.length/batchSize)} (${batch.length} products)`);

      // Prepare batch data for Python
      const batchData = batch.map(product => ({
        product_id: product.product_id,
        product_name: product.product_name || '',
        brand: product.brand || '',
        variety: product.variety || '',
        size: product.size || '',
        image_data: product.image_data || ''
      }));

      try {
        const embeddings = await processWithCLIP(batchData);
        
        // Save embeddings to database
        for (const embedding of embeddings) {
          if (embedding.embedding && embedding.embedding.length > 0) {
            await db.query(`
              INSERT INTO product_embeddings (product_id, embedding, embedding_model, created_at)
              VALUES (?, ?, 'clip-vit-base-patch32', NOW())
              ON DUPLICATE KEY UPDATE 
                embedding = VALUES(embedding),
                created_at = NOW()
            `, [embedding.product_id, JSON.stringify(embedding.embedding)]);
            successCount++;
          } else {
            console.log(`❌ Failed to generate embedding for product ${embedding.product_id}`);
            errorCount++;
          }
        }

        console.log(`   ✅ Processed ${embeddings.length} products in this batch`);
        
      } catch (error) {
        console.error(`❌ Error processing batch:`, error.message);
        errorCount += batch.length;
      }

      // Progress update
      const processed = Math.min(i + batchSize, missingProducts.length);
      console.log(`   📊 Progress: ${processed}/${missingProducts.length} (${((processed/missingProducts.length)*100).toFixed(1)}%)`);
    }

    console.log(`\n🎉 Missing Embeddings Processing Complete!`);
    console.log(`   ✅ Successfully added: ${successCount} embeddings`);
    console.log(`   ❌ Failed: ${errorCount} products`);
    
    // Final statistics
    const [finalStats] = await db.query(`
      SELECT COUNT(*) as total_embeddings FROM product_embeddings
    `);
    
    console.log(`\n📊 Updated Database Statistics:`);
    console.log(`   Total embeddings in database: ${finalStats[0].total_embeddings}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.end();
  }
}

function processWithCLIP(products) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import requests
import json
import sys
import numpy as np
import traceback

def process_products():
    try:
        # Load CLIP model
        model_name = "openai/clip-vit-base-patch32"
        model = CLIPModel.from_pretrained(model_name)
        processor = CLIPProcessor.from_pretrained(model_name)
        
        # Read products from stdin
        input_data = sys.stdin.read()
        products = json.loads(input_data)
        
        results = []
        
        for product in products:
            try:
                # Get image
                image_url = product['image_data']
                if not image_url:
                    results.append({
                        'product_id': product['product_id'],
                        'embedding': [],
                        'error': 'No image URL'
                    })
                    continue
                
                # Load and process image
                if image_url.startswith('http'):
                    response = requests.get(image_url, timeout=10)
                    image = Image.open(response.content).convert('RGB')
                else:
                    image = Image.open(image_url).convert('RGB')
                
                # Generate embedding
                inputs = processor(images=image, return_tensors="pt")
                with torch.no_grad():
                    image_features = model.get_image_features(**inputs)
                    embedding = image_features.squeeze().numpy().tolist()
                
                results.append({
                    'product_id': product['product_id'],
                    'embedding': embedding,
                    'error': None
                })
                
            except Exception as e:
                results.append({
                    'product_id': product['product_id'],
                    'embedding': [],
                    'error': str(e)
                })
        
        print(json.dumps(results))
        
    except Exception as e:
        print(json.dumps([{'error': f'Model loading failed: {str(e)}'}]))

if __name__ == "__main__":
    process_products()
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process failed: ${errorOutput}`));
        return;
      }

      try {
        const results = JSON.parse(output);
        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${error.message}`));
      }
    });

    // Send data to Python
    pythonProcess.stdin.write(JSON.stringify(products));
    pythonProcess.stdin.end();
  });
}

completeMissingEmbeddings().catch(console.error); 