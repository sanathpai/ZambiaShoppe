-- Migration script to update Product table structure
-- 1. Rename description column to size
-- 2. Drop category column
-- Execute this in your database to complete the product field changes

-- First, add the size column with data from description
ALTER TABLE Products 
ADD COLUMN size VARCHAR(255) DEFAULT NULL 
COMMENT 'Product size information (e.g., 300ml, 1L, Small, Medium, Large)';

-- Copy data from description to size column
UPDATE Products 
SET size = description 
WHERE description IS NOT NULL AND description != '';

-- Drop the category column
ALTER TABLE Products 
DROP COLUMN category;

-- Drop the description column (after copying data to size)
ALTER TABLE Products 
DROP COLUMN description;

-- Verify the changes
DESCRIBE Products;

-- Show sample data to verify the migration
SELECT product_id, product_name, variety, brand, size 
FROM Products 
LIMIT 5; 