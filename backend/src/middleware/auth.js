const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  console.log(`=== AUTH MIDDLEWARE DEBUG ===`);
  console.log(`Processing auth for: ${req.method} ${req.url}`);
  
  const token = req.header('Authorization')?.replace('Bearer ', '');
  console.log(`Token present: ${!!token}`);
  console.log(`Token preview: ${token ? token.substring(0, 20) + '...' : 'No token'}`);

  if (!token) {
    console.log(`❌ AUTH FAILED: No token provided`);
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Check for both userId and adminId in the decoded token
    req.user = { id: decoded.userId || decoded.adminId, role: decoded.role };
    console.log('✅ AUTH SUCCESS: Authenticated user ID:', req.user.id, 'Role:', req.user.role);
    console.log(`=== AUTH MIDDLEWARE - CALLING NEXT() ===`);
    next();
  } catch (error) {
    console.log(`❌ AUTH FAILED: Invalid token - ${error.message}`);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
