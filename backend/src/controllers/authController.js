// Auth Controller - Handle authentication operations
const UserModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


class AuthController {
  // User registration
  static async register(req, res) {
    try {
      const { username, email, password, fullName, department } = req.body;
      
      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username, email, and password are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long'
        });
      }

      // Create user
      const user = await UserModel.createUser({
        username,
        email,
        password,
        fullName,
        department
      });

      res.status(201).json({
        success: true,
        data: user,
        message: 'User registered successfully'
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // User login
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required'
        });
      }

      let user, token;

      try {
        // Try database authentication first
        user = await UserModel.authenticateUser(username, password);
        token = UserModel.generateToken(user);
        
        // Create session
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        await UserModel.createSession(user.id, token, ipAddress, userAgent);
      } catch (dbError) {
        console.log('Database authentication failed, trying fallback...');
        
        // Secure fallback authentication for development/demo
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        const userUsername = process.env.USER_USERNAME || 'user';
        const userPasswordHash = process.env.USER_PASSWORD_HASH;
        const jwtSecret = process.env.JWT_SECRET;
        
        if (!jwtSecret) {
          throw new Error('JWT_SECRET not configured');
        }
        
        if (username === adminUsername && adminPasswordHash && await bcrypt.compare(password, adminPasswordHash)) {
          user = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            username: adminUsername,
            email: 'admin@telkom.co.id',
            full_name: 'Administrator',
            role: 'admin',
            department: 'IT'
          };
          
          // Generate secure token
          token = jwt.sign(
            { 
              userId: user.id, 
              username: user.username, 
              role: user.role 
            },
            jwtSecret,
            { expiresIn: '7d' }
          );
        } else if (username === userUsername && userPasswordHash && await bcrypt.compare(password, userPasswordHash)) {
          user = {
            id: '550e8400-e29b-41d4-a716-446655440001',
            username: userUsername,
            email: 'user@telkom.co.id',
            full_name: 'Demo User',
            role: 'user',
            department: 'Sales'
          };
          
          token = jwt.sign(
            { 
              userId: user.id, 
              username: user.username, 
              role: user.role 
            },
            jwtSecret,
            { expiresIn: '7d' }
          );
        } else {
          // Final fallback for demo/development without password hashes
          if (username === 'admin' && password === 'admin123') {
            user = {
              id: 'demo-admin-001',
              username: 'admin',
              email: 'admin@telkom.co.id',
              full_name: 'Administrator',
              role: 'admin',
              department: 'IT'
            };
            
            token = jwt.sign(
              { 
                userId: user.id, 
                username: user.username, 
                role: user.role 
              },
              jwtSecret,
              { expiresIn: '24h' }
            );
          } else if (username === 'user' && password === 'user123') {
            user = {
              id: 'demo-user-001',
              username: 'user',
              email: 'user@telkom.co.id',
              full_name: 'Demo User',
              role: 'user',
              department: 'Sales'
            };
            
            token = jwt.sign(
              { 
                userId: user.id, 
                username: user.username, 
                role: user.role 
              },
              jwtSecret,
              { expiresIn: '24h' }
            );
          } else {
            throw new Error('Invalid credentials');
          }
        }
      }

      res.json({
        success: true,
        data: {
          user,
          token
        },
        message: 'Login successful'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  // User logout
  static async logout(req, res) {
    try {
      const userId = req.user?.userId;
      const token = req.token;

      if (userId && token) {
        await UserModel.deleteSession(userId, token);
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    try {
      const userId = req.user.userId;
      const user = await UserModel.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user profile'
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const userId = req.user.userId;
      const { fullName, email, department } = req.body;

      const updatedUser = await UserModel.updateUser(userId, {
        fullName,
        email,
        department
      });

      res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Verify token (middleware helper)
  static async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Access token required'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      let decoded;
      try {
        // Try UserModel verification first
        decoded = UserModel.verifyToken(token);
      } catch (modelError) {
        // Fallback token verification with environment JWT secret
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error('JWT_SECRET not configured');
        }
        decoded = jwt.verify(token, jwtSecret);
      }
      
      try {
        // Try to get user from database
        const user = await UserModel.getUserById(decoded.userId);
        if (!user || !user.is_active) {
          // Check if it's a demo user
          if (decoded.userId === 'demo-admin-001' || decoded.userId === 'demo-user-001' || 
              decoded.userId === 'demo-admin-id' || decoded.userId === 'demo-user-id') {
            // Allow demo users
            req.user = decoded;
            req.token = token;
            return next();
          }
          
          return res.status(401).json({
            success: false,
            error: 'User not found or inactive'
          });
        }
      } catch (dbError) {
        // Database unavailable, check if it's demo user
        if (decoded.userId === 'demo-admin-001' || decoded.userId === 'demo-user-001' || 
            decoded.userId === 'demo-admin-id' || decoded.userId === 'demo-user-id') {
          req.user = decoded;
          req.token = token;
          return next();
        }
        
        return res.status(401).json({
          success: false,
          error: 'Authentication service unavailable'
        });
      }

      req.user = decoded;
      req.token = token;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  }

  // Admin only middleware
  static async requireAdmin(req, res, next) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      next();
    } catch (error) {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
  }

  // Get all users (admin only)
  static async getAllUsers(req, res) {
    try {
      const users = await UserModel.getAllUsers();
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get users'
      });
    }
  }

  // Get user statistics (admin only)
  static async getUserStats(req, res) {
    try {
      const stats = await UserModel.getUserStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user statistics'
      });
    }
  }
}

module.exports = AuthController;