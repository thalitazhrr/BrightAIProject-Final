// Chat Controller - Handle chat-related operations
const ChatModel = require('../models/chatModel');

class ChatController {
  // Get all chats (user-specific with ownership validation)
  static async getAllChats(req, res) {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      // Check if this is a fallback authentication user
      const isFallbackUser = userId === '550e8400-e29b-41d4-a716-446655440000' || 
                            userId === '550e8400-e29b-41d4-a716-446655440001';
      
      console.log(`📚 Getting chats for user: ${userId}`);
      
      if (isFallbackUser) {
        // For fallback users, get chats where user_id is null
        const chats = await ChatModel.getAllChats(null);
        
        // Return chats with the fallback user ID for frontend compatibility
        const userChats = chats.filter(chat => chat.user_id === null).map(chat => ({
          ...chat,
          user_id: userId
        }));
        
        console.log(`📚 Found ${userChats.length} chats for fallback user ${userId}`);
        
        res.json({
          success: true,
          data: userChats,
          count: userChats.length,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // For regular database users
      const chats = await ChatModel.getAllChats(userId);
      
      // Ensure all returned chats belong to the requesting user
      const userChats = chats.filter(chat => chat.user_id === userId);
      
      console.log(`📚 Found ${userChats.length} chats for user ${userId}`);
      
      res.json({
        success: true,
        data: userChats,
        count: userChats.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error getting chats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chats',
        message: error.message
      });
    }
  }

  // Get chat by ID with ownership validation
  static async getChatById(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      const chat = await ChatModel.getChatById(chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }
      
      // Verify chat ownership
      if (chat.user_id !== userId) {
        console.warn(`🚫 User ${userId} attempted to access chat ${chatId} owned by ${chat.user_id}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied - chat not owned by user'
        });
      }

      res.json({
        success: true,
        data: chat,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error getting chat:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chat',
        message: error.message
      });
    }
  }

  // Create new chat with proper user association
  static async createChat(req, res) {
    try {
      const { id, title, lastMessage, userId: bodyUserId } = req.body;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      if (!id || !title) {
        return res.status(400).json({
          success: false,
          error: 'Chat ID and title are required'
        });
      }
      
      // Check if this is a fallback authentication user
      const isFallbackUser = userId === '550e8400-e29b-41d4-a716-446655440000' || 
                            userId === '550e8400-e29b-41d4-a716-446655440001';
      
      if (isFallbackUser) {
        // For fallback users, create the chat without user_id constraint
        // This allows development/demo usage without full user system
        const chatData = {
          id,
          title,
          lastMessage: lastMessage || 'Start a conversation...',
          userId: null // Use null for fallback users to avoid foreign key constraint
        };
        
        console.log(`💬 Creating chat ${id} for fallback user ${userId}`);
        const chat = await ChatModel.createChat(chatData);
        
        // Return chat with original userId for frontend compatibility
        const returnChat = { ...chat, user_id: userId };
        
        res.status(201).json({
          success: true,
          data: returnChat,
          message: 'Chat created successfully',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // For regular database users, use the authenticated user ID
      const chatData = {
        id,
        title,
        lastMessage: lastMessage || 'Start a conversation...',
        userId: userId // Always use authenticated user ID
      };
      
      console.log(`💬 Creating chat ${id} for user ${userId}`);
      const chat = await ChatModel.createChat(chatData);

      res.status(201).json({
        success: true,
        data: chat,
        message: 'Chat created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error creating chat:', error);
      
      if (error.message.includes('duplicate')) {
        res.status(409).json({
          success: false,
          error: 'Chat with this ID already exists',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create chat',
          message: error.message
        });
      }
    }
  }

  // Update chat
  static async updateChat(req, res) {
    try {
      const { chatId } = req.params;
      const { title, lastMessage } = req.body;
      
      const chat = await ChatModel.updateChat(chatId, {
        title,
        lastMessage
      });

      if (!chat) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }

      res.json({
        success: true,
        data: chat,
        message: 'Chat updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error updating chat:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update chat',
        message: error.message
      });
    }
  }

  // Delete chat with ownership validation
  static async deleteChat(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      // First verify the chat exists and user owns it
      const existingChat = await ChatModel.getChatById(chatId);
      
      if (!existingChat) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }
      
      // Verify ownership
      if (existingChat.user_id !== userId) {
        console.warn(`🚫 User ${userId} attempted to delete chat ${chatId} owned by ${existingChat.user_id}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied - cannot delete chat owned by another user'
        });
      }
      
      console.log(`🗑️ Deleting chat ${chatId} for user ${userId}`);
      const deletedChat = await ChatModel.deleteChat(chatId);

      res.json({
        success: true,
        data: deletedChat,
        message: 'Chat deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error deleting chat:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete chat',
        message: error.message
      });
    }
  }

  // Add message to chat with ownership validation
  static async addMessage(req, res) {
    try {
      const { chatId } = req.params;
      const { message, isBot, messageId, timestamp } = req.body;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }
      
      // Check if this is a fallback authentication user
      const isFallbackUser = userId === '550e8400-e29b-41d4-a716-446655440000' || 
                            userId === '550e8400-e29b-41d4-a716-446655440001';
      
      // Verify chat exists and user owns it
      const chat = await ChatModel.getChatById(chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }
      
      // For fallback users, check if chat has null user_id
      if (isFallbackUser) {
        if (chat.user_id !== null) {
          console.warn(`🚫 Fallback user ${userId} attempted to add message to chat ${chatId} owned by ${chat.user_id}`);
          return res.status(403).json({
            success: false,
            error: 'Access denied - cannot add message to chat owned by another user'
          });
        }
      } else {
        // For regular users, check exact user_id match
        if (chat.user_id !== userId) {
          console.warn(`🚫 User ${userId} attempted to add message to chat ${chatId} owned by ${chat.user_id}`);
          return res.status(403).json({
            success: false,
            error: 'Access denied - cannot add message to chat owned by another user'
          });
        }
      }

      console.log(`💬 Adding message to chat ${chatId} for user ${userId}`);
      const newMessage = await ChatModel.addMessage(chatId, {
        message,
        isBot: isBot || false,
        userId: isFallbackUser ? null : userId, // Use null for fallback users
        messageId: messageId,
        timestamp: timestamp
      });

      res.status(201).json({
        success: true,
        data: newMessage,
        message: 'Message added successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error adding message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add message',
        message: error.message
      });
    }
  }

  // Get chat messages with ownership validation
  static async getChatMessages(req, res) {
    try {
      const { chatId } = req.params;
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }
      
      // Verify chat exists and user owns it
      const chat = await ChatModel.getChatById(chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          error: 'Chat not found'
        });
      }
      
      if (chat.user_id !== userId) {
        console.warn(`🚫 User ${userId} attempted to access messages for chat ${chatId} owned by ${chat.user_id}`);
        return res.status(403).json({
          success: false,
          error: 'Access denied - cannot access messages for chat owned by another user'
        });
      }
      
      console.log(`📨 Getting messages for chat ${chatId} (user ${userId})`);
      const messages = await ChatModel.getChatMessages(chatId);
      
      res.json({
        success: true,
        data: messages,
        count: messages.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error getting messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get messages',
        message: error.message
      });
    }
  }

  // Search chats
  static async searchChats(req, res) {
    try {
      const { q: query } = req.query;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      const chats = await ChatModel.searchChats(query);
      
      res.json({
        success: true,
        data: chats,
        count: chats.length,
        query: query,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error searching chats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search chats',
        message: error.message
      });
    }
  }

  // Get chat statistics
  static async getChatStats(req, res) {
    try {
      const stats = await ChatModel.getChatStats();
      
      res.json({
        success: true,
        data: {
          ...stats,
          avg_messages_per_chat: parseFloat(stats.avg_messages_per_chat || 0).toFixed(2)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error getting chat stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chat statistics',
        message: error.message
      });
    }
  }

  // Sync chat from frontend (for offline/online sync)
  static async syncChat(req, res) {
    try {
      const { chat } = req.body;
      
      if (!chat || !chat.id) {
        return res.status(400).json({
          success: false,
          error: 'Chat data with ID is required'
        });
      }

      // Check if chat exists
      let existingChat = await ChatModel.getChatById(chat.id);
      
      if (!existingChat) {
        // Create new chat
        await ChatModel.createChat({
          id: chat.id,
          title: chat.title,
          lastMessage: chat.lastMessage
        });
      } else {
        // Update existing chat
        await ChatModel.updateChat(chat.id, {
          title: chat.title,
          lastMessage: chat.lastMessage
        });
      }

      // Sync messages
      const existingMessages = await ChatModel.getChatMessages(chat.id);
      const existingMessageTexts = existingMessages.map(m => m.text);
      
      // Add new messages
      for (const message of chat.messages || []) {
        if (!existingMessageTexts.includes(message.text)) {
          await ChatModel.addMessage(chat.id, {
            message: message.text,
            isBot: message.isBot
          });
        }
      }

      // Get updated chat
      const updatedChat = await ChatModel.getChatById(chat.id);

      res.json({
        success: true,
        data: updatedChat,
        message: 'Chat synced successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error syncing chat:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync chat',
        message: error.message
      });
    }
  }
}

module.exports = ChatController;