const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const { testConnection, initializeDatabase } = require('./src/config/database');
const ChatModel = require('./src/models/chatModel');
const UserModel = require('./src/models/userModel');

const app = express();
const PORT = process.env.PORT || 3001;

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
    // Add network IPs for external access
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

// Basic routes first
app.get('/', (req, res) => {
  res.json({
    message: 'Telkom HSI BrightAI Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/telkom/health',
      dashboard: '/api/telkom/dashboard/data',
      ai_chat: '/api/telkom/ai/chat',
      analytics: '/api/telkom/analytics/summary'
    }
  });
});

// Health check route
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
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

// Import routes after basic setup
let telkomRoutes, chatRoutes, authRoutes, aiRoutes;

try {
  authRoutes = require('./src/routes/authRoutes');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

try {
  telkomRoutes = require('./src/routes/telkomRoutes');
  app.use('/api/telkom', telkomRoutes);
  console.log('✅ Telkom routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading telkom routes:', error.message);
}

try {
  aiRoutes = require('./src/routes/aiRoutes');
  app.use('/api/ai', aiRoutes);
  console.log('✅ AI routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading AI routes:', error.message);
}

try {
  chatRoutes = require('./src/routes/chatRoutes');
  app.use('/api/chats', chatRoutes);
  console.log('✅ Chat routes loaded successfully');
} catch (error) {
  console.error('❌ Error loading chat routes:', error.message);
  
  // Fallback routes if main routes fail
  app.get('/api/telkom/health', async (req, res) => {
    try {
      const dbConnected = await testConnection();
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
    } catch (err) {
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.post('/api/telkom/ai/chat', (req, res) => {
    res.json({
      success: true,
      response: 'Hello! I am BrightAI. Routes are being loaded. Please try again in a moment.',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/telkom/dashboard/data', (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Dashboard loading...',
        stats: {
          total_orders: 0,
          completed_orders: 0,
          pending_orders: 0
        }
      },
      timestamp: new Date().toISOString()
    });
  });
}

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

// Start server function
async function startServer() {
  try {
    console.log('🚀 Starting Telkom HSI BrightAI Backend...');
    
    // UJI KONEKSI DATABASE TERLEBIH DAHULU
    const isDbConnected = await UserModel.testConnection();

    if (!isDbConnected) {
      console.error('🔴 CRITICAL: Could not connect to the database. Server will not start.');
      process.exit(1); // Hentikan server jika tidak bisa konek ke DB
    }

    // Inisialisasi semua tabel database yang diperlukan
    // Fungsi ini akan menangani koneksi dan pembuatan tabel
    console.log('🔄 Initializing database tables...');
    await UserModel.initializeTables();
    await ChatModel.initializeTables();
    console.log('✅ Database tables initialized successfully.');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('\n🎉 Server started successfully!');
      console.log(`🌐 Server URL: http://localhost:${PORT}`);
      console.log(`📖 API Docs: http://localhost:${PORT}/`);
      console.log('\n✨ Ready to serve HSI analytics!');
    });

    // Fungsi untuk mematikan server dengan aman (Graceful shutdown)
    const shutdown = (signal) => {
      console.log(`\n🔄 Received ${signal}, shutting down gracefully...`);
      server.close(() => {
        console.log('✅ HTTP server closed.');
        // Jika Anda menggunakan pool database, Anda bisa menutupnya di sini
        // await pool.end(); 
        // console.log('Database pool closed.');
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