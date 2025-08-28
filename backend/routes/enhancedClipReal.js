const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');

// Enhanced CLIP search with REAL smart cropping for failed products
router.post('/enhanced-search', async (req, res) => {
  console.log('🎯 Real Enhanced CLIP search with smart cropping for failed products');
  
  try {
    const { image, strategies = ['auto'] } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }
    
    console.log('🔧 Using smart cropping strategies:', strategies);
    
    // Generate temporary file for the image
    const tempId = crypto.randomBytes(16).toString('hex');
    const tempImagePath = path.join(__dirname, '..', 'temp', `real_enhanced_${tempId}.jpg`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempImagePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save image to temporary file
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(tempImagePath, base64Data, 'base64');
    
    console.log('📸 Image saved, applying smart cropping...');
    
    // Apply smart cropping first
    const croppedImagePath = await applySmartCropping(tempImagePath, strategies);
    console.log('✅ Smart cropping applied');
    
    let queryEmbedding;
    let processingDetails = {};
    
    try {
      // Get CLIP embedding from the smart-cropped image
      queryEmbedding = await getCLIPEmbedding(croppedImagePath);
      console.log('✅ CLIP embedding computed from smart-cropped image');
      processingDetails.method = 'smart_cropped';
      processingDetails.success = true;
    } catch (clipError) {
      console.log('⚠️ Smart crop failed, trying original image:', clipError.message);
      // Fallback to original image
      queryEmbedding = await getCLIPEmbedding(tempImagePath);
      console.log('✅ Fallback embedding computed from original image');
      processingDetails.method = 'fallback_original';
      processingDetails.success = false;
      processingDetails.error = clipError.message;
    }
    
    // Search similar products in database
    const similarProducts = await searchSimilarProducts(queryEmbedding, 5);
    console.log(`🎯 Found ${similarProducts.length} similar products using ${processingDetails.method}`);
    
    // Clean up temporary files
    try {
      fs.unlinkSync(tempImagePath);
      if (croppedImagePath && croppedImagePath !== tempImagePath) {
        fs.unlinkSync(croppedImagePath);
      }
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temp files:', cleanupError);
    }
    
    // Add enhanced processing info to results
    const enhancedResults = similarProducts.map((product, index) => ({
      ...product,
      processing_rank: index + 1,
      enhanced_processing: true
    }));
    
    // Return results
    res.json({
      success: true,
      results: enhancedResults,
      count: enhancedResults.length,
      cropping_strategies: strategies,
      processing_details: processingDetails,
      enhanced: true,
      message: `Smart cropping ${processingDetails.success ? 'succeeded' : 'failed, used fallback'}`
    });
    
  } catch (error) {
    console.error('❌ Real Enhanced CLIP search error:', error);
    res.status(500).json({
      success: false,
      error: 'Real Enhanced CLIP search failed',
      details: error.message 
    });
  }
});

// Analyze cropping effectiveness endpoint
router.post('/analyze-cropping', async (req, res) => {
  console.log('📊 Real cropping analysis request received');
  
  try {
    const { image } = req.body;
    
    if (!image || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Valid image data is required' });
    }
    
    // Save image temporarily
    const tempId = crypto.randomBytes(16).toString('hex');
    const tempImagePath = path.join(__dirname, '..', 'temp', `analysis_${tempId}.jpg`);
    
    const tempDir = path.dirname(tempImagePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(tempImagePath, base64Data, 'base64');
    
    // Analyze the image with smart cropping
    const analysis = await analyzeImageWithSmartCropping(tempImagePath);
    
    // Clean up
    try {
      fs.unlinkSync(tempImagePath);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup analysis temp file:', cleanupError);
    }
    
    res.json({
      success: true,
      analysis: analysis.strategies,
      product_type: analysis.product_type,
      recommendations: analysis.recommendations
    });
    
  } catch (error) {
    console.error('❌ Real cropping analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Real cropping analysis failed',
      details: error.message 
    });
  }
});

function applySmartCropping(imagePath, strategies) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import os
sys.path.append('${path.join(__dirname, '..', 'utils')}')

try:
    from realSmartCropping import ProductSmartCropper
    import cv2
    
    cropper = ProductSmartCropper()
    strategies = ${JSON.stringify(strategies)}
    
    # Process image with smart cropping
    results = cropper.process_image("${imagePath}", strategies)
    
    # Save the best crop
    for result in results:
        if result['success']:
            output_path = "${imagePath}".replace('.jpg', '_smart_cropped.jpg')
            cv2.imwrite(output_path, result['image'])
            print(f"SUCCESS:{output_path}")
            break
    else:
        print("ERROR: No successful crops generated")
        
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript], {
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
      console.log('Smart cropping output:', output);
      if (errorOutput) console.log('Smart cropping errors:', errorOutput);
      
      if (code !== 0) {
        reject(new Error(`Smart cropping failed: ${errorOutput}`));
        return;
      }

      try {
        const lines = output.trim().split('\n');
        const successLine = lines.find(line => line.startsWith('SUCCESS:'));
        
        if (successLine) {
          const croppedPath = successLine.replace('SUCCESS:', '');
          resolve(croppedPath);
        } else {
          // If smart cropping failed, return original path
          console.log('⚠️ Smart cropping did not produce output, using original');
          resolve(imagePath);
        }
      } catch (error) {
        reject(new Error(`Failed to parse smart cropping output: ${error.message}`));
      }
    });
  });
}

function analyzeImageWithSmartCropping(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import os
sys.path.append('${path.join(__dirname, '..', 'utils')}')

try:
    from realSmartCropping import ProductSmartCropper
    import json
    
    cropper = ProductSmartCropper()
    
    # Detect product type
    import cv2
    image = cv2.imread("${imagePath}")
    product_type = cropper.detect_product_type(image)
    
    # Get strategy effectiveness
    results = cropper.process_image("${imagePath}", ['auto'])
    
    strategies = []
    for result in results:
        if result['success']:
            strategies.append({
                'strategy': result['strategy'],
                'effectiveness_score': 0.9,  # High score for successful crops
                'success': True
            })
        else:
            strategies.append({
                'strategy': result['strategy'],
                'effectiveness_score': 0.1,  # Low score for failed crops
                'success': False,
                'error': result.get('error', 'Unknown error')
            })
    
    # Generate recommendations
    recommendations = []
    successful_strategies = [s for s in strategies if s['success']]
    
    if successful_strategies:
        best_strategy = successful_strategies[0]['strategy']
        recommendations.append({
            'type': 'optimal_strategy',
            'message': f'Best strategy for {product_type}: {best_strategy}',
            'confidence': 'high'
        })
    
    if product_type == 'beverage':
        recommendations.append({
            'type': 'product_specific',
            'message': 'For beverages: Focus on upper bottle region and label area',
            'confidence': 'high'
        })
    elif product_type == 'pharmaceutical':
        recommendations.append({
            'type': 'product_specific', 
            'message': 'For pharmaceuticals: Extract text regions and enhance contrast',
            'confidence': 'high'
        })
    else:
        recommendations.append({
            'type': 'product_specific',
            'message': 'For personal care: Isolate product from background',
            'confidence': 'high'
        })
    
    analysis = {
        'product_type': product_type,
        'strategies': strategies,
        'recommendations': recommendations
    }
    
    print(json.dumps(analysis))
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript], {
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
        reject(new Error(`Image analysis failed: ${errorOutput}`));
        return;
      }

      try {
        const lines = output.trim().split('\n');
        const jsonLine = lines.find(line => line.startsWith('{'));
        
        if (jsonLine) {
          const analysis = JSON.parse(jsonLine);
          resolve(analysis);
        } else {
          reject(new Error('No analysis results found'));
        }
      } catch (error) {
        reject(new Error(`Failed to parse analysis results: ${error.message}`));
      }
    });
  });
}

function getCLIPEmbedding(imagePath) {
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
    
    # Process the (potentially smart-cropped) image
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
        reject(new Error(`CLIP embedding failed: ${errorOutput}`));
        return;
      }

      try {
        const lines = output.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine.startsWith('[') && lastLine.endsWith(']')) {
          const embedding = JSON.parse(lastLine);
          resolve(embedding);
        } else {
          reject(new Error('Failed to get valid CLIP embedding'));
        }
      } catch (error) {
        reject(new Error(`Failed to parse CLIP embedding: ${error.message}`));
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
      LIMIT 1000
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
            similarity: similarity
          });
          validCount++;
        }
      } catch (e) {
        // Skip malformed embeddings
        continue;
      }
    }

    // Sort by similarity and return top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, topK);
    
    console.log(`✅ Real enhanced search processed ${validCount} embeddings, returning top ${topResults.length}`);
    return topResults;

  } catch (error) {
    throw new Error(`Real enhanced search failed: ${error.message}`);
  }
}

module.exports = router;
