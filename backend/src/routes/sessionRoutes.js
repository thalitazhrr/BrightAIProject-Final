// src/routes/sessionRoutes.js
const express = require('express');
const router = express.Router();
const sessionModel = require('../models/sessionModel');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

// Get active sessions for authenticated user
router.get('/active', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const activeSessions = await sessionModel.getActiveSessions(userId, parseInt(limit));

    res.json({
      success: true,
      active_sessions: activeSessions,
      total: activeSessions.length
    });

  } catch (error) {
    logger.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active sessions'
    });
  }
});

// Get specific session details
router.get('/:sessionId', authMiddleware.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await sessionModel.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check if user owns this session
    if (session.USER_ID !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this session'
      });
    }

    res.json({
      success: true,
      session: session
    });

  } catch (error) {
    logger.error('Get session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

// Create new session
router.post('/create', authMiddleware.authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_name } = req.body;

    if (!session_name || !session_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Session name is required'
      });
    }

    const sessionId = await sessionModel.create({
      user_id: userId,
      session_name: session_name.trim()
    });

    res.json({
      success: true,
      session_id: sessionId,
      message: 'Session created successfully'
    });

  } catch (error) {
    logger.error('Create session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

// Update session name
router.put('/:sessionId/name', authMiddleware.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { session_name } = req.body;

    if (!session_name || !session_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Session name is required'
      });
    }

    // Verify user owns this session
    const session = await sessionModel.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.USER_ID !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this session'
      });
    }

    await sessionModel.updateSessionName(sessionId, session_name.trim());

    res.json({
      success: true,
      message: 'Session name updated successfully'
    });

  } catch (error) {
    logger.error('Update session name error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session name'
    });
  }
});

// End session
router.put('/:sessionId/end', authMiddleware.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify user owns this session
    const session = await sessionModel.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.USER_ID !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this session'
      });
    }

    if (session.IS_ACTIVE === 0) {
      return res.status(400).json({
        success: false,
        error: 'Session already ended'
      });
    }

    await sessionModel.endSession(sessionId);

    res.json({
      success: true,
      message: 'Session ended successfully'
    });

  } catch (error) {
    logger.error('End session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session'
    });
  }
});

// Delete specific session
router.delete('/:sessionId', authMiddleware.authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify user owns this session
    const session = await sessionModel.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.USER_ID !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this session'
      });
    }

    await sessionModel.deleteSession(sessionId, userId);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    logger.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session'
    });
  }
});

module.exports = router;