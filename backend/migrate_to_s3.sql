-- Migration script to change image storage from base64 to S3 URLs
-- Execute this after setting up S3 infrastructure

-- Backup existing data (optional but recommended)
-- CREATE TABLE Products_backup AS SELECT * FROM Products WHERE image IS NOT NULL;

-- Modify image column to store URLs instead of base64 data
ALTER TABLE Products 
MODIFY COLUMN image VARCHAR(500) DEFAULT NULL 
COMMENT 'S3 URL for product image';

-- Add index for better performance when filtering by image existence
CREATE INDEX idx_products_image ON Products(image);

-- Verify the change
DESCRIBE Products; 