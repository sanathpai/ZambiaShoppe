
import sys
import os
import json
import base64
import io
import warnings
warnings.filterwarnings("ignore")

# Add the utils directory to path
sys.path.append('/Users/soha/ZambiaShoppe/backend/utils')

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
                host='zambia-db-cluster.clcicq6q2by6.af-south-1.rds.amazonaws.com',
                user='admin',
                password='shopdbpassword',
                database='shopdatabase'
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
    
    results = clip.find_top5_similar("/Users/soha/Downloads/professor_test_images/test1.jpg")
    print("RESULTS_START")
    print(json.dumps(results, indent=2))
    print("RESULTS_END")
    
except Exception as e:
    print(f"Script failed: {e}")
    sys.exit(1)
    