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

const migrateImagesToS3 = async () => {
  console.log('🚀 Starting migration of base64 images to S3...');
  
  try {
    // Find all products with base64 images
    const [products] = await db.query(`
      SELECT product_id, product_name, image 
      FROM Products 
      WHERE image IS NOT NULL 
      AND image LIKE 'data:image%'
      LIMIT 10
    `);

    console.log(`📊 Found ${products.length} products with base64 images to migrate`);

    if (products.length === 0) {
      console.log('✅ No base64 images found to migrate');
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
            'migration-date': new Date().toISOString()
          }
        });

        await s3Client.send(uploadCommand);
        
        // Construct S3 URL
        const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
        
        // Update database with S3 URL
        await db.query(
          'UPDATE Products SET image = ? WHERE product_id = ?',
          [s3Url, product.product_id]
        );

        console.log(`✅ Successfully migrated image for product ${product.product_id}: ${s3Url}`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error migrating product ${product.product_id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n🎉 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} images`);
    console.log(`❌ Failed to migrate: ${errorCount} images`);
    console.log(`📊 Total processed: ${products.length} products`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await db.end();
    console.log('🔚 Migration script completed');
  }
};

// Run migration if called directly
if (require.main === module) {
  migrateImagesToS3();
}

module.exports = migrateImagesToS3; 