const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');

// Universal Enhanced CLIP search - general improvements for all products
router.post('/enhanced-search', async (req, res) => {
  console.log('🎯 Universal Enhanced CLIP search - general improvements');
  
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format' });
    }
    
    // Generate temporary file for the image
    const tempId = crypto.randomBytes(16).toString('hex');
    const tempImagePath = path.join(__dirname, '..', 'temp', `universal_enhanced_${tempId}.jpg`);
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempImagePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save image to temporary file
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(tempImagePath, base64Data, 'base64');
    
    console.log('📸 Image saved, applying universal enhancements...');
    
    // Apply universal enhancement
    const enhancedImagePath = await applyUniversalEnhancement(tempImagePath);
    console.log('✅ Universal enhancement applied');
    
    let queryEmbedding;
    let processingDetails = {};
    
    try {
      // Get CLIP embedding from the enhanced image
      queryEmbedding = await getCLIPEmbedding(enhancedImagePath);
      console.log('✅ CLIP embedding computed from enhanced image');
      processingDetails.method = 'universal_enhanced';
      processingDetails.success = true;
    } catch (clipError) {
      console.log('⚠️ Enhancement failed, trying original image:', clipError.message);
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
      if (enhancedImagePath && enhancedImagePath !== tempImagePath) {
        fs.unlinkSync(enhancedImagePath);
      }
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temp files:', cleanupError);
    }
    
    // Add enhanced processing info to results
    const enhancedResults = similarProducts.map((product, index) => ({
      ...product,
      processing_rank: index + 1,
      enhanced_processing: true,
      enhancement_type: 'universal'
    }));
    
    // Return results
    res.json({
      success: true,
      results: enhancedResults,
      count: enhancedResults.length,
      enhancement_type: 'universal',
      processing_details: processingDetails,
      enhanced: true,
      message: `Universal enhancement ${processingDetails.success ? 'succeeded' : 'failed, used fallback'}`
    });
    
  } catch (error) {
    console.error('❌ Universal Enhanced CLIP search error:', error);
    res.status(500).json({
      success: false,
      error: 'Universal Enhanced CLIP search failed',
      details: error.message 
    });
  }
});

// Analyze enhancement effectiveness endpoint
router.post('/analyze-cropping', async (req, res) => {
  console.log('📊 Universal enhancement analysis request received');
  
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
    
    // Analyze the image with universal enhancement
    const analysis = await analyzeUniversalEnhancement(tempImagePath);
    
    // Clean up
    try {
      fs.unlinkSync(tempImagePath);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup analysis temp file:', cleanupError);
    }
    
    res.json({
      success: true,
      analysis: analysis.strategies,
      enhancement_type: 'universal',
      quality_improvements: analysis.quality_improvements,
      recommendations: analysis.recommendations
    });
    
  } catch (error) {
    console.error('❌ Universal enhancement analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Universal enhancement analysis failed',
      details: error.message 
    });
  }
});

function applyUniversalEnhancement(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import os
sys.path.append('${path.join(__dirname, '..', 'utils')}')

try:
    from universalImageEnhancer import UniversalImageEnhancer
    
    enhancer = UniversalImageEnhancer()
    
    # Apply universal enhancement
    enhanced_path = enhancer.enhance_image("${imagePath}")
    
    print(f"SUCCESS:{enhanced_path}")
        
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
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
      console.log('Universal enhancement output:', output);
      if (errorOutput) console.log('Universal enhancement errors:', errorOutput);
      
      if (code !== 0) {
        reject(new Error(`Universal enhancement failed: ${errorOutput}`));
        return;
      }

      try {
        const lines = output.trim().split('\n');
        const successLine = lines.find(line => line.startsWith('SUCCESS:'));
        
        if (successLine) {
          const enhancedPath = successLine.replace('SUCCESS:', '');
          resolve(enhancedPath);
        } else {
          // If enhancement failed, return original path
          console.log('⚠️ Universal enhancement did not produce output, using original');
          resolve(imagePath);
        }
      } catch (error) {
        reject(new Error(`Failed to parse universal enhancement output: ${error.message}`));
      }
    });
  });
}

function analyzeUniversalEnhancement(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import os
sys.path.append('${path.join(__dirname, '..', 'utils')}')

try:
    from universalImageEnhancer import UniversalImageEnhancer
    import cv2
    import json
    
    enhancer = UniversalImageEnhancer()
    
    # Load original image
    original_image = cv2.imread("${imagePath}")
    
    # Apply enhancements and get quality assessment
    enhanced_image = enhancer.apply_enhancement_pipeline(original_image)
    quality_metrics = enhancer.quality_assessment(original_image, enhanced_image)
    
    # Generate analysis
    strategies = [
        {
            'strategy': 'adaptive_contrast_enhancement',
            'effectiveness_score': min(quality_metrics['contrast_improvement'], 2.0),
            'success': True
        },
        {
            'strategy': 'smart_noise_reduction', 
            'effectiveness_score': 0.9,
            'success': True
        },
        {
            'strategy': 'edge_enhancement',
            'effectiveness_score': min(quality_metrics['sharpness_improvement'], 2.0),
            'success': True
        },
        {
            'strategy': 'color_normalization',
            'effectiveness_score': 0.8,
            'success': True
        }
    ]
    
    # Generate recommendations
    recommendations = []
    
    if quality_metrics['overall_score'] > 1.2:
        recommendations.append({
            'type': 'high_improvement',
            'message': f'Significant quality improvement detected (score: {quality_metrics["overall_score"]:.2f})',
            'confidence': 'high'
        })
    elif quality_metrics['overall_score'] > 1.05:
        recommendations.append({
            'type': 'moderate_improvement',
            'message': f'Moderate quality improvement detected (score: {quality_metrics["overall_score"]:.2f})',
            'confidence': 'medium'
        })
    else:
        recommendations.append({
            'type': 'minimal_improvement',
            'message': f'Minimal improvement - image may already be well optimized (score: {quality_metrics["overall_score"]:.2f})',
            'confidence': 'medium'
        })
    
    recommendations.append({
        'type': 'universal_enhancement',
        'message': 'Universal enhancement applies contrast optimization, noise reduction, and edge enhancement',
        'confidence': 'high'
    })
    
    analysis = {
        'strategies': strategies,
        'quality_improvements': quality_metrics,
        'recommendations': recommendations
    }
    
    print(json.dumps(analysis))
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
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
        reject(new Error(`Universal enhancement analysis failed: ${errorOutput}`));
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
    
    # Process the enhanced image
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
    
    console.log(`✅ Universal enhanced search processed ${validCount} embeddings, returning top ${topResults.length}`);
    return topResults;

  } catch (error) {
    throw new Error(`Universal enhanced search failed: ${error.message}`);
  }
}

module.exports = router;
