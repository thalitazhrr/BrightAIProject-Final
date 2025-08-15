// Auth Routes - Authentication endpoints
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');

// Public routes (no authentication required)
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Protected routes (authentication required)
router.post('/logout', AuthController.verifyToken, AuthController.logout);
router.get('/profile', AuthController.verifyToken, AuthController.getProfile);
router.put('/profile', AuthController.verifyToken, AuthController.updateProfile);

// Admin only routes
router.get('/users', 
  AuthController.verifyToken, 
  AuthController.requireAdmin, 
  AuthController.getAllUsers
);

router.get('/stats', 
  AuthController.verifyToken, 
  AuthController.requireAdmin, 
  AuthController.getUserStats
);

// Token verification endpoint
router.get('/verify', AuthController.verifyToken, (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role
    },
    message: 'Token is valid'
  });
});

module.exports = router;