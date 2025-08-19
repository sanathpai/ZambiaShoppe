# Auto-Populating Date Columns Implementation

## Overview
This implementation adds two auto-populating date columns for analytics purposes:

1. **`date_created`** in the `Products` table - tracks when each product was originally created
2. **`date_first_viewed`** in the `UserInsightViews` table - tracks when a user first viewed their business insights

## Files Created/Modified

### New Files:
- `add_date_columns.sql` - Database migration script
- `test_date_columns.js` - Test script to verify implementation
- `APPLY_DATE_COLUMNS.md` - This documentation file

### Existing Files:
- **No changes needed** to existing code files! The columns use `DEFAULT CURRENT_TIMESTAMP` so they auto-populate without code changes.

## How to Apply

### Step 1: Run the Database Migration
```bash
# Connect to your MySQL database and run the migration
mysql -u [username] -p [database_name] < backend/add_date_columns.sql

# Or if using a specific host
mysql -h [host] -u [username] -p [database_name] < backend/add_date_columns.sql
```

### Step 2: Verify the Implementation (Optional)
```bash
# Run the test script to verify everything works
cd backend
node test_date_columns.js
```

### Step 3: Clean Up (Optional)
```bash
# Remove the test file after verification
rm backend/test_date_columns.js
```

## What the Migration Does

### Products Table Changes:
- Adds `date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP` column
- Backfills existing products with current timestamp
- All new products will automatically get creation timestamp

### UserInsightViews Table Changes:
- Adds `date_first_viewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP` column  
- Backfills existing records with their `last_viewed_at` value for historical accuracy
- All new insight view records will automatically get creation timestamp

## Technical Details

### Column Specifications:
```sql
-- Products table
date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
COMMENT 'Auto-populated timestamp of when the product was created'

-- UserInsightViews table  
date_first_viewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
COMMENT 'Auto-populated timestamp of when the user first viewed insights'
```

### No Code Changes Required:
- **Product.js** - No changes needed. The `create()` method will automatically populate `date_created`
- **insightsController.js** - No changes needed. The INSERT for `UserInsightViews` will automatically populate `date_first_viewed`

## Benefits for Analytics

### Product Analytics:
- Track product creation trends over time
- Analyze user behavior patterns in product creation
- Export data with creation timestamps for business intelligence

### Insights Analytics:
- Track when users first engaged with business insights
- Measure time between user registration and first insights view
- Analyze insights adoption patterns

## Database Export Benefits

When exporting the database for analysis, these columns will provide valuable temporal context:

```sql
-- Example analytics queries you can now run:

-- Products created per month
SELECT 
    DATE_FORMAT(date_created, '%Y-%m') as month,
    COUNT(*) as products_created
FROM Products 
GROUP BY DATE_FORMAT(date_created, '%Y-%m')
ORDER BY month;

-- Users who viewed insights vs creation date
SELECT 
    u.username,
    u.created_at as user_created,
    uiv.date_first_viewed as insights_first_viewed,
    DATEDIFF(uiv.date_first_viewed, u.created_at) as days_to_first_view
FROM Users u
LEFT JOIN UserInsightViews uiv ON u.id = uiv.user_id
ORDER BY days_to_first_view;
```

## Rollback (If Needed)

If you need to rollback these changes:

```sql
-- Remove the new columns
ALTER TABLE Products DROP COLUMN date_created;
ALTER TABLE UserInsightViews DROP COLUMN date_first_viewed;
```

## Summary

✅ **Ready to apply** - Migration script is complete  
✅ **No breaking changes** - Existing application code works unchanged  
✅ **Analytics ready** - New columns provide valuable temporal data  
✅ **Auto-populating** - No manual intervention required for new records
