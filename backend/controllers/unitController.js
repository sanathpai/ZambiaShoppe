const Unit = require('../models/Unit');
const CurrentPrice = require('../models/CurrentPrice');
const db = require('../config/db');



// Add or update a unit
exports.addUnit = async (req, res) => {
  const connection = await db.getConnection(); // Get the DB connection
  try {
    console.log("I am here",req.body);
    const user_id = req.user.id; // Authenticated user's ID
    console.log('=== UNIT CREATION DEBUG ===');
    console.log('Adding unit with price data for user:', user_id);
    console.log('Request body received:', JSON.stringify(req.body, null, 2));
    
    const { 
      product_id, 
      buying_unit_type, 
      selling_unit_type, 
      unitCategory, 
      prepackaged_b, 
      prepackaged, 
      conversion_rate, 
      newUnitType, 
      selectedExistingUnit, 
      retail_price, 
      order_price 
    } = req.body;

    console.log('Extracted price data:');
    console.log('- retail_price:', retail_price, '(type:', typeof retail_price, ')');
    console.log('- order_price:', order_price, '(type:', typeof order_price, ')');
    console.log('==============================');

    console.log(`Adding units for product ID: ${product_id} for user ID: ${user_id}`);
    await connection.beginTransaction();

    // Step 1: Fetch existing units for this product and user
    const existingUnits = await Unit.findByProductIdAndUser(product_id, user_id);

    // Check if this is a first-time request format or subsequent addition format
    const isFirstTimeFormat = buying_unit_type && selling_unit_type && !newUnitType;
    const isSubsequentFormat = newUnitType && selectedExistingUnit && unitCategory;

    if (existingUnits.length === 0 || isFirstTimeFormat) {
      // ------------------------------
      // FIRST-TIME LOGIC (or frontend sent first-time format despite existing units)
      // ------------------------------
      
      if (existingUnits.length > 0 && isFirstTimeFormat) {
        console.log("⚠️ WARNING: Existing units found but frontend sent first-time format. Converting to first-time creation.");
      }

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
      }, connection);
      console.log(`Buying unit ID: ${buyingUnitId} updated with opposite unit ID: ${sellingUnitId}`);

      // Step 5: Insert the conversion rates between the buying and selling units
      await connection.query(
        'INSERT INTO Unit_Conversion (product_id, from_unit_id, to_unit_id, conversion_rate, user_id) VALUES (?, ?, ?, ?, ?)',
        [product_id, buyingUnitId, sellingUnitId, conversion_rate, user_id]
      );
      await connection.query(
        'INSERT INTO Unit_Conversion (product_id, from_unit_id, to_unit_id, conversion_rate, user_id) VALUES (?, ?, ?, ?, ?)',
        [product_id, sellingUnitId, buyingUnitId, 1 / conversion_rate, user_id]
      );
      console.log(`Conversion rates added between buying unit ID: ${buyingUnitId} and selling unit ID: ${sellingUnitId}`);

      // Step 6: Create current prices for both units if provided
      // For buying unit: order_price goes to order_price, retail_price stays 0 (buying units don't have retail prices)
      if (order_price && order_price.toString().trim() !== '' && !isNaN(parseFloat(order_price))) {
        console.log('Creating current prices for buying unit with order_price:', order_price);
        console.log('Order price type:', typeof order_price, 'parsed:', parseFloat(order_price));
        
        try {
          const buyingPriceId = await CurrentPrice.upsert({
            product_id,
            unit_id: buyingUnitId,
            user_id,
            retail_price: 0.00, // Buying units typically don't have retail prices
            order_price: parseFloat(order_price) || 0.00
          }, connection); // Pass the transaction connection
          console.log('✅ SUCCESS: Buying unit current price created/updated with ID:', buyingPriceId);
        } catch (priceError) {
          console.error('❌ ERROR: Failed to create buying unit price:', priceError);
          throw priceError;
        }
      } else {
        console.log('⚠️ SKIPPED: No valid order_price provided for buying unit - skipping price creation');
        console.log('order_price value:', order_price, 'type:', typeof order_price);
      }
      
      // For selling unit: retail_price goes to retail_price, order_price stays 0 (selling units don't have order prices)
      if (retail_price && retail_price.toString().trim() !== '' && !isNaN(parseFloat(retail_price))) {
        console.log('Creating current prices for selling unit with retail_price:', retail_price);
        console.log('Retail price type:', typeof retail_price, 'parsed:', parseFloat(retail_price));
        
        try {
          const sellingPriceId = await CurrentPrice.upsert({
            product_id,
            unit_id: sellingUnitId,
            user_id,
            retail_price: parseFloat(retail_price) || 0.00,
            order_price: 0.00 // Selling units typically don't have order prices
          }, connection); // Pass the transaction connection
          console.log('✅ SUCCESS: Selling unit current price created/updated with ID:', sellingPriceId);
        } catch (priceError) {
          console.error('❌ ERROR: Failed to create selling unit price:', priceError);
          throw priceError;
        }
      } else {
        console.log('⚠️ SKIPPED: No valid retail_price provided for selling unit - skipping price creation');
        console.log('retail_price value:', retail_price, 'type:', typeof retail_price);
      }

    } else {
      // ------------------------------
      // SUBSEQUENT ADDITIONS LOGIC
      // ------------------------------
      // Some units already exist for this product, and we have subsequent format data

      if (!isSubsequentFormat) {
        throw new Error('Invalid request format: Expected subsequent addition format (newUnitType, selectedExistingUnit, unitCategory) but received incomplete data.');
      }

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
      await connection.query(
        'INSERT INTO Unit_Conversion (product_id, from_unit_id, to_unit_id, conversion_rate, user_id) VALUES (?, ?, ?, ?, ?)',
        [product_id, newUnitId, selectedExistingUnit, conversion_rate, user_id]
      );
      console.log(`Conversion added between existing unit ID: ${selectedExistingUnit} and new unit ID: ${newUnitId}`);

      // Step 3: Create current prices for the new unit based on its category
      if (unitCategory === 'buying' && order_price && order_price.toString().trim() !== '' && !isNaN(parseFloat(order_price))) {
        console.log('Creating current prices for new buying unit with order_price:', order_price);
        console.log('Order price type:', typeof order_price, 'parsed:', parseFloat(order_price));
        
        try {
          const newBuyingPriceId = await CurrentPrice.upsert({
            product_id,
            unit_id: newUnitId,
            user_id,
            retail_price: 0.00, // Buying units don't have retail prices
            order_price: parseFloat(order_price) || 0.00
          }, connection); // Pass the transaction connection
          console.log('✅ SUCCESS: New buying unit current price created/updated with ID:', newBuyingPriceId);
        } catch (priceError) {
          console.error('❌ ERROR: Failed to create new buying unit price:', priceError);
          throw priceError;
        }
      } else if (unitCategory === 'selling' && retail_price && retail_price.toString().trim() !== '' && !isNaN(parseFloat(retail_price))) {
        console.log('Creating current prices for new selling unit with retail_price:', retail_price);
        console.log('Retail price type:', typeof retail_price, 'parsed:', parseFloat(retail_price));
        
        try {
          const newSellingPriceId = await CurrentPrice.upsert({
            product_id,
            unit_id: newUnitId,
            user_id,
            retail_price: parseFloat(retail_price) || 0.00,
            order_price: 0.00 // Selling units don't have order prices
          }, connection); // Pass the transaction connection
          console.log('✅ SUCCESS: New selling unit current price created/updated with ID:', newSellingPriceId);
        } catch (priceError) {
          console.error('❌ ERROR: Failed to create new selling unit price:', priceError);
          throw priceError;
        }
      } else {
        console.log('⚠️ SKIPPED: No valid price data provided for new unit or conditions not met');
        console.log('- unitCategory:', unitCategory);
        console.log('- order_price:', order_price, typeof order_price, 'valid:', order_price && order_price.toString().trim() !== '' && !isNaN(parseFloat(order_price)));
        console.log('- retail_price:', retail_price, typeof retail_price, 'valid:', retail_price && retail_price.toString().trim() !== '' && !isNaN(parseFloat(retail_price)));
        console.log('- Condition for buying:', unitCategory === 'buying' && order_price && order_price.toString().trim() !== '' && !isNaN(parseFloat(order_price)));
        console.log('- Condition for selling:', unitCategory === 'selling' && retail_price && retail_price.toString().trim() !== '' && !isNaN(parseFloat(retail_price)));
      }
    }

    // Commit the transaction
    await connection.commit();
    console.log('✅ Unit(s) and prices transaction committed successfully');
    res.status(201).json({ message: 'Unit(s) and prices added successfully' });

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

    // Fetch current prices for this product-unit combination
    const currentPrice = await CurrentPrice.findByProductAndUnit(unit.product_id, unitId, userId);
    console.log('Current price details:', currentPrice);

    // Combine all the required data
    const unitDetails = {
      product_id: unit.product_id,
      unit_type: unit.unit_type,
      unit_category: unit.unit_category,
      opposite_unit_id: unit.opposite_unit_id, // Include the opposite unit ID
      opposite_unit_type: oppositeUnit ? oppositeUnit.unit_type : null,
      prepackaged: unit.prepackaged === 1,
      conversion_factor: conversion ? conversion.conversion_rate : null,
      order_price: currentPrice ? currentPrice.order_price : 0.00,
      retail_price: currentPrice ? currentPrice.retail_price : 0.00,
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
    
    // TEMPORARY DEBUG - Remove after testing
    const [dbInfo] = await db.query('SELECT DATABASE() as current_db');
    console.log('=== DATABASE DEBUG INFO ===');
    console.log('Environment DB_NAME:', process.env.DB_NAME);
    console.log('Environment DB_HOST:', process.env.DB_HOST);
    console.log('Environment DB_PORT:', process.env.DB_PORT);
    console.log('Actual connected database:', dbInfo[0].current_db);
    console.log('User ID requesting units:', user_id);
    console.log('===========================');
    
    // Get units with current prices
    const [unitsWithPrices] = await db.query(`
      SELECT 
        u.unit_id, 
        u.product_id,
        p.product_name,  -- Product name
        p.variety,       -- Product variety
        u.unit_type, 
        u.unit_category, 
        u.prepackaged,
        ou.unit_type AS opposite_unit_type,  -- Fetching the name of the opposite unit
        uc.conversion_rate, -- Fetching the conversion rate between the units
        COALESCE(cp.order_price, 0.00) as order_price,
        COALESCE(cp.retail_price, 0.00) as retail_price,
        cp.last_updated as price_last_updated
      FROM 
        Units u
      LEFT JOIN 
        Units ou ON u.opposite_unit_id = ou.unit_id  -- Self-join on opposite unit
      LEFT JOIN 
        Products p ON u.product_id = p.product_id  -- Join to get product name
      LEFT JOIN 
        Unit_Conversion uc ON uc.from_unit_id = u.unit_id AND uc.to_unit_id = ou.unit_id  -- Join to get conversion rate
      LEFT JOIN 
        CurrentPrice cp ON cp.product_id = u.product_id AND cp.unit_id = u.unit_id AND cp.user_id = u.user_id  -- Join to get current prices
      WHERE 
        u.user_id = ?
    `, [user_id]);
    
    console.log(`Found ${unitsWithPrices.length} units with prices for user ${user_id}`);
    res.status(200).json(unitsWithPrices);
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
    const { product_id, unit_type, unit_category, opposite_unit_id, prepackaged, conversion_rate, order_price, retail_price } = req.body;
    const { id } = req.params;

    const updatedUnit = { product_id, unit_type, unit_category, opposite_unit_id, prepackaged };
    const result = await Unit.updateByIdAndUser(id, user_id, updatedUnit);

    if (!result) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Update or create current prices if provided
    if ((order_price !== undefined && order_price !== null) || (retail_price !== undefined && retail_price !== null)) {
      console.log('Updating current prices:', { order_price, retail_price });
      
      const currentPrice = await CurrentPrice.findByProductAndUnit(product_id, id, user_id);
      
      if (currentPrice) {
        // Update existing prices
        const priceData = {
          product_id,
          unit_id: id,
          user_id,
          retail_price: retail_price !== undefined ? retail_price : currentPrice.retail_price,
          order_price: order_price !== undefined ? order_price : currentPrice.order_price
        };
        await CurrentPrice.upsert(priceData);
      } else {
        // Create new price record
        const priceData = {
          product_id,
          unit_id: id,
          user_id,
          retail_price: retail_price || 0.00,
          order_price: order_price || 0.00
        };
        await CurrentPrice.upsert(priceData);
      }
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

    res.status(200).json({ message: 'Unit, conversion, and prices updated successfully' });
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



/**
 * Controller to fetch all units associated with a product.
 * Expects:
 * - productId as a route parameter.
 */
exports.getUnitsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const user_id = req.user.id; // Get authenticated user's ID

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: productId',
      });
    }

    // Query to fetch all unique units related to the product for this user
    const query = `
     SELECT DISTINCT u.unit_id, u.unit_type
FROM Units u
WHERE u.product_id = ? AND u.user_id = ?;
    `;

    const [rows] = await db.query(query, [productId, user_id]);

    res.status(200).json({
      success: true,
      units: rows,
    });
  } catch (error) {
    console.error(`Error fetching units for product ${req.params.productId}: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error fetching units for the product',
    });
  }
};

// DEBUG: Show database connection info
exports.debugDatabaseInfo = async (req, res) => {
  try {
    // Get database name and connection info
    const [dbInfo] = await db.query('SELECT DATABASE() as current_database');
    const [tableInfo] = await db.query('SELECT COUNT(*) as unit_count FROM Units');
    const [latestUnits] = await db.query('SELECT unit_id, product_name, unit_type FROM Units u LEFT JOIN Products p ON u.product_id = p.product_id ORDER BY unit_id DESC LIMIT 5');
    
    res.json({
      database_name: dbInfo[0].current_database,
      total_units: tableInfo[0].unit_count,
      latest_units: latestUnits,
      environment_info: {
        DB_HOST: process.env.DB_HOST,
        DB_NAME: process.env.DB_NAME,
        DB_PORT: process.env.DB_PORT,
        NODE_ENV: process.env.NODE_ENV
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


