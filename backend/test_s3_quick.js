require('dotenv').config();
const { upload } = require('./config/s3Config');

console.log('🔧 S3 Configuration Check:');
console.log('✅ S3 Config loaded:', !!upload);
console.log('✅ AWS vars:', {
  key: !!process.env.AWS_ACCESS_KEY_ID,
  secret: !!process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_S3_BUCKET_NAME
});

console.log('\n🧪 Testing S3 upload middleware...');
const mockReq = {
  user: { id: 'test' },
  headers: { 'content-type': 'multipart/form-data' }
};

const mockRes = {
  status: () => ({ json: () => {} })
};

// Test if upload middleware works
upload.single('image')(mockReq, mockRes, (err) => {
  if (err) {
    console.error('❌ S3 upload middleware error:', err.message);
    console.error('   Error details:', err.code || 'Unknown');
  } else {
    console.log('✅ S3 upload middleware loaded successfully');
  }
  console.log('\n🎯 Test complete - S3 should be working now!');
});