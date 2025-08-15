// Chat Routes
const express = require('express');
const ChatController = require('../controllers/chatController');
const AuthController = require('../controllers/authController');

const router = express.Router();

// Apply authentication middleware to all chat routes
router.use(AuthController.verifyToken);

// Get all chats (user-specific)
router.get('/', ChatController.getAllChats);

// Search chats
router.get('/search', ChatController.searchChats);

// Get chat statistics
router.get('/stats', ChatController.getChatStats);

// Get specific chat by ID
router.get('/:chatId', ChatController.getChatById);

// Create new chat
router.post('/', ChatController.createChat);

// Update chat
router.put('/:chatId', ChatController.updateChat);

// Delete chat
router.delete('/:chatId', ChatController.deleteChat);

// Get chat messages
router.get('/:chatId/messages', ChatController.getChatMessages);

// Add message to chat
router.post('/:chatId/messages', ChatController.addMessage);

// Sync chat (for offline/online sync)
router.post('/sync', ChatController.syncChat);

module.exports = router;