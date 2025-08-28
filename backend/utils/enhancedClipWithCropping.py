#!/usr/bin/env python3
"""
Enhanced CLIP Processing with Smart Cropping
Combines multiple cropping strategies with CLIP analysis for improved accuracy
"""

import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import json
import sys
import cv2
import os
import tempfile
from smartCropping import SmartCropper

class EnhancedCLIPWithCropping:
    def __init__(self, model_name="openai/clip-vit-base-patch32"):
        """Initialize the enhanced CLIP system with cropping"""
        print("🚀 Loading Enhanced CLIP with Smart Cropping...")
        
        # Load CLIP model
        self.model = CLIPModel.from_pretrained(model_name)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)
        
        # Initialize smart cropper
        self.cropper = SmartCropper()
        
        print(f"✅ Model loaded on {self.device}")
        print("✅ Smart cropping algorithms ready")
    
    def get_embedding_from_pil(self, pil_image):
        """Get CLIP embedding from PIL image"""
        try:
            # Ensure RGB format
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            # Process with CLIP
            inputs = self.processor(images=pil_image, return_tensors="pt").to(self.device)
            
            with torch.no_grad():
                features = self.model.get_image_features(**inputs)
                # Normalize for cosine similarity
                features = features / features.norm(dim=-1, keepdim=True)
                embedding = features.cpu().numpy().flatten().tolist()
            
            return embedding
        except Exception as e:
            print(f"❌ Error getting embedding: {e}")
            return None
    
    def process_multiple_crops(self, image_path, crop_strategies=['center_crop', 'object_detection', 'multi_region']):
        """
        Process multiple crops of an image and return all embeddings
        """
        print(f"🔍 Processing with cropping strategies: {crop_strategies}")
        
        # Get crops using smart cropping
        crop_results = self.cropper.process_image(image_path, crop_strategies)
        
        embeddings = []
        
        # Process original image first
        try:
            original_image = Image.open(image_path).convert('RGB')
            original_embedding = self.get_embedding_from_pil(original_image)
            if original_embedding:
                embeddings.append({
                    'strategy': 'original',
                    'embedding': original_embedding,
                    'weight': 1.0
                })
        except Exception as e:
            print(f"⚠️ Error processing original image: {e}")
        
        # Process each crop
        for crop_result in crop_results['crops']:
            if not crop_result['success']:
                continue
            
            try:
                # Convert OpenCV image to PIL
                crop_image_cv = crop_result['image']
                crop_image_pil = Image.fromarray(cv2.cvtColor(crop_image_cv, cv2.COLOR_BGR2RGB))
                
                # Get embedding
                embedding = self.get_embedding_from_pil(crop_image_pil)
                
                if embedding:
                    # Assign weights based on strategy effectiveness
                    weight = self.get_strategy_weight(crop_result['strategy'])
                    
                    embeddings.append({
                        'strategy': crop_result['strategy'],
                        'embedding': embedding,
                        'weight': weight
                    })
                    
                    print(f"   ✅ {crop_result['strategy']}: embedding generated (weight: {weight})")
                else:
                    print(f"   ❌ {crop_result['strategy']}: failed to generate embedding")
                    
            except Exception as e:
                print(f"   ❌ {crop_result['strategy']}: error - {e}")
        
        return embeddings
    
    def get_strategy_weight(self, strategy):
        """
        Assign weights to different cropping strategies based on their effectiveness
        """
        weights = {
            'original': 1.0,
            'center_crop': 0.8,
            'object_detection': 0.9,
            'edge_detection': 0.7,
            'saliency_crop': 0.8,
            'text_aware': 0.85,
            'multi_region_center_80': 0.75,
            'multi_region_center_60': 0.7,
            'multi_region_upper_region': 0.6,
            'multi_region_center_square': 0.65
        }
        return weights.get(strategy, 0.5)
    
    def compute_weighted_similarity(self, query_embeddings, target_embedding):
        """
        Compute weighted similarity between multiple query embeddings and a target
        """
        if not query_embeddings:
            return 0.0
        
        similarities = []
        total_weight = 0.0
        
        for query_emb in query_embeddings:
            try:
                embedding = query_emb['embedding']
                weight = query_emb['weight']
                
                # Compute cosine similarity
                dot_product = np.dot(embedding, target_embedding)
                query_norm = np.linalg.norm(embedding)
                target_norm = np.linalg.norm(target_embedding)
                
                if query_norm > 0 and target_norm > 0:
                    similarity = dot_product / (query_norm * target_norm)
                    similarities.append(similarity * weight)
                    total_weight += weight
                
            except Exception as e:
                print(f"⚠️ Error computing similarity: {e}")
                continue
        
        if total_weight > 0:
            weighted_similarity = sum(similarities) / total_weight
            return weighted_similarity
        else:
            return 0.0
    
    def enhanced_search(self, image_path, crop_strategies=['center_crop', 'object_detection', 'multi_region']):
        """
        Perform enhanced search using multiple cropping strategies
        """
        print(f"🎯 Enhanced CLIP search for: {os.path.basename(image_path)}")
        
        # Get multiple embeddings from different crops
        query_embeddings = self.process_multiple_crops(image_path, crop_strategies)
        
        if not query_embeddings:
            print("❌ No valid embeddings generated")
            return None
        
        print(f"✅ Generated {len(query_embeddings)} embeddings from different crops")
        
        # For testing, return the weighted average embedding
        # In production, this would be compared against the database
        if len(query_embeddings) == 1:
            return query_embeddings[0]['embedding']
        
        # Compute weighted average embedding
        total_weight = sum(emb['weight'] for emb in query_embeddings)
        weighted_embedding = []
        
        for i in range(len(query_embeddings[0]['embedding'])):
            weighted_sum = sum(emb['embedding'][i] * emb['weight'] for emb in query_embeddings)
            weighted_embedding.append(weighted_sum / total_weight)
        
        return weighted_embedding
    
    def analyze_cropping_effectiveness(self, image_path, strategies=['center_crop', 'object_detection', 'saliency_crop', 'text_aware']):
        """
        Analyze which cropping strategies work best for a given image
        """
        print(f"📊 Analyzing cropping effectiveness for: {os.path.basename(image_path)}")
        
        embeddings = self.process_multiple_crops(image_path, strategies)
        
        if len(embeddings) < 2:
            print("❌ Not enough embeddings to compare")
            return None
        
        # Compare similarity between different crops and original
        original_embedding = None
        for emb in embeddings:
            if emb['strategy'] == 'original':
                original_embedding = emb['embedding']
                break
        
        if not original_embedding:
            print("❌ No original embedding found")
            return None
        
        analysis = []
        
        for emb in embeddings:
            if emb['strategy'] == 'original':
                continue
            
            # Compute similarity to original
            similarity = np.dot(emb['embedding'], original_embedding) / (
                np.linalg.norm(emb['embedding']) * np.linalg.norm(original_embedding)
            )
            
            analysis.append({
                'strategy': emb['strategy'],
                'similarity_to_original': similarity,
                'weight': emb['weight'],
                'effectiveness_score': similarity * emb['weight']
            })
        
        # Sort by effectiveness
        analysis.sort(key=lambda x: x['effectiveness_score'], reverse=True)
        
        print("📈 Cropping Strategy Effectiveness:")
        for i, result in enumerate(analysis[:5]):  # Top 5
            print(f"   {i+1}. {result['strategy']}: {result['effectiveness_score']:.3f} "
                  f"(sim: {result['similarity_to_original']:.3f}, weight: {result['weight']})")
        
        return analysis

def main():
    """Command line interface for enhanced CLIP processing"""
    if len(sys.argv) < 2:
        print("Usage: python enhancedClipWithCropping.py <image_path> [mode]")
        print("Modes: 'search' (default), 'analyze'")
        sys.exit(1)
    
    image_path = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'search'
    
    if not os.path.exists(image_path):
        print(f"❌ Image not found: {image_path}")
        sys.exit(1)
    
    try:
        enhancer = EnhancedCLIPWithCropping()
        
        if mode == 'search':
            # Perform enhanced search
            embedding = enhancer.enhanced_search(image_path)
            if embedding:
                print("✅ Enhanced embedding generated successfully")
                print(f"📊 Embedding dimensions: {len(embedding)}")
                print(f"🎯 Ready for similarity search")
                
                # Output embedding as JSON for integration with Node.js
                print("ENHANCED_EMBEDDING_READY")
                print(json.dumps(embedding))
            else:
                print("❌ Failed to generate enhanced embedding")
                sys.exit(1)
                
        elif mode == 'analyze':
            # Analyze cropping effectiveness
            analysis = enhancer.analyze_cropping_effectiveness(image_path)
            if analysis:
                print("✅ Cropping analysis completed")
                print(json.dumps(analysis, indent=2))
            else:
                print("❌ Failed to analyze cropping effectiveness")
                sys.exit(1)
        else:
            print(f"❌ Unknown mode: {mode}")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
