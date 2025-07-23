// Middleware to trim leading and trailing whitespace from all string fields
const trimFields = (req, res, next) => {
  const trimValue = (obj) => {
    if (typeof obj === 'string') {
      return obj.trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(trimValue);
    }
    if (obj !== null && typeof obj === 'object') {
      const trimmedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          trimmedObj[key] = trimValue(obj[key]);
        }
      }
      return trimmedObj;
    }
    return obj;
  };

  // Trim all fields in the request body
  if (req.body && typeof req.body === 'object') {
    req.body = trimValue(req.body);
  }

  // Trim query parameters as well
  if (req.query && typeof req.query === 'object') {
    req.query = trimValue(req.query);
  }

  next();
};

module.exports = trimFields; 