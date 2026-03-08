// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./src/utils/logger');
const { errorHandler } = require('./src/middleware/errorHandler');
const { initializePools } = require('./config/database');

const authRoutes = require('./src/routes/authRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');

const app = express();

// Trust proxy untuk mengatasi rate limit warning
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/sessions', sessionRoutes);

// Health check endpoint - sesuai dengan yang ada di startup message
app.get('/api/telkom/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'brightai-backend'
  });
});

// Fallback health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Oracle DB wajib terkoneksi — tidak ada fallback mock
    await initializePools();
    logger.info("Database pools initialized successfully");

    const userModel = require('./src/models/userModel');
    const chatModel = require('./src/models/chatModel');
    const sessionModel = require('./src/models/sessionModel');

    await userModel.initialize();
    await chatModel.initialize();
    await sessionModel.initialize();
    logger.info("Database models initialized");

    app.listen(PORT, () => {
      logger.info(`BrightAI Backend Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server. Pastikan Oracle DB dapat diakses (VPN aktif, .env sudah benar):', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;