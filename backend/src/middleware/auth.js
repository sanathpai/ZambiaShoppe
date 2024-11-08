const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Check for both userId and adminId in the decoded token
    req.user = { id: decoded.userId || decoded.adminId, role: decoded.role };
    console.log('Authenticated user ID:', req.user.id, 'Role:', req.user.role);
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
