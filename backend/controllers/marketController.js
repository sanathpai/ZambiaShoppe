// controllers/marketController.js
const Market = require('../models/Market');

exports.addMarket = async (req, res) => {
  try {
    const user_id = req.user.id;
    const marketData = { ...req.body, user_id };
    const marketId = await Market.create(marketData);
    res.status(201).json({ marketId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllMarkets = async (req, res) => {
  try {
    const user_id = req.user.id;
    const markets = await Market.findAllByUser(user_id);
    res.status(200).json(markets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMarketById = async (req, res) => {
  try {
    const user_id = req.user.id;
    const market = await Market.findByIdAndUser(req.params.id, user_id);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }
    res.status(200).json(market);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateMarket = async (req, res) => {
  try {
    const user_id = req.user.id;
    const marketId = req.params.id;
    const marketData = { ...req.body };

    const result = await Market.updateByIdAndUser(marketId, user_id, marketData);
    if (!result) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.status(200).json({ message: 'Market updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMarket = async (req, res) => {
  try {
    const user_id = req.user.id;
    const marketId = req.params.id;
    const result = await Market.deleteByIdAndUser(marketId, user_id);
    if (!result) {
      return res.status(404).json({ error: 'Market not found' });
    }
    res.status(200).json({ message: 'Market deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
