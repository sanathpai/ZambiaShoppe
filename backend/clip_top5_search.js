require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const db = require('./config/db');

async function findTop5SimilarProducts(queryImagePath) {
  console.log(`🔍 Finding top 5 similar products for: ${queryImagePath}`);
  
  try {
    // Use your existing CLIP implementation to get similarity results
    const clipResults = await runClipSimilarity(queryImagePath);
    
    // Format results as requested by professor: "Product (Brand) - Variety, Size"
    const formattedResults = clipResults.map((result, index) => {
      let formatted = result.product_name;
      
      // Add brand if available
      if (result.brand) {
        formatted += ` (${result.brand})`;
      }
      
      // Add variety and size if available
      const details = [];
      if (result.variety) details.push(result.variety);
      if (result.size) details.push(result.size);
      
      if (details.length > 0) {
        formatted += ` - ${details.join(', ')}`;
      }
      
      return {
        rank: index + 1,
        similarity: result.similarity.toFixed(3),
        formatted: formatted,
        product_id: result.product_id
      };
    });
    
    return formattedResults;
    
  } catch (error) {
    console.error('Error finding similar products:', error);
    throw error;
  }
}

async function runClipSimilarity(queryImagePath) {
  return new Promise((resolve, reject) => {
    console.log('🧠 Running CLIP similarity analysis...');
    
    // Create Python script that uses your existing CLIP environment
    const pythonScript = `
import sys
import os
sys.path.append('${path.join(__dirname, 'utils')}')

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
    import mysql.connector
    from mysql.connector import Error
except ImportError as e:
    print(f"Error importing: {e}")
    sys.exit(1)

class CLIPSearch:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.db_connection = None
        
    def setup_clip(self):
        print("Loading CLIP model...")
        try:
            self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            self.model.to(self.device)
        except Exception as e:
            print(f"Error loading CLIP: {e}")
            raise
            
    def setup_database(self):
        try:
            # Database connection using environment variables
            self.db_connection = mysql.connector.connect(
                host='${process.env.DB_HOST || 'localhost'}',
                user='${process.env.DB_USER || 'root'}',
                password='${process.env.DB_PASSWORD || ''}',
                database='${process.env.DB_NAME || 'zambiashoppe'}'
            )
        except Error as e:
            print(f"Database error: {e}")
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
        
    def find_top5_similar(self, query_image_path):
        try:
            # Get query image embedding
            query_embedding = self.get_image_embedding(query_image_path)
            
            # Get all products with images from database
            cursor = self.db_connection.cursor(dictionary=True)
            cursor.execute("""
                SELECT product_id, product_name, brand, variety, size,
                       COALESCE(image_s3_url, image) as image_data
                FROM Products 
                WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
            """)
            
            products = cursor.fetchall()
            cursor.close()
            
            similarities = []
            
            for product in products:
                try:
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
                    print(f"Error processing product {product['product_id']}: {e}")
                    continue
            
            # Sort by similarity and return top 5
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            return similarities[:5]
            
        except Exception as e:
            print(f"Error in similarity search: {e}")
            raise

# Main execution
try:
    searcher = CLIPSearch()
    searcher.setup_clip()
    searcher.setup_database()
    
    results = searcher.find_top5_similar("${queryImagePath}")
    print(json.dumps(results, indent=2))
    
except Exception as e:
    print(f"Script failed: {e}")
    sys.exit(1)
    `;

    // Write Python script to temporary file
    const fs = require('fs');
    const tempScriptPath = path.join(__dirname, 'temp_clip_search.py');
    fs.writeFileSync(tempScriptPath, pythonScript);

    // Run Python script with CLIP environment
    const pythonProcess = spawn('bash', ['-c', 
      `source ${path.join(__dirname, 'clip_env/bin/activate')} && python3 ${tempScriptPath}`
    ]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.error('Python error:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      if (code === 0) {
        try {
          const results = JSON.parse(outputData);
          resolve(results);
        } catch (parseError) {
          console.error('Error parsing results:', parseError);
          console.error('Raw output:', outputData);
          reject(new Error('Failed to parse CLIP results'));
        }
      } else {
        console.error(`Python script failed with code ${code}`);
        console.error('Error output:', errorData);
        reject(new Error(`CLIP analysis failed: ${errorData}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(error);
    });
  });
}

// Test function for a single image
async function testSingleImage(imagePath) {
  console.log('🎯 CLIP Top-5 Product Search Test');
  console.log('='.repeat(50));
  
  try {
    const results = await findTop5SimilarProducts(imagePath);
    
    console.log(`\n📋 Top 5 matches for: ${path.basename(imagePath)}`);
    console.log('-'.repeat(50));
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.formatted}`);
      console.log(`   Similarity: ${result.similarity} | ID: ${result.product_id}`);
    });
    
    console.log('\n✅ Test completed successfully!');
    return results;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

module.exports = {
  findTop5SimilarProducts,
  testSingleImage
};

// If run directly, test with a sample image
if (require.main === module) {
  const testImagePath = process.argv[2];
  if (!testImagePath) {
    console.log('Usage: node clip_top5_search.js <image_path>');
    console.log('Example: node clip_top5_search.js /path/to/test_image.jpg');
    process.exit(1);
  }
  
  testSingleImage(testImagePath)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 