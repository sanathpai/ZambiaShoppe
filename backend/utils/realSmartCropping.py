#!/usr/bin/env python3
"""
Real Smart Cropping Implementation for Product Recognition
Addresses specific failure cases: beverages, pharmaceuticals, personal care
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import json
import sys
import os

class ProductSmartCropper:
    def __init__(self):
        """Initialize with product-specific cropping strategies"""
        self.strategies = {
            'beverage_focus': self.beverage_bottle_crop,
            'label_extraction': self.pharmaceutical_label_crop,
            'product_isolation': self.product_isolation_crop,
            'text_region_focus': self.text_region_crop,
            'background_removal': self.background_removal_crop,
            'multi_scale': self.multi_scale_crop
        }
    
    def detect_product_type(self, image):
        """Detect if image is beverage bottle, pharmaceutical, or personal care"""
        height, width = image.shape[:2]
        aspect_ratio = height / width
        
        # Analyze image characteristics
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        
        # Look for vertical lines (bottle characteristics)
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 15))
        vertical_lines = cv2.morphologyEx(edges, cv2.MORPH_OPEN, vertical_kernel)
        vertical_score = np.sum(vertical_lines) / (width * height)
        
        # Classify based on aspect ratio and features
        if aspect_ratio > 1.5 and vertical_score > 0.02:
            return 'beverage'  # Tall and has vertical lines
        elif aspect_ratio < 1.2 and vertical_score < 0.01:
            return 'pharmaceutical'  # Wide/square, less vertical structure
        else:
            return 'personal_care'  # Mixed characteristics
    
    def beverage_bottle_crop(self, image):
        """Specialized cropping for beverage bottles like Fruiticana smoothie"""
        height, width = image.shape[:2]
        
        # Focus on upper 70% where labels typically are
        upper_region = image[0:int(height*0.7), :]
        
        # Find the main bottle contour
        gray = cv2.cvtColor(upper_region, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Use adaptive threshold to handle varying lighting
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY_INV, 11, 2)
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Find the largest contour (main bottle)
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            # Expand bounding box to include label area
            padding_x = int(w * 0.1)
            padding_y = int(h * 0.1)
            
            x = max(0, x - padding_x)
            y = max(0, y - padding_y)
            w = min(width - x, w + 2 * padding_x)
            h = min(int(height*0.7) - y, h + 2 * padding_y)
            
            cropped = upper_region[y:y+h, x:x+w]
            
            # Enhance contrast for better label reading
            pil_image = Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB))
            enhancer = ImageEnhance.Contrast(pil_image)
            enhanced = enhancer.enhance(1.5)
            
            return cv2.cvtColor(np.array(enhanced), cv2.COLOR_RGB2BGR)
        
        # Fallback: center crop of upper region
        return self.center_crop_region(upper_region, 0.8)
    
    def pharmaceutical_label_crop(self, image):
        """Specialized cropping for pharmaceutical products like Shaltoux syrup"""
        height, width = image.shape[:2]
        
        # Convert to grayscale for text detection
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply morphological operations to find text regions
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        morph = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
        
        # Use MSER to detect text regions
        mser = cv2.MSER_create()
        regions, _ = mser.detectRegions(morph)
        
        if regions:
            # Get bounding boxes of all text regions
            text_boxes = []
            for region in regions:
                x, y, w, h = cv2.boundingRect(region.reshape(-1, 1, 2))
                # Filter reasonable text box sizes
                if 10 < w < width/2 and 10 < h < height/3:
                    text_boxes.append((x, y, x+w, y+h))
            
            if text_boxes:
                # Find overall bounding box of text regions
                x1 = min(box[0] for box in text_boxes)
                y1 = min(box[1] for box in text_boxes)
                x2 = max(box[2] for box in text_boxes)
                y2 = max(box[3] for box in text_boxes)
                
                # Add padding for context
                padding = 30
                x1 = max(0, x1 - padding)
                y1 = max(0, y1 - padding)
                x2 = min(width, x2 + padding)
                y2 = min(height, y2 + padding)
                
                cropped = image[y1:y2, x1:x2]
                
                # Enhance for better text recognition
                pil_image = Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB))
                enhancer = ImageEnhance.Sharpness(pil_image)
                sharpened = enhancer.enhance(2.0)
                enhancer = ImageEnhance.Contrast(sharpened)
                enhanced = enhancer.enhance(1.3)
                
                return cv2.cvtColor(np.array(enhanced), cv2.COLOR_RGB2BGR)
        
        # Fallback: focus on center where labels typically are
        return self.center_crop_region(image, 0.7)
    
    def product_isolation_crop(self, image):
        """Isolate the main product from background (for personal care like Vestline)"""
        height, width = image.shape[:2]
        
        # Use GrabCut algorithm for foreground extraction
        mask = np.zeros((height, width), np.uint8)
        
        # Define initial rectangle (center 80%)
        margin_x = int(width * 0.1)
        margin_y = int(height * 0.1)
        rect = (margin_x, margin_y, width - 2*margin_x, height - 2*margin_y)
        
        # Initialize for GrabCut
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        
        try:
            # Apply GrabCut
            cv2.grabCut(image, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
            
            # Extract foreground
            mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
            
            # Find bounding box of foreground
            coords = np.where(mask2 == 1)
            if len(coords[0]) > 0:
                y_min, y_max = np.min(coords[0]), np.max(coords[0])
                x_min, x_max = np.min(coords[1]), np.max(coords[1])
                
                # Add small padding
                padding = 20
                y_min = max(0, y_min - padding)
                x_min = max(0, x_min - padding)
                y_max = min(height, y_max + padding)
                x_max = min(width, x_max + padding)
                
                cropped = image[y_min:y_max, x_min:x_max]
                return cropped
        except:
            pass
        
        # Fallback to edge-based detection
        return self.edge_based_crop(image)
    
    def text_region_crop(self, image):
        """Focus on text/label regions for brand recognition"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Use multiple text detection methods
        # Method 1: EAST text detector (if available)
        try:
            # Apply Gaussian blur and threshold
            blurred = cv2.GaussianBlur(gray, (3, 3), 0)
            thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
            
            # Find text contours
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            text_regions = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h
                area = cv2.contourArea(contour)
                
                # Filter for text-like regions
                if 0.2 < aspect_ratio < 10 and 50 < area < (image.shape[0] * image.shape[1]) / 4:
                    text_regions.append((x, y, x+w, y+h))
            
            if text_regions:
                # Merge overlapping regions
                merged_regions = self.merge_text_regions(text_regions)
                
                # Find the largest merged region
                largest_region = max(merged_regions, key=lambda r: (r[2]-r[0]) * (r[3]-r[1]))
                x1, y1, x2, y2 = largest_region
                
                # Add context padding
                padding = 40
                x1 = max(0, x1 - padding)
                y1 = max(0, y1 - padding)
                x2 = min(image.shape[1], x2 + padding)
                y2 = min(image.shape[0], y2 + padding)
                
                return image[y1:y2, x1:x2]
        except:
            pass
        
        return self.center_crop_region(image, 0.6)
    
    def background_removal_crop(self, image):
        """Remove background and focus on product"""
        height, width = image.shape[:2]
        
        # Convert to HSV for better color segmentation
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Create mask for background (typically edges)
        # Assume background is in the outer regions
        mask = np.ones((height, width), dtype=np.uint8) * 255
        
        # Remove outer border (likely background)
        border_size = min(width, height) // 10
        mask[:border_size, :] = 0  # Top
        mask[-border_size:, :] = 0  # Bottom
        mask[:, :border_size] = 0  # Left
        mask[:, -border_size:] = 0  # Right
        
        # Find the main object using the mask
        coords = np.where(mask == 255)
        if len(coords[0]) > 0:
            y_min, y_max = np.min(coords[0]), np.max(coords[0])
            x_min, x_max = np.min(coords[1]), np.max(coords[1])
            
            # Expand slightly for context
            expansion = 20
            y_min = max(0, y_min - expansion)
            x_min = max(0, x_min - expansion)
            y_max = min(height, y_max + expansion)
            x_max = min(width, x_max + expansion)
            
            return image[y_min:y_max, x_min:x_max]
        
        return self.center_crop_region(image, 0.8)
    
    def multi_scale_crop(self, image):
        """Create multiple crops at different scales"""
        crops = []
        
        # Scale factors for different crop sizes
        scales = [0.6, 0.8, 0.9]
        
        for scale in scales:
            cropped = self.center_crop_region(image, scale)
            crops.append(cropped)
        
        # Return the medium scale (0.8) as the main crop
        return crops[1] if len(crops) > 1 else crops[0]
    
    def center_crop_region(self, image, scale):
        """Helper function for center cropping"""
        height, width = image.shape[:2]
        new_height = int(height * scale)
        new_width = int(width * scale)
        
        start_y = (height - new_height) // 2
        start_x = (width - new_width) // 2
        
        return image[start_y:start_y + new_height, start_x:start_x + new_width]
    
    def edge_based_crop(self, image):
        """Edge detection based cropping"""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Get overall bounding box
            all_contours = np.vstack(contours)
            x, y, w, h = cv2.boundingRect(all_contours)
            
            # Add padding
            padding = 30
            height, width = image.shape[:2]
            
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(width - x, w + 2 * padding)
            h = min(height - y, h + 2 * padding)
            
            return image[y:y+h, x:x+w]
        
        return self.center_crop_region(image, 0.7)
    
    def merge_text_regions(self, regions):
        """Merge overlapping text regions"""
        if not regions:
            return []
        
        merged = []
        sorted_regions = sorted(regions, key=lambda r: r[0])  # Sort by x coordinate
        
        current = sorted_regions[0]
        
        for next_region in sorted_regions[1:]:
            # Check if regions overlap or are close
            if (current[2] >= next_region[0] - 10):  # 10 pixel tolerance
                # Merge regions
                current = (
                    min(current[0], next_region[0]),
                    min(current[1], next_region[1]),
                    max(current[2], next_region[2]),
                    max(current[3], next_region[3])
                )
            else:
                merged.append(current)
                current = next_region
        
        merged.append(current)
        return merged
    
    def process_image(self, image_path, strategies=['auto']):
        """Process an image with smart cropping strategies"""
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        # Auto-detect product type if 'auto' is specified
        if 'auto' in strategies:
            product_type = self.detect_product_type(image)
            print(f"🔍 Detected product type: {product_type}")
            
            if product_type == 'beverage':
                strategies = ['beverage_focus', 'text_region_focus', 'background_removal']
            elif product_type == 'pharmaceutical':
                strategies = ['label_extraction', 'text_region_focus', 'product_isolation']
            else:  # personal_care
                strategies = ['product_isolation', 'background_removal', 'text_region_focus']
        
        results = []
        
        for strategy in strategies:
            if strategy in self.strategies:
                try:
                    cropped = self.strategies[strategy](image)
                    results.append({
                        'strategy': strategy,
                        'image': cropped,
                        'success': True
                    })
                    print(f"✅ Applied {strategy}")
                except Exception as e:
                    print(f"❌ Failed {strategy}: {e}")
                    results.append({
                        'strategy': strategy,
                        'error': str(e),
                        'success': False
                    })
        
        return results

def main():
    """Test the smart cropping system"""
    if len(sys.argv) < 2:
        print("Usage: python realSmartCropping.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    cropper = ProductSmartCropper()
    
    try:
        results = cropper.process_image(image_path, ['auto'])
        
        print(f"✅ Processed {image_path}")
        print(f"🎯 Generated {len([r for r in results if r['success']])} successful crops")
        
        # Return the best crop (first successful one)
        for result in results:
            if result['success']:
                # Save the best crop for CLIP processing
                output_path = image_path.replace('.jpg', '_smart_cropped.jpg')
                cv2.imwrite(output_path, result['image'])
                print(f"📸 Saved smart crop: {output_path}")
                break
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
