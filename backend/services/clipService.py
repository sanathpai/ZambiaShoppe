#!/usr/bin/env python3
"""
Persistent CLIP Service for Fast Image Similarity Search
Keeps CLIP model loaded in memory to avoid initialization overhead
"""

import sys
import json
import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import warnings
import io
import base64
import traceback

# Suppress warnings for cleaner output
warnings.filterwarnings("ignore")

class PersistentCLIPService:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize CLIP model and processor"""
        try:
            print(json.dumps({"status": "initializing", "message": "Loading CLIP model..."}), flush=True)
            
            # Use CPU for consistent performance (GPU optional)
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            
            # Load CLIP model and processor
            model_name = "openai/clip-vit-base-patch32"
            self.model = CLIPModel.from_pretrained(model_name)
            self.processor = CLIPProcessor.from_pretrained(model_name)
            
            # Move model to device
            self.model = self.model.to(self.device)
            self.model.eval()  # Set to evaluation mode
            
            print(json.dumps({"status": "ready", "message": f"CLIP model loaded on {self.device}"}), flush=True)
            
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"Failed to initialize CLIP: {str(e)}"}), flush=True)
            sys.exit(1)
    
    def process_image_from_path(self, image_path):
        """Process image from file path"""
        try:
            # Load and process image
            image = Image.open(image_path).convert('RGB')
            
            # Get image features
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)
                # Normalize features
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            # Convert to numpy and then to list for JSON serialization
            embedding = image_features.cpu().numpy().flatten().tolist()
            
            return {
                "status": "success",
                "embedding": embedding,
                "dimensions": len(embedding)
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to process image: {str(e)}",
                "traceback": traceback.format_exc()
            }
    
    def process_image_from_base64(self, base64_data):
        """Process image from base64 string"""
        try:
            # Decode base64 image
            image_data = base64.b64decode(base64_data)
            image = Image.open(io.BytesIO(image_data)).convert('RGB')
            
            # Get image features
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                image_features = self.model.get_image_features(**inputs)
                # Normalize features
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            # Convert to numpy and then to list for JSON serialization
            embedding = image_features.cpu().numpy().flatten().tolist()
            
            return {
                "status": "success",
                "embedding": embedding,
                "dimensions": len(embedding)
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to process base64 image: {str(e)}",
                "traceback": traceback.format_exc()
            }
    
    def run_service(self):
        """Main service loop - processes requests from stdin"""
        print(json.dumps({"status": "service_ready", "message": "CLIP service ready for requests"}), flush=True)
        
        try:
            for line in sys.stdin:
                try:
                    request = json.loads(line.strip())
                    request_id = request.get("request_id")
                    
                    if request.get("action") == "process_image":
                        image_path = request.get("image_path")
                        if image_path:
                            result = self.process_image_from_path(image_path)
                        else:
                            result = {"status": "error", "message": "No image_path provided"}
                    
                    elif request.get("action") == "process_base64":
                        base64_data = request.get("base64_data")
                        if base64_data:
                            result = self.process_image_from_base64(base64_data)
                        else:
                            result = {"status": "error", "message": "No base64_data provided"}
                    
                    elif request.get("action") == "ping":
                        result = {"status": "pong", "message": "Service is alive"}
                    
                    elif request.get("action") == "shutdown":
                        print(json.dumps({"status": "shutdown", "message": "Service shutting down"}), flush=True)
                        break
                    
                    else:
                        result = {"status": "error", "message": f"Unknown action: {request.get('action')}"}
                    
                    # Add request_id to response if it was provided
                    if request_id:
                        result["request_id"] = request_id
                    
                    print(json.dumps(result), flush=True)
                    
                except json.JSONDecodeError:
                    print(json.dumps({"status": "error", "message": "Invalid JSON request"}), flush=True)
                except Exception as e:
                    print(json.dumps({"status": "error", "message": f"Request processing error: {str(e)}"}), flush=True)
                    
        except KeyboardInterrupt:
            print(json.dumps({"status": "shutdown", "message": "Service interrupted"}), flush=True)
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"Service error: {str(e)}"}), flush=True)

def main():
    """Main entry point"""
    service = PersistentCLIPService()
    service.run_service()

if __name__ == "__main__":
    main()
