require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const db = require('./config/db');

async function fastProfessorTest() {
  console.log('⚡ Fast CLIP Test for Professor (Limited Database)');
  console.log('='.repeat(60));

  const imageFolder = '/Users/soha/Downloads/professor_test_images';
  
  try {
    // Get a small, representative sample of products
    const [products] = await db.query(`
      SELECT product_id, product_name, brand, variety, size,
             COALESCE(image_s3_url, image) as image_data
      FROM Products 
      WHERE (image IS NOT NULL OR image_s3_url IS NOT NULL)
      AND product_name IN ('Eggs', 'Soft drink', 'Sugar', 'Cooking oil', 'Water', 'Beer', 'Gin', 'Bread', 'Milk')
      ORDER BY RAND()
      LIMIT 30
    `);

    console.log(`📦 Using ${products.length} representative products for faster testing`);

    const imageFiles = fs.readdirSync(imageFolder).filter(f => f.endsWith('.jpg'));
    console.log(`🖼️  Found ${imageFiles.length} test images\n`);

    const allResults = [];

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      const imagePath = path.join(imageFolder, imageFile);
      
      console.log(`🔍 Processing ${i + 1}/${imageFiles.length}: ${imageFile}`);

      try {
        const results = await runFastClip(imagePath, products);
        
        console.log(`📋 Top 5 matches:`);
        const formattedResults = results.map(r => {
          let formatted = r.product_name;
          if (r.brand) formatted += ` (${r.brand})`;
          const details = [];
          if (r.variety) details.push(r.variety);
          if (r.size) details.push(r.size);
          if (details.length > 0) formatted += ` - ${details.join(', ')}`;
          return formatted;
        });
        
        formattedResults.forEach((match, idx) => {
          console.log(`   ${idx + 1}. ${match}`);
        });
        
        allResults.push({
          imageFile: imageFile,
          results: formattedResults
        });
        
        console.log('✅ Done\n');
        
      } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        allResults.push({
          imageFile: imageFile,
          error: error.message
        });
      }
    }

    // Final summary
    console.log('='.repeat(60));
    console.log('📊 FINAL RESULTS FOR PROFESSOR');
    console.log('='.repeat(60));

    allResults.forEach((result, index) => {
      console.log(`\n${index + 1}. IMAGE: ${result.imageFile}`);
      console.log('-'.repeat(30));
      
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else {
        result.results.forEach((match, matchIndex) => {
          console.log(`   ${matchIndex + 1}. ${match}`);
        });
      }
    });

    // Save to file
    const outputFile = path.join(__dirname, `professor_results_fast_${Date.now()}.txt`);
    let content = 'CLIP Test Results for Professor Shenoy\\n';
    content += '='.repeat(40) + '\\n\\n';
    
    allResults.forEach((result, index) => {
      content += `${index + 1}. IMAGE: ${result.imageFile}\\n`;
      if (result.error) {
        content += `Error: ${result.error}\\n\\n`;
      } else {
        result.results.forEach((match, idx) => {
          content += `   ${idx + 1}. ${match}\\n`;
        });
        content += '\\n';
      }
    });

    fs.writeFileSync(outputFile, content);
    console.log(`\n📄 Results saved to: ${outputFile}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function runFastClip(queryImagePath, products) {
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
except ImportError as e:
    print(f"Error: {e}")
    sys.exit(1)

class FastCLIP:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cpu"  # Force CPU for faster startup
        
    def setup(self):
        print("Loading CLIP (CPU mode for speed)...")
        try:
            self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32", use_fast=False)
            print("✅ Ready")
        except Exception as e:
            print(f"Error: {e}")
            raise
            
    def get_embedding(self, image_path):
        image = Image.open(image_path).convert('RGB')
        inputs = self.processor(images=image, return_tensors="pt")
        
        with torch.no_grad():
            features = self.model.get_image_features(**inputs)
            features = features / features.norm(dim=-1, keepdim=True)
            
        return features.cpu().numpy().flatten()
        
    def load_image_data(self, image_data):
        if image_data.startswith('data:image/'):
            header, data = image_data.split(',', 1)
            image_bytes = base64.b64decode(data)
            return Image.open(io.BytesIO(image_bytes)).convert('RGB')
        elif image_data.startswith('http'):
            import requests
            response = requests.get(image_data, timeout=10)
            return Image.open(io.BytesIO(response.content)).convert('RGB')
        else:
            raise ValueError("Invalid format")
            
    def get_embedding_from_data(self, image_data):
        image = self.load_image_data(image_data)
        inputs = self.processor(images=image, return_tensors="pt")
        
        with torch.no_grad():
            features = self.model.get_image_features(**inputs)
            features = features / features.norm(dim=-1, keepdim=True)
            
        return features.cpu().numpy().flatten()
        
    def similarity(self, vec1, vec2):
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

# Data from Node.js
products_data = ${JSON.stringify(products)}

try:
    clip = FastCLIP()
    clip.setup()
    
    query_embedding = clip.get_embedding("${queryImagePath}")
    similarities = []
    
    print(f"Comparing against {len(products_data)} products...")
    
    for product in products_data:
        try:
            product_embedding = clip.get_embedding_from_data(product['image_data'])
            sim = clip.similarity(query_embedding, product_embedding)
            
            similarities.append({
                'product_id': product['product_id'],
                'product_name': product['product_name'],
                'brand': product['brand'],
                'variety': product['variety'],
                'size': product['size'],
                'similarity': float(sim)
            })
        except:
            continue
    
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    print(json.dumps(similarities[:5]))
    
except Exception as e:
    print(f"Failed: {e}")
    sys.exit(1)
    `;

    const tempFile = path.join(__dirname, `temp_fast_${Date.now()}.py`);
    fs.writeFileSync(tempFile, pythonScript);

    const process = spawn('bash', ['-c', 
      `source ${path.join(__dirname, 'clip_env/bin/activate')} && python3 ${tempFile}`
    ]);

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (text.includes('Loading') || text.includes('Comparing')) {
        console.log(`   ${text.trim()}`);
      }
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      try { fs.unlinkSync(tempFile); } catch(e) {}

      if (code === 0) {
        try {
          // Find JSON in output
          const lines = output.trim().split('\\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().startsWith('[')) {
              const results = JSON.parse(lines[i].trim());
              resolve(results);
              return;
            }
          }
          reject(new Error('No results found'));
        } catch (e) {
          reject(new Error('Parse failed'));
        }
      } else {
        reject(new Error(`Failed: ${error}`));
      }
    });
  });
}

fastProfessorTest()
  .then(() => {
    console.log('\\n🎉 Fast test completed!');
    process.exit(0);
  })
  .catch(() => process.exit(1)); 