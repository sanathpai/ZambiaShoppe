# Discount Feature Implementation

This document outlines the implementation of discount functionality across Customer Transaction, Add Sale, and Add Purchase features.

## Database Changes

### Migration Required
Run the following SQL script in your database to add discount columns:

```sql
-- File: backend/add_discount_column.sql
ALTER TABLE Sales 
ADD COLUMN discount DECIMAL(10,2) DEFAULT 0.00 
COMMENT 'Discount amount for the sale transaction';

ALTER TABLE Purchases 
ADD COLUMN discount DECIMAL(10,2) DEFAULT 0.00 
COMMENT 'Discount amount for the purchase transaction';
```

## Features Implemented

### 1. Customer Transaction
- **Single discount field** for the entire transaction (not per product)
- **Default value**: 0
- **Grand Total calculation**: Automatically updates to reflect discount (Grand Total = Subtotal - Discount)
- **Discount distribution**: When logging sales, the discount is proportionally distributed across all items based on their contribution to the subtotal
- **UI**: Discount input field placed next to Grand Total with validation (minimum 0)
- **Confirmation Modal**: Shows subtotal, discount (if > 0), and grand total separately for clarity

### 2. Add Sale
- **Single discount field** for individual sales
- **Default value**: 0 
- **UI**: Discount input field in the form with helper text "Optional discount amount"
- **Validation**: Minimum value of 0, step of 0.01
- **Form reset**: Discount resets to 0 after successful submission

### 3. Add Purchase
- **Single discount field** for individual purchases
- **Default value**: 0
- **UI**: Discount input field placed after Order Price field
- **Validation**: Minimum value of 0, step of 0.01
- **Form reset**: Discount resets to 0 after successful submission

## Backend Changes

### Models Updated
- **Sale.js**: Added discount parameter (default 0) to create and update operations
- **Purchase.js**: Added discount parameter (default 0) to create and update operations

### Controllers Updated
- **saleController.js**: Added discount extraction from request body and passes to Sale model
- **purchaseController.js**: Added discount extraction from request body and passes to Purchase model

## Frontend Changes

### Components Updated
1. **CustomerTransaction.js**:
   - Added discount state
   - Added useEffect for grand total calculation including discount
   - Added discount input field with proper styling
   - Updated confirmation modal to show subtotal, discount, and grand total
   - Added proportional discount distribution in handleLogSales function

2. **AddSale.js**:
   - Added discount state
   - Added discount input field to form
   - Added discount to sale data submission
   - Added discount reset in form reset

3. **AddPurchase.js**:
   - Added discount state  
   - Added discount input field to form
   - Added discount to purchase data submission
   - Added discount reset in form reset

## How to Test

1. **Run the database migration** script to add discount columns
2. **Restart your backend** server to pick up model changes
3. **Test Customer Transaction**:
   - Add multiple items
   - Enter a discount amount
   - Verify Grand Total updates correctly (Subtotal - Discount)
   - Submit and verify each sale record gets proportional discount
4. **Test Add Sale**:
   - Add a sale with discount
   - Verify it saves correctly
5. **Test Add Purchase**:
   - Add a purchase with discount
   - Verify it saves correctly

## Notes

- All discount values are stored as DECIMAL(10,2) in the database
- Frontend validation ensures discount cannot be negative
- In Customer Transaction, discount is applied to the whole transaction and distributed proportionally
- In Add Sale and Add Purchase, discount applies to the individual record
- Existing records will have discount = 0.00 by default 