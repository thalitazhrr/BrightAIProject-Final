// middleware/aiMiddleware.js
const rateLimit = require('express-rate-limit');

// Rate limiting for AI endpoints
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Terlalu banyak permintaan dari IP ini, coba lagi dalam 15 menit.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Chat specific rate limiting (more restrictive)
const chatRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 chat requests per minute
  message: {
    error: 'Terlalu banyak pesan chat, harap tunggu sebentar.',
    retryAfter: '1 minute'
  }
});

// Request validation middleware
const validateChatRequest = (req, res, next) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Message is required',
      code: 'MISSING_MESSAGE'
    });
  }
  
  if (typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Message must be a string',
      code: 'INVALID_MESSAGE_TYPE'
    });
  }
  
  if (message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message cannot be empty',
      code: 'EMPTY_MESSAGE'
    });
  }
  
  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Message too long (max 1000 characters)',
      code: 'MESSAGE_TOO_LONG'
    });
  }
  
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};

// CORS configuration for AI endpoints
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'https://telkom-brightai.vercel.app',
      // Add your production domains
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('AI API Error:', err);
  
  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: 'Database connection failed',
      code: 'DB_CONNECTION_ERROR',
      message: 'Layanan sedang dalam maintenance, silakan coba lagi nanti.'
    });
  }
  
  // Rate limit errors
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      message: err.message || 'Terlalu banyak permintaan, silakan tunggu sebentar.'
    });
  }
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      code: 'CORS_ERROR',
      message: 'Origin tidak diizinkan mengakses API ini.'
    });
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.message
    });
  }
  
  // Default server error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: 'Terjadi kesalahan sistem, silakan coba lagi nanti.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    
    // Log based on status code
    if (res.statusCode >= 400) {
      console.error('AI API Error Request:', logData);
    } else {
      console.log('AI API Request:', logData);
    }
  });
  
  next();
};

// Content sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.body && req.body.message) {
    // Remove potentially harmful characters
    req.body.message = req.body.message
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  
  next();
};

module.exports = {
  aiRateLimit,
  chatRateLimit,
  validateChatRequest,
  securityHeaders,
  corsOptions,
  errorHandler,
  requestLogger,
  sanitizeInput
};