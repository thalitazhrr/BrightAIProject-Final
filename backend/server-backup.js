// server.js - Telkom HSI BrightAI Backend
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
    message: 'Telkom HSI BrightAI Backend API',
    version: '1.0.0',
    status: 'running',
    database: isDatabaseConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth_login: 'POST /api/auth/login',
      auth_register: 'POST /api/auth/register',
      auth_verify: 'GET /api/auth/verify',
      health: '/api/telkom/health',
      dashboard: '/api/telkom/dashboard/data',
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
// AUTHENTICATION ROUTES
// ===========================================

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
      
      const bcrypt = require('bcrypt');
      
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

app.post('/api/auth/register', async (req, res) => {
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

// ===========================================
// DASHBOARD ROUTES
// ===========================================

app.get('/api/telkom/dashboard/data', authenticateToken, async (req, res) => {
  try {
    // Mock data for HSI dashboard
    res.json({
      success: true,
      data: {
        overview: {
          totalOrders: 1250,
          completionRate: 87.5,
          totalRegions: 7,
          totalWitels: 34,
          completedOrders: 1094,
          pendingOrders: 156,
          growthRate: 12.3
        },
        regional: [
          { regional: 'Jawa Barat', total_orders: 320, completion_rate: 89.2 },
          { regional: 'DKI Jakarta', total_orders: 280, completion_rate: 91.5 },
          { regional: 'Jawa Tengah', total_orders: 195, completion_rate: 85.1 },
          { regional: 'Jawa Timur', total_orders: 210, completion_rate: 88.7 },
          { regional: 'Sumatra Utara', total_orders: 125, completion_rate: 82.4 }
        ],
        packages: [
          { package_name: 'IndiHome 50 Mbps', total_orders: 420 },
          { package_name: 'IndiHome 100 Mbps', total_orders: 350 },
          { package_name: 'IndiHome 30 Mbps', total_orders: 280 },
          { package_name: 'IndiHome 20 Mbps', total_orders: 200 }
        ]
      },
      source: 'mock',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data',
      timestamp: new Date().toISOString()
    });
  }
});

// ===========================================
// AI CHAT ROUTES
// ===========================================

app.post('/api/ai/chat', authenticateToken, (req, res) => {
  try {
    const { message, responseType, conversationHistory } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    let response = '🤖 **BrightAI HSI Assistant**\n\nHalo! Saya siap membantu analisis HSI Telkom Anda.';
    
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('performa') || lowerMessage.includes('performance')) {
      response = '📊 **Analisis Performa HSI:**\n\n• **Completion Rate**: 87.5% (↑2.3% dari bulan lalu)\n• **Total Orders**: 1,250 pesanan\n• **Regional Terbaik**: DKI Jakarta (91.5%)\n• **Package Populer**: IndiHome 50 Mbps (420 orders)\n\n**Rekomendasi**: Fokus peningkatan di Sumatra Utara (82.4%)';
    } else if (lowerMessage.includes('regional') || lowerMessage.includes('daerah')) {
      response = '🗺️ **Analisis Regional HSI:**\n\n**Top Performers:**\n• DKI Jakarta: 91.5% completion\n• Jawa Barat: 89.2% completion\n• Jawa Timur: 88.7% completion\n\n**Needs Attention:**\n• Sumatra Utara: 82.4% completion\n\n**Insight**: Jakarta dan Jawa memiliki infrastruktur terbaik.';
    } else if (lowerMessage.includes('paket') || lowerMessage.includes('package')) {
      response = '📦 **Analisis Paket HSI:**\n\n**Paling Diminati:**\n• IndiHome 50 Mbps: 420 orders (33.6%)\n• IndiHome 100 Mbps: 350 orders (28%)\n• IndiHome 30 Mbps: 280 orders (22.4%)\n\n**Trend**: Pelanggan beralih ke kecepatan tinggi (50-100 Mbps)';
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('halo')) {
      response = '👋 **Selamat datang di BrightAI!**\n\nSaya adalah asisten AI untuk analisis HSI Telkom. Saya dapat membantu dengan:\n\n• 📊 Analisis performa dan completion rate\n• 🗺️ Data regional dan witel\n• 📦 Tren paket dan layanan\n• 📈 Insights dan rekomendasi\n\nSilakan tanya apa saja tentang data HSI!';
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

    const userChats = await ChatModel.getAllChats(req.user.userId);
    res.json({
      success: true,
      data: userChats,
      count: userChats.length,
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

    const newChat = await ChatModel.createChat({
      id,
      title,
      lastMessage: lastMessage || 'Start a conversation...',
      userId: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: newChat,
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
      return res.status(500).json({
        success: false,
        error: 'Database connection required'
      });
    }

    const newMessage = await ChatModel.addMessage(chatId, {
      message: message,
      isBot: isBot || false,
      userId: req.user.userId
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
      return res.status(500).json({
        success: false,
        error: 'Database connection required'
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
    console.log('🚀 Starting Telkom HSI BrightAI Backend...');
    
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
      console.log('\n✨ Ready to serve HSI analytics!');
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