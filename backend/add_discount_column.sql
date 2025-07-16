-- Migration script to add discount column to Sales and Purchases tables
-- Execute this in your database to add discount functionality

-- Add discount column to Sales table
ALTER TABLE Sales 
ADD COLUMN discount DECIMAL(10,2) DEFAULT 0.00 
COMMENT 'Discount amount for the sale transaction';

-- Add discount column to Purchases table
ALTER TABLE Purchases 
ADD COLUMN discount DECIMAL(10,2) DEFAULT 0.00 
COMMENT 'Discount amount for the purchase transaction';

-- Verify the changes
DESCRIBE Sales;
DESCRIBE Purchases;

-- Show sample data to verify the migration
SELECT sale_id, product_id, retail_price, quantity, discount 
FROM Sales 
LIMIT 5;

SELECT purchase_id, product_id, order_price, quantity, discount 
FROM Purchases 
LIMIT 5; 