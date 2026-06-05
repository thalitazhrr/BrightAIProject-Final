// src/controllers/chatController.js - Updated dengan Chat History
const ruleEngine = require('../rules/engine/ruleEngine');
const queryProcessor = require('../rules/engine/queryProcessor');
const { generateWelcomeMessage, generateFallbackResponse, generateErrorResponse } = require('../rules/template/welcomeTemplates');
const chatModel = require('../models/chatModel');
const sessionModel = require('../models/sessionModel');
const logger = require('../utils/logger');
const forecastNLG = require('../rules/engine/forecastNLG');

class ChatController {
  async processMessage(req, res) {
    try {
      const { message, sessionId, geoContext } = req.body;
      const userId = req.user.id;
      
      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      const trimmedMessage = message.trim();
      
      // Create session if not provided
      let session_id = sessionId;
      if (!session_id) {
        try {
          session_id = await sessionModel.create({
            user_id: userId,
            session_name: `Chat ${new Date().toISOString().slice(0, 16)}`
          });
        } catch (sessionError) {
          logger.error('Error creating session:', sessionError);
          session_id = chatModel.generateSessionId(); // Fallback
        }
      }
      
      logger.info(`Processing message from user ${userId}: ${trimmedMessage}`);

      // Save user message to database
      await chatModel.saveUserMessage({
        user_id: userId,
        message: trimmedMessage,
        session_id: session_id
      });

      // Update message count in session
      try {
        await sessionModel.incrementMessageCount(session_id);
      } catch (error) {
        logger.warn('Failed to increment message count:', error);
      }

      let response;
      let responseData = {
        user_id: userId,
        session_id: session_id,
        source: 'fallback',
        processing_time: 0
      };

      const startTime = Date.now();

      // Check if it's a welcome/greeting message
      if (queryProcessor.isWelcomeQuery(trimmedMessage)) {
        response = generateWelcomeMessage();
        responseData.message = response;
        responseData.source = 'welcome';
        responseData.processing_time = Date.now() - startTime;

        await chatModel.saveAssistantResponse(responseData);

        return res.json({
          success: true,
          source: 'welcome',
          response: response,
          session_id: session_id
        });
      }

      // Check if it's a forecast result message
      if (trimmedMessage.startsWith('__FORECAST__:')) {
        try {
          const data = JSON.parse(trimmedMessage.slice('__FORECAST__:'.length));
          response = forecastNLG.generate(data);
          responseData.message = response;
          responseData.source = 'rule_based';
          responseData.processing_time = Date.now() - startTime;
          await chatModel.saveAssistantResponse(responseData);
          return res.json({ success: true, source: 'forecast', response, session_id });
        } catch (e) {
          logger.error('Forecast message parse error:', e);
        }
      }

      // Check if it's a help request
      if (queryProcessor.isHelpQuery(trimmedMessage)) {
        response = generateFallbackResponse('general_help');
        responseData.message = response;
        responseData.source = 'help';
        responseData.processing_time = Date.now() - startTime;

        await chatModel.saveAssistantResponse(responseData);

        return res.json({
          success: true,
          source: 'help',
          response: response,
          session_id: session_id
        });
      }

      // Process through rule engine
      const ruleResult = await ruleEngine.processQuery(trimmedMessage, { userId, geoContext });
      
      if (ruleResult.success) {
        responseData.message = ruleResult.response;
        responseData.rule_id = ruleResult.rule_id;
        responseData.rule_name = ruleResult.rule_name;
        responseData.confidence = ruleResult.confidence;
        responseData.source = ruleResult.source;
        responseData.processing_time = ruleResult.processing_time;

        await chatModel.saveAssistantResponse(responseData);

        return res.json({
          success: true,
          source: ruleResult.source,
          rule_id: ruleResult.rule_id,
          rule_name: ruleResult.rule_name,
          confidence: ruleResult.confidence,
          response: ruleResult.response,
          processing_time: ruleResult.processing_time,
          cached: ruleResult.cached || false,
          session_id: session_id
        });
      } else {
        // No matching rule found
        response = generateFallbackResponse(ruleResult.reason, ruleResult.partialMatches);
        responseData.message = response;
        responseData.source = 'fallback';
        responseData.processing_time = Date.now() - startTime;

        await chatModel.saveAssistantResponse(responseData);

        return res.json({
          success: true,
          source: 'fallback',
          response: response,
          reason: ruleResult.reason,
          session_id: session_id
        });
      }
      
    } catch (error) {
      logger.error('Chat controller error:', error);
      
      // Save error response to database
      try {
        const errorResponse = generateErrorResponse('processing_error');
        await chatModel.saveAssistantResponse({
          user_id: req.user ? req.user.id : null,
          message: errorResponse,
          source: 'error',
          session_id: req.body.sessionId || null,
          processing_time: 0
        });
      } catch (saveError) {
        logger.error('Error saving error response:', saveError);
      }

      const errorResponse = generateErrorResponse('processing_error');
      return res.status(500).json({
        success: false,
        source: 'error',
        response: errorResponse,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  // Handle forecast result — dedicated endpoint, no rule engine
  async processForecastResult(req, res) {
    try {
      const { data, sessionId } = req.body;
      const userId = req.user.id;

      if (!data) {
        return res.status(400).json({ success: false, error: 'Forecast data required' });
      }

      let session_id = sessionId;
      if (!session_id) {
        try {
          session_id = await sessionModel.create({
            user_id: userId,
            session_name: `Chat ${new Date().toISOString().slice(0, 16)}`
          });
        } catch {
          session_id = chatModel.generateSessionId();
        }
      }

      const startTime  = Date.now();
      const scope      = data.witel ? `${data.regional} / ${data.witel}` : data.regional;
      const userText   = `Prediksi ${data.metricLabel} — ${scope} untuk ${data.forecastPeriod}`;
      const response   = forecastNLG.generate(data);

      // Simpan user message
      await chatModel.saveUserMessage({ user_id: userId, message: userText, session_id });
      try { await sessionModel.incrementMessageCount(session_id); } catch {}

      // Simpan AI response
      const processing_time = Date.now() - startTime;
      await chatModel.saveAssistantResponse({
        user_id: userId, session_id, message: response,
        source: 'rule_based', processing_time
      });

      return res.json({ success: true, source: 'forecast', response, session_id });
    } catch (error) {
      logger.error('processForecastResult error:', error);
      return res.status(500).json({ success: false, error: 'Failed to process forecast result' });
    }
  }

  // Get chat history for user
  async getChatHistory(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, session_id } = req.query;

      // If session_id is provided, get specific session messages
      if (session_id) {
        const chatSession = await chatModel.getChatBySession(session_id);
        
        // Check if user has access to this session (use == for type-safe Oracle number comparison)
        const userHasAccess = chatSession.some(chat => String(chat.USER_ID) === String(userId));
        if (!userHasAccess && chatSession.length > 0) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to this chat session'
          });
        }

        return res.json({
          success: true,
          data: chatSession,
          session_id: session_id
        });
      }

      // Otherwise get all chat history for user
      const chatHistory = await chatModel.getChatHistory(
        userId, 
        parseInt(limit), 
        parseInt(offset)
      );

      res.json({
        success: true,
        chat_history: chatHistory,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: chatHistory.length
        }
      });

    } catch (error) {
      logger.error('Get chat history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chat history'
      });
    }
  }

  // Get specific chat session
  async getChatSession(req, res) {
    try {
      const { sessionId } = req.params;

      const chatSession = await chatModel.getChatBySession(sessionId);

      // Check if user has access to this session (use string comparison for Oracle number safety)
      const userHasAccess = chatSession.some(chat => String(chat.USER_ID) === String(req.user.id));
      if (!userHasAccess && chatSession.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this chat session'
        });
      }

      res.json({
        success: true,
        session_id: sessionId,
        chat_session: chatSession
      });

    } catch (error) {
      logger.error('Get chat session error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chat session'
      });
    }
  }

  // Get chat statistics
  async getChatStats(req, res) {
    try {
      const userId = req.user.id;
      const { days = 30 } = req.query;

      const stats = await chatModel.getChatStats(userId, parseInt(days));

      res.json({
        success: true,
        stats: stats,
        period_days: parseInt(days)
      });

    } catch (error) {
      logger.error('Get chat stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get chat statistics'
      });
    }
  }

  // Delete chat history (user can delete their own history)
  async deleteChatHistory(req, res) {
    try {
      const userId = req.user.id;
      const { sessionId } = req.body;

      if (sessionId) {
        // Delete specific session
        // First verify user owns this session
        const chatSession = await chatModel.getChatBySession(sessionId);
        const userOwnsSession = chatSession.some(chat => chat.USER_ID === userId);
        
        if (!userOwnsSession && chatSession.length > 0) {
          return res.status(403).json({
            success: false,
            error: 'Access denied to this chat session'
          });
        }

        // Delete chat messages and session
        let chatDeleted = 0;
        let sessionDeleted = 0;
        
        try {
          chatDeleted = await chatModel.deleteSession(sessionId, userId);
        } catch (chatError) {
          logger.error("Error deleting chat messages:", chatError);
          // Continue with session deletion even if chat deletion fails
        }
        
        try {
          sessionDeleted = await sessionModel.deleteSession(sessionId, userId);
        } catch (sessionError) {
          logger.error("Error deleting session:", sessionError);
        }
        
        res.json({
          success: true,
          message: 'Chat session deleted successfully'
        });
      } else {
        // Delete all user's chat history and sessions
        await chatModel.deleteUserHistory(userId);
        await sessionModel.deleteUserSessions(userId);
        
        res.json({
          success: true,
          message: 'All chat history deleted successfully'
        });
      }

    } catch (error) {
      logger.error('Delete chat history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete chat history'
      });
    }
  }

  async getCapabilities(req, res) {
    try {
      const rulesInfo = ruleEngine.getAllRulesInfo();
      const capabilities = {
        total_rules: rulesInfo.length,
        databases: ['BRIGHTAI_SALES', 'BRIGHTAI_DAPROS', 'BRIGHTAI_TARGET', 'BRIGHTAI_REVENUE', 'BRIGHTAI_CT0_NAL'],
        categories: [...new Set(rulesInfo.map(rule => rule.category))],
        rules_by_database: this.groupRulesByDatabase(rulesInfo)
      };
      
      res.json({
        success: true,
        capabilities: capabilities,
        rules: rulesInfo
      });
      
    } catch (error) {
      logger.error('Get capabilities error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get capabilities'
      });
    }
  }

  groupRulesByDatabase(rulesInfo) {
    return rulesInfo.reduce((acc, rule) => {
      if (!acc[rule.database]) {
        acc[rule.database] = [];
      }
      acc[rule.database].push({
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        description: rule.description
      });
      return acc;
    }, {});
  }
}

module.exports = new ChatController();