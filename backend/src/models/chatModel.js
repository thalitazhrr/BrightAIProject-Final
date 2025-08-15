// Chat Model - Database operations for chat history
const { pool } = require('../config/database');

class ChatModel {
  // Initialize chat tables
  static async initializeTables() {
    try {
      // Create chats table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chats (
          id VARCHAR(50) PRIMARY KEY,
          title VARCHAR(500) NOT NULL,
          last_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create chat_messages table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          chat_id VARCHAR(50) REFERENCES chats(id) ON DELETE CASCADE,
          message TEXT NOT NULL,
          is_bot BOOLEAN DEFAULT FALSE,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add user_id columns to existing tables (after tables are created)
      // Allow NULL user_id for fallback authentication users
      await pool.query(`
        ALTER TABLE chats 
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE
      `);

      await pool.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE
      `);

      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
        CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);
        CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
      `);

      console.log('✅ Chat tables initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing chat tables:', error);
      throw error;
    }
  }

  // Get all chats for a specific user
  static async getAllChats(userId = null) {
    try {
      let query = `
        SELECT 
          c.id,
          c.title,
          c.last_message,
          c.created_at,
          c.updated_at,
          c.user_id,
          COUNT(cm.id) as message_count
        FROM chats c
        LEFT JOIN chat_messages cm ON c.id = cm.chat_id`;
      
      let params = [];
      if (userId !== undefined) {
        if (userId === null) {
          query += ` WHERE c.user_id IS NULL`;
        } else {
          query += ` WHERE c.user_id = $1`;
          params = [userId];
        }
      }
      
      query += `
        GROUP BY c.id, c.title, c.last_message, c.created_at, c.updated_at, c.user_id
        ORDER BY c.updated_at DESC
      `;
      
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Error getting chats:', error);
      throw error;
    }
  }

  // Get chat by ID with messages
  static async getChatById(chatId) {
    try {
      // Get chat info
      const chatResult = await pool.query(`
        SELECT id, title, last_message, created_at, updated_at, user_id
        FROM chats
        WHERE id = $1
      `, [chatId]);

      if (chatResult.rows.length === 0) {
        return null;
      }

      const chat = chatResult.rows[0];

      // Get messages
      const messagesResult = await pool.query(`
        SELECT message, is_bot, timestamp
        FROM chat_messages
        WHERE chat_id = $1
        ORDER BY timestamp ASC
      `, [chatId]);

      chat.messages = messagesResult.rows.map(msg => ({
        text: msg.message,
        isBot: msg.is_bot,
        timestamp: msg.timestamp
      }));

      return chat;
    } catch (error) {
      console.error('❌ Error getting chat by ID:', error);
      throw error;
    }
  }

  // Create new chat
  static async createChat(chatData) {
    try {
      const { id, title, lastMessage, userId } = chatData;
      
      const result = await pool.query(`
        INSERT INTO chats (id, title, last_message, user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [id, title, lastMessage, userId]);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error creating chat:', error);
      throw error;
    }
  }

  // Update chat
  static async updateChat(chatId, updateData) {
    try {
      const { title, lastMessage } = updateData;
      
      const result = await pool.query(`
        UPDATE chats
        SET title = COALESCE($2, title),
            last_message = COALESCE($3, last_message),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [chatId, title, lastMessage]);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error updating chat:', error);
      throw error;
    }
  }

  // Delete chat
  static async deleteChat(chatId) {
    try {
      // Messages will be deleted automatically due to CASCADE
      const result = await pool.query(`
        DELETE FROM chats
        WHERE id = $1
        RETURNING *
      `, [chatId]);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error deleting chat:', error);
      throw error;
    }
  }

  // Add message to chat
  static async addMessage(chatId, messageData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { message, isBot, userId } = messageData;
      
      // Insert message
      const messageResult = await client.query(`
        INSERT INTO chat_messages (chat_id, message, is_bot, user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [chatId, message, isBot, userId]);

      // Update chat's last message and timestamp
      await client.query(`
        UPDATE chats
        SET last_message = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [chatId, message.length > 100 ? message.substring(0, 100) + '...' : message]);

      await client.query('COMMIT');
      
      return {
        text: messageResult.rows[0].message,
        isBot: messageResult.rows[0].is_bot,
        timestamp: messageResult.rows[0].timestamp
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error adding message:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get chat messages
  static async getChatMessages(chatId) {
    try {
      const result = await pool.query(`
        SELECT message, is_bot, timestamp
        FROM chat_messages
        WHERE chat_id = $1
        ORDER BY timestamp ASC
      `, [chatId]);

      return result.rows.map(msg => ({
        text: msg.message,
        isBot: msg.is_bot,
        timestamp: msg.timestamp
      }));
    } catch (error) {
      console.error('❌ Error getting chat messages:', error);
      throw error;
    }
  }

  // Search chats
  static async searchChats(query) {
    try {
      const result = await pool.query(`
        SELECT DISTINCT
          c.id,
          c.title,
          c.last_message,
          c.created_at,
          c.updated_at
        FROM chats c
        LEFT JOIN chat_messages cm ON c.id = cm.chat_id
        WHERE 
          c.title ILIKE $1 OR 
          c.last_message ILIKE $1 OR
          cm.message ILIKE $1
        ORDER BY c.updated_at DESC
      `, [`%${query}%`]);

      return result.rows;
    } catch (error) {
      console.error('❌ Error searching chats:', error);
      throw error;
    }
  }

  // Get chat statistics
  static async getChatStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(DISTINCT c.id) as total_chats,
          COUNT(cm.id) as total_messages,
          COUNT(CASE WHEN cm.is_bot = true THEN 1 END) as bot_messages,
          COUNT(CASE WHEN cm.is_bot = false THEN 1 END) as user_messages,
          AVG(CASE WHEN chat_message_counts.message_count > 0 THEN chat_message_counts.message_count END) as avg_messages_per_chat
        FROM chats c
        LEFT JOIN chat_messages cm ON c.id = cm.chat_id
        LEFT JOIN (
          SELECT chat_id, COUNT(*) as message_count
          FROM chat_messages
          GROUP BY chat_id
        ) chat_message_counts ON c.id = chat_message_counts.chat_id
      `);

      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting chat stats:', error);
      throw error;
    }
  }
}

module.exports = ChatModel;