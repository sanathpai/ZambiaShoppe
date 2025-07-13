const multer = require('multer');
const { upload } = require('./config/s3Config');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Create a simple test image buffer
const createTestImage = () => {
  // Create a minimal PNG image (1x1 pixel)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0x1D, 0x01, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
  ]);
  return pngData;
};

const testS3Upload = async () => {
  console.log('🧪 Testing S3 upload configuration...');
  
  try {
    // Create test image
    const testImageBuffer = createTestImage();
    console.log('✅ Created test image buffer');
    
    // Mock request object
    const mockReq = {
      user: { id: 'test-user-123' },
      headers: { 'content-type': 'multipart/form-data' }
    };
    
    // Mock response object
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`Response ${code}:`, data);
          return mockRes;
        }
      })
    };
    
    // Test the upload middleware with a mock file
    const testFile = {
      fieldname: 'image',
      originalname: 'test-image.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: testImageBuffer,
      size: testImageBuffer.length
    };
    
    console.log('🔄 Testing multer S3 upload...');
    
    // Use the upload middleware directly
    const uploadMiddleware = upload.single('image');
    
    // Create a promise to handle the async middleware
    const uploadPromise = new Promise((resolve, reject) => {
      uploadMiddleware(mockReq, mockRes, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(mockReq.file);
        }
      });
    });
    
    // Simulate the file being attached to the request
    mockReq.file = testFile;
    
    // Test the upload
    const result = await uploadPromise;
    
    if (result && result.location) {
      console.log('✅ S3 upload test successful!');
      console.log('📸 Uploaded file location:', result.location);
      console.log('🔑 S3 key:', result.key);
      console.log('🪣 Bucket:', result.bucket);
    } else {
      console.log('⚠️ Upload completed but no location returned');
    }
    
  } catch (error) {
    console.error('❌ S3 upload test failed:', error.message);
    console.error('Error details:', error);
    
    // Check for specific error types
    if (error.code === 'AccessDenied') {
      console.error('💡 This is likely an ACL permission issue - check if ACL is disabled on your bucket');
    } else if (error.code === 'InvalidBucketName') {
      console.error('💡 Check your bucket name in the environment variables');
    } else if (error.code === 'NoSuchBucket') {
      console.error('💡 The specified bucket does not exist');
    }
  }
};

// Run the test
testS3Upload().then(() => {
  console.log('🎉 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});