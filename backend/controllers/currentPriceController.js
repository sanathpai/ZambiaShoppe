const CurrentPrice = require('../models/CurrentPrice');

// Get current price for a specific product-unit combination
exports.getCurrentPrice = async (req, res) => {
  try {
    const { productId, unitId } = req.params;
    const user_id = req.user.id;

    const currentPrice = await CurrentPrice.findByProductAndUnit(productId, unitId, user_id);
    
    if (!currentPrice) {
      return res.status(404).json({ 
        message: 'No current price found for this product-unit combination',
        retail_price: 0.00,
        order_price: 0.00
      });
    }

    res.status(200).json(currentPrice);
  } catch (error) {
    console.error('Error fetching current price:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all current prices for the authenticated user
exports.getAllCurrentPrices = async (req, res) => {
  try {
    const user_id = req.user.id;
    const currentPrices = await CurrentPrice.findAllByUser(user_id);
    res.status(200).json(currentPrices);
  } catch (error) {
    console.error('Error fetching current prices:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get current prices for a specific product (all units)
exports.getCurrentPricesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const user_id = req.user.id;
    
    const currentPrices = await CurrentPrice.findByProduct(productId, user_id);
    res.status(200).json(currentPrices);
  } catch (error) {
    console.error('Error fetching current prices for product:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get price suggestions for a product (includes units without prices)
exports.getPriceSuggestions = async (req, res) => {
  try {
    const { productId } = req.params;
    const user_id = req.user.id;
    
    const suggestions = await CurrentPrice.getPriceSuggestions(productId, user_id);
    res.status(200).json(suggestions);
  } catch (error) {
    console.error('Error fetching price suggestions:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create or update current price
exports.upsertCurrentPrice = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { product_id, unit_id, retail_price, order_price } = req.body;

    if (!product_id || !unit_id) {
      return res.status(400).json({ error: 'Product ID and Unit ID are required' });
    }

    const currentPriceData = {
      product_id,
      unit_id,
      user_id,
      retail_price: retail_price || 0.00,
      order_price: order_price || 0.00
    };

    const currentPriceId = await CurrentPrice.upsert(currentPriceData);
    
    // Fetch the updated/created record to return
    const updatedPrice = await CurrentPrice.findByProductAndUnit(product_id, unit_id, user_id);
    
    res.status(200).json({
      message: 'Current price updated successfully',
      current_price_id: currentPriceId,
      ...updatedPrice
    });
  } catch (error) {
    console.error('Error updating current price:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update only retail price
exports.updateRetailPrice = async (req, res) => {
  try {
    const { productId, unitId } = req.params;
    const { retail_price } = req.body;
    const user_id = req.user.id;

    if (retail_price === undefined || retail_price === null) {
      return res.status(400).json({ error: 'Retail price is required' });
    }

    await CurrentPrice.updateRetailPrice(productId, unitId, user_id, retail_price);
    
    const updatedPrice = await CurrentPrice.findByProductAndUnit(productId, unitId, user_id);
    res.status(200).json({
      message: 'Retail price updated successfully',
      ...updatedPrice
    });
  } catch (error) {
    console.error('Error updating retail price:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update only order price
exports.updateOrderPrice = async (req, res) => {
  try {
    const { productId, unitId } = req.params;
    const { order_price } = req.body;
    const user_id = req.user.id;

    if (order_price === undefined || order_price === null) {
      return res.status(400).json({ error: 'Order price is required' });
    }

    await CurrentPrice.updateOrderPrice(productId, unitId, user_id, order_price);
    
    const updatedPrice = await CurrentPrice.findByProductAndUnit(productId, unitId, user_id);
    res.status(200).json({
      message: 'Order price updated successfully',
      ...updatedPrice
    });
  } catch (error) {
    console.error('Error updating order price:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete current price
exports.deleteCurrentPrice = async (req, res) => {
  try {
    const { productId, unitId } = req.params;
    const user_id = req.user.id;

    const deleted = await CurrentPrice.deleteByProductAndUnit(productId, unitId, user_id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Current price not found' });
    }

    res.status(200).json({ message: 'Current price deleted successfully' });
  } catch (error) {
    console.error('Error deleting current price:', error);
    res.status(500).json({ error: error.message });
  }
}; 