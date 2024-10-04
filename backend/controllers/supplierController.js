const Supplier = require('../models/Supplier');

// Add supplier or market
exports.addSupplier = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const { supplier_name, market_name, contact_info, location } = req.body;
    console.log(req.body);
    // Prepare the supplier or market data based on the existence of supplier_name or market_name
    const supplierData = {
      user_id,
      supplier_name: supplier_name || null,  // Add supplier name only if supplier_name is provided
      market_name: market_name || null,  // Add market name only if market_name is provided
      contact_info,
      location
    };

    console.log("This is Supplier Data" );
    console.log(supplierData);

    const supplierId = await Supplier.create(supplierData);
    res.status(201).json({ supplierId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all suppliers or markets for the user
exports.getAllSuppliers = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const suppliers = await Supplier.findAllByUser(user_id);
    res.status(200).json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a specific supplier or market by ID
exports.getSupplier = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const supplier = await Supplier.findByIdAndUser(req.params.id, user_id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier or market not found' });
    }
    res.status(200).json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update supplier or market
exports.updateSupplier = async (req, res) => {
  try {
    const user_id = req.user.id;
    const supplierId = req.params.id;
    const { supplier_name, market_name, contact_info, location } = req.body;

    // Prepare the updated data based on whether it's a supplier or market
    const updatedSupplier = {
      supplier_name: supplier_name || null,  // Update supplier_name if provided
      market_name: market_name || null,  // Update market_name if provided
      contact_info,
      location
    };

    const success = await Supplier.updateByIdAndUser(supplierId, user_id, updatedSupplier);
    if (!success) {
      return res.status(404).json({ error: 'Supplier or market not found' });
    }
    res.status(200).json({ message: 'Supplier or market updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete supplier or market
exports.deleteSupplier = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const success = await Supplier.deleteByIdAndUser(req.params.id, user_id);
    if (!success) {
      return res.status(404).json({ error: 'Supplier or market not found' });
    }
    res.status(200).json({ message: 'Supplier or market deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
