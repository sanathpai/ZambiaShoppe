// Quick test to see what's wrong with enhanced routes
const express = require('express');
const router = express.Router();

// Simple test route first
router.post('/enhanced-search', async (req, res) => {
  console.log('🎯 Enhanced CLIP search request received');
  console.log('Body:', req.body);
  
  try {
    const { image, strategies = ['center_crop'] } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    console.log('✅ Image received, processing with strategies:', strategies);
    
    // For now, just return a test response to see if the route works
    res.json({
      success: true,
      results: [
        {
          product_id: 1,
          product_name: "Test Enhanced Product",
          brand: "Enhanced Brand",
          variety: "Test Variety",
          size: "100ml",
          similarity: 0.95
        }
      ],
      count: 1,
      cropping_strategies: strategies,
      enhanced: true,
      message: "Enhanced CLIP route is working!"
    });
    
  } catch (error) {
    console.error('❌ Enhanced CLIP error:', error);
    res.status(500).json({
      success: false,
      error: 'Enhanced CLIP search failed',
      details: error.message 
    });
  }
});

router.post('/analyze-cropping', async (req, res) => {
  console.log('📊 Cropping analysis request received');
  
  res.json({
    success: true,
    analysis: [
      { strategy: 'center_crop', effectiveness_score: 0.85 },
      { strategy: 'object_detection', effectiveness_score: 0.92 },
      { strategy: 'text_aware', effectiveness_score: 0.78 }
    ],
    recommendations: ["Use object_detection for best results"]
  });
});

module.exports = router;
