// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Public routes
router.post('/register', 
  authController.validateRegister, 
  authController.register
);

router.post('/login', 
  authController.validateLogin, 
  authController.login
);

// Protected routes
router.get('/profile', 
  auth.authenticate, 
  authController.getProfile
);

router.put('/profile', 
  auth.authenticate, 
  authController.validateUpdateProfile, 
  authController.updateProfile
);

router.put('/change-password', 
  auth.authenticate, 
  authController.validateChangePassword, 
  authController.changePassword
);

router.post('/logout', 
  auth.authenticate, 
  authController.logout
);

router.get('/verify',
  auth.authenticate,
  async (req, res) => {
    try {
      const userModel = require('../models/userModel');
      const user = await userModel.findById(req.user.id);
      if (!user) {
        return res.status(401).json({ success: false, error: 'User no longer exists' });
      }
      res.json({ success: true, user: req.user });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Verification failed' });
    }
  }
);

module.exports = router;