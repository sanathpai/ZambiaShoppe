const Unit = require('../models/Unit');
const ProductOffering = require('../models/ProductOffering');

exports.addUnit = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const { product_id, buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b } = req.body;

    // Fetch all units associated with the product
    const existingUnits = await Unit.findByProductIdAndUser(product_id, user_id);

    let unitId;

    // Check if any existing units have default values
    const defaultUnit = existingUnits.find(unit => unit.buying_unit_type === 'default' && unit.selling_unit_type === 'default');

    if (defaultUnit) {
      // Update the default unit
      await Unit.updateByIdAndUser(defaultUnit.unit_id, user_id, {
        product_id,
        buying_unit_size,
        selling_unit_size,
        buying_unit_type,
        selling_unit_type,
        prepackaged,
        prepackaged_b,
      });
      unitId = defaultUnit.unit_id;
    } else {
      // Create a new unit
      unitId = await Unit.create({
        product_id,
        buying_unit_size,
        selling_unit_size,
        buying_unit_type,
        selling_unit_type,
        prepackaged,
        prepackaged_b,
        user_id,
      });
    }

    res.status(201).json({ unitId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUnit = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const unit = await Unit.findByIdAndUser(req.params.id, user_id);
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.status(200).json(unit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllUnits = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const units = await Unit.findAllByUser(user_id);
    res.status(200).json(units);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUnitsByProductId = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const units = await Unit.findByProductIdAndUser(req.params.productId, user_id);
    res.status(200).json(units);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const { product_id, buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b } = req.body;
    const { id } = req.params;

    const updatedUnit = { product_id, buying_unit_size, selling_unit_size, buying_unit_type, selling_unit_type, prepackaged, prepackaged_b };
    const result = await Unit.updateByIdAndUser(id, user_id, updatedUnit);

    if (!result) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.status(200).json({ message: 'Unit updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUnit = async (req, res) => {
  try {
    const user_id = req.user.id; // Assuming req.user contains the authenticated user's id
    const { id } = req.params;

    // Get the product offering IDs related to the unit
    const offerings = await ProductOffering.findByUnitIdAndUser(id, user_id);
    const offeringIds = offerings.map(offering => offering.offering_id);

    // Delete dependent rows in ProductOfferings
    if (offeringIds.length > 0) {
      const deleteProductOfferings = await ProductOffering.deleteByUnitIdAndUser(id, user_id);
    }

    // Now delete the unit
    const result = await Unit.deleteByIdAndUser(id, user_id);
    if (!result) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.status(200).json({ message: 'Unit and associated product offerings deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
