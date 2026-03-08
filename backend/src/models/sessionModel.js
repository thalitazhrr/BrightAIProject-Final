// src/models/sessionModel.js
const { executeQuery } = require('../../config/database');
const logger = require('../utils/logger');

class SessionModel {
  constructor() {
    this.tableName = 'BRIGHTAI_SESSION';
    this.database = 'DADBS';
    this.schema = 'USR_RPT';
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    await this.initializeTable();
    this.isInitialized = true;
  }

  async initializeTable() {
    try {
      logger.info('BRIGHTAI_SESSION table initialized');
    } catch (error) {
      logger.error('Error initializing BRIGHTAI_SESSION table:', error);
    }
  }

  async create(sessionData) {
    try {
      const { user_id, session_name } = sessionData;
      const session_id = this.generateSessionId();

      const query = `
        INSERT INTO ${this.schema}.${this.tableName} (SESSION_ID, USER_ID, SESSION_NAME, IS_ACTIVE, STARTED_AT, MESSAGE_COUNT)
        VALUES (:session_id, :user_id, :session_name, 1, CURRENT_TIMESTAMP, 0)
      `;

      await executeQuery(query, { session_id, user_id, session_name }, this.database);

      logger.info(`Session created with ID: ${session_id}`);
      return session_id;

    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

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

    async getActiveSessions(user_id, limit = 20) {
    try {
        const query = `
        SELECT *
        FROM (
            SELECT SESSION_ID, USER_ID, SESSION_NAME, STARTED_AT, MESSAGE_COUNT
            FROM ${this.schema}.${this.tableName}
            WHERE USER_ID = :user_id AND IS_ACTIVE = 1
            ORDER BY STARTED_AT DESC
        )
        WHERE ROWNUM <= ${limit}
        `;
        
        const result = await executeQuery(query, { user_id }, this.database);
        return result;
    } catch (error) {
        logger.error('Error getting active sessions:', error);
        throw error;
    }
    }

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

  async deleteSession(session_id, user_id = null) {
    try {
      let query, params;
      if (user_id) {
        query = `
          DELETE FROM ${this.schema}.${this.tableName}
          WHERE SESSION_ID = :session_id AND USER_ID = :user_id
        `;
        params = { session_id, user_id };
      } else {
        query = `
          DELETE FROM ${this.schema}.${this.tableName}
          WHERE SESSION_ID = :session_id
        `;
        params = { session_id };
      }

      const result = await executeQuery(query, params, this.database);
      logger.info(`Session ${session_id} deleted successfully`);
      return result.rowsAffected;
    } catch (error) {
      logger.error('Error deleting session:', error);
      throw error;
    }
  }

  async deleteUserSessions(user_id) {
    try {
      const query = `
        DELETE FROM ${this.schema}.${this.tableName}
        WHERE USER_ID = :user_id
      `;
      const result = await executeQuery(query, { user_id }, this.database);
      logger.info(`Deleted ${result.rowsAffected} sessions for user ${user_id}`);
      return result.rowsAffected;
    } catch (error) {
      logger.error('Error deleting user sessions:', error);
      throw error;
    }
  }

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

  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `SESS_${timestamp}_${random}`;
  }
}

module.exports = new SessionModel();
