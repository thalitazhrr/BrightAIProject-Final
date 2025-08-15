// aiRoutes.js
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const AuthController = require('../controllers/authController');

// Apply authentication middleware to all AI routes
router.use(AuthController.verifyToken);

// Main chat endpoint
router.post('/chat', aiController.chat);

// Specific analytics endpoints
router.get('/kpi', async (req, res) => {
  try {
    const kpiData = await aiController.getOverallKPI();
    res.json({
      success: true,
      data: kpiData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch KPI data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Customer analytics endpoint
router.get('/customer-analytics', async (req, res) => {
  try {
    const customerData = await aiController.getCustomerBehaviorAnalysis();
    const churnData = await aiController.getChurnAnalysis();
    
    res.json({
      success: true,
      data: {
        customerBehavior: customerData,
        churnAnalysis: churnData
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch customer analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Regional performance endpoint
router.get('/regional-performance', async (req, res) => {
  try {
    const regionalData = await aiController.getRegionalPerformance();
    res.json({
      success: true,
      data: regionalData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch regional performance',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Package analytics endpoint
router.get('/package-analytics', async (req, res) => {
  try {
    const packageData = await aiController.getPackagePopularity();
    res.json({
      success: true,
      data: packageData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch package analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Service performance endpoint
router.get('/service-performance', async (req, res) => {
  try {
    const serviceData = await aiController.getServicePerformanceMetrics();
    res.json({
      success: true,
      data: serviceData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch service performance',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Sales trends endpoint
router.get('/sales-trends', async (req, res) => {
  try {
    const salesData = await aiController.getSalesTrends();
    res.json({
      success: true,
      data: salesData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sales trends',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Quick insights endpoint
router.get('/quick-insights', async (req, res) => {
  try {
    const insights = await aiController.gatherContextualData('kpi_metrics');
    const response = await aiController.generateIntelligentResponse(
      'Give me quick insights', 
      'kpi_metrics', 
      insights, 
      []
    );
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch quick insights',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'AI Analytics API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;