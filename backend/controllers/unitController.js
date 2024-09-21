const Unit = require('../models/Unit');
const db = require('../config/db');

// Add or update a unit
// exports.addUnit = async (req, res) => {
//   try {
//     const user_id = req.user.id; // Authenticated user's ID
//     const { product_id, unit_type, unit_category, opposite_unit_id, prepackaged, conversion_rate } = req.body;

//     console.log(`Adding unit for product ID: ${product_id} for user ID: ${user_id}`);

//     // Fetch all units associated with the product for the user
//     const existingUnits = await Unit.findByProductIdAndUser(product_id, user_id);
//     console.log(`Existing units for product ID ${product_id}: ${JSON.stringify(existingUnits)}`);

//     let unitId;

//     // Check if the unit with the same type and category already exists
//     const sameUnit = existingUnits.find(unit => unit.unit_type === unit_type && unit.unit_category === unit_category);
//     if (sameUnit) {
//       console.log(`Unit with same type and category already exists: ${JSON.stringify(sameUnit)}`);
//       return res.status(400).json({ error: 'Unit with the same type and category already exists.' });
//     }

//     // Create a new unit
//     console.log(`Creating new unit with type: ${unit_type} and category: ${unit_category}`);
//     unitId = await Unit.create({
//       product_id,
//       unit_type,
//       unit_category,
//       opposite_unit_id,
//       prepackaged,
//       user_id,
//     });

//     console.log(`New unit created with ID: ${unitId}`);

//     // Insert the conversion between this new unit and the opposite unit (if provided)
//     if (opposite_unit_id && conversion_rate > 0 && unitId !== opposite_unit_id) {
//       await db.query(
//         'INSERT INTO Unit_Conversion (product_id, from_unit_id, to_unit_id, conversion_rate, user_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE conversion_rate = ?',
//         [product_id, unit_category === 'buying' ? unitId : opposite_unit_id, unit_category === 'selling' ? unitId : opposite_unit_id, conversion_rate, user_id, conversion_rate]
//       );
//       console.log(`Inserted conversion rate for new unit ID: ${unitId} with opposite unit ID: ${opposite_unit_id}`);
//     } else {
//       console.log('No valid opposite unit or conversion rate for this unit.');
//     }

//     res.status(201).json({ unitId });
//   } catch (error) {
//     console.error('Error during unit creation or update:', error);
//     res.status(500).json({ error: error.message });
//   }
// };
// Add or update a unit (for the first time)


// Add or update a unit
exports.addUnit = async (req, res) => {
  const connection = await db.getConnection(); // Get the DB connection
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const { product_id, buying_unit_type, selling_unit_type, prepackaged_b, prepackaged, conversion_rate, newUnitType, selectedExistingUnit } = req.body;

    console.log(`Adding units for product ID: ${product_id} for user ID: ${user_id}`);
    await connection.beginTransaction();

    // Step 1: Fetch existing units for this product and user
    const existingUnits = await Unit.findByProductIdAndUser(product_id, user_id);

    if (existingUnits.length === 0) {
      // ------------------------------
      // FIRST-TIME LOGIC
      // ------------------------------
      // No units exist for this product, so we create both buying and selling units

      console.log("First-time logic: Adding both buying and selling units");

      // Step 2: Create the buying unit
      const buyingUnitData = {
        product_id,
        unit_type: buying_unit_type,
        unit_category: 'buying',
        opposite_unit_id: null, // Set after selling unit is created
        prepackaged: prepackaged_b,
        user_id
      };
      const buyingUnitId = await Unit.create(buyingUnitData, connection);
      console.log(`Buying unit created with ID: ${buyingUnitId}`);

      // Step 3: Create the selling unit, with opposite_unit_id pointing to the buying unit
      const sellingUnitData = {
        product_id,
        unit_type: selling_unit_type,
        unit_category: 'selling',
        opposite_unit_id: buyingUnitId,
        prepackaged: prepackaged,
        user_id
      };
      const sellingUnitId = await Unit.create(sellingUnitData, connection);
      console.log(`Selling unit created with ID: ${sellingUnitId}`);

      // Step 4: Update the buying unit's opposite_unit_id to the selling unit
      await Unit.updateByIdAndUser(buyingUnitId, user_id, {
        product_id: product_id, // Use the product ID already known
        unit_type: buying_unit_type, // Use the unit type from request body
        unit_category: 'buying', // Set the category as 'buying'
        opposite_unit_id: sellingUnitId, // Set the opposite unit ID to the newly created selling unit
        prepackaged: prepackaged_b
      });
      console.log(`Buying unit ID: ${buyingUnitId} updated with opposite unit ID: ${sellingUnitId}`);

      // Step 5: Insert the conversion rates between the buying and selling units
      await db.query(
        'INSERT INTO Unit_Conversion (product_id, from_unit_id, to_unit_id, conversion_rate, user_id) VALUES (?, ?, ?, ?, ?)',
        [product_id, buyingUnitId, sellingUnitId, conversion_rate, user_id]
      );
      await db.query(
        'INSERT INTO Unit_Conversion (product_id, from_unit_id, to_unit_id, conversion_rate, user_id) VALUES (?, ?, ?, ?, ?)',
        [product_id, sellingUnitId, buyingUnitId, 1 / conversion_rate, user_id]
      );
      console.log(`Conversion rates added between buying unit ID: ${buyingUnitId} and selling unit ID: ${sellingUnitId}`);
    } else {
      // ------------------------------
      // SUBSEQUENT ADDITIONS LOGIC
      // ------------------------------
      // Some units already exist for this product, so we only add one new unit and a single conversion rate

      console.log("Subsequent addition logic: Adding only one new unit and conversion");

      // Step 1: Create the new unit (either buying or selling)
      const newUnitData = {
        product_id,
        unit_type: newUnitType,
        unit_category: newUnitType === 'buying' ? 'buying' : 'selling', // Based on user input
        opposite_unit_id: selectedExistingUnit, // Reference to the existing unit
        prepackaged,
        user_id
      };

      const newUnitId = await Unit.create(newUnitData, connection);
      console.log(`New unit created with ID: ${newUnitId}`);

      // Step 2: Insert the conversion rate between the new unit and the selected existing unit
      await db.query(
        'INSERT INTO Unit_Conversion (product_id, from_unit_id, to_unit_id, conversion_rate, user_id) VALUES (?, ?, ?, ?, ?)',
        [product_id, newUnitId, selectedExistingUnit, conversion_rate, user_id]
      );
      console.log(`Conversion added between existing unit ID: ${selectedExistingUnit} and new unit ID: ${newUnitId}`);
    }

    // Commit the transaction
    await connection.commit();
    res.status(201).json({ message: 'Unit(s) added successfully' });

  } catch (error) {
    console.error('Error during unit creation:', error);
    if (connection) await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
};



// Get a single unit by ID
exports.getUnit = async (req, res) => {
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const unit = await Unit.findByIdAndUser(req.params.id, user_id);
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.status(200).json(unit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all units for the authenticated user
exports.getAllUnits = async (req, res) => {
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const units = await Unit.findAllByUser(user_id);
    res.status(200).json(units);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all units by product ID
exports.getUnitsByProductId = async (req, res) => {
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const units = await Unit.findByProductIdAndUser(req.params.productId, user_id);
    res.status(200).json(units);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an existing unit
exports.updateUnit = async (req, res) => {
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const { product_id, unit_type, unit_category, opposite_unit_id, prepackaged, conversion_rate } = req.body;
    const { id } = req.params;

    const updatedUnit = { product_id, unit_type, unit_category, opposite_unit_id, prepackaged };
    const result = await Unit.updateByIdAndUser(id, user_id, updatedUnit);

    if (!result) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Update the conversion rate between this unit and the opposite unit
    if (conversion_rate > 0 && id !== opposite_unit_id) {
      await db.query(
        'UPDATE Unit_Conversion SET conversion_rate = ? WHERE product_id = ? AND ((from_unit_id = ? AND to_unit_id = ?) OR (from_unit_id = ? AND to_unit_id = ?))',
        [conversion_rate, product_id, id, opposite_unit_id, opposite_unit_id, id]
      );
    }

    res.status(200).json({ message: 'Unit and conversion updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a unit
exports.deleteUnit = async (req, res) => {
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const { id } = req.params;

    // Delete rows in Unit_Conversion
    await db.query('DELETE FROM Unit_Conversion WHERE from_unit_id = ? OR to_unit_id = ? AND user_id = ?', [id, id, user_id]);

    // Now delete the unit
    const result = await Unit.deleteByIdAndUser(id, user_id);
    if (!result) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    res.status(200).json({ message: 'Unit and conversions deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};