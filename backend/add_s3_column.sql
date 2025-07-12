-- Add S3 URL column while keeping existing base64 image column
-- This allows for gradual migration and fallback support

-- Add new column for S3 URLs
ALTER TABLE Products 
ADD COLUMN image_s3_url VARCHAR(500) DEFAULT NULL 
COMMENT 'S3 URL for product image (preferred when available)';

-- Add index for better performance
CREATE INDEX idx_products_image_s3 ON Products(image_s3_url);

-- Verify the changes
DESCRIBE Products; 