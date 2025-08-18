const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');

// CLIP image similarity search endpoint
router.post('/search', async (req, res) => {
  console.log('🔍 CLIP search request received');
  
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    // Validate image format
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }
    
    // Generate temporary file for the image
    const tempId = crypto.randomBytes(16).toString('hex');
    const tempImagePath = path.join(__dirname, '..', 'temp', `clip_query_${tempId}.jpg`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempImagePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save image to temporary file
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(tempImagePath, base64Data, 'base64');
    
    console.log('📸 Temporary image saved:', tempImagePath);
    
    // Get CLIP embedding for the query image
    const queryEmbedding = await getQueryEmbedding(tempImagePath);
    console.log('✅ Query embedding computed');
    
    // Search similar products in database
    const similarProducts = await searchSimilarProducts(queryEmbedding, 5);
    console.log(`🎯 Found ${similarProducts.length} similar products`);
    
    // Clean up temporary file
    try {
      fs.unlinkSync(tempImagePath);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temp file:', cleanupError);
    }
    
    // Return results
    res.json({
      success: true,
      results: similarProducts,
      count: similarProducts.length
    });
    
  } catch (error) {
    console.error('❌ CLIP search error:', error);
    
    // Clean up temporary file on error
    if (req.body?.image) {
      try {
        const tempFiles = fs.readdirSync(path.join(__dirname, '..', 'temp'))
          .filter(file => file.startsWith('clip_query_'));
        tempFiles.forEach(file => {
          try {
            fs.unlinkSync(path.join(__dirname, '..', 'temp', file));
          } catch (e) {
            // Silent cleanup
          }
        });
      } catch (e) {
        // Silent cleanup
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to search similar products',
      details: error.message 
    });
  }
});

function getQueryEmbedding(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import json
import sys

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
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

    const pythonProcess = spawn(path.join(__dirname, '..', 'clip_env', 'bin', 'python'), ['-c', pythonScript], {
      cwd: path.join(__dirname, '..')
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
    // Get pre-computed embeddings from database  
    const [embeddings] = await db.query(`
      SELECT 
        pe.product_id,
        CAST(pe.embedding AS CHAR(100000)) as embedding_text,
        p.product_name,
        IFNULL(p.brand, '') as brand,
        IFNULL(p.variety, '') as variety,
        IFNULL(p.size, '') as size,
        COALESCE(p.image_s3_url, p.image) as image_url
      FROM product_embeddings pe
      JOIN Products p ON pe.product_id = p.product_id
      LIMIT 500
    `);

    console.log(`🔍 Computing similarities against ${embeddings.length} products...`);

    const similarities = [];
    let validCount = 0;
    
    for (const row of embeddings) {
      try {
        // Parse the embedding
        let embeddingText = row.embedding_text.trim();
        if (embeddingText.endsWith('...')) {
          continue; // Skip truncated embeddings
        }
        
        const productEmbedding = JSON.parse(embeddingText);
        
        // Ensure matching dimensions
        if (productEmbedding.length !== queryEmbedding.length) {
          continue;
        }
        
        // Verify valid numbers
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
        
        // Only include valid similarities
        if (similarity >= -1 && similarity <= 1) {
          similarities.push({
            product_id: row.product_id,
            product_name: row.product_name,
            brand: row.brand,
            variety: row.variety,
            size: row.size,
            image_url: row.image_url,
            similarity: similarity,
            similarity_percentage: Math.round(similarity * 100 * 100) / 100 // Round to 2 decimals
          });
          validCount++;
        }
      } catch (e) {
        continue; // Skip malformed embeddings
      }
    }

    // Sort by similarity (highest first) and return top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, topK);
    
    console.log(`✅ Processed ${validCount} valid embeddings, returning top ${topResults.length}`);
    
    return topResults;

  } catch (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
}

module.exports = router; 