-- Add auto-populating date columns for analytics purposes
-- These columns are useful for analysis when the database is exported

-- 1. Add date_created column to Products table
-- This will track when each product was originally created
ALTER TABLE Products 
ADD COLUMN date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
COMMENT 'Auto-populated timestamp of when the product was created';

-- 2. Add date_first_viewed column to UserInsightViews table
-- This will track when a user first viewed their insights
ALTER TABLE UserInsightViews 
ADD COLUMN date_first_viewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
COMMENT 'Auto-populated timestamp of when the user first viewed insights';

-- For existing Products records, set date_created to current timestamp
-- This is a one-time update for existing data
UPDATE Products 
SET date_created = CURRENT_TIMESTAMP 
WHERE date_created IS NULL;

-- For existing UserInsightViews records, set date_first_viewed to last_viewed_at 
-- to maintain historical accuracy
UPDATE UserInsightViews 
SET date_first_viewed = last_viewed_at 
WHERE date_first_viewed IS NULL;

-- Verify the changes
SELECT 'Products table structure:' as info;
DESCRIBE Products;

SELECT 'UserInsightViews table structure:' as info;
DESCRIBE UserInsightViews;

-- Show sample data to verify the migration
SELECT 'Sample Products data:' as info;
SELECT product_id, product_name, date_created 
FROM Products 
ORDER BY product_id 
LIMIT 5;

SELECT 'Sample UserInsightViews data:' as info;
SELECT id, user_id, last_viewed_at, date_first_viewed 
FROM UserInsightViews 
ORDER BY id 
LIMIT 5;
