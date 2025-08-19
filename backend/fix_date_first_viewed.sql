-- Fix the date_first_viewed column to properly reflect when users FIRST viewed insights
-- The previous migration incorrectly set it to migration time instead of actual first view time

-- For existing UserInsightViews records, set date_first_viewed to last_viewed_at
-- This assumes that the current last_viewed_at represents when they first viewed (since there's only one record per user)
-- This is the best approximation we have for historical "first view" data
UPDATE UserInsightViews 
SET date_first_viewed = last_viewed_at 
WHERE date_first_viewed > last_viewed_at OR date_first_viewed IS NULL;

-- For future records, the column will auto-populate with CURRENT_TIMESTAMP when a user first views insights
-- This will happen automatically when new records are inserted

-- Verify the fix
SELECT 'Fixed UserInsightViews data:' as info;
SELECT 
    id, 
    user_id, 
    last_viewed_at, 
    date_first_viewed,
    CASE 
        WHEN date_first_viewed <= last_viewed_at THEN 'Correct' 
        ELSE 'Needs fixing' 
    END as status
FROM UserInsightViews 
ORDER BY id 
LIMIT 10;
