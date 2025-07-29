const db = require('./config/db');

async function fixNegativeInventory() {
  try {
    const [users] = await db.query('SELECT id, username FROM Users WHERE username = ?', ['mokarite05']);
    if (users.length === 0) {
      console.log('User mokarite05 not found');
      return;
    }
    
    const userId = users[0].id;
    console.log('Found user:', users[0]);
    
    // Find all negative inventory items
    const [negativeInventories] = await db.query(`
      SELECT i.inventory_id, i.current_stock, i.unit_id, 
             p.product_name, p.variety, p.brand, p.size,
             u.unit_type
      FROM Inventories i
      JOIN Products p ON i.product_id = p.product_id
      LEFT JOIN Units u ON i.unit_id = u.unit_id
      WHERE i.user_id = ? AND i.current_stock < 0
      ORDER BY i.current_stock ASC
    `, [userId]);
    
    if (negativeInventories.length === 0) {
      console.log('\nNo negative inventory found - nothing to fix!');
      return;
    }
    
    console.log(`\nFound ${negativeInventories.length} negative inventory item(s) to fix:`);
    
    for (const inv of negativeInventories) {
      console.log(`\nFixing inventory for:`);
      console.log(`- Product: ${inv.product_name}${inv.variety ? ` (${inv.variety})` : ''}${inv.brand ? ` - ${inv.brand}` : ''}${inv.size ? ` - ${inv.size}` : ''}`);
      console.log(`- Current Stock: ${inv.current_stock} ${inv.unit_type || 'units'}`);
      console.log(`- Inventory ID: ${inv.inventory_id}`);
      
      // Set negative inventory to 0 (safest option)
      await db.query('UPDATE Inventories SET current_stock = 0 WHERE inventory_id = ?', [inv.inventory_id]);
      console.log(`✅ Updated inventory to 0 ${inv.unit_type || 'units'}`);
    }
    
    console.log(`\n🎉 Successfully fixed ${negativeInventories.length} negative inventory item(s)!`);
    console.log('\nNote: All negative inventory has been set to 0 for safety.');
    console.log('The user can now add stock through purchases or use the reconcile function');
    console.log('(which now prevents negative values) to set the correct stock levels.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing negative inventory:', error);
    process.exit(1);
  }
}

fixNegativeInventory(); 