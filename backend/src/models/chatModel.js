// src/models/chatModel.js
const { executeQuery } = require('../../config/database');
const logger = require('../utils/logger');

class ChatModel {
  constructor() {
    this.tableName = 'BRIGHTAI_CHAT';
    this.database = 'DWHNAS';
    this.schema = 'DWH_MOIS';
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    await this.initializeTable();
    this.isInitialized = true;
  }

  // Initialize chat table if not exists
  async initializeTable() {
    try {
      logger.info('BRIGHTAI_CHAT table initialized');
    } catch (error) {
      logger.error('Error initializing BRIGHTAI_CHAT table:', error);
    }
  }

  // Save user message
  async saveUserMessage(chatData) {
    try {
      const { user_id, message, session_id } = chatData;
      
      const query = `
        INSERT INTO ${this.schema}.${this.tableName} 
        (USER_ID, MESSAGE_TYPE, MESSAGE, SESSION_ID)
        VALUES (:user_id, 'user', :message, :session_id)
      `;
      
      const binds = {
        user_id,
        message,
        session_id
      };

      await executeQuery(query, binds, this.database);
      
      // Get the last inserted chat ID (trigger will handle auto-increment)
      const getChatIdQuery = `
        SELECT SEQ_BRIGHTAI_CHAT.CURRVAL as CHAT_ID FROM DUAL
      `;
      const result = await executeQuery(getChatIdQuery, [], this.database);
      
      return result[0].CHAT_ID;
      
    } catch (error) {
      logger.error('Error saving user message:', error);
      throw error;
    }
  }

  // Save assistant response
  async saveAssistantResponse(responseData) {
    try {
      const { 
        user_id, 
        message, 
        rule_id, 
        rule_name, 
        confidence, 
        source, 
        processing_time, 
        session_id 
      } = responseData;
      
      const query = `
        INSERT INTO ${this.schema}.${this.tableName} 
        (USER_ID, MESSAGE_TYPE, MESSAGE, RULE_ID, RULE_NAME, CONFIDENCE, SOURCE, PROCESSING_TIME, SESSION_ID)
        VALUES (:user_id, 'assistant', :message, :rule_id, :rule_name, :confidence, :source, :processing_time, :session_id)
      `;
      
      const binds = {
        user_id,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        rule_id: rule_id || null,
        rule_name: rule_name || null,
        confidence: confidence || null,
        source: source || 'fallback',
        processing_time: processing_time || null,
        session_id
      };

      await executeQuery(query, binds, this.database);
      
      // Get the last inserted chat ID
      const getChatIdQuery = `
        SELECT SEQ_BRIGHTAI_CHAT.CURRVAL as CHAT_ID FROM DUAL
      `;
      const result = await executeQuery(getChatIdQuery, [], this.database);
      
      return result[0].CHAT_ID;
      
    } catch (error) {
      logger.error('Error saving assistant response:', error);
      throw error;
    }
  }

  // Get chat history for user
  async getChatHistory(user_id, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT CHAT_ID, MESSAGE_TYPE, MESSAGE, RULE_ID, RULE_NAME, CONFIDENCE, 
               SOURCE, PROCESSING_TIME, CREATED_AT, SESSION_ID
        FROM ${this.schema}.${this.tableName}
        WHERE USER_ID = :user_id
        ORDER BY CREATED_AT DESC
      `;
      
      const result = await executeQuery(query, { user_id }, this.database);
      
      // Parse JSON messages for assistant responses and ensure consistent field names
      return result.map(row => ({
        CHAT_ID: row.CHAT_ID,
        MESSAGE_TYPE: row.MESSAGE_TYPE,
        MESSAGE: row.MESSAGE_TYPE === 'assistant' ? 
          this.tryParseJSON(row.MESSAGE) : row.MESSAGE,
        RULE_ID: row.RULE_ID,
        RULE_NAME: row.RULE_NAME,
        CONFIDENCE: row.CONFIDENCE,
        SOURCE: row.SOURCE,
        PROCESSING_TIME: row.PROCESSING_TIME,
        CREATED_AT: row.CREATED_AT,
        SESSION_ID: row.SESSION_ID,
        USER_ID: row.USER_ID || null
      }));
      
    } catch (error) {
      logger.error('Error getting chat history:', error);
      throw error;
    }
  }

  // Get chat history by session
  async getChatBySession(session_id) {
    try {
      const query = `
        SELECT CHAT_ID, USER_ID, MESSAGE_TYPE, MESSAGE, RULE_ID, RULE_NAME, 
               CONFIDENCE, SOURCE, PROCESSING_TIME, CREATED_AT
        FROM ${this.schema}.${this.tableName}
        WHERE SESSION_ID = :session_id
        ORDER BY CREATED_AT ASC
      `;
      
      const result = await executeQuery(query, { session_id }, this.database);
      
      return result.map(row => ({
        CHAT_ID: row.CHAT_ID,
        USER_ID: row.USER_ID,
        MESSAGE_TYPE: row.MESSAGE_TYPE,
        MESSAGE: row.MESSAGE_TYPE === 'assistant' ? 
          this.tryParseJSON(row.MESSAGE) : row.MESSAGE,
        RULE_ID: row.RULE_ID,
        RULE_NAME: row.RULE_NAME,
        CONFIDENCE: row.CONFIDENCE,
        SOURCE: row.SOURCE,
        PROCESSING_TIME: row.PROCESSING_TIME,
        CREATED_AT: row.CREATED_AT,
        SESSION_ID: row.SESSION_ID
      }));
      
    } catch (error) {
      logger.error('Error getting chat by session:', error);
      throw error;
    }
  }

  // Get chat statistics
  async getChatStats(user_id = null, days = 30) {
    try {
      let whereClause = `WHERE CREATED_AT >= SYSDATE - :days`;
      const binds = { days };
      
      if (user_id) {
        whereClause += ` AND USER_ID = :user_id`;
        binds.user_id = user_id;
      }
      
      const query = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN MESSAGE_TYPE = 'user' THEN 1 END) as user_messages,
          COUNT(CASE WHEN MESSAGE_TYPE = 'assistant' THEN 1 END) as assistant_messages,
          COUNT(CASE WHEN SOURCE = 'rule_based' THEN 1 END) as rule_based_responses,
          COUNT(CASE WHEN SOURCE = 'fallback' THEN 1 END) as fallback_responses,
          AVG(CONFIDENCE) as avg_confidence,
          AVG(PROCESSING_TIME) as avg_processing_time,
          COUNT(DISTINCT SESSION_ID) as total_sessions,
          COUNT(DISTINCT USER_ID) as unique_users
        FROM ${this.schema}.${this.tableName}
        ${whereClause}
      `;
      
      const result = await executeQuery(query, binds, this.database);
      
      return result[0];
      
    } catch (error) {
      logger.error('Error getting chat stats:', error);
      throw error;
    }
  }

  // Delete old chat history
  async deleteOldChats(days = 90) {
    try {
      const query = `
        DELETE FROM ${this.schema}.${this.tableName}
        WHERE CREATED_AT < SYSDATE - :days
      `;
      
      const result = await executeQuery(query, { days }, this.database);
      
      logger.info(`Deleted ${result.rowsAffected} old chat records`);
      return result.rowsAffected;
      
    } catch (error) {
      logger.error('Error deleting old chats:', error);
      throw error;
    }
  }

  // Delete specific session's chat messages
  async deleteSession(sessionId, userId) {
    try {
      const query = `
        DELETE FROM ${this.schema}.${this.tableName}
        WHERE SESSION_ID = :sessionId AND USER_ID = :userId
      `;
      
      const result = await executeQuery(query, { sessionId, userId }, this.database);
      
      logger.info(`Deleted ${result.rowsAffected} messages from session ${sessionId} for user ${userId}`);
      return result.rowsAffected;
      
    } catch (error) {
      logger.error(`Error deleting session ${sessionId}:`, error);
      throw error;
    }
  }

  // Delete all chat history for a user
  async deleteUserHistory(userId) {
    try {
      const query = `
        DELETE FROM ${this.schema}.${this.tableName}
        WHERE USER_ID = :userId
      `;
      
      const result = await executeQuery(query, { userId }, this.database);
      
      logger.info(`Deleted ${result.rowsAffected} messages for user ${userId}`);
      return result.rowsAffected;
      
    } catch (error) {
      logger.error(`Error deleting history for user ${userId}:`, error);
      throw error;
    }
  }

  // Helper function to parse JSON safely
  tryParseJSON(jsonString) {
    if (!jsonString) return '';
    
    // If it's already a string and doesn't look like JSON, return as is
    if (typeof jsonString === 'string' && !jsonString.trim().startsWith('{') && !jsonString.trim().startsWith('[')) {
      return jsonString;
    }
    
    try {
      const parsed = JSON.parse(jsonString);
      
      // If parsed result is an object, convert it back to a readable string
      if (typeof parsed === 'object' && parsed !== null) {
        // If it's a complex object, return a formatted string representation
        if (Array.isArray(parsed)) {
          return parsed.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n');
        } else {
          // For objects, try to extract a meaningful text representation
          if (parsed.text) return parsed.text;
          if (parsed.message) return parsed.message;
          if (parsed.response) return parsed.response;
          
          // Otherwise convert to formatted JSON string
          return JSON.stringify(parsed, null, 2);
        }
      }
      
      return parsed;
    } catch (error) {
      // Return original string if parsing fails
      return String(jsonString);
    }
  }

  // Generate session ID
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `SESS_${timestamp}_${random}`;
  }
}

module.exports = new ChatModel();