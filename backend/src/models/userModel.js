// src/models/userModel.js
const { executeQuery } = require('../../config/database');
const logger = require('../utils/logger');

class UserModel {
  constructor() {
    this.tableName = 'BRIGHTAI_USER';
    this.database = 'DADBS';
    this.schema = 'USR_RPT';
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    await this.initializeTable();
    this.isInitialized = true;
  }

  // Initialize users table if not exists
  async initializeTable() {
    try {
      logger.info('BRIGHTAI_USER table initialized');
    } catch (error) {
      logger.error('Error initializing BRIGHTAI_USER table:', error);
    }
  }

  // Create new user
  async create(userData) {
    try {
      const { username, email, password_hash, full_name, role = 'user' } = userData;
      
      const query = `
        INSERT INTO ${this.schema}.${this.tableName} (USERNAME, EMAIL, PASSWORD_HASH, FULL_NAME, ROLE)
        VALUES (:username, :email, :password_hash, :full_name, :role)
      `;
      
      const binds = {
        username,
        email,
        password_hash,
        full_name,
        role
      };

      await executeQuery(query, binds, this.database);
      
      // Get the last inserted user ID from sequence
      const getUserIdQuery = `
        SELECT USR_RPT.SEQ_BRIGHTAI_USER.CURRVAL as USER_ID FROM DUAL
      `;
      const result = await executeQuery(getUserIdQuery, [], this.database);
      const userId = result[0].USER_ID;
      
      logger.info(`User created with ID: ${userId}`);
      return userId;
      
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  // Find user by email
  async findByEmail(email) {
    try {
      const query = `
        SELECT USER_ID, USERNAME, EMAIL, PASSWORD_HASH, FULL_NAME, ROLE, IS_ACTIVE, CREATED_AT, UPDATED_AT
        FROM ${this.schema}.${this.tableName}
        WHERE EMAIL = :email AND IS_ACTIVE = 1
      `;
      
      const result = await executeQuery(query, { email }, this.database);
      
      return result.length > 0 ? result[0] : null;
      
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Find user by username
  async findByUsername(username) {
    try {
      const query = `
        SELECT USER_ID, USERNAME, EMAIL, PASSWORD_HASH, FULL_NAME, ROLE, IS_ACTIVE, CREATED_AT, UPDATED_AT
        FROM ${this.schema}.${this.tableName}
        WHERE USERNAME = :username AND IS_ACTIVE = 1
      `;
      
      const result = await executeQuery(query, { username }, this.database);
      
      return result.length > 0 ? result[0] : null;
      
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  // Find user by ID
  async findById(user_id) {
    try {
      const query = `
        SELECT USER_ID, USERNAME, EMAIL, PASSWORD_HASH, FULL_NAME, ROLE, IS_ACTIVE, CREATED_AT, UPDATED_AT
        FROM ${this.schema}.${this.tableName}
        WHERE USER_ID = :user_id AND IS_ACTIVE = 1
      `;
      
      const result = await executeQuery(query, { user_id }, this.database);
      
      return result.length > 0 ? result[0] : null;
      
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Update user activity
  async updateActivity(user_id) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET UPDATED_AT = CURRENT_TIMESTAMP
        WHERE USER_ID = :user_id
      `;
      
      await executeQuery(query, { user_id }, this.database);
      
    } catch (error) {
      logger.error('Error updating user activity:', error);
      throw error;
    }
  }

  // Update user profile
  async updateProfile(user_id, profileData) {
    try {
      const { full_name, username, email } = profileData;

      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET FULL_NAME = :full_name,
            USERNAME = :username,
            EMAIL = :email,
            UPDATED_AT = CURRENT_TIMESTAMP
        WHERE USER_ID = :user_id
      `;

      await executeQuery(query, { full_name, username, email, user_id }, this.database);

    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Update password
  async updatePassword(user_id, hashedPassword) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET PASSWORD_HASH = :password_hash,
            UPDATED_AT = CURRENT_TIMESTAMP
        WHERE USER_ID = :user_id
      `;
      
      await executeQuery(query, { password_hash: hashedPassword, user_id }, this.database);
      
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  // Update user role (admin function)
  async updateRole(user_id, role) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET ROLE = :role,
            UPDATED_AT = CURRENT_TIMESTAMP
        WHERE USER_ID = :user_id
      `;
      
      await executeQuery(query, { role, user_id }, this.database);
      
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }

  // Get all users (admin function)
  async findAll(limit = 50, offset = 0) {
    try {
      const query = `
        SELECT USER_ID, USERNAME, EMAIL, FULL_NAME, ROLE, IS_ACTIVE, CREATED_AT, UPDATED_AT
        FROM ${this.schema}.${this.tableName}
        WHERE IS_ACTIVE = 1
        ORDER BY CREATED_AT DESC
      `;
      
      const result = await executeQuery(query, {}, this.database);
      
      return result;
      
    } catch (error) {
      logger.error('Error finding all users:', error);
      throw error;
    }
  }

  // Deactivate user (admin function)
  async deactivateById(user_id) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET IS_ACTIVE = 0,
            UPDATED_AT = CURRENT_TIMESTAMP
        WHERE USER_ID = :user_id
      `;
      
      await executeQuery(query, { user_id }, this.database);
      
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  // Activate user (admin function)
  async activateById(user_id) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET IS_ACTIVE = 1,
            UPDATED_AT = CURRENT_TIMESTAMP
        WHERE USER_ID = :user_id
      `;
      
      await executeQuery(query, { user_id }, this.database);
      
    } catch (error) {
      logger.error('Error activating user:', error);
      throw error;
    }
  }

  // Check if username exists
  async usernameExists(username, excludeUserId = null) {
    try {
      let query = `
        SELECT COUNT(*) as count
        FROM ${this.schema}.${this.tableName}
        WHERE USERNAME = :username
      `;
      
      const binds = { username };
      
      if (excludeUserId) {
        query += ` AND USER_ID != :excludeUserId`;
        binds.excludeUserId = excludeUserId;
      }
      
      const result = await executeQuery(query, binds, this.database);
      
      return result[0].COUNT > 0;
      
    } catch (error) {
      logger.error('Error checking username existence:', error);
      throw error;
    }
  }

  // Check if email exists
  async emailExists(email, excludeUserId = null) {
    try {
      let query = `
        SELECT COUNT(*) as count
        FROM ${this.schema}.${this.tableName}
        WHERE EMAIL = :email
      `;
      
      const binds = { email };
      
      if (excludeUserId) {
        query += ` AND USER_ID != :excludeUserId`;
        binds.excludeUserId = excludeUserId;
      }
      
      const result = await executeQuery(query, binds, this.database);
      
      return result[0].COUNT > 0;
      
    } catch (error) {
      logger.error('Error checking email existence:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN IS_ACTIVE = 1 THEN 1 END) as active_users,
          COUNT(CASE WHEN IS_ACTIVE = 0 THEN 1 END) as inactive_users,
          COUNT(CASE WHEN ROLE = 'admin' THEN 1 END) as admin_users,
          COUNT(CASE WHEN ROLE = 'user' THEN 1 END) as regular_users
        FROM ${this.schema}.${this.tableName}
      `;
      
      const result = await executeQuery(query, [], this.database);
      
      return result[0];
      
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }
}

module.exports = new UserModel();