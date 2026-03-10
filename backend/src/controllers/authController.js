// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const userModel = require('../models/userModel');

class AuthController {
  // Register user
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { username, full_name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const userId = await userModel.create({
        username,
        full_name,
        email,
        password_hash: hashedPassword
      });

      logger.info(`New user registered: ${email}`);

      // Generate JWT token
      const payload = {
        id: userId,
        email: email
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { 
          expiresIn: process.env.JWT_EXPIRE || '24h',
          issuer: 'brightai-backend'
        }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: userId,
          username,
          full_name,
          email
        },
        token
      });

    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register user'
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { email, password } = req.body;

      // Find user by email
      const user = await userModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.PASSWORD_HASH);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Update last login
      await userModel.updateActivity(user.USER_ID);

      logger.info(`User logged in: ${email}`);

      // Generate JWT token
      const payload = {
        id: user.USER_ID,
        email: user.EMAIL
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { 
          expiresIn: process.env.JWT_EXPIRE || '24h',
          issuer: 'brightai-backend'
        }
      );

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          user_id: user.USER_ID,
          username: user.USERNAME,
          full_name: user.FULL_NAME,
          email: user.EMAIL,
          role: user.ROLE,
          last_login: new Date().toISOString()
        },
        token
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to login'
      });
    }
  }

  // Get user profile
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user: {
          id: user.ID,
          name: user.NAME,
          email: user.EMAIL,
          created_at: user.CREATED_AT,
          last_login: user.LAST_LOGIN
        }
      });

    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user profile'
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user.id;
      const { fullName, username, email } = req.body;

      // Check email uniqueness if changed
      if (email && email !== req.user.email) {
        const emailTaken = await userModel.emailExists(email, userId);
        if (emailTaken) {
          return res.status(400).json({
            success: false,
            error: 'Email sudah digunakan oleh akun lain'
          });
        }
      }

      // Check username uniqueness if changed
      if (username) {
        const usernameTaken = await userModel.usernameExists(username, userId);
        if (usernameTaken) {
          return res.status(400).json({
            success: false,
            error: 'Username sudah digunakan oleh akun lain'
          });
        }
      }

      await userModel.updateProfile(userId, { full_name: fullName, username, email });

      logger.info(`User profile updated: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Profil berhasil diperbarui',
        user: {
          full_name: fullName,
          username,
          email
        }
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      const isDbError = error.message && (error.message.includes('not initialized') || error.message.includes('ECONNREFUSED') || error.message.includes('NJS-'));
      res.status(500).json({
        success: false,
        error: isDbError
          ? 'Koneksi database bermasalah. Pastikan Oracle DB aktif dan server sudah di-restart.'
          : 'Gagal memperbarui profil'
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Get current user
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.PASSWORD_HASH);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await userModel.updatePassword(userId, hashedNewPassword);

      logger.info(`Password changed for user: ${user.EMAIL}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      const isDbError = error.message && (error.message.includes('not initialized') || error.message.includes('ECONNREFUSED') || error.message.includes('NJS-'));
      res.status(500).json({
        success: false,
        error: isDbError
          ? 'Koneksi database bermasalah. Pastikan Oracle DB aktif dan server sudah di-restart.'
          : 'Failed to change password'
      });
    }
  }

  // Logout (optional - mainly for logging)
  async logout(req, res) {
    try {
      logger.info(`User logged out: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to logout'
      });
    }
  }

  // Generate JWT token
  generateToken(userId, email) {
    const payload = {
      id: userId,
      email: email
    };

    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRE || '24h',
        issuer: 'brightai-backend'
      }
    );
  }

  // Validation rules
  validateRegister = [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters'),
    
    body('full_name')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ];

  validateLogin = [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ];

  validateUpdateProfile = [
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Nama lengkap wajib diisi')
      .isLength({ min: 2, max: 100 })
      .withMessage('Nama lengkap harus antara 2-100 karakter'),
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username wajib diisi')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username harus antara 3-50 karakter'),
    body('email')
      .isEmail()
      .withMessage('Format email tidak valid')
      .normalizeEmail()
  ];

  validateChangePassword = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      })
  ];
}

module.exports = new AuthController();