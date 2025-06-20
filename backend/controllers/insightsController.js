const db = require('../config/db');

// Get insights data for a specific user
const getInsightsData = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Query to get insights for the user
    const query = `
      SELECT 
        id,
        user_id,
        insight1,
        insight2,
        insight3,
        insight4,
        insight5,
        last_updated,
        created_at,
        version_number
      FROM Insights 
      WHERE user_id = ?
      ORDER BY last_updated DESC 
      LIMIT 1
    `;

    const [results] = await db.execute(query, [userId]);
    
    if (results.length === 0) {
      return res.status(404).json({ 
        error: 'No insights found for this user',
        message: 'Insights will be available once your professor adds them for your shop.'
      });
    }

    const insight = results[0];
    
    res.json({
      id: insight.id,
      user_id: insight.user_id,
      insight1: insight.insight1,
      insight2: insight.insight2,
      insight3: insight.insight3,
      insight4: insight.insight4,
      insight5: insight.insight5,
      last_updated: insight.last_updated,
      created_at: insight.created_at,
      version_number: insight.version_number
    });

  } catch (error) {
    console.error('Error fetching insights data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Check if user has new insights since last viewed
const checkNewInsights = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get latest insight version for user
    const insightQuery = `
      SELECT version_number, last_updated 
      FROM Insights 
      WHERE user_id = ? 
      ORDER BY last_updated DESC 
      LIMIT 1
    `;
    
    const [insightResults] = await db.execute(insightQuery, [userId]);
    
    if (insightResults.length === 0) {
      return res.json({ 
        hasNew: false, 
        message: 'No insights available yet' 
      });
    }

    const latestVersion = insightResults[0].version_number;
    const lastUpdated = insightResults[0].last_updated;

    // Get user's last viewed version
    const viewQuery = `
      SELECT last_viewed_version, last_viewed_at 
      FROM UserInsightViews 
      WHERE user_id = ?
    `;
    
    const [viewResults] = await db.execute(viewQuery, [userId]);
    
    let hasNew = true;
    let lastViewed = null;
    
    if (viewResults.length > 0) {
      const lastViewedVersion = viewResults[0].last_viewed_version;
      lastViewed = viewResults[0].last_viewed_at;
      hasNew = latestVersion > lastViewedVersion;
    }

    res.json({
      hasNew,
      lastViewed,
      currentVersion: latestVersion,
      lastUpdated
    });

  } catch (error) {
    console.error('Error checking new insights:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark insights as viewed by user
const markInsightsViewed = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get current version number
    const versionQuery = `
      SELECT version_number 
      FROM Insights 
      WHERE user_id = ? 
      ORDER BY last_updated DESC 
      LIMIT 1
    `;
    
    const [versionResults] = await db.execute(versionQuery, [userId]);
    
    if (versionResults.length === 0) {
      return res.status(404).json({ error: 'No insights found for this user' });
    }

    const currentVersion = versionResults[0].version_number;

    // Update or insert view record
    const upsertQuery = `
      INSERT INTO UserInsightViews (user_id, last_viewed_at, last_viewed_version)
      VALUES (?, NOW(), ?)
      ON DUPLICATE KEY UPDATE
      last_viewed_at = NOW(),
      last_viewed_version = ?
    `;

    await db.execute(upsertQuery, [userId, currentVersion, currentVersion]);

    res.json({ 
      success: true, 
      message: 'Insights marked as viewed',
      viewedVersion: currentVersion
    });

  } catch (error) {
    console.error('Error marking insights as viewed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get insights statistics for a user
const getInsightsStats = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get insights count and latest version
    const statsQuery = `
      SELECT 
        COUNT(*) as total_insights,
        MAX(version_number) as latest_version,
        MAX(last_updated) as last_updated
      FROM Insights 
      WHERE user_id = ?
    `;

    const [statsResults] = await db.execute(statsQuery, [userId]);
    
    // Get view statistics
    const viewQuery = `
      SELECT 
        last_viewed_at,
        last_viewed_version
      FROM UserInsightViews 
      WHERE user_id = ?
    `;

    const [viewResults] = await db.execute(viewQuery, [userId]);

    const stats = {
      totalInsights: statsResults[0].total_insights,
      latestVersion: statsResults[0].latest_version || 0,
      lastUpdated: statsResults[0].last_updated,
      lastViewed: viewResults.length > 0 ? viewResults[0].last_viewed_at : null,
      lastViewedVersion: viewResults.length > 0 ? viewResults[0].last_viewed_version : 0
    };

    res.json(stats);

  } catch (error) {
    console.error('Error fetching insights stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create or update insights (for professor's use)
const createOrUpdateInsights = async (req, res) => {
  try {
    const { 
      user_id, 
      insight1, 
      insight2, 
      insight3, 
      insight4, 
      insight5 
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if insights exist for this user
    const existingQuery = `
      SELECT id, version_number 
      FROM Insights 
      WHERE user_id = ? 
      ORDER BY last_updated DESC 
      LIMIT 1
    `;

    const [existingResults] = await db.execute(existingQuery, [user_id]);
    
    let newVersion = 1;
    if (existingResults.length > 0) {
      newVersion = existingResults[0].version_number + 1;
    }

    // Insert new insights record
    const insertQuery = `
      INSERT INTO Insights (
        user_id, insight1, insight2, insight3, insight4, insight5, version_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(insertQuery, [
      user_id, insight1, insight2, insight3, insight4, insight5, newVersion
    ]);

    res.json({
      success: true,
      message: 'Insights created/updated successfully',
      insightId: result.insertId,
      version: newVersion
    });

  } catch (error) {
    console.error('Error creating/updating insights:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getInsightsData,
  checkNewInsights,
  markInsightsViewed,
  getInsightsStats,
  createOrUpdateInsights
}; 