const db = require('./config/db');

const setupImageSupport = async () => {
  try {
    console.log('🔧 Setting up image support for Products table...');
    
    // Check if image column already exists
    const [columns] = await db.query('DESCRIBE Products');
    const hasImageColumn = columns.some(col => col.Field === 'image');
    
    if (hasImageColumn) {
      console.log('✅ Image column already exists in Products table');
      return;
    }
    
    // Add image column
    await db.query(`
      ALTER TABLE Products 
      ADD COLUMN image LONGTEXT DEFAULT NULL 
      COMMENT 'Base64 encoded image data for the product'
    `);
    
    console.log('✅ Successfully added image column to Products table');
    
    // Verify the column was added
    const [newColumns] = await db.query('DESCRIBE Products');
    console.log('\n📋 Products table structure:');
    newColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(required)'}`);
    });
    
  } catch (error) {
    console.error('❌ Error setting up image support:', error.message);
  } finally {
    process.exit();
  }
};

// Run the setup
setupImageSupport(); 