const db = require('../config/db');

/**
 * Validates that a unit_id belongs to the specified product_id
 * @param {number} productId - The product ID
 * @param {number} unitId - The unit ID
 * @param {number} userId - The user ID (for additional validation)
 * @returns {Promise<boolean>} - True if valid, false otherwise
 */
async function validateUnitBelongsToProduct(productId, unitId, userId) {
  try {
    const [rows] = await db.query(`
      SELECT unit_id 
      FROM Units 
      WHERE unit_id = ? AND product_id = ? AND user_id = ?
    `, [unitId, productId, userId]);
    
    return rows.length > 0;
  } catch (error) {
    console.error('Error validating unit-product relationship:', error);
    return false;
  }
}

/**
 * Gets the correct product_id for a given unit_id
 * @param {number} unitId - The unit ID
 * @param {number} userId - The user ID
 * @returns {Promise<number|null>} - The correct product_id or null if not found
 */
async function getCorrectProductIdForUnit(unitId, userId) {
  try {
    const [rows] = await db.query(`
      SELECT product_id 
      FROM Units 
      WHERE unit_id = ? AND user_id = ?
    `, [unitId, userId]);
    
    return rows.length > 0 ? rows[0].product_id : null;
  } catch (error) {
    console.error('Error getting correct product for unit:', error);
    return null;
  }
}

/**
 * Validates CurrentPrice data before insertion/update
 * @param {Object} priceData - The price data to validate
 * @param {number} priceData.product_id - Product ID
 * @param {number} priceData.unit_id - Unit ID
 * @param {number} priceData.user_id - User ID
 * @returns {Promise<{valid: boolean, error?: string, correctedProductId?: number}>}
 */
async function validateCurrentPriceData(priceData) {
  const { product_id, unit_id, user_id } = priceData;
  
  if (!product_id || !unit_id || !user_id) {
    return {
      valid: false,
      error: 'Missing required fields: product_id, unit_id, and user_id are required'
    };
  }
  
  // Check if the unit belongs to the specified product
  const isValid = await validateUnitBelongsToProduct(product_id, unit_id, user_id);
  
  if (isValid) {
    return { valid: true };
  }
  
  // If not valid, get the correct product_id for this unit
  const correctProductId = await getCorrectProductIdForUnit(unit_id, user_id);
  
  if (correctProductId === null) {
    return {
      valid: false,
      error: `Unit ID ${unit_id} not found for user ${user_id}`
    };
  }
  
  return {
    valid: false,
    error: `Unit ID ${unit_id} belongs to product ${correctProductId}, not ${product_id}`,
    correctedProductId: correctProductId
  };
}

/**
 * Safely creates or updates a CurrentPrice entry with validation
 * @param {Object} priceData - The price data
 * @param {Object} connection - Database connection (optional)
 * @returns {Promise<{success: boolean, currentPriceId?: number, error?: string}>}
 */
async function safeUpsertCurrentPrice(priceData, connection = null) {
  const dbConnection = connection || db;
  
  // Validate the data first
  const validation = await validateCurrentPriceData(priceData);
  
  if (!validation.valid) {
    // If we have a corrected product ID, we could auto-fix or warn
    if (validation.correctedProductId) {
      console.warn(`⚠️ Auto-correcting product_id from ${priceData.product_id} to ${validation.correctedProductId} for unit_id ${priceData.unit_id}`);
      priceData.product_id = validation.correctedProductId;
    } else {
      return {
        success: false,
        error: validation.error
      };
    }
  }
  
  try {
    // Proceed with the upsert using the validated/corrected data
    const { product_id, unit_id, user_id, retail_price, order_price } = priceData;
    
    // Try to update existing record first
    const [updateResult] = await dbConnection.query(`
      UPDATE CurrentPrice 
      SET retail_price = ?, order_price = ?, last_updated = CURRENT_TIMESTAMP
      WHERE product_id = ? AND unit_id = ? AND user_id = ?
    `, [retail_price || 0.00, order_price || 0.00, product_id, unit_id, user_id]);

    if (updateResult.affectedRows > 0) {
      // Record was updated, get the existing ID
      const [existing] = await dbConnection.query(`
        SELECT current_price_id FROM CurrentPrice 
        WHERE product_id = ? AND unit_id = ? AND user_id = ?
      `, [product_id, unit_id, user_id]);
      
      return {
        success: true,
        currentPriceId: existing[0].current_price_id
      };
    } else {
      // Create new record
      const [insertResult] = await dbConnection.query(`
        INSERT INTO CurrentPrice (product_id, unit_id, user_id, retail_price, order_price)
        VALUES (?, ?, ?, ?, ?)
      `, [product_id, unit_id, user_id, retail_price || 0.00, order_price || 0.00]);
      
      return {
        success: true,
        currentPriceId: insertResult.insertId
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Database error: ${error.message}`
    };
  }
}

module.exports = {
  validateUnitBelongsToProduct,
  getCorrectProductIdForUnit,
  validateCurrentPriceData,
  safeUpsertCurrentPrice
};
