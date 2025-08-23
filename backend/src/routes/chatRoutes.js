// src/routes/chatRoutes.js - Updated dengan Chat History
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');
const validation = require('../middleware/validation');

// Main chat endpoint
router.post('/message', 
  auth.authenticate, 
  validation.validateChatMessage, 
  chatController.processMessage
);

// Get chat history
router.get('/history', 
  auth.authenticate, 
  chatController.getChatHistory
);

// Get specific chat session
router.get('/session/:sessionId', 
  auth.authenticate, 
  chatController.getChatSession
);

// Get chat statistics
router.get('/stats', 
  auth.authenticate, 
  chatController.getChatStats
);

// Delete chat history
router.delete('/history', 
  auth.authenticate, 
  chatController.deleteChatHistory
);

// Get capabilities
router.get('/capabilities', 
  auth.authenticate, 
  chatController.getCapabilities
);

module.exports = router;