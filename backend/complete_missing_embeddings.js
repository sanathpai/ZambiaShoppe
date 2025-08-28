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

    // Process missing products in smaller batches to avoid EPIPE errors
    const batchSize = 5; // Reduced from 50 to prevent memory/timeout issues
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
        console.log(`   🔧 Starting batch processing...`);
        const embeddings = await processWithCLIP(batchData);
        
        if (!embeddings || embeddings.length === 0) {
          console.log(`   ⚠️ No embeddings returned for this batch`);
          errorCount += batch.length;
          continue;
        }
        
        // Save embeddings to database
        for (const embedding of embeddings) {
          if (embedding.embedding && embedding.embedding.length > 0) {
            try {
              await db.query(`
                INSERT INTO product_embeddings (product_id, embedding, embedding_model, created_at)
                VALUES (?, ?, 'clip-vit-base-patch32', NOW())
                ON DUPLICATE KEY UPDATE 
                  embedding = VALUES(embedding),
                  created_at = NOW()
              `, [embedding.product_id, JSON.stringify(embedding.embedding)]);
              successCount++;
              console.log(`   ✅ Saved embedding for product ${embedding.product_id} (${embedding.embedding.length} dimensions)`);
            } catch (dbError) {
              console.log(`   ❌ Database error for product ${embedding.product_id}: ${dbError.message}`);
              errorCount++;
            }
          } else {
            console.log(`   ❌ Failed to generate embedding for product ${embedding.product_id}: ${embedding.error || 'Unknown error'}`);
            errorCount++;
          }
        }

        console.log(`   ✅ Batch complete: ${embeddings.filter(e => e.embedding && e.embedding.length > 0).length}/${embeddings.length} successful`);
        
        // Add a small delay between batches to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`❌ Error processing batch ${Math.floor(i/batchSize) + 1}:`, error.message);
        console.log(`   🔄 Continuing with next batch...`);
        errorCount += batch.length;
        
        // Add extra delay after errors
        await new Promise(resolve => setTimeout(resolve, 5000));
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
import io
from io import BytesIO

def process_products():
    try:
        # Load CLIP model with explicit device handling
        model_name = "openai/clip-vit-base-patch32"
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading CLIP model on {device}...", file=sys.stderr)
        
        model = CLIPModel.from_pretrained(model_name)
        processor = CLIPProcessor.from_pretrained(model_name)
        model = model.to(device)
        
        print(f"Model loaded successfully", file=sys.stderr)
        
        # Read products from stdin
        input_data = sys.stdin.read()
        products = json.loads(input_data)
        
        print(f"Processing {len(products)} products...", file=sys.stderr)
        
        results = []
        
        for i, product in enumerate(products):
            try:
                print(f"Processing product {i+1}/{len(products)}: {product['product_id']}", file=sys.stderr)
                
                # Get image
                image_url = product['image_data']
                if not image_url or image_url.strip() == '':
                    results.append({
                        'product_id': product['product_id'],
                        'embedding': [],
                        'error': 'No image URL'
                    })
                    continue
                
                # Load and process image with better error handling
                try:
                    if image_url.startswith('http'):
                        response = requests.get(image_url, timeout=15, stream=True)
                        response.raise_for_status()
                        image = Image.open(BytesIO(response.content)).convert('RGB')
                    else:
                        # Handle local file paths
                        image = Image.open(image_url).convert('RGB')
                    
                    # Resize if too large to prevent memory issues
                    if image.size[0] > 512 or image.size[1] > 512:
                        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    
                except Exception as img_error:
                    print(f"Image loading failed for {product['product_id']}: {img_error}", file=sys.stderr)
                    results.append({
                        'product_id': product['product_id'],
                        'embedding': [],
                        'error': f'Image loading failed: {str(img_error)}'
                    })
                    continue
                
                # Generate embedding with device handling
                try:
                    inputs = processor(images=image, return_tensors="pt").to(device)
                    with torch.no_grad():
                        image_features = model.get_image_features(**inputs)
                        # Normalize for cosine similarity
                        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                        embedding = image_features.squeeze().cpu().numpy().tolist()
                    
                    results.append({
                        'product_id': product['product_id'],
                        'embedding': embedding,
                        'error': None
                    })
                    print(f"Successfully processed product {product['product_id']}", file=sys.stderr)
                    
                except Exception as clip_error:
                    print(f"CLIP processing failed for {product['product_id']}: {clip_error}", file=sys.stderr)
                    results.append({
                        'product_id': product['product_id'],
                        'embedding': [],
                        'error': f'CLIP processing failed: {str(clip_error)}'
                    })
                
            except Exception as e:
                print(f"General error for product {product['product_id']}: {e}", file=sys.stderr)
                results.append({
                    'product_id': product['product_id'],
                    'embedding': [],
                    'error': str(e)
                })
        
        print(json.dumps(results))
        
    except Exception as e:
        print(f"Critical error: {e}", file=sys.stderr)
        print(json.dumps([{'error': f'Model loading failed: {str(e)}'}]))

if __name__ == "__main__":
    process_products()
`;

    // Use the virtual environment Python if available
    const pythonCmd = path.join(__dirname, 'clip_env', 'bin', 'python');
    const pythonProcess = spawn(pythonCmd, ['-c', pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000 // 5 minute timeout
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log('Python:', data.toString().trim()); // Show progress
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Python process error: ${error.message}`));
    });

    pythonProcess.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`Python process killed by signal: ${signal}`));
        return;
      }
      
      if (code !== 0) {
        reject(new Error(`Python process failed with code ${code}: ${errorOutput}`));
        return;
      }

      try {
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        
        if (lastLine.startsWith('[') && lastLine.endsWith(']')) {
          const results = JSON.parse(lastLine);
          resolve(results);
        } else {
          reject(new Error(`Invalid Python output format: ${lastLine}`));
        }
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${error.message}\nOutput: ${output}`));
      }
    });

    // Send data to Python with error handling
    try {
      pythonProcess.stdin.write(JSON.stringify(products));
      pythonProcess.stdin.end();
    } catch (error) {
      reject(new Error(`Failed to send data to Python: ${error.message}`));
    }
  });
}

completeMissingEmbeddings().catch(console.error); 