require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');

async function processProfessorImages() {
  console.log('🎓 Processing Professor\'s CLIP Test Images');
  console.log('='.repeat(60));

  const imageFolder = '/Users/soha/Downloads/professor_test_images';
  
  try {
    // Check if folder exists
    if (!fs.existsSync(imageFolder)) {
      throw new Error(`Folder not found: ${imageFolder}`);
    }

    // Get all jpg files
    const files = fs.readdirSync(imageFolder);
    const imageFiles = files.filter(file => file.toLowerCase().endsWith('.jpg'));

    if (imageFiles.length === 0) {
      throw new Error('No JPG files found in professor_test_images folder');
    }

    console.log(`🖼️  Found ${imageFiles.length} test images:`);
    imageFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    console.log('');

    const allResults = [];

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      const imagePath = path.join(imageFolder, imageFile);
      
      console.log(`🔍 Processing ${i + 1}/${imageFiles.length}: ${imageFile}`);
      console.log('-'.repeat(50));

      try {
        const results = await runClipOnImage(imagePath);
        
        console.log(`📋 Top 5 matches for ${imageFile}:`);
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
        });
        
        allResults.push({
          imageFile: imageFile,
          results: results.map(r => {
            let formatted = r.product_name;
            if (r.brand) formatted += ` (${r.brand})`;
            const details = [];
            if (r.variety) details.push(r.variety);
            if (r.size) details.push(r.size);
            if (details.length > 0) formatted += ` - ${details.join(', ')}`;
            return formatted;
          })
        });
        
        console.log('✅ Completed successfully\n');
        
      } catch (error) {
        console.log(`❌ Error processing ${imageFile}: ${error.message}\n`);
        allResults.push({
          imageFile: imageFile,
          error: error.message
        });
      }
    }

    // Generate final report
    console.log('='.repeat(60));
    console.log('📊 FINAL RESULTS FOR PROFESSOR');
    console.log('='.repeat(60));

    allResults.forEach((result, index) => {
      console.log(`\n${index + 1}. IMAGE: ${result.imageFile}`);
      console.log('-'.repeat(30));
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else {
        console.log('Top 5 matches:');
        result.results.forEach((match, matchIndex) => {
          console.log(`   ${matchIndex + 1}. ${match}`);
        });
      }
    });

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(__dirname, `professor_clip_results_${timestamp}.txt`);
    
    let reportContent = 'CLIP Analysis Results for Professor Shenoy\n';
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
          reportContent += `   ${matchIndex + 1}. ${match}\n`;
        });
        reportContent += '\n';
      }
    });

    fs.writeFileSync(outputFile, reportContent);
    
    console.log(`\n📄 Results saved to: ${outputFile}`);
    console.log('📧 Send this file to the professor');

  } catch (error) {
    console.error('❌ Processing failed:', error.message);
    throw error;
  }
}

async function runClipOnImage(imagePath) {
  return new Promise((resolve, reject) => {
    console.log('🧠 Running CLIP similarity analysis...');
    
    // Use your existing Python CLIP setup
    const pythonScript = `
import sys
import os
import json
import base64
import io
import warnings
warnings.filterwarnings("ignore")

# Add the utils directory to path
sys.path.append('${path.join(__dirname, 'utils')}')

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

class ProfessorCLIP:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.db_connection = None
        
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
            
    def setup_database(self):
        try:
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
            query_embedding = self.get_image_embedding(query_image_path)
            
            # Get products from database (limit to 200 for faster processing)
            cursor = self.db_connection.cursor(dictionary=True)
            cursor.execute('''
                SELECT product_id, product_name, brand, variety, size,
                       COALESCE(image_s3_url, image) as image_data
                FROM Products 
                WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
                ORDER BY RAND()
                LIMIT 200
            ''')
            
            products = cursor.fetchall()
            cursor.close()
            
            print(f"🔍 Comparing against {len(products)} products...")
            
            similarities = []
            
            for i, product in enumerate(products):
                try:
                    if i % 50 == 0:
                        print(f"   Progress: {i+1}/{len(products)}")
                    
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
                    continue
            
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            return similarities[:5]
            
        except Exception as e:
            print(f"Error in similarity search: {e}")
            raise

try:
    clip = ProfessorCLIP()
    clip.setup_clip()
    clip.setup_database()
    
    results = clip.find_top5_similar("${imagePath}")
    print("RESULTS_START")
    print(json.dumps(results, indent=2))
    print("RESULTS_END")
    
except Exception as e:
    print(f"Script failed: {e}")
    sys.exit(1)
    `;

    const fs = require('fs');
    const tempScriptPath = path.join(__dirname, 'temp_professor_clip.py');
    fs.writeFileSync(tempScriptPath, pythonScript);

    const pythonProcess = spawn('bash', ['-c', 
      `source ${path.join(__dirname, 'clip_env/bin/activate')} && python3 ${tempScriptPath}`
    ]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString();
      outputData += text;
      // Show progress but not too verbose
      if (text.includes('Progress:') || text.includes('Loading') || text.includes('Comparing')) {
        process.stdout.write('.');
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) {}

      if (code === 0) {
        try {
          // Extract JSON results
          const startMarker = 'RESULTS_START';
          const endMarker = 'RESULTS_END';
          const startIndex = outputData.indexOf(startMarker);
          const endIndex = outputData.indexOf(endMarker);
          
          if (startIndex !== -1 && endIndex !== -1) {
            const jsonStr = outputData.substring(startIndex + startMarker.length, endIndex).trim();
            const results = JSON.parse(jsonStr);
            resolve(results);
          } else {
            throw new Error('Could not find results markers in output');
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          reject(new Error('Failed to parse CLIP results'));
        }
      } else {
        reject(new Error(`CLIP analysis failed: ${errorData}`));
      }
    });
  });
}

// Run the processing
processProfessorImages()
  .then(() => {
    console.log('\n🎉 All images processed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Processing failed:', error.message);
    process.exit(1);
  }); 