#!/usr/bin/env python3
"""
Universal Image Enhancement for CLIP Accuracy
General improvements that work for all product types
"""

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import json
import sys
import os

class UniversalImageEnhancer:
    def __init__(self):
        """Initialize with universal enhancement techniques"""
        self.enhancement_methods = [
            'adaptive_enhance',
            'contrast_optimization', 
            'noise_reduction',
            'edge_enhancement',
            'color_normalization',
            'background_removal',
            'intelligent_crop'
        ]
    
    def enhance_image(self, image_path):
        """Apply universal enhancements to improve CLIP accuracy"""
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        print(f"🎯 Applying universal enhancements to improve CLIP accuracy...")
        
        # Apply enhancement pipeline
        enhanced_image = self.apply_enhancement_pipeline(image)
        
        # Save enhanced image
        output_path = image_path.replace('.jpg', '_enhanced.jpg')
        cv2.imwrite(output_path, enhanced_image)
        
        print(f"✅ Enhanced image saved: {output_path}")
        return output_path
    
    def apply_enhancement_pipeline(self, image):
        """Apply a sequence of universal enhancements"""
        # 1. Adaptive contrast enhancement
        enhanced = self.adaptive_contrast_enhancement(image)
        
        # 2. Noise reduction while preserving details
        enhanced = self.smart_noise_reduction(enhanced)
        
        # 3. Edge enhancement for better feature extraction
        enhanced = self.edge_enhancement(enhanced)
        
        # 4. Color normalization
        enhanced = self.color_normalization(enhanced)
        
        # 5. Histogram equalization for better exposure
        enhanced = self.adaptive_histogram_equalization(enhanced)
        
        # 6. Background removal and intelligent cropping
        enhanced = self.remove_background_and_crop(enhanced)
        
        return enhanced
    
    def adaptive_contrast_enhancement(self, image):
        """Enhance contrast adaptively based on image characteristics"""
        # Convert to LAB color space for better contrast control
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to L channel
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        l_enhanced = clahe.apply(l)
        
        # Merge back
        enhanced_lab = cv2.merge([l_enhanced, a, b])
        enhanced = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        
        print("✅ Applied adaptive contrast enhancement")
        return enhanced
    
    def smart_noise_reduction(self, image):
        """Reduce noise while preserving important details"""
        # Use bilateral filter - reduces noise while keeping edges sharp
        denoised = cv2.bilateralFilter(image, 9, 75, 75)
        
        # Blend with original to preserve fine details
        alpha = 0.7  # Weight for denoised image
        enhanced = cv2.addWeighted(denoised, alpha, image, 1-alpha, 0)
        
        print("✅ Applied smart noise reduction")
        return enhanced
    
    def edge_enhancement(self, image):
        """Enhance edges to improve feature detection"""
        # Convert to grayscale for edge detection
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Laplacian edge detection
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        laplacian = np.uint8(np.absolute(laplacian))
        
        # Create a 3-channel version of the edge mask
        edge_mask = cv2.cvtColor(laplacian, cv2.COLOR_GRAY2BGR)
        
        # Blend edges with original image (subtle enhancement)
        edge_weight = 0.2
        enhanced = cv2.addWeighted(image, 1.0, edge_mask, edge_weight, 0)
        
        print("✅ Applied edge enhancement")
        return enhanced
    
    def color_normalization(self, image):
        """Normalize colors for better consistency"""
        # Convert to PIL for easier color manipulation
        pil_image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        
        # Enhance color balance
        enhancer = ImageEnhance.Color(pil_image)
        color_enhanced = enhancer.enhance(1.1)  # Slightly boost color saturation
        
        # Enhance brightness slightly
        enhancer = ImageEnhance.Brightness(color_enhanced)
        brightness_enhanced = enhancer.enhance(1.05)  # Very subtle brightness boost
        
        # Convert back to OpenCV format
        enhanced = cv2.cvtColor(np.array(brightness_enhanced), cv2.COLOR_RGB2BGR)
        
        print("✅ Applied color normalization")
        return enhanced
    
    def adaptive_histogram_equalization(self, image):
        """Apply adaptive histogram equalization for better exposure"""
        # Convert to YUV color space
        yuv = cv2.cvtColor(image, cv2.COLOR_BGR2YUV)
        y, u, v = cv2.split(yuv)
        
        # Apply adaptive histogram equalization to Y channel
        clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8,8))
        y_eq = clahe.apply(y)
        
        # Merge back
        enhanced_yuv = cv2.merge([y_eq, u, v])
        enhanced = cv2.cvtColor(enhanced_yuv, cv2.COLOR_YUV2BGR)
        
        print("✅ Applied adaptive histogram equalization")
        return enhanced
    
    def intelligent_crop(self, image):
        """Apply intelligent cropping to focus on the main subject"""
        height, width = image.shape[:2]
        
        # Find the main subject using edge detection and contours
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Use adaptive threshold for better edge detection
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY_INV, 11, 2)
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Find the largest contour (likely the main subject)
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            # Expand the bounding box to include context
            padding_x = int(w * 0.15)  # 15% padding
            padding_y = int(h * 0.15)
            
            x = max(0, x - padding_x)
            y = max(0, y - padding_y)
            w = min(width - x, w + 2 * padding_x)
            h = min(height - y, h + 2 * padding_y)
            
            # Ensure minimum size (don't crop too aggressively)
            min_size = min(width, height) * 0.6
            if w >= min_size and h >= min_size:
                cropped = image[y:y+h, x:x+w]
                print("✅ Applied intelligent cropping")
                return cropped
        
        # If intelligent cropping fails, apply gentle center crop
        crop_factor = 0.85  # Remove only outer 15%
        new_height = int(height * crop_factor)
        new_width = int(width * crop_factor)
        
        start_y = (height - new_height) // 2
        start_x = (width - new_width) // 2
        
        cropped = image[start_y:start_y + new_height, start_x:start_x + new_width]
        print("✅ Applied gentle center crop")
        return cropped
    
    def quality_assessment(self, original_image, enhanced_image):
        """Assess the quality improvement"""
        # Calculate sharpness using Laplacian variance
        def calculate_sharpness(img):
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            return cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Calculate contrast using standard deviation
        def calculate_contrast(img):
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            return gray.std()
        
        original_sharpness = calculate_sharpness(original_image)
        enhanced_sharpness = calculate_sharpness(enhanced_image)
        
        original_contrast = calculate_contrast(original_image)
        enhanced_contrast = calculate_contrast(enhanced_image)
        
        return {
            'sharpness_improvement': enhanced_sharpness / original_sharpness if original_sharpness > 0 else 1.0,
            'contrast_improvement': enhanced_contrast / original_contrast if original_contrast > 0 else 1.0,
            'overall_score': (enhanced_sharpness / original_sharpness + enhanced_contrast / original_contrast) / 2 if original_sharpness > 0 and original_contrast > 0 else 1.0
        }
    
    def remove_background_and_crop(self, image):
        """Remove background and intelligently crop to focus on the main product"""
        height, width = image.shape[:2]
        
        print("🎯 Applying background removal and intelligent cropping...")
        
        # Method 1: Try GrabCut for sophisticated background removal
        try:
            grabcut_result = self.grabcut_background_removal(image)
            if grabcut_result is not None:
                print("✅ GrabCut background removal successful")
                return grabcut_result
        except Exception as e:
            print(f"⚠️ GrabCut failed: {e}")
        
        # Method 2: Fallback to contour-based detection
        try:
            contour_result = self.contour_based_crop(image)
            if contour_result is not None:
                print("✅ Contour-based cropping successful")
                return contour_result
        except Exception as e:
            print(f"⚠️ Contour-based cropping failed: {e}")
        
        # Method 3: Final fallback to gentle center crop
        print("✅ Applying gentle center crop as fallback")
        return self.gentle_center_crop(image)
    
    def grabcut_background_removal(self, image):
        """Use GrabCut algorithm to remove background and focus on product"""
        height, width = image.shape[:2]
        
        # Create mask for GrabCut
        mask = np.zeros((height, width), np.uint8)
        
        # Define initial rectangle (center 70% of image)
        margin_x = int(width * 0.15)
        margin_y = int(height * 0.15)
        rect = (margin_x, margin_y, width - 2*margin_x, height - 2*margin_y)
        
        # Initialize background and foreground models
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        
        # Apply GrabCut
        cv2.grabCut(image, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        
        # Extract foreground
        mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
        
        # Find bounding box of foreground
        coords = np.where(mask2 == 1)
        if len(coords[0]) == 0:
            return None
        
        y_min, y_max = np.min(coords[0]), np.max(coords[0])
        x_min, x_max = np.min(coords[1]), np.max(coords[1])
        
        # Add padding around the detected product
        padding_x = int((x_max - x_min) * 0.1)
        padding_y = int((y_max - y_min) * 0.1)
        
        x_min = max(0, x_min - padding_x)
        y_min = max(0, y_min - padding_y)
        x_max = min(width, x_max + padding_x)
        y_max = min(height, y_max + padding_y)
        
        # Ensure minimum size (don't crop too aggressively)
        crop_width = x_max - x_min
        crop_height = y_max - y_min
        min_width = width * 0.4
        min_height = height * 0.4
        
        if crop_width < min_width or crop_height < min_height:
            return None
        
        # Extract the product region
        cropped = image[y_min:y_max, x_min:x_max]
        return cropped
    
    def contour_based_crop(self, image):
        """Use contour detection to find and crop the main product"""
        height, width = image.shape[:2]
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Use adaptive threshold for better edge detection
        thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                       cv2.THRESH_BINARY_INV, 11, 2)
        
        # Apply morphological operations to close gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # Find the largest contour (likely the main product)
        largest_contour = max(contours, key=cv2.contourArea)
        contour_area = cv2.contourArea(largest_contour)
        
        # Only proceed if the contour is significant
        total_area = width * height
        if contour_area < total_area * 0.1:  # At least 10% of image
            return None
        
        # Get bounding box
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Add padding
        padding_x = int(w * 0.15)
        padding_y = int(h * 0.15)
        
        x = max(0, x - padding_x)
        y = max(0, y - padding_y)
        w = min(width - x, w + 2 * padding_x)
        h = min(height - y, h + 2 * padding_y)
        
        # Ensure minimum size
        if w < width * 0.4 or h < height * 0.4:
            return None
        
        return image[y:y+h, x:x+w]
    
    def gentle_center_crop(self, image):
        """Apply a gentle center crop as final fallback"""
        height, width = image.shape[:2]
        
        # Remove only outer 10% from each side
        crop_factor = 0.8
        new_height = int(height * crop_factor)
        new_width = int(width * crop_factor)
        
        start_y = (height - new_height) // 2
        start_x = (width - new_width) // 2
        
        return image[start_y:start_y + new_height, start_x:start_x + new_width]

def main():
    """Test the universal enhancement system"""
    if len(sys.argv) < 2:
        print("Usage: python universalImageEnhancer.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    enhancer = UniversalImageEnhancer()
    
    try:
        # Load original for comparison
        original_image = cv2.imread(image_path)
        
        # Apply enhancement
        enhanced_path = enhancer.enhance_image(image_path)
        
        # Load enhanced image
        enhanced_image = cv2.imread(enhanced_path)
        
        # Assess quality improvement
        quality_metrics = enhancer.quality_assessment(original_image, enhanced_image)
        
        print(f"📊 Quality Assessment:")
        print(f"   Sharpness improvement: {quality_metrics['sharpness_improvement']:.2f}x")
        print(f"   Contrast improvement: {quality_metrics['contrast_improvement']:.2f}x")
        print(f"   Overall score: {quality_metrics['overall_score']:.2f}")
        
        print(f"SUCCESS:{enhanced_path}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
