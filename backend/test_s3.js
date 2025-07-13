// Add this to your backend (maybe in a separate test file or at the end of your main server file)
const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS (same as your existing config)
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const comprehensiveS3Test = async () => {
  console.log('🧪 COMPREHENSIVE S3 TEST STARTING...');
  console.log('=====================================');
  
  // Step 1: Check environment variables
  console.log('\n📋 Step 1: Environment Variables Check');
  console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
  console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
  console.log('AWS_REGION:', process.env.AWS_REGION || '❌ Missing');
  console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || '❌ Missing');
  
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_REGION || !process.env.AWS_S3_BUCKET_NAME) {
    console.error('❌ Missing required environment variables. Cannot proceed.');
    return;
  }

  try {
    // Step 2: Test AWS credentials
    console.log('\n🔐 Step 2: Testing AWS Credentials...');
    const buckets = await s3.listBuckets().promise();
    console.log('✅ AWS credentials are valid');
    console.log('📦 Available buckets:', buckets.Buckets.map(b => b.Name).join(', '));
    
    // Step 3: Check if target bucket exists
    console.log('\n🎯 Step 3: Checking Target Bucket...');
    const targetBucket = process.env.AWS_S3_BUCKET_NAME;
    const bucketExists = buckets.Buckets.some(bucket => bucket.Name === targetBucket);
    
    if (!bucketExists) {
      console.error(`❌ Target bucket "${targetBucket}" not found!`);
      console.log('💡 Available buckets:', buckets.Buckets.map(b => b.Name).join(', '));
      return;
    }
    console.log(`✅ Target bucket "${targetBucket}" exists`);

    // Step 4: Check bucket region
    console.log('\n🌍 Step 4: Checking Bucket Region...');
    const location = await s3.getBucketLocation({ Bucket: targetBucket }).promise();
    const bucketRegion = location.LocationConstraint || 'us-east-1';
    console.log(`📍 Bucket region: ${bucketRegion}`);
    console.log(`📍 Configured region: ${process.env.AWS_REGION}`);
    
    if (bucketRegion !== process.env.AWS_REGION) {
      console.warn(`⚠️ REGION MISMATCH! Bucket is in ${bucketRegion} but config says ${process.env.AWS_REGION}`);
      console.log('💡 This might cause upload failures. Update AWS_REGION to match bucket region.');
    } else {
      console.log('✅ Region configuration is correct');
    }

    // Step 5: Test simple upload
    console.log('\n📤 Step 5: Testing Simple Upload...');
    const testKey = `test-uploads/backend-test-${Date.now()}.txt`;
    const testData = 'This is a test upload from the backend server';
    
    const uploadParams = {
      Bucket: targetBucket,
      Key: testKey,
      Body: testData,
      ContentType: 'text/plain',
      Metadata: {
        'test': 'true',
        'source': 'backend-test'
      }
    };

    const uploadResult = await s3.upload(uploadParams).promise();
    console.log('✅ Simple upload successful!');
    console.log('📄 Upload URL:', uploadResult.Location);
    console.log('🔑 Object Key:', uploadResult.Key);

    // Step 6: Test image-like upload (simulating your actual use case)
    console.log('\n📸 Step 6: Testing Image Upload (Simulation)...');
    const imageKey = `products/test-image-${Date.now()}.jpg`;
    const fakeImageData = Buffer.from('fake-image-data-for-testing');
    
    const imageUploadParams = {
      Bucket: targetBucket,
      Key: imageKey,
      Body: fakeImageData,
      ContentType: 'image/jpeg',
      Metadata: {
        'test': 'true',
        'source': 'backend-image-test'
      }
    };

    const imageUploadResult = await s3.upload(imageUploadParams).promise();
    console.log('✅ Image upload simulation successful!');
    console.log('📸 Image URL:', imageUploadResult.Location);

    // Step 7: Test permissions by trying to read the uploaded files
    console.log('\n👁️ Step 7: Testing Read Permissions...');
    const readResult = await s3.getObject({ Bucket: targetBucket, Key: testKey }).promise();
    console.log('✅ Read permissions work');
    console.log('📄 Read data:', readResult.Body.toString());

    // Step 8: Cleanup test files
    console.log('\n🗑️ Step 8: Cleaning Up Test Files...');
    await s3.deleteObject({ Bucket: targetBucket, Key: testKey }).promise();
    await s3.deleteObject({ Bucket: targetBucket, Key: imageKey }).promise();
    console.log('✅ Test files cleaned up');

    // Final summary
    console.log('\n🎉 ALL S3 TESTS PASSED! Your S3 configuration is working correctly.');
    console.log('💡 If your app is still failing, the issue might be in the multer-s3 configuration or request handling.');
    
  } catch (error) {
    console.error('\n❌ S3 TEST FAILED:');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Full Error:', error);
    
    // Provide specific suggestions based on error type
    if (error.code === 'InvalidAccessKeyId') {
      console.log('💡 Suggestion: Check your AWS_ACCESS_KEY_ID');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.log('💡 Suggestion: Check your AWS_SECRET_ACCESS_KEY');
    } else if (error.code === 'AccessDenied') {
      console.log('💡 Suggestion: Check IAM permissions for your user');
    } else if (error.code === 'NoSuchBucket') {
      console.log('💡 Suggestion: Verify bucket name and region');
    } else if (error.code === 'PermanentRedirect') {
      console.log('💡 Suggestion: Check bucket region configuration');
    }
  }
};

// Run the test
comprehensiveS3Test();

// Export for use in other files if needed
module.exports = { comprehensiveS3Test }; 