const Shop = require('../models/Shop');

exports.addShop = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const shopData = { ...req.body, user_id };
    const shopId = await Shop.create(shopData);
    res.status(201).json({ shopId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    res.status(200).json(shop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllShops = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const shops = await Shop.findAllByUser(user_id);
    res.status(200).json(shops);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateShop = async (req, res) => {
  try {
    const shopId = req.params.id;
    const shopData = { ...req.body };
    const result = await Shop.update(shopId, shopData);
    if (result === 0) {
      return res.status(404).json({ error: 'Shop not found or no changes made' });
    }
    res.status(200).json({ message: 'Shop updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteShop = async (req, res) => {
  try {
    const shopId = req.params.id;
    const result = await Shop.delete(shopId);
    if (result === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    res.status(200).json({ message: 'Shop deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};