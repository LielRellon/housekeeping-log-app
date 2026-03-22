// Request sanitization middleware - prevent XSS and injection attacks

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .substring(0, 5000); // Limit string length
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize the key (limit to alphanumeric and underscore)
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 100);
    
    if (sanitizedKey) {
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = sanitizeObject(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      }
    }
  }
  return sanitized;
};

// Middleware to sanitize req.body, req.query, and req.params
function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
}

module.exports = {
  sanitizeRequest,
  sanitizeString,
  sanitizeObject
};
