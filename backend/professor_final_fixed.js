require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');

async function professorFinalFixed() {
  console.log('🎓 Professor CLIP Test - FIXED VERSION');
  console.log('='.repeat(60));
  console.log('✅ Using 1,855 pre-computed embeddings for instant search');
  console.log('🎯 Goal: Show actual top 5 matches for professor\'s test images\n');

  const testImageFolder = '/Users/soha/Downloads';
  const testImages = [
    'test1.jpg', 'test2.jpg', 'test3.jpg', 
    'test4.jpg', 'test5.jpg', 'test6.jpg'
  ];

  try {
    // Verify embeddings are available
    const [embeddingCount] = await db.query('SELECT COUNT(*) as count FROM product_embeddings');
    console.log(`📊 Found ${embeddingCount[0].count} pre-computed embeddings\n`);

    const allResults = [];

    for (const imageFile of testImages) {
      const imagePath = path.join(testImageFolder, imageFile);
      
      if (!fs.existsSync(imagePath)) {
        console.log(`❌ Image not found: ${imageFile}`);
        continue;
      }

      console.log(`🔍 Processing: ${imageFile}`);
      console.log('-'.repeat(40));

      try {
        const startTime = Date.now();
        
        // Get query embedding using CLIP
        const queryEmbedding = await getQueryEmbedding(imagePath);
        console.log('   ✅ Query embedding computed');
        
        // Search against pre-computed embeddings
        const results = await searchSimilarProducts(queryEmbedding, 5);
        
        const searchTime = Date.now() - startTime;
        console.log(`   ⚡ Search completed in ${searchTime}ms`);
        console.log(`   📋 Found ${results.length} matches\n`);

        // Display results
        if (results.length > 0) {
          console.log('   🎯 Top 5 matches:');
          results.forEach((result, index) => {
            let display = `${result.product_name}`;
            if (result.brand) display += ` (${result.brand})`;
            
            const details = [];
            if (result.variety) details.push(result.variety);
            if (result.size) details.push(result.size);
            if (details.length > 0) display += ` - ${details.join(', ')}`;
            
            console.log(`      ${index + 1}. ${display} (${(result.similarity * 100).toFixed(1)}%)`);
          });
        } else {
          console.log('   ❌ No matches found');
        }
        
        console.log('');
        
        allResults.push({
          imageFile,
          results,
          searchTime,
          success: true
        });
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        allResults.push({
          imageFile,
          error: error.message,
          success: false
        });
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📊 PROFESSOR TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    const successful = allResults.filter(r => r.success);
    const avgTime = successful.length > 0 ? 
      successful.reduce((sum, r) => sum + r.searchTime, 0) / successful.length : 0;

    console.log(`✅ Successfully processed: ${successful.length}/${testImages.length} images`);
    console.log(`⚡ Average search time: ${avgTime.toFixed(0)}ms`);
    console.log(`📊 Database size: ${embeddingCount[0].count} products with embeddings`);
    
    // Top 5 accuracy analysis
    let imagesWithMatches = 0;
    successful.forEach(result => {
      if (result.results.length > 0) {
        imagesWithMatches++;
      }
    });
    
    const top5Coverage = (imagesWithMatches / successful.length) * 100;
    console.log(`🎯 Images with matches: ${imagesWithMatches}/${successful.length} (${top5Coverage.toFixed(1)}%)`);
    
    if (top5Coverage >= 80) {
      console.log('🟢 SUCCESS: Achieved professor\'s 80-90% target!');
    } else {
      console.log('🟡 PARTIAL: Below 80% target - may need optimization');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.end();
  }
}

function getQueryEmbedding(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import json

try:
    # Load CLIP model
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    # Process image
    image = Image.open("${imagePath}").convert('RGB')
    inputs = processor(images=image, return_tensors="pt")
    
    with torch.no_grad():
        features = model.get_image_features(**inputs)
        # Normalize for cosine similarity
        features = features / features.norm(dim=-1, keepdim=True)
        embedding = features.cpu().numpy().flatten().tolist()
    
    print(json.dumps(embedding))
    
except Exception as e:
    print(f"ERROR: {e}")
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript]);
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
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine.startsWith('[') && lastLine.endsWith(']')) {
          const embedding = JSON.parse(lastLine);
          resolve(embedding);
        } else {
          reject(new Error('Failed to get valid embedding'));
        }
      } catch (error) {
        reject(new Error(`Failed to parse embedding: ${error.message}`));
      }
    });
  });
}

async function searchSimilarProducts(queryEmbedding, topK = 5) {
  try {
    // Get all pre-computed embeddings
    const [embeddings] = await db.query(`
      SELECT 
        pe.product_id,
        pe.embedding,
        p.product_name,
        IFNULL(p.brand, '') as brand,
        IFNULL(p.variety, '') as variety,
        IFNULL(p.size, '') as size
      FROM product_embeddings pe
      JOIN Products p ON pe.product_id = p.product_id
      LIMIT 1855
    `);

    console.log(`   🔍 Computing similarities against ${embeddings.length} products...`);

    const similarities = [];
    
    for (const row of embeddings) {
      try {
        const productEmbedding = JSON.parse(row.embedding);
        
        // Ensure both embeddings have the same length
        if (productEmbedding.length !== queryEmbedding.length) {
          continue;
        }
        
        // Cosine similarity calculation
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
        
        // Only include reasonable similarities
        if (similarity > -1 && similarity <= 1) {
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
        // Skip malformed embeddings
        continue;
      }
    }

    // Sort by similarity (highest first) and return top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, topK);
    
    console.log(`   ✅ Computed ${similarities.length} similarities, returning top ${topResults.length}`);
    
    return topResults;

  } catch (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
}

professorFinalFixed().catch(console.error); 