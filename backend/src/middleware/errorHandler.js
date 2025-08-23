// src/middleware/errorHandler.js - PERLU UPDATE
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  let error = {
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  };

  // Validation errors
  if (err.name === 'ValidationError') {
    error.error = 'Validation failed';
    error.details = err.message;
    return res.status(400).json(error);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.error = 'Invalid token';
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error.error = 'Token expired';
    return res.status(401).json(error);
  }

  // Oracle database errors
  if (err.code && err.code.startsWith('ORA-')) {
    error.error = 'Database error';
    
    // Handle specific Oracle errors
    switch(err.code) {
      case 'ORA-00001':
        error.error = 'Duplicate entry. Data already exists.';
        error.details = 'A record with this information already exists in the database.';
        return res.status(409).json(error);
      
      case 'ORA-01017':
        error.error = 'Database authentication failed';
        error.details = 'Invalid database credentials.';
        return res.status(500).json(error);
      
      case 'ORA-12154':
        error.error = 'Database connection failed';
        error.details = 'Could not resolve the connect identifier specified.';
        return res.status(500).json(error);
      
      case 'ORA-00904':
        error.error = 'Database schema error';
        error.details = 'Invalid column name in database query.';
        return res.status(500).json(error);
      
      case 'ORA-00942':
        error.error = 'Database table error';
        error.details = 'Table or view does not exist.';
        return res.status(500).json(error);
      
      default:
        if (process.env.NODE_ENV === 'development') {
          error.details = err.message;
          error.code = err.code;
        }
        return res.status(500).json(error);
    }
  }

  // Express validator errors
  if (err.type === 'entity.parse.failed') {
    error.error = 'Invalid JSON format';
    error.details = 'Request body contains invalid JSON.';
    return res.status(400).json(error);
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error.error = 'File too large';
    error.details = 'The uploaded file exceeds the maximum allowed size.';
    return res.status(413).json(error);
  }

  // Custom application errors
  if (err.isCustomError) {
    error.error = err.message;
    error.details = err.details;
    return res.status(err.statusCode || 400).json(error);
  }

  // Rule engine specific errors
  if (err.message && err.message.includes('Rule execution')) {
    error.error = 'Rule processing failed';
    error.details = 'Failed to process your request using the rule engine.';
    return res.status(500).json(error);
  }

  // Rate limiting errors
  if (err.status === 429) {
    error.error = 'Too many requests';
    error.details = 'You have exceeded the rate limit. Please try again later.';
    return res.status(429).json(error);
  }

  // Network/timeout errors
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
    error.error = 'Network error';
    error.details = 'A network error occurred while processing your request.';
    return res.status(503).json(error);
  }

  // Development mode - show detailed errors
  if (process.env.NODE_ENV === 'development') {
    error.details = err.message;
    error.stack = err.stack;
    error.name = err.name;
  }

  // Default 500 error
  res.status(500).json(error);
}

// Custom error class for application-specific errors
class CustomError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.name = 'CustomError';
    this.statusCode = statusCode;
    this.details = details;
    this.isCustomError = true;
  }
}

// 404 handler for undefined routes
function notFoundHandler(req, res) {
  const error = {
    success: false,
    error: 'Route not found',
    details: `The endpoint ${req.method} ${req.path} does not exist.`,
    timestamp: new Date().toISOString()
  };
  
  logger.warn('404 - Route not found:', {
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  res.status(404).json(error);
}

module.exports = {
  errorHandler,
  CustomError,
  notFoundHandler
};