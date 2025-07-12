const db = require('../config/db');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Create S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const migrateToHybridStorage = async () => {
  console.log('🚀 Starting migration to hybrid storage (S3 + base64 backup)...');
  
  try {
    // Check if S3 is configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
      console.error('❌ S3 credentials not configured. Please set AWS environment variables.');
      return;
    }

    // Find all products with base64 images but no S3 URL
    const [products] = await db.query(`
      SELECT product_id, product_name, image 
      FROM Products 
      WHERE image IS NOT NULL 
      AND image LIKE 'data:image%'
      AND (image_s3_url IS NULL OR image_s3_url = '')
      LIMIT 20
    `);

    console.log(`📊 Found ${products.length} products with base64 images to migrate to S3`);

    if (products.length === 0) {
      console.log('✅ No base64 images found that need migration to S3');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        console.log(`🔄 Migrating image for product: ${product.product_name} (ID: ${product.product_id})`);
        
        // Parse base64 data
        const base64Data = product.image;
        const matches = base64Data.match(/^data:image\/([a-zA-Z]*);base64,(.*)$/);
        
        if (!matches) {
          console.error(`❌ Invalid base64 format for product ${product.product_id}`);
          errorCount++;
          continue;
        }

        const imageType = matches[1]; // jpeg, png, etc.
        const imageBuffer = Buffer.from(matches[2], 'base64');
        
        // Generate unique filename
        const filename = `products/migrated-${product.product_id}-${uuidv4()}.${imageType}`;
        
        // Upload to S3
        const uploadCommand = new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: filename,
          Body: imageBuffer,
          ContentType: `image/${imageType}`,
          Metadata: {
            'migrated-from': 'base64',
            'product-id': product.product_id.toString(),
            'migration-date': new Date().toISOString(),
            'original-filename': `product-${product.product_id}.${imageType}`
          }
        });

        await s3Client.send(uploadCommand);
        
        // Construct S3 URL
        const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
        
        // Update database with S3 URL (keeping original base64 as backup)
        await db.query(
          'UPDATE Products SET image_s3_url = ? WHERE product_id = ?',
          [s3Url, product.product_id]
        );

        console.log(`✅ Successfully migrated image for product ${product.product_id}`);
        console.log(`   S3 URL: ${s3Url}`);
        console.log(`   Base64 backup: Kept in database`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error migrating product ${product.product_id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n🎉 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} images to S3`);
    console.log(`❌ Failed to migrate: ${errorCount} images`);
    console.log(`📊 Total processed: ${products.length} products`);
    console.log(`📦 Base64 images kept as backup in database`);
    console.log(`🔄 Products now have both S3 URLs and base64 fallbacks`);

    // Show storage stats
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(image) as products_with_base64,
        COUNT(image_s3_url) as products_with_s3,
        COUNT(CASE WHEN image IS NOT NULL AND image_s3_url IS NOT NULL THEN 1 END) as products_with_both
      FROM Products
    `);
    
    console.log('\n📈 Storage Statistics:');
    console.log(`Total products: ${stats[0].total_products}`);
    console.log(`Products with base64: ${stats[0].products_with_base64}`);
    console.log(`Products with S3: ${stats[0].products_with_s3}`);
    console.log(`Products with both: ${stats[0].products_with_both}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await db.end();
    console.log('🔚 Migration script completed');
  }
};

// Run migration if called directly
if (require.main === module) {
  migrateToHybridStorage();
}

module.exports = migrateToHybridStorage; 