const Unit = require('../models/Unit');
const db = require('../config/db');



// Add or update a unit
exports.addUnit = async (req, res) => {
  const connection = await db.getConnection(); // Get the DB connection
  try {
    const user_id = req.user.id; // Authenticated user's ID
    console.log(req.body)
    const { product_id, buying_unit_type, selling_unit_type, unitCategory, prepackaged_b, prepackaged, conversion_rate, newUnitType, selectedExistingUnit } = req.body;

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
        unit_category: unitCategory, // Based on user input
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
exports.getUnit= async (req, res) => {
  try {
    const unitId = req.params.id;
    const userId = req.user.id; // Assuming you have the authenticated user ID available in `req.user`
    console.log(`Fetching details for unit ID: ${unitId} for user ID: ${userId}`);

    // Fetch unit details from the Units table with the user's ID
    const [unitRows] = await db.query(
      'SELECT * FROM Units WHERE unit_id = ? AND user_id = ?', 
      [unitId, userId]
    );
    const unit = unitRows[0];
    
    if (!unit) {
      console.error('No unit found for the specified ID and user.');
      return res.status(404).json({ error: 'Unit not found' });
    }

    console.log('Unit details from database:', unit);

    // Fetch the type of the opposite unit using `opposite_unit_id` and `user_id`
    const [oppositeRows] = await db.query(
      'SELECT unit_type FROM Units WHERE unit_id = ? AND user_id = ?', 
      [unit.opposite_unit_id, userId]
    );
    const oppositeUnit = oppositeRows[0];
    console.log('Opposite unit details:', oppositeUnit);

    // Fetch the conversion rate from the Unit_Conversion table with `user_id`
    const [conversionRows] = await db.query(
      'SELECT conversion_rate FROM Unit_Conversion WHERE ((from_unit_id = ? AND to_unit_id = ?) OR (from_unit_id = ? AND to_unit_id = ?)) AND user_id = ?',
      [unitId, unit.opposite_unit_id, unit.opposite_unit_id, unitId, userId]
    );
    const conversion = conversionRows[0];
    console.log('Conversion details:', conversion);

    // Combine all the required data
    const unitDetails = {
      product_id: unit.product_id,
      unit_type: unit.unit_type,
      unit_category: unit.unit_category,
      opposite_unit_type: oppositeUnit ? oppositeUnit.unit_type : null,
      prepackaged: unit.prepackaged === 1,
      conversion_factor: conversion ? conversion.conversion_rate : null,
    };

    console.log('Final unit details to return:', unitDetails);
    res.status(200).json(unitDetails);
  } catch (error) {
    console.error('Error fetching unit details:', error);
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

    // Update or insert the conversion rate between this unit and the opposite unit
    if (conversion_rate > 0 && id !== opposite_unit_id) {
      // Check if the current conversion exists
      const [existingConversion] = await db.query(
        'SELECT * FROM Unit_Conversion WHERE product_id = ? AND from_unit_id = ? AND to_unit_id = ?',
        [product_id, id, opposite_unit_id]
      );

      if (existingConversion.length > 0) {
        // Update the existing conversion rate from id -> opposite_unit_id
        await db.query(
          'UPDATE Unit_Conversion SET conversion_rate = ? WHERE product_id = ? AND from_unit_id = ? AND to_unit_id = ?',
          [conversion_rate, product_id, id, opposite_unit_id]
        );
      } else {
        // Insert the conversion if it doesn't exist
        await db.query(
          'INSERT INTO Unit_Conversion (product_id, from_unit_id, to_unit_id, conversion_rate, user_id) VALUES (?, ?, ?, ?, ?)',
          [product_id, id, opposite_unit_id, conversion_rate, user_id]
        );
      }

      // Check if the reverse conversion (opposite_unit_id -> id) exists
      const [reverseConversion] = await db.query(
        'SELECT * FROM Unit_Conversion WHERE product_id = ? AND from_unit_id = ? AND to_unit_id = ?',
        [product_id, opposite_unit_id, id]
      );

      if (reverseConversion.length > 0) {
        // Calculate the precise reverse conversion rate
        const preciseReverseRate = parseFloat((1 / conversion_rate).toPrecision(10));
        console.log("this is the reverse rate:",preciseReverseRate);

        // Update the reverse conversion rate to be precise 1/conversion_rate
        await db.query(
          'UPDATE Unit_Conversion SET conversion_rate = ? WHERE product_id = ? AND from_unit_id = ? AND to_unit_id = ?',
          [preciseReverseRate, product_id, opposite_unit_id, id]
        );
      }
      // Do nothing if the reverse conversion does not exist
    }

    res.status(200).json({ message: 'Unit and conversion updated successfully' });
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ error: error.message });
  }
};



// Delete a unit
exports.deleteUnit = async (req, res) => {
  try {
    const user_id = req.user.id; // Authenticated user's ID
    const { id } = req.params;

    // Find the product associated with this unit
    const [unit] = await db.query('SELECT product_id FROM Units WHERE unit_id = ? AND user_id = ?', [id, user_id]);

    if (unit.length === 0) {
      return res.status(404).json({ error: 'Unit not found or you do not have permission to delete this unit' });
    }

    const product_id = unit[0].product_id;

    // Delete entries in Inventories, Purchases, and Sales associated with this unit and product
    await db.query('DELETE FROM Inventories WHERE unit_id = ? AND product_id = ? AND user_id = ?', [id, product_id, user_id]);
    await db.query('DELETE FROM Purchases WHERE unit_id = ? AND product_id = ? AND user_id = ?', [id, product_id, user_id]);
    await db.query('DELETE FROM Sales WHERE unit_id = ? AND product_id = ? AND user_id = ?', [id, product_id, user_id]);

    // Delete rows in Unit_Conversion
    await db.query('DELETE FROM Unit_Conversion WHERE (from_unit_id = ? OR to_unit_id = ?) AND user_id = ?', [id, id, user_id]);

    // Now delete the unit
    const result = await Unit.deleteByIdAndUser(id, user_id);
    if (!result) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    res.status(200).json({ message: 'Unit, associated inventories, purchases, sales, and conversions deleted successfully' });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({ error: error.message });
  }
};
