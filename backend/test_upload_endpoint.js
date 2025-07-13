// Get a test JWT token first
console.log('🔐 Getting authentication token...');
const loginResponse = await axios.post('http://localhost:8000/api/auth/login', {
  username: 'test_user',
  password: 'test_password'
});

const token = loginResponse.data.token;
console.log('✅ Got authentication token');

// Create FormData for the upload
const formData = new FormData();
formData.append('product_name', 'Test Product S3');
formData.append('category', 'Test Category');
formData.append('variety', 'Test Variety');
formData.append('description', 'Test description for S3 upload');

// Add the image as a buffer
formData.append('image', testImageBuffer, {
  filename: 'test-image.png',
  contentType: 'image/png'
});

console.log('📤 Sending upload request...');

// Make the upload request
const uploadResponse = await axios.post('http://localhost:8000/products', formData, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'multipart/form-data'
  },
  timeout: 30000 // 30 second timeout
});