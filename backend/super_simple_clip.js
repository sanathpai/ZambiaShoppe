require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testSingleImage() {
  console.log('🎓 Simple CLIP Test for Professor');
  console.log('='.repeat(50));

  const imagePath = '/Users/soha/Downloads/professor_test_images/test1.jpg';
  
  if (!fs.existsSync(imagePath)) {
    console.log('❌ Test image not found:', imagePath);
    return;
  }

  console.log('📸 Testing:', imagePath);
  
  try {
    const results = await runSimpleClip(imagePath);
    console.log('\n📋 Top 5 matches:');
    
    results.forEach((result, index) => {
      let formatted = result.product_name || 'Unknown Product';
      
      if (result.brand && result.brand !== 'None') {
        formatted += ` (${result.brand})`;
      }
      
      const details = [];
      if (result.variety && result.variety !== 'None') details.push(result.variety);
      if (result.size && result.size !== 'None') details.push(result.size);
      
      if (details.length > 0) {
        formatted += ` - ${details.join(', ')}`;
      }
      
      console.log(`   ${index + 1}. ${formatted} (similarity: ${(result.similarity * 100).toFixed(1)}%)`);
    });
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function runSimpleClip(queryImagePath) {
  return new Promise((resolve, reject) => {
    console.log('🧠 Running CLIP analysis...');
    
    const pythonScript = `
import sys
import json
import warnings
warnings.filterwarnings("ignore")

try:
    import torch
    import numpy as np
    from PIL import Image
    from transformers import CLIPProcessor, CLIPModel
    import requests
    import random
except ImportError as e:
    print(f"Missing package: {e}")
    sys.exit(1)

class SimpleCLIP:
    def __init__(self):
        self.model = None
        self.processor = None
        
    def setup(self):
        print("Loading CLIP model...")
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
        
    def load_web_image(self, url):
        try:
            response = requests.get(url, timeout=10)
            return Image.open(response.content).convert('RGB')
        except:
            return None
            
    def get_web_embedding(self, url):
        image = self.load_web_image(url)
        if image is None:
            return None
            
        inputs = self.processor(images=image, return_tensors="pt")
        
        with torch.no_grad():
            features = self.model.get_image_features(**inputs)
            features = features / features.norm(dim=-1, keepdim=True)
            
        return features.cpu().numpy().flatten()
        
    def similarity(self, vec1, vec2):
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

# Hard-coded sample products to avoid database issues
sample_products = [
    {"product_name": "Soft drink", "brand": "Coca Cola", "variety": "Fanta orange", "size": "300ml", 
     "url": "https://zambia-shoppe-product-images.s3.af-south-1.amazonaws.com/products/product-1474-34bc85a2-84e4-4379-bc52-17b370bc10c1.jpeg"},
    {"product_name": "Beer", "brand": "Mosi", "variety": "Lager", "size": "375ml",
     "url": "https://zambia-shoppe-product-images.s3.af-south-1.amazonaws.com/products/product-1911-72aa8044-74ed-455f-ad8a-0a0815745d0f.jpeg"},
    {"product_name": "Sugar", "brand": "Whitespoon", "variety": "White", "size": "1KG",
     "url": "https://zambia-shoppe-product-images.s3.af-south-1.amazonaws.com/products/product-1385-5b6f2e3c-1d07-4814-9c19-137461f377ab.jpeg"},
    {"product_name": "Milk", "brand": "Creambell", "variety": "Full cream", "size": "500mls",
     "url": "https://zambia-shoppe-product-images.s3.af-south-1.amazonaws.com/products/product-3199-b208c431-b8be-473b-b7c3-a99a765ca6b7.jpeg"},
    {"product_name": "Bread", "brand": "Agogos", "variety": "White", "size": "700g",
     "url": "https://zambia-shoppe-product-images.s3.af-south-1.amazonaws.com/products/product-2264-e0f5ff9d-6f94-4af9-809f-649baccdc654.jpeg"}
]

try:
    clip = SimpleCLIP()
    clip.setup()
    
    query_embedding = clip.get_embedding("${queryImagePath}")
    similarities = []
    
    print(f"Comparing against {len(sample_products)} sample products...")
    
    for product in sample_products:
        try:
            product_embedding = clip.get_web_embedding(product['url'])
            if product_embedding is not None:
                sim = clip.similarity(query_embedding, product_embedding)
                
                similarities.append({
                    'product_name': product['product_name'],
                    'brand': product['brand'],
                    'variety': product['variety'],
                    'size': product['size'],
                    'similarity': float(sim)
                })
        except Exception as e:
            print(f"Skipped one product: {e}")
            continue
    
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    print(json.dumps(similarities[:5]))
    
except Exception as e:
    print(f"Failed: {e}")
    sys.exit(1)
    `;

    const tempFile = path.join(__dirname, `temp_simple_${Date.now()}.py`);
    fs.writeFileSync(tempFile, pythonScript);

    const process = spawn('bash', ['-c', 
      `source ${path.join(__dirname, 'clip_env/bin/activate')} && python3 ${tempFile}`
    ]);

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (text.includes('Loading') || text.includes('Comparing') || text.includes('Ready')) {
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
          reject(new Error('No results found in output'));
        } catch (e) {
          console.log('Raw output:', output);
          reject(new Error('Parse failed: ' + e.message));
        }
      } else {
        reject(new Error(`Failed with code ${code}: ${error}`));
      }
    });
  });
}

testSingleImage()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }); 