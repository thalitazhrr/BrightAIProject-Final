// src/routes/chatRoutes.js - Updated dengan Chat History
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');
const validation = require('../middleware/validation');

// Main chat endpoint
router.post(
  '/message', 
  auth.authenticate, 
  validation.validateChatMessage, 
  chatController.processMessage.bind(chatController)
);

// Get chat history
router.get(
  '/history', 
  auth.authenticate, 
  chatController.getChatHistory.bind(chatController)
);

// Get specific chat session
router.get(
  '/session/:sessionId', 
  auth.authenticate, 
  chatController.getChatSession.bind(chatController)
);

// Get chat statistics
router.get(
  '/stats', 
  auth.authenticate, 
  chatController.getChatStats.bind(chatController)
);

// Delete chat history
router.delete(
  '/history', 
  auth.authenticate, 
  chatController.deleteChatHistory.bind(chatController)
);

// Get capabilities
router.get(
  '/capabilities', 
  auth.authenticate, 
  chatController.getCapabilities.bind(chatController)
);

module.exports = router;