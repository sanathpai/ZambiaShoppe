#!/usr/bin/env python3
"""
Smart Cropping Algorithms for Enhanced CLIP Performance
Implements multiple cropping strategies to improve product recognition accuracy
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import json
import sys
import os

class SmartCropper:
    def __init__(self):
        """Initialize the smart cropping system"""
        self.crop_strategies = {
            'center_crop': self.center_crop,
            'object_detection': self.object_detection_crop, 
            'edge_detection': self.edge_detection_crop,
            'saliency_crop': self.saliency_crop,
            'multi_region': self.multi_region_crop,
            'text_aware': self.text_aware_crop
        }
    
    def enhance_image_quality(self, image):
        """Enhance image quality before cropping"""
        # Convert to PIL for processing
        if isinstance(image, np.ndarray):
            image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        
        # Enhance contrast and sharpness
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.2)
        
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(1.1)
        
        # Reduce noise
        image = image.filter(ImageFilter.MedianFilter(size=3))
        
        return image
    
    def center_crop(self, image, crop_ratio=0.8):
        """
        Center crop to focus on the main product
        Removes background distractions from edges
        """
        height, width = image.shape[:2]
        
        # Calculate crop dimensions
        new_height = int(height * crop_ratio)
        new_width = int(width * crop_ratio)
        
        # Calculate crop coordinates (center)
        start_y = (height - new_height) // 2
        start_x = (width - new_width) // 2
        
        cropped = image[start_y:start_y + new_height, start_x:start_x + new_width]
        return cropped
    
    def object_detection_crop(self, image):
        """
        Use contour detection to find the main object and crop around it
        Good for products with clear boundaries
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Edge detection
        edges = cv2.Canny(blurred, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return self.center_crop(image)  # Fallback to center crop
        
        # Find the largest contour (likely the main product)
        largest_contour = max(contours, key=cv2.contourArea)
        
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Add padding around the object
        padding = 50
        height, width = image.shape[:2]
        
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(width - x, w + 2 * padding)
        h = min(height - y, h + 2 * padding)
        
        cropped = image[y:y + h, x:x + w]
        return cropped
    
    def edge_detection_crop(self, image):
        """
        Use edge detection to find product boundaries
        Effective for products with clear edges against backgrounds
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply bilateral filter to reduce noise while keeping edges sharp
        filtered = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Edge detection with adaptive thresholds
        edges = cv2.adaptiveThreshold(filtered, 255, cv2.ADAPTIVE_THRESH_MEAN_C, 
                                     cv2.THRESH_BINARY, 11, 2)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return self.center_crop(image)
        
        # Get bounding box of all significant contours
        all_points = np.vstack([contour.reshape(-1, 2) for contour in contours 
                               if cv2.contourArea(contour) > 100])
        
        x, y, w, h = cv2.boundingRect(all_points)
        
        # Add small padding
        padding = 20
        height, width = image.shape[:2]
        
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(width - x, w + 2 * padding)
        h = min(height - y, h + 2 * padding)
        
        cropped = image[y:y + h, x:x + w]
        return cropped
    
    def saliency_crop(self, image):
        """
        Use saliency detection to find the most important regions
        Good for complex scenes with multiple objects
        """
        # Create saliency detector
        saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
        
        # Compute saliency map
        success, saliency_map = saliency.computeSaliency(image)
        
        if not success:
            return self.center_crop(image)
        
        # Convert to 8-bit
        saliency_map = (saliency_map * 255).astype(np.uint8)
        
        # Find the most salient region
        _, thresh = cv2.threshold(saliency_map, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Find contours of salient regions
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return self.center_crop(image)
        
        # Get bounding box of the largest salient region
        largest_contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Add padding
        padding = 30
        height, width = image.shape[:2]
        
        x = max(0, x - padding)
        y = max(0, y - padding)
        w = min(width - x, w + 2 * padding)
        h = min(height - y, h + 2 * padding)
        
        cropped = image[y:y + h, x:x + w]
        return cropped
    
    def multi_region_crop(self, image):
        """
        Create multiple crop regions to capture different aspects of the product
        Returns multiple crops that can be analyzed separately
        """
        height, width = image.shape[:2]
        crops = []
        
        # Strategy 1: Center crop (80%)
        center_crop = self.center_crop(image, 0.8)
        crops.append(('center_80', center_crop))
        
        # Strategy 2: Tighter center crop (60%)
        tight_crop = self.center_crop(image, 0.6)
        crops.append(('center_60', tight_crop))
        
        # Strategy 3: Upper portion (for bottles/vertical products)
        upper_crop = image[0:int(height*0.7), int(width*0.1):int(width*0.9)]
        crops.append(('upper_region', upper_crop))
        
        # Strategy 4: Central square (for square products)
        size = min(height, width)
        start_x = (width - size) // 2
        start_y = (height - size) // 2
        square_crop = image[start_y:start_y + size, start_x:start_x + size]
        crops.append(('center_square', square_crop))
        
        return crops
    
    def text_aware_crop(self, image):
        """
        Detect text regions and ensure they're included in the crop
        Good for products where brand/label text is important
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Use MSER (Maximally Stable Extremal Regions) for text detection
        mser = cv2.MSER_create()
        regions, _ = mser.detectRegions(gray)
        
        if not regions:
            return self.center_crop(image)
        
        # Get bounding boxes of all text regions
        text_bboxes = []
        for region in regions:
            x, y, w, h = cv2.boundingRect(region.reshape(-1, 1, 2))
            # Filter out very small or very large regions
            if 10 < w < image.shape[1]/3 and 10 < h < image.shape[0]/3:
                text_bboxes.append((x, y, x+w, y+h))
        
        if not text_bboxes:
            return self.center_crop(image)
        
        # Find overall bounding box that includes all text regions
        x1 = min(bbox[0] for bbox in text_bboxes)
        y1 = min(bbox[1] for bbox in text_bboxes)
        x2 = max(bbox[2] for bbox in text_bboxes)
        y2 = max(bbox[3] for bbox in text_bboxes)
        
        # Add padding around text regions
        padding = 50
        height, width = image.shape[:2]
        
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(width, x2 + padding)
        y2 = min(height, y2 + padding)
        
        cropped = image[y1:y2, x1:x2]
        return cropped
    
    def process_image(self, image_path, strategies=['center_crop', 'object_detection', 'multi_region']):
        """
        Process an image with multiple cropping strategies
        """
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        # Enhance image quality first
        enhanced_pil = self.enhance_image_quality(image)
        enhanced = cv2.cvtColor(np.array(enhanced_pil), cv2.COLOR_RGB2BGR)
        
        results = {'original_image': image_path, 'crops': []}
        
        for strategy in strategies:
            if strategy in self.crop_strategies:
                try:
                    if strategy == 'multi_region':
                        crops = self.crop_strategies[strategy](enhanced)
                        for crop_name, crop_image in crops:
                            results['crops'].append({
                                'strategy': f"{strategy}_{crop_name}",
                                'image': crop_image,
                                'success': True
                            })
                    else:
                        crop_image = self.crop_strategies[strategy](enhanced)
                        results['crops'].append({
                            'strategy': strategy,
                            'image': crop_image,
                            'success': True
                        })
                except Exception as e:
                    results['crops'].append({
                        'strategy': strategy,
                        'error': str(e),
                        'success': False
                    })
        
        return results

def main():
    """Command line interface for testing cropping algorithms"""
    if len(sys.argv) < 2:
        print("Usage: python smartCropping.py <image_path> [output_dir]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "cropped_outputs"
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    cropper = SmartCropper()
    
    try:
        # Process with all strategies
        results = cropper.process_image(image_path, 
                                      ['center_crop', 'object_detection', 'edge_detection', 
                                       'saliency_crop', 'multi_region', 'text_aware'])
        
        print(f"✅ Processed {image_path}")
        print(f"🎯 Generated {len([c for c in results['crops'] if c['success']])} successful crops")
        
        # Save cropped images
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        
        for i, crop_result in enumerate(results['crops']):
            if crop_result['success']:
                output_path = os.path.join(output_dir, f"{base_name}_{crop_result['strategy']}.jpg")
                cv2.imwrite(output_path, crop_result['image'])
                print(f"   📸 Saved: {output_path}")
            else:
                print(f"   ❌ Failed: {crop_result['strategy']} - {crop_result.get('error', 'Unknown error')}")
        
        print("✅ Cropping completed successfully")
        
    except Exception as e:
        print(f"❌ Error processing image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
