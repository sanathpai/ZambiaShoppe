

const db = require('../config/db');

const Unit = {
  // Create a new unit
  create: async (unit) => {
    const { product_id, unit_type, unit_category, opposite_unit_id, prepackaged, user_id } = unit;
    const [result] = await db.query(
      'INSERT INTO Units (product_id, unit_type, unit_category, opposite_unit_id, prepackaged, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [product_id, unit_type, unit_category, opposite_unit_id, prepackaged, user_id]
    );
    return result.insertId;
  },

  // Find unit by ID
  findById: async (unitId) => {
    const [rows] = await db.query('SELECT * FROM Units WHERE unit_id = ?', [unitId]);
    return rows[0];
  },

  // Find all units by user ID
  findAllByUser: async (userId) => {
    const [rows] = await db.query(`
   SELECT 
      u.unit_id, 
      u.product_id,
      p.product_name,  -- Product name
      u.unit_type, 
      u.unit_category, 
      u.prepackaged,
      ou.unit_type AS opposite_unit_type,  -- Fetching the name of the opposite unit
      uc.conversion_rate -- Fetching the conversion rate between the units
    FROM 
      Units u
    LEFT JOIN 
      Units ou ON u.opposite_unit_id = ou.unit_id  -- Self-join on opposite unit
    LEFT JOIN 
      Products p ON u.product_id = p.product_id  -- Join to get product name
    LEFT JOIN 
      Unit_Conversion uc ON uc.from_unit_id = u.unit_id AND uc.to_unit_id = ou.unit_id  -- Join to get conversion rate
    WHERE 
      u.user_id = ?
`, 
      [userId]
    );
    return rows;
  },

  // Find all units for a product by product_id and user_id
  findAllByProductIdAndUser: async (product_id, user_id) => {
    const [rows] = await db.query(`
      SELECT 
        u.unit_id, 
        u.unit_type, 
        u.unit_category,
        uc.conversion_rate,  -- Fetch conversion rates
        uc.to_unit_id,       -- Include the target unit ID for conversion
        p.product_name
      FROM Units u
      LEFT JOIN Products p ON u.product_id = p.product_id
      LEFT JOIN Unit_Conversion uc ON uc.from_unit_id = u.unit_id
      WHERE u.product_id = ? AND u.user_id = ?
    `, [product_id, user_id]);
    
    return rows.map(row => ({
        unit_id: row.unit_id,
        unit_type: row.unit_type,
        unit_category: row.unit_category,
        conversion_rate: row.conversion_rate,
        to_unit_id: row.to_unit_id
    }));
},

findByProductIdAndUser: async (product_id, user_id) => {
  const [rows] = await db.query('SELECT * FROM Units WHERE product_id = ? AND user_id = ?', [product_id, user_id]);
  return rows;
},


  // Find unit by product ID and user ID
  findByProductId: async (productId, userId) => {
    const [rows] = await db.query(`
      SELECT Units.*, Products.product_name 
      FROM Units 
      JOIN Products ON Units.product_id = Products.product_id 
      WHERE Units.product_id = ? AND Units.user_id = ?`, 
      [productId, userId]
    );
    return rows;
  },

  // Find unit by ID and user ID
  findByIdAndUser: async (unitId, userId) => {
    const [rows] = await db.query('SELECT * FROM Units WHERE unit_id = ? AND user_id = ?', [unitId, userId]);
    return rows[0];
  },

  // Update unit by unit ID and user ID
  updateByIdAndUser: async (unitId, userId, updatedUnit) => {
    const { product_id, unit_type, unit_category, opposite_unit_id, prepackaged } = updatedUnit;
    const [result] = await db.query(
      'UPDATE Units SET product_id = ?, unit_type = ?, unit_category = ?, opposite_unit_id = ?, prepackaged = ? WHERE unit_id = ? AND user_id = ?',
      [product_id, unit_type, unit_category, opposite_unit_id, prepackaged, unitId, userId]
    );
    return result.affectedRows > 0;
  },

  // Update unit by product ID and user ID
  updateByProductIdAndUser: async (productId, userId, updatedUnit) => {
    const { unit_type, unit_category, opposite_unit_id, prepackaged } = updatedUnit;
    const [result] = await db.query(
      'UPDATE Units SET unit_type = ?, unit_category = ?, opposite_unit_id = ?, prepackaged = ? WHERE product_id = ? AND user_id = ?',
      [unit_type, unit_category, opposite_unit_id, prepackaged, productId, userId]
    );
    return result.affectedRows > 0;
  },

  // Find default unit by product and user ID
  findDefaultUnitByProduct: async (productId, userId) => {
    const [rows] = await db.query(`
      SELECT * FROM Units 
      WHERE product_id = ? AND user_id = ? AND unit_type = 'default' AND unit_category = 'buying'`,
      [productId, userId]
    );
    return rows[0];
  },

  // Delete unit by unit ID and user ID
  deleteByIdAndUser: async (unitId, userId) => {
    const [result] = await db.query('DELETE FROM Units WHERE unit_id = ? AND user_id = ?', [unitId, userId]);
    return result.affectedRows > 0;
  }
};

module.exports = Unit;
