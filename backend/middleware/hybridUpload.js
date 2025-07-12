const multer = require('multer');
const { upload: s3Upload } = require('../config/s3Config');

// Check if S3 is configured
const isS3Configured = () => {
  return !!(process.env.AWS_ACCESS_KEY_ID && 
           process.env.AWS_SECRET_ACCESS_KEY && 
           process.env.AWS_S3_BUCKET_NAME && 
           process.env.AWS_REGION);
};

// Memory storage for fallback when S3 is not configured
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
  }
});

// Hybrid upload middleware
const hybridUpload = (req, res, next) => {
  console.log('🔄 Hybrid upload middleware - S3 configured:', isS3Configured());
  console.log('📋 Content-Type:', req.headers['content-type']);
  console.log('📋 Initial req.body keys:', Object.keys(req.body || {}));
  
  // If it's not multipart/form-data, skip file upload processing
  if (!req.headers['content-type'] || !req.headers['content-type'].includes('multipart/form-data')) {
    console.log('📄 Non-multipart request, skipping file upload middleware');
    req.uploadMethod = 'none';
    return next();
  }
  
  // Store original request body data temporarily
  let bodyData = {};
  
  // Create a unified success handler
  const handleSuccess = (method) => {
    console.log(`✅ ${method} upload successful`);
    console.log('📋 Final req.body after success:', JSON.stringify(req.body, null, 2));
    
    // Preserve body data if it got lost
    if (Object.keys(req.body).length === 0 && Object.keys(bodyData).length > 0) {
      console.log('🔄 Restoring lost body data');
      req.body = { ...bodyData };
    }
    
    req.uploadMethod = method;
    next();
  };
  
  // Create a unified error handler
  const handleError = (error, method, attemptFallback = false) => {
    console.warn(`⚠️ ${method} upload failed:`, error.message);
    console.log('📋 req.body during error:', JSON.stringify(req.body, null, 2));
    
    // Store body data if available
    if (req.body && Object.keys(req.body).length > 0) {
      bodyData = { ...req.body };
      console.log('💾 Stored body data for preservation');
    }
    
    if (attemptFallback) {
      console.log('🔄 Attempting memory storage fallback...');
      
      // Use a fresh multer instance for memory storage
      const fallbackUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 50 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
          cb(null, allowedMimes.includes(file.mimetype));
        }
      });
      
      fallbackUpload.single('image')(req, res, (memErr) => {
        if (memErr) {
          console.error('❌ Memory storage also failed:', memErr.message);
          // Restore body data and continue
          if (Object.keys(bodyData).length > 0) {
            req.body = { ...bodyData };
            console.log('🔄 Restored body data after fallback failure');
          }
          req.uploadMethod = 'failed';
          req.uploadError = memErr.message;
          return next();
        }
        
        // Memory storage succeeded
        if (Object.keys(req.body).length === 0 && Object.keys(bodyData).length > 0) {
          req.body = { ...bodyData };
          console.log('🔄 Restored body data after memory success');
        }
        
        if (!req.file) {
          console.log('📄 No file in memory upload, proceeding with text data only');
          req.uploadMethod = 'none';
        } else {
          console.log('✅ Memory storage fallback successful');
          req.uploadMethod = 'fallback';
        }
        next();
      });
    } else {
      // No fallback, restore data and continue
      if (Object.keys(bodyData).length > 0) {
        req.body = { ...bodyData };
        console.log('🔄 Restored body data after error');
      }
      req.uploadMethod = 'failed';
      req.uploadError = error.message;
      next();
    }
  };
  
  if (isS3Configured()) {
    // Try S3 upload
    console.log('📤 Attempting S3 upload...');
    s3Upload.single('image')(req, res, (err) => {
      if (err) {
        console.warn('⚠️ S3 upload failed, attempting memory fallback:', err.message);
        handleError(err, 'S3', true);
      } else {
        if (!req.file) {
          console.log('📄 No file uploaded via FormData, proceeding with text data only');
          req.uploadMethod = 'none';
        } else {
          req.uploadMethod = 's3';
        }
        handleSuccess(req.uploadMethod);
      }
    });
  } else {
    // S3 not configured, use memory storage
    console.log('📦 S3 not configured, using memory storage');
    memoryUpload.single('image')(req, res, (err) => {
      if (err) {
        console.error('❌ Memory upload failed:', err.message);
        handleError(err, 'Memory', false);
      } else {
        if (!req.file) {
          console.log('📄 No file uploaded via FormData, proceeding with text data only');
          req.uploadMethod = 'none';
        } else {
          req.uploadMethod = 'memory';
        }
        handleSuccess(req.uploadMethod);
      }
    });
  }
};

module.exports = {
  hybridUpload,
  isS3Configured
}; 