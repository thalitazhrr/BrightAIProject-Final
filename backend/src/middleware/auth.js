// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class AuthMiddleware {
  authenticate(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Access denied. No token provided.'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
      
    } catch (error) {
      logger.error('Authentication error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }
  }

  optionalAuth(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      }
      
      next();
    } catch (error) {
      next();
    }
  }
}

module.exports = new AuthMiddleware();