// src/models/sessionModel.js
const { executeQuery } = require('../../config/database');
const logger = require('../utils/logger');

class SessionModel {
  constructor() {
    this.tableName = 'BRIGHTAI_SESSION';
    this.database = 'DWHNAS';
    this.schema = 'DWH_MOIS';
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    await this.initializeTable();
    this.isInitialized = true;
  }

  // Initialize session table if not exists
  async initializeTable() {
    try {
      logger.info('BRIGHTAI_SESSION table initialized');
    } catch (error) {
      logger.error('Error initializing BRIGHTAI_SESSION table:', error);
    }
  }

  // Create new session
  async create(sessionData) {
    try {
      const { user_id, session_name } = sessionData;
      const session_id = this.generateSessionId();
      
      const query = `
        INSERT INTO ${this.schema}.${this.tableName} (SESSION_ID, USER_ID, SESSION_NAME)
        VALUES (:session_id, :user_id, :session_name)
      `;
      
      await executeQuery(query, { session_id, user_id, session_name }, this.database);
      
      logger.info(`Session created with ID: ${session_id}`);
      return session_id;
      
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  // Find session by ID
  async findById(session_id) {
    try {
      const query = `
        SELECT SESSION_ID, USER_ID, SESSION_NAME, STARTED_AT, ENDED_AT, IS_ACTIVE, MESSAGE_COUNT
        FROM ${this.schema}.${this.tableName}
        WHERE SESSION_ID = :session_id
      `;
      
      const result = await executeQuery(query, { session_id }, this.database);
      
      return result.length > 0 ? result[0] : null;
      
    } catch (error) {
      logger.error('Error finding session by ID:', error);
      throw error;
    }
  }

  // Get active sessions for user
  async getActiveSessions(user_id, limit = 20) {
    try {
      const query = `
        SELECT SESSION_ID, SESSION_NAME, STARTED_AT, MESSAGE_COUNT
        FROM ${this.schema}.${this.tableName}
        WHERE USER_ID = :user_id AND IS_ACTIVE = 1
        ORDER BY STARTED_AT DESC
      `;
      
      const result = await executeQuery(query, { user_id }, this.database);
      
      return result;
      
    } catch (error) {
      logger.error('Error getting active sessions:', error);
      throw error;
    }
  }

  // Update message count
  async incrementMessageCount(session_id) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET MESSAGE_COUNT = MESSAGE_COUNT + 1
        WHERE SESSION_ID = :session_id
      `;
      
      await executeQuery(query, { session_id }, this.database);
      
    } catch (error) {
      logger.error('Error updating message count:', error);
      throw error;
    }
  }

  // End session
  async endSession(session_id) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET IS_ACTIVE = 0,
            ENDED_AT = CURRENT_TIMESTAMP
        WHERE SESSION_ID = :session_id
      `;
      
      await executeQuery(query, { session_id }, this.database);
      
    } catch (error) {
      logger.error('Error ending session:', error);
      throw error;
    }
  }

  // Update session name
  async updateSessionName(session_id, session_name) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET SESSION_NAME = :session_name
        WHERE SESSION_ID = :session_id
      `;
      
      await executeQuery(query, { session_name, session_id }, this.database);
      
    } catch (error) {
      logger.error('Error updating session name:', error);
      throw error;
    }
  }

  // Delete old inactive sessions
  async deleteOldSessions(days = 30) {
    try {
      const query = `
        DELETE FROM ${this.schema}.${this.tableName}
        WHERE IS_ACTIVE = 0 AND ENDED_AT < SYSDATE - :days
      `;
      
      const result = await executeQuery(query, { days }, this.database);
      
      logger.info(`Deleted ${result.rowsAffected} old sessions`);
      return result.rowsAffected;
      
    } catch (error) {
      logger.error('Error deleting old sessions:', error);
      throw error;
    }
  }

  // Generate unique session ID
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `SESS_${timestamp}_${random}`;
  }
}

module.exports = new SessionModel();