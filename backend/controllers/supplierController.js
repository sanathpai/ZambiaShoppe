const Supplier = require('../models/Supplier');

exports.addSupplier = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const supplierData = { ...req.body, user_id };
    const supplierId = await Supplier.create(supplierData);
    res.status(201).json({ supplierId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllSuppliers = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const suppliers = await Supplier.findAllByUser(user_id);
    res.status(200).json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSupplier = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const supplier = await Supplier.findByIdAndUser(req.params.id, user_id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.status(200).json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const user_id = req.user.id;
    const supplierId = req.params.id;
    const success = await Supplier.updateByIdAndUser(supplierId, user_id, req.body);
    if (!success) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.status(200).json({ message: 'Supplier updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const success = await Supplier.deleteByIdAndUser(req.params.id, user_id);
    if (!success) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.status(200).json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
