// backend/src/middleware/rateLimiter.js
// Advanced rate limiting specifically designed for AI endpoints

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

class AdvancedRateLimiter {
  
  constructor() {
    // Different rate limits for different types of requests
    this.limitConfigs = {
      // General AI endpoint rate limiting
      general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per window per IP
        message: {
          error: 'Terlalu banyak permintaan AI. Silakan tunggu 15 menit.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
      },

      // Chat endpoint - more restrictive due to processing complexity
      chat: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 20, // 20 chat requests per minute per IP
        message: {
          error: 'Terlalu banyak pesan chat AI. Silakan tunggu sebentar.',
          code: 'CHAT_RATE_LIMIT_EXCEEDED',
          retryAfter: '1 minute'
        },
        standardHeaders: true,
        legacyHeaders: false,
      },

      // Analytics endpoints - moderate limiting
      analytics: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 50, // 50 analytics requests per 5 minutes per IP
        message: {
          error: 'Terlalu banyak permintaan analytics. Silakan tunggu 5 menit.',
          code: 'ANALYTICS_RATE_LIMIT_EXCEEDED',
          retryAfter: '5 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
      },

      // Heavy computation endpoints (like comprehensive analysis)
      heavy: {
        windowMs: 10 * 60 * 1000, // 10 minutes
        max: 10, // 10 heavy requests per 10 minutes per IP
        message: {
          error: 'Terlalu banyak permintaan analisis kompleks. Silakan tunggu 10 menit.',
          code: 'HEAVY_ANALYSIS_RATE_LIMIT_EXCEEDED',
          retryAfter: '10 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
      },

      // Premium users (if authentication is implemented)
      premium: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 500, // 500 requests per window for premium users
        message: {
          error: 'Premium rate limit exceeded. Silakan tunggu 15 menit.',
          code: 'PREMIUM_RATE_LIMIT_EXCEEDED',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
      }
    };

    // Slow down configurations for gradual throttling
    this.slowDownConfigs = {
      chat: {
        windowMs: 1 * 60 * 1000, // 1 minute
        delayAfter: 10, // Start slowing down after 10 requests
        delayMs: 500, // Add 500ms delay per request after delayAfter
        maxDelayMs: 5000, // Maximum delay of 5 seconds
      },

      analytics: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        delayAfter: 25, // Start slowing down after 25 requests
        delayMs: 200, // Add 200ms delay per request
        maxDelayMs: 3000, // Maximum delay of 3 seconds
      }
    };
  }

  // Create rate limiter based on type
  createRateLimiter(type = 'general') {
    const config = this.limitConfigs[type] || this.limitConfigs.general;
    
    return rateLimit({
      ...config,
      keyGenerator: (req) => {
        // Use IP + User-Agent for more accurate identification
        return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
      },
      skip: (req) => {
        // Skip rate limiting for localhost in development
        if (process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1') {
          return true;
        }
        return false;
      },
      onLimitReached: (req, res) => {
        console.log(`🚨 Rate limit reached for ${req.ip} on ${req.path}`);
        
        // Log detailed information about the rate limit hit
        console.log({
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
          rateLimitType: type
        });
      }
    });
  }

  // Create slow down middleware
  createSlowDown(type = 'chat') {
    const config = this.slowDownConfigs[type] || this.slowDownConfigs.chat;
    
    return slowDown({
      ...config,
      keyGenerator: (req) => {
        return `${req.ip}-${req.get('User-Agent') || 'unknown'}`;
      },
      skip: (req) => {
        // Skip slow down for localhost in development
        if (process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1') {
          return true;
        }
        return false;
      },
      onLimitReached: (req, res) => {
        console.log(`⏰ Slow down activated for ${req.ip} on ${req.path}`);
      }
    });
  }

  // Advanced rate limiter with user tier detection
  createTieredRateLimiter() {
    return (req, res, next) => {
      // Detect user tier (placeholder for future authentication)
      const userTier = this.detectUserTier(req);
      
      // Apply appropriate rate limit based on user tier
      const limiterType = userTier === 'premium' ? 'premium' : 'general';
      const limiter = this.createRateLimiter(limiterType);
      
      return limiter(req, res, next);
    };
  }

  // Detect user tier from request (placeholder for authentication)
  detectUserTier(req) {
    // Placeholder - in production, this would check JWT tokens, API keys, etc.
    const authHeader = req.get('Authorization');
    
    if (authHeader && authHeader.includes('premium')) {
      return 'premium';
    }
    
    return 'standard';
  }

  // Dynamic rate limiter based on endpoint complexity
  createDynamicRateLimiter() {
    return (req, res, next) => {
      const path = req.path.toLowerCase();
      let limiterType = 'general';
      
      // Determine rate limit type based on endpoint
      if (path.includes('/chat')) {
        limiterType = 'chat';
      } else if (path.includes('/analytics') || path.includes('/kpi')) {
        limiterType = 'analytics';
      } else if (path.includes('/comprehensive') || path.includes('/deep-analysis')) {
        limiterType = 'heavy';
      }
      
      const limiter = this.createRateLimiter(limiterType);
      return limiter(req, res, next);
    };
  }

  // Rate limiter with custom headers
  createCustomHeaderRateLimiter(type = 'general') {
    const config = this.limitConfigs[type];
    
    return rateLimit({
      ...config,
      keyGenerator: (req) => `${req.ip}-${req.get('User-Agent') || 'unknown'}`,
      handler: (req, res) => {
        // Add custom headers with rate limit information
        res.set({
          'X-RateLimit-Type': type,
          'X-RateLimit-Limit': config.max,
          'X-RateLimit-Window': config.windowMs,
          'X-RateLimit-Policy': 'AI-Optimized',
          'Retry-After': Math.ceil(config.windowMs / 1000)
        });
        
        res.status(429).json({
          success: false,
          error: config.message.error,
          code: config.message.code,
          details: {
            limit: config.max,
            window: `${config.windowMs / 1000} seconds`,
            retryAfter: config.message.retryAfter,
            type: type
          },
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // Burst protection for AI endpoints
  createBurstProtection() {
    return rateLimit({
      windowMs: 10 * 1000, // 10 seconds
      max: 5, // Maximum 5 requests per 10 seconds
      message: {
        error: 'Terlalu banyak permintaan dalam waktu singkat. Silakan tunggu 10 detik.',
        code: 'BURST_PROTECTION_TRIGGERED'
      },
      standardHeaders: true,
      legacyHeaders: false,
      onLimitReached: (req, res) => {
        console.log(`💥 Burst protection triggered for ${req.ip}`);
      }
    });
  }

  // Memory-based rate limiter for high-performance scenarios
  createMemoryRateLimiter(type = 'general') {
    const config = this.limitConfigs[type];
    
    return rateLimit({
      ...config,
      store: new rateLimit.MemoryStore(),
      keyGenerator: (req) => `${req.ip}-${req.get('User-Agent') || 'unknown'}`,
      message: {
        success: false,
        error: config.message.error,
        code: config.message.code,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Rate limiter with whitelist support
  createWhitelistRateLimiter(type = 'general', whitelist = []) {
    const config = this.limitConfigs[type];
    
    return rateLimit({
      ...config,
      skip: (req) => {
        // Skip rate limiting for whitelisted IPs
        if (whitelist.includes(req.ip)) {
          return true;
        }
        
        // Skip for development
        if (process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1') {
          return true;
        }
        
        return false;
      },
      keyGenerator: (req) => `${req.ip}-${req.get('User-Agent') || 'unknown'}`
    });
  }

  // Get all available rate limiters
  getAllRateLimiters() {
    return {
      // Basic rate limiters
      general: this.createRateLimiter('general'),
      chat: this.createRateLimiter('chat'),
      analytics: this.createRateLimiter('analytics'),
      heavy: this.createRateLimiter('heavy'),
      premium: this.createRateLimiter('premium'),
      
      // Advanced rate limiters
      tiered: this.createTieredRateLimiter(),
      dynamic: this.createDynamicRateLimiter(),
      customHeader: this.createCustomHeaderRateLimiter(),
      burstProtection: this.createBurstProtection(),
      memory: this.createMemoryRateLimiter(),
      
      // Slow down middlewares
      chatSlowDown: this.createSlowDown('chat'),
      analyticsSlowDown: this.createSlowDown('analytics'),
      
      // Whitelist support
      whitelist: (whitelist) => this.createWhitelistRateLimiter('general', whitelist)
    };
  }

  // Monitor rate limit usage
  getRateLimitStats() {
    // This would typically integrate with a monitoring system
    return {
      totalRequests: 'N/A - Implement with monitoring service',
      rateLimitHits: 'N/A - Implement with monitoring service',
      topIPs: 'N/A - Implement with monitoring service',
      recommendedLimits: {
        chat: 'Current: 20/min - Consider: 15/min for better performance',
        analytics: 'Current: 50/5min - Optimal',
        heavy: 'Current: 10/10min - Consider: 5/10min for resource protection'
      }
    };
  }
}

// Export singleton instance
const rateLimiter = new AdvancedRateLimiter();

module.exports = {
  AdvancedRateLimiter,
  rateLimiter,
  
  // Quick access to common rate limiters
  generalRateLimit: rateLimiter.createRateLimiter('general'),
  chatRateLimit: rateLimiter.createRateLimiter('chat'),
  analyticsRateLimit: rateLimiter.createRateLimiter('analytics'),
  heavyRateLimit: rateLimiter.createRateLimiter('heavy'),
  
  // Advanced rate limiters
  dynamicRateLimit: rateLimiter.createDynamicRateLimiter(),
  burstProtection: rateLimiter.createBurstProtection(),
  
  // Slow down middlewares
  chatSlowDown: rateLimiter.createSlowDown('chat'),
  analyticsSlowDown: rateLimiter.createSlowDown('analytics'),
  
  // Utility functions
  getAllRateLimiters: () => rateLimiter.getAllRateLimiters(),
  getRateLimitStats: () => rateLimiter.getRateLimitStats(),
  
  // Factory functions for custom configurations
  createCustomRateLimit: (type, config) => rateLimiter.createRateLimiter(type, config),
  createWhitelistRateLimit: (whitelist) => rateLimiter.createWhitelistRateLimiter('general', whitelist)
};