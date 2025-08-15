// server.js - BrightAI Chatbot Backend with Database Integration
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { testConnection } = require('./src/config/database');
const ChatModel = require('./src/models/chatModel');
const UserModel = require('./src/models/userModel');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure JWT_SECRET is set
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL ERROR: JWT_SECRET is not defined in your .env file.');
  process.exit(1);
}

// Global variables
let isDatabaseConnected = false;

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    'http://0.0.0.0:3000',
    /^http:\/\/192\.168\.\d+\.\d+:3000$/,
    /^http:\/\/10\.\d+\.\d+\.\d+:3000$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:3000$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const telkomRoutes = require('./src/routes/telkomRoutes');
const authRoutes = require('./src/routes/authRoutes');

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
}

// ===========================================
// BASIC ROUTES
// ===========================================

app.get('/', (req, res) => {
  res.json({
    message: 'BrightAI Chatbot Backend API',
    version: '1.0.0',
    status: 'running',
    database: isDatabaseConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth_login: 'POST /api/auth/login',
      auth_register: 'POST /api/auth/register',
      auth_verify: 'GET /api/auth/verify',
      health: '/api/telkom/health',
      ai_chat: '/api/ai/chat',
      chats: '/api/chats'
    }
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbConnected = isDatabaseConnected && await testConnection();
    res.json({
      success: true,
      status: 'healthy',
      services: {
        api: 'running',
        database: dbConnected ? 'connected' : 'disconnected'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/telkom/health', async (req, res) => {
  try {
    const dbConnected = isDatabaseConnected && await testConnection();
    res.json({
      success: true,
      status: 'healthy',
      services: {
        api: 'running',
        database: dbConnected ? 'connected' : 'disconnected'
      },
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===========================================
// AUTHENTICATION ROUTES - NOW HANDLED BY authRoutes
// ===========================================

/*
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password required' 
      });
    }

    let user = null;
    let token = null;

    if (isDatabaseConnected) {
      // Try database authentication first
      try {
        user = await UserModel.authenticateUser(username, password);
        token = UserModel.generateToken(user);
      } catch (error) {
        console.log('Database authentication failed:', error.message);
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }
    } else {
      // Development fallback authentication (when database is unavailable)
      console.log('🔄 Using development fallback authentication');
      
      // Hardcoded demo users for development
      const demoUsers = [
        {
          id: 'demo-admin-001',
          username: 'admin',
          email: 'admin@telkom.co.id',
          full_name: 'Administrator',
          role: 'admin',
          department: 'IT',
          password: 'admin123' // Use plain text for development fallback
        },
        {
          id: 'demo-user-001',
          username: 'user',
          email: 'user@telkom.co.id',
          full_name: 'Demo User',
          role: 'user',
          department: 'Sales',
          password: 'user123' // Use plain text for development fallback
        }
      ];
      
      const demoUser = demoUsers.find(u => u.username === username);
      
      if (!demoUser) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }

      if (password !== demoUser.password) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid credentials' 
        });
      }

      // Generate token for demo user
      const { password: userPassword, ...userWithoutPassword } = demoUser;
      user = userWithoutPassword;
      
      token = jwt.sign(
        { 
          userId: user.id, 
          username: user.username, 
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    }

    res.json({
      success: true,
      data: { user, token },
      message: 'Login successful',
      source: isDatabaseConnected ? 'database' : 'development-fallback'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, fullName, department } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }

    if (isDatabaseConnected) {
      try {
        const newUser = await UserModel.createUser({
          username,
          email,
          password,
          fullName,
          department
        });

        res.status(201).json({
          success: true,
          data: newUser,
          message: 'User registered successfully'
        });
      } catch (error) {
        if (error.message.includes('already exists')) {
          return res.status(400).json({
            success: false,
            error: error.message
          });
        }
        throw error;
      }
    } else {
      // Development fallback - registration not supported without database
      res.status(503).json({
        success: false,
        error: 'Registration is not available in development mode without database. Please use demo credentials: admin/admin123 or user/user123',
        demo_credentials: [
          { username: 'admin', password: 'admin123', role: 'admin' },
          { username: 'user', password: 'user123', role: 'user' }
        ]
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    message: 'Token is valid'
  });
});
*/


// ===========================================
// AI CHAT ROUTES
// ===========================================

app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  try {
    const { message, responseType, conversationHistory } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    let response = '🤖 **BrightAI Assistant**\n\nHalo! Saya siap membantu Anda dengan berbagai pertanyaan dan informasi.';
    
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('halo')) {
      response = '👋 **Selamat datang di BrightAI!**\n\nSaya adalah asisten AI yang siap membantu Anda. Saya dapat membantu dengan:\n\n• 💬 Menjawab pertanyaan umum\n• 🔍 Memberikan informasi\n• 🤝 Bantuan dan dukungan\n• 📝 Diskusi dan brainstorming\n\nAda yang bisa saya bantu hari ini?';
    } else if (lowerMessage.includes('bantuan') || lowerMessage.includes('help')) {
      response = '🆘 **Bantuan BrightAI**\n\nSaya dapat membantu Anda dengan:\n\n• Menjawab pertanyaan\n• Memberikan informasi\n• Diskusi topik tertentu\n• Brainstorming ide\n\nSilakan tanyakan apa saja yang ingin Anda ketahui!';
    } else if (lowerMessage.includes('terima kasih') || lowerMessage.includes('thanks')) {
      response = '😊 **Sama-sama!**\n\nSenang bisa membantu Anda. Jangan ragu untuk bertanya lagi jika ada yang ingin Anda diskusikan!';
    } else {
      // Generic response for other queries
      response = `💭 **Respon AI**\n\nTerima kasih atas pertanyaan Anda: "${message}"\n\nSaya adalah asisten AI yang dapat membantu dengan berbagai topik. Bisakah Anda memberikan lebih detail tentang apa yang ingin Anda ketahui?`;
    }

    res.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ===========================================
// CHAT MANAGEMENT ROUTES
// ===========================================

app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    if (!isDatabaseConnected) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'Database disconnected - no chats available',
        timestamp: new Date().toISOString()
      });
    }

    // Check if this is a fallback authentication user
    const userId = req.user.userId;
    const isFallbackUser = userId === '550e8400-e29b-41d4-a716-446655440000' || 
                          userId === '550e8400-e29b-41d4-a716-446655440001';
    
    // For fallback users, get chats where user_id is null
    const userChats = await ChatModel.getAllChats(isFallbackUser ? null : userId);
    
    // Return chats with the fallback user ID for frontend compatibility
    const returnChats = isFallbackUser 
      ? userChats.filter(chat => chat.user_id === null).map(chat => ({
          ...chat,
          user_id: userId
        }))
      : userChats.filter(chat => chat.user_id === userId);
    
    res.json({
      success: true,
      data: returnChats,
      count: returnChats.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chats'
    });
  }
});

app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
    const { id, title, lastMessage } = req.body;
    
    if (!id || !title) {
      return res.status(400).json({
        success: false,
        error: 'Chat ID and title are required'
      });
    }

    if (!isDatabaseConnected) {
      // Fallback when database is not connected
      console.log('🔄 Database not connected, using fallback chat creation');
      const fallbackChat = {
        id,
        title,
        lastMessage: lastMessage || 'Start a conversation...',
        userId: req.user.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'fallback'
      };
      
      return res.status(201).json({
        success: true,
        data: fallbackChat,
        message: 'Chat created successfully (fallback mode)',
        timestamp: new Date().toISOString()
      });
    }

    // Check if this is a fallback authentication user
    const userId = req.user.userId;
    const isFallbackUser = userId === '550e8400-e29b-41d4-a716-446655440000' || 
                          userId === '550e8400-e29b-41d4-a716-446655440001';
    
    const newChat = await ChatModel.createChat({
      id,
      title,
      lastMessage: lastMessage || 'Start a conversation...',
      userId: isFallbackUser ? null : userId // Use null for fallback users to avoid foreign key constraint
    });

    // Return chat with original userId for frontend compatibility if fallback user
    const returnChat = isFallbackUser ? { ...newChat, user_id: userId } : newChat;
    
    res.status(201).json({
      success: true,
      data: returnChat,
      message: 'Chat created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create chat'
    });
  }
});

app.get('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    if (!isDatabaseConnected) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: 'Database disconnected',
        timestamp: new Date().toISOString()
      });
    }

    const chatMessages = await ChatModel.getChatMessages(chatId);
    
    res.json({
      success: true,
      data: chatMessages,
      count: chatMessages.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get messages'
    });
  }
});

app.post('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message, isBot } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    if (!isDatabaseConnected) {
      // Fallback when database is not connected - return a mock response
      console.log('🔄 Database not connected, using fallback message storage');
      const fallbackMessage = {
        id: `msg_${Date.now()}`,
        chatId,
        message,
        isBot: isBot || false,
        userId: req.user.userId,
        createdAt: new Date().toISOString(),
        source: 'fallback'
      };
      
      return res.status(201).json({
        success: true,
        data: fallbackMessage,
        message: 'Message added successfully (fallback mode)',
        timestamp: new Date().toISOString()
      });
    }

    // Check if this is a fallback authentication user
    const userId = req.user.userId;
    const isFallbackUser = userId === '550e8400-e29b-41d4-a716-446655440000' || 
                          userId === '550e8400-e29b-41d4-a716-446655440001';
    
    const newMessage = await ChatModel.addMessage(chatId, {
      message: message,
      isBot: isBot || false,
      userId: isFallbackUser ? null : userId // Use null for fallback users
    });

    res.status(201).json({
      success: true,
      data: newMessage,
      message: 'Message added successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

app.delete('/api/chats/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    if (!isDatabaseConnected) {
      // Fallback when database is not connected
      console.log('🔄 Database not connected, using fallback chat deletion');
      
      return res.json({
        success: true,
        data: { chatId },
        message: 'Chat deleted successfully (fallback mode)',
        timestamp: new Date().toISOString()
      });
    }

    const deletedChat = await ChatModel.deleteChat(chatId);
    
    if (!deletedChat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found'
      });
    }

    res.json({
      success: true,
      data: { chatId },
      message: 'Chat deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete chat'
    });
  }
});

// Mount additional routes
app.use('/api/telkom', telkomRoutes);
app.use('/api/auth', authRoutes);

// ===========================================
// ERROR HANDLERS
// ===========================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global Error:', {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  res.status(error.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// ===========================================
// SERVER STARTUP
// ===========================================

async function startServer() {
  try {
    console.log('🚀 Starting BrightAI Chatbot Backend...');
    
    // Test database connection
    try {
      const isDbConnected = await UserModel.testConnection();
      if (isDbConnected) {
        console.log('✅ Database connection successful');
        isDatabaseConnected = true;
        
        // Initialize database tables
        console.log('🔄 Initializing database tables...');
        await UserModel.initializeTables();
        await ChatModel.initializeTables();
        console.log('✅ Database tables initialized successfully');
      } else {
        console.warn('⚠️ Database connection failed - server will run without database');
        isDatabaseConnected = false;
      }
    } catch (error) {
      console.warn('⚠️ Database connection error:', error.message);
      console.warn('⚠️ Server will run without database');
      isDatabaseConnected = false;
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('\n🎉 Server started successfully!');
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`📖 API Docs: http://localhost:${PORT}/`);
      console.log(`🔗 Database: ${isDatabaseConnected ? 'Connected' : 'Disconnected'}`);
      console.log('\n✨ Ready to serve chatbot functionality!');
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n🔄 Received ${signal}, shutting down...`);
      server.close(() => {
        console.log('✅ HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;