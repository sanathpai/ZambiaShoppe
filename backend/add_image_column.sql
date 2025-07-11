-- Add image column to Products table
-- This column will store base64 encoded image data for products
-- Execute this SQL command in your database to add image support

ALTER TABLE Products 
ADD COLUMN image LONGTEXT DEFAULT NULL 
COMMENT 'Base64 encoded image data for the product';

-- Verify the column was added
DESCRIBE Products; 