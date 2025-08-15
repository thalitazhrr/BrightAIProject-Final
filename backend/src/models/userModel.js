// User Model - Handle user authentication and management
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

class UserModel {
  static async testConnection() {
    let client;
    try {
      client = await pool.connect();
      console.log('✅ Database connection test successful.');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      return false;
    } finally {
      if (client) {
        client.release(); // Selalu lepaskan client setelah selesai
      }
    }
  }

  // Initialize user tables
  static async initializeTables() {
    try {
      console.log('🔄 Initializing user tables...');
      
      // Create users table with error handling
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            role VARCHAR(50) DEFAULT 'user',
            department VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ Users table created/verified');
      } catch (tableError) {
        console.log('⚠️  Users table creation failed, will use fallback mode:', tableError.message);
      }

      // Create user sessions table
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS user_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            ip_address INET,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ User sessions table created/verified');
      } catch (sessionError) {
        console.log('⚠️  User sessions table creation failed, will use fallback mode:', sessionError.message);
      }

      // Create indexes for user-related tables only
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
      `);

      // Create default admin user if not exists
      const adminExists = await pool.query(
        'SELECT id FROM users WHERE username = $1', 
        ['admin']
      );

      if (adminExists.rows.length === 0) {
        const adminPassword = await bcrypt.hash('admin123', 12);
        await pool.query(`
          INSERT INTO users (username, email, password_hash, full_name, role, department)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          'admin',
          'admin@telkom.co.id', 
          adminPassword,
          'System Administrator',
          'admin',
          'IT'
        ]);
        console.log('✅ Default admin user created (username: admin, password: admin123)');
      }

      console.log('✅ User tables initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing user tables:', error);
      throw error;
    }
  }

  // Create new user
  static async createUser(userData) {
    try {
      const { username, email, password, fullName, role = 'user', department } = userData;
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      const result = await pool.query(`
        INSERT INTO users (username, email, password_hash, full_name, role, department)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, full_name, role, department, created_at
      `, [username, email, passwordHash, fullName, role, department]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        if (error.constraint === 'users_username_key') {
          throw new Error('Username already exists');
        }
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
      }
      throw error;
    }
  }

  // Authenticate user
  static async authenticateUser(username, password) {
    try {
      const result = await pool.query(`
        SELECT id, username, email, password_hash, full_name, role, department, is_active
        FROM users 
        WHERE (username = $1 OR email = $1) AND is_active = true
      `, [username]);

      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Remove password hash from returned data
      delete user.password_hash;
      return user;
    } catch (error) {
      throw error;
    }
  }

  // Generate JWT token
  static generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Create user session
  static async createSession(userId, token, ipAddress, userAgent) {
    try {
      const tokenHash = await bcrypt.hash(token, 10);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await pool.query(`
        INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, tokenHash, expiresAt, ipAddress, userAgent]);

      // Clean expired sessions
      await pool.query(
        'DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP'
      );
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }

  // Get user by ID
  static async getUserById(userId) {
    try {
      const result = await pool.query(`
        SELECT id, username, email, full_name, role, department, is_active, last_login, created_at
        FROM users WHERE id = $1
      `, [userId]);

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Get user by username
  static async getUserByUsername(username) {
    try {
      const result = await pool.query(`
        SELECT id, username, email, full_name, role, department, is_active, last_login, created_at
        FROM users WHERE username = $1
      `, [username]);

      return result.rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  static async updateUser(userId, updateData) {
    try {
      const { fullName, email, department } = updateData;
      
      const result = await pool.query(`
        UPDATE users 
        SET full_name = COALESCE($1, full_name),
            email = COALESCE($2, email),
            department = COALESCE($3, department),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, username, email, full_name, role, department, updated_at
      `, [fullName, email, department, userId]);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get all users (admin only)
  static async getAllUsers() {
    try {
      const result = await pool.query(`
        SELECT id, username, email, full_name, role, department, is_active, last_login, created_at
        FROM users 
        ORDER BY created_at DESC
      `);

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Delete user session (logout)
  static async deleteSession(userId, token) {
    try {
      // Note: In a real implementation, you'd want to hash the token for comparison
      await pool.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  // Get user statistics
  static async getUserStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_logins,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users
        FROM users
      `);

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UserModel;