// Centralized error handler middleware
const logger = require('winston');

// Create a proper logger instance for errors if not passed in
let errorLogger = logger;

function setErrorLogger(loggerInstance) {
  errorLogger = loggerInstance;
}

// Error handler middleware
function errorHandler(err, req, res, next) {
  // Log the error
  const errorInfo = {
    message: err.message,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'production') {
    // Log full stack in production too, but only for internal purposes
    errorLogger.error('Application error:', { ...errorInfo, stack: err.stack });
  } else {
    errorLogger.error('Application error:', { ...errorInfo, stack: err.stack });
  }

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;
  
  // Build error response
  const errorResponse = {
    error: {
      message: err.message || 'Internal server error',
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Include request ID if available for tracking
  if (req.id) {
    errorResponse.error.requestId = req.id;
  }

  // Don't expose stack traces in production
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

// 404 handler - must be last
function notFoundHandler(req, res) {
  errorLogger.warn(`404 Not Found: ${req.method} ${req.path}`);
  
  res.status(404).json({
    error: {
      message: 'Not found',
      status: 404,
      path: req.path,
      timestamp: new Date().toISOString()
    }
  });
}

// Async error wrapper - wraps async route handlers to catch errors
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  setErrorLogger
};
