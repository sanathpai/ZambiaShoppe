const db = require('../config/db');
const convertUnits = require('../utils/unitConversion');

const Inventory = {
  create: async (inventory) => {
    const { offering_id, current_stock, user_id, unit_type, shop_name } = inventory;
    const [result] = await db.query(
      'INSERT INTO Inventories (offering_id, current_stock, user_id, unit_type, shop_name) VALUES (?, ?, ?, ?, ?)',
      [offering_id, current_stock, user_id, unit_type, shop_name]
    );
    return result.insertId;
  },
  findById: async (id) => {
    const query = `
      SELECT 
        Inventories.*, 
        Products.product_name, 
        Products.variety 
      FROM Inventories
      JOIN ProductOfferings ON Inventories.offering_id = ProductOfferings.offering_id
      JOIN Products ON ProductOfferings.product_id = Products.product_id
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
        Products.product_name,
        Products.variety, 
        Inventories.unit_type
      FROM Inventories
      JOIN ProductOfferings ON Inventories.offering_id = ProductOfferings.offering_id
      JOIN Products ON ProductOfferings.product_id = Products.product_id
      WHERE Inventories.user_id = ?
    `;
    const [rows] = await db.query(query, [userId]);
    return rows;
  },
  findByOfferingAndShopAndUser: async (offering_id, shop_name, user_id) => {
    const [rows] = await db.query(
      'SELECT * FROM Inventories WHERE offering_id = ? AND shop_name = ? AND user_id = ?',
      [offering_id, shop_name, user_id]
    );
    return rows[0];
  },
  findByOfferingAndUser: async (offering_id, user_id) => {
    const [rows] = await db.query(
      'SELECT * FROM Inventories WHERE offering_id = ? AND user_id = ?',
      [offering_id, user_id]
    );
    return rows[0];
  },
  update: async (id, inventory) => {
    const { offering_id, current_stock, user_id, unit_type, shop_name } = inventory;
    const [result] = await db.query(
      'UPDATE Inventories SET offering_id = ?, current_stock = ?, user_id = ?, unit_type = ?, shop_name = ? WHERE inventory_id = ?',
      [offering_id, current_stock, user_id, unit_type, shop_name, id]
    );
    return result.affectedRows;
  },
  delete: async (id) => {
    const [result] = await db.query('DELETE FROM Inventories WHERE inventory_id = ?', [id]);
    return result.affectedRows;
  },
  findAll: async () => {
    const query = `
      SELECT Inventories.inventory_id, Inventories.current_stock, Inventories.shop_name, Products.product_name
      FROM Inventories
      JOIN ProductOfferings ON Inventories.offering_id = ProductOfferings.offering_id
      JOIN Products ON ProductOfferings.product_id = Products.product_id
    `;
    const [rows] = await db.query(query);
    return rows;
  },
  reconcile: async (offering_id, shop_name, user_id, actual_stock, actual_unit_type) => {
    let inventory = await Inventory.findByOfferingAndShopAndUser(offering_id, shop_name, user_id);

    if (!inventory) {
      throw new Error('Inventory not found');
    }

    const convertedStock = convertUnits(actual_stock, actual_unit_type, inventory.unit_type, 1, 1);
    await Inventory.update(inventory.inventory_id, { ...inventory, current_stock: convertedStock });

    return inventory.inventory_id;
  },
};

module.exports = Inventory;
