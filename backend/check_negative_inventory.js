const db = require('./config/db');

async function checkNegativeInventory() {
  try {
    const [users] = await db.query('SELECT id, username FROM Users WHERE username = ?', ['mokarite05']);
    if (users.length === 0) {
      console.log('User mokarite05 not found');
      return;
    }
    
    const userId = users[0].id;
    console.log('Found user:', users[0]);
    
    const [inventories] = await db.query(`
      SELECT i.inventory_id, i.current_stock, i.unit_id, 
             p.product_name, p.variety, p.brand, p.size,
             u.unit_type
      FROM Inventories i
      JOIN Products p ON i.product_id = p.product_id
      LEFT JOIN Units u ON i.unit_id = u.unit_id
      WHERE i.user_id = ? AND i.current_stock < 0
      ORDER BY i.current_stock ASC
    `, [userId]);
    
    console.log('\nNegative inventory items for user mokarite05:');
    if (inventories.length === 0) {
      console.log('No negative inventory found');
    } else {
      inventories.forEach(inv => {
        console.log(`- Product: ${inv.product_name}${inv.variety ? ` (${inv.variety})` : ''}${inv.brand ? ` - ${inv.brand}` : ''}${inv.size ? ` - ${inv.size}` : ''}`);
        console.log(`  Current Stock: ${inv.current_stock} ${inv.unit_type || 'units'}`);
        console.log(`  Inventory ID: ${inv.inventory_id}`);
        console.log('');
      });
    }
    
    // Also check all inventory to see the overall state
    const [allInventories] = await db.query(`
      SELECT i.inventory_id, i.current_stock, i.unit_id, 
             p.product_name, p.variety, p.brand, p.size,
             u.unit_type
      FROM Inventories i
      JOIN Products p ON i.product_id = p.product_id
      LEFT JOIN Units u ON i.unit_id = u.unit_id
      WHERE i.user_id = ?
      ORDER BY i.current_stock ASC
    `, [userId]);
    
    console.log(`\nAll inventory items for user mokarite05 (${allInventories.length} total):`);
    allInventories.forEach(inv => {
      const status = inv.current_stock < 0 ? ' ❌ NEGATIVE' : inv.current_stock === 0 ? ' ⚠️ ZERO' : ' ✅ POSITIVE';
      console.log(`- ${inv.product_name}${inv.variety ? ` (${inv.variety})` : ''}: ${inv.current_stock} ${inv.unit_type || 'units'}${status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkNegativeInventory(); 