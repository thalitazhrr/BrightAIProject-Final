//telkomRoutes.js - Simplified routes for BrightAI chatbot
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const AuthController = require('../controllers/authController');
const { query } = require('../config/database');

// Middleware for request logging
router.use((req, res, next) => {
  console.log(`🔄 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
});

// Error handling middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Public routes (health check)
router.get('/health', asyncHandler(async (req, res) => {
  try {
    // Simple health check without database dependency
    res.json({
      success: true,
      status: 'healthy',
      services: {
        api: 'running',
        ai_controller: 'active'
      },
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

// Apply authentication to all other routes
router.use(AuthController.verifyToken);

// ====== AI CHAT ROUTES ======

// Main chat endpoint for BrightAI
router.post('/ai/chat', asyncHandler(aiController.chat));

// ====== ERROR HANDLING ======

// 404 handler for unmatched routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// General error handler
router.use((error, req, res, next) => {
  console.error('❌ Route Error:', {
    message: error.message,
    stack: error.stack,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;