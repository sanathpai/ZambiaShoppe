require('dotenv').config();
const { upload } = require('./config/s3Config');
const express = require('express');
const app = express();

// Create a test image buffer
const createTestImage = () => {
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

console.log('🔍 Testing S3 upload configuration...');

// Test the multer-s3 configuration
const testUpload = () => {
  console.log('📝 S3 Configuration Test:');
  console.log('  - AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
  console.log('  - AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
  console.log('  - AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
  console.log('  - AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || 'NOT SET');
  
  // Test upload middleware
  const mockReq = {
    user: { id: 'test-user' },
    headers: { 'content-type': 'multipart/form-data' },
    body: {
      product_name: 'Test Product',
      category: 'Test Category',
      variety: 'Test Variety'
    }
  };
  
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        console.log(`❌ Response ${code}:`, data);
        return mockRes;
      }
    })
  };
  
  // Mock file object
  const mockFile = {
    fieldname: 'image',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: createTestImage(),
    size: 100
  };
  
  console.log('🔄 Testing upload middleware...');
  
  // Test upload with mock data
  const uploadMiddleware = upload.single('image');
  
  uploadMiddleware(mockReq, mockRes, (err) => {
    if (err) {
      console.error('❌ Upload middleware error:', err.message);
      console.error('   Error code:', err.code);
      console.error('   Error stack:', err.stack);
      
      // Specific error analysis
      if (err.message.includes('The bucket does not allow ACLs')) {
        console.error('💡 SOLUTION: S3 bucket has ACL disabled. This should be fixed by removing ACL from config.');
      } else if (err.message.includes('Access Denied')) {
        console.error('💡 SOLUTION: Check AWS credentials and bucket permissions.');
      } else if (err.message.includes('timeout')) {
        console.error('💡 SOLUTION: Upload timeout - file might be too large or network issue.');
      } else {
        console.error('💡 SOLUTION: Check S3 configuration and AWS credentials.');
      }
      
    } else {
      console.log('✅ Upload middleware test passed');
      if (mockReq.file) {
        console.log('📄 File details:', {
          location: mockReq.file.location,
          key: mockReq.file.key,
          bucket: mockReq.file.bucket,
          size: mockReq.file.size
        });
      }
    }
  });
};

testUpload();