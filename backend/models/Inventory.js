const db = require('../config/db');
const convertUnits = require('../utils/unitConversion');

const Inventory = {
  create: async (inventory) => {
    const { product_id, current_stock, user_id, unit_id, shop_name } = inventory;
    const [result] = await db.query(
      'INSERT INTO Inventories (product_id, current_stock, user_id, unit_id, shop_name) VALUES (?, ?, ?, ?, ?)',
      [product_id, current_stock, user_id, unit_id, shop_name]
    );
    return result.insertId;
  },
  
  findById: async (id) => {
    const query = `
     SELECT 
        Inventories.*, 
        Products.product_name, 
        Products.variety, 
        Units.unit_type -- Fetch the unit type from Units table
      FROM Inventories
      JOIN Products ON Inventories.product_id = Products.product_id
      JOIN Units ON Inventories.unit_id = Units.unit_id -- Join Units table to get unit_type
      WHERE inventory_id = ?
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  },

  findAllByUser: async (userId) => {
    const query = `
    SELECT 
        Inventories.inventory_id, 
        Inventories.current_stock, 
        Inventories.shop_name,
        Products.product_id, 
        Products.product_name,
        Products.variety, 
        Inventories.unit_id, 
        Units.unit_type -- Fetch unit type instead of just unit_id
      FROM Inventories
      JOIN Products ON Inventories.product_id = Products.product_id
      JOIN Units ON Inventories.unit_id = Units.unit_id -- Join with Units table to get unit_type
      WHERE Inventories.user_id = ?
    `;
    const [rows] = await db.query(query, [userId]);
    return rows;
  },

  findByProductAndUser: async (product_id, user_id) => {
    const [rows] = await db.query(
      `SELECT i.*, u.unit_type 
     FROM Inventories i 
     JOIN Units u ON i.unit_id = u.unit_id
     WHERE i.product_id = ? AND i.user_id = ?`,
      [product_id, user_id]
    );
    return rows[0];
  },

  findAllByUserAndId: async (userId,prodId) => {
    const query = `
    SELECT 
        Inventories.inventory_id, 
        Inventories.current_stock, 
        Inventories.shop_name,
        Products.product_id, 
        Products.product_name,
        Products.variety, 
        Inventories.unit_id, 
        Units.unit_type -- Fetch unit type instead of just unit_id
      FROM Inventories
      JOIN Products ON Inventories.product_id = Products.product_id
      JOIN Units ON Inventories.unit_id = Units.unit_id -- Join with Units table to get unit_type
      WHERE Inventories.user_id = ? AND Inventories.product_id = ?
    `;
    const [rows] = await db.query(query, [userId,prodId]);
    return rows;
  },

  update: async (id, inventory) => {
    const { product_id, current_stock, user_id, unit_id, shop_name } = inventory;
    console.log(`Updating inventory with id: ${id}`);
    console.log(`Current stock: ${current_stock}`);
    console.log(`Other values - product_id: ${product_id}, user_id: ${user_id}, unit_id: ${unit_id}, shop_name: ${shop_name}`);
    const [result] = await db.query(
      'UPDATE Inventories SET product_id = ?, current_stock = ?, user_id = ?, unit_id = ?, shop_name = ? WHERE inventory_id = ?',
      [product_id, current_stock, user_id, unit_id, shop_name, id]
    );
    return result.affectedRows;
  },

  delete: async (id) => {
    const [result] = await db.query('DELETE FROM Inventories WHERE inventory_id = ?', [id]);
    return result.affectedRows;
  },

  reconcile: async (product_id, shop_name, user_id, actual_stock, actual_unit_id) => {
    let inventory = await Inventory.findByProductAndUser(product_id, user_id);

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Convert the actual stock to match the inventory's unit using the Unit_Conversion table
    const convertedStock = await convertUnits(actual_stock, actual_unit_id, inventory.unit_id);
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: convertedStock });

    return inventory.inventory_id;
  },
};

module.exports = Inventory;
