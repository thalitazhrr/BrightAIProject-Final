// src/utils/cache.js
const NodeCache = require('node-cache');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.CACHE_TTL) || 1800,
      maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 1000,
      deleteOnExpire: true,
      checkperiod: 120
    });

    setInterval(() => {
      const stats = this.cache.getStats();
      logger.info('Cache stats:', stats);
    }, 300000);
  }

  get(key) {
    try {
      return this.cache.get(key);
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  set(key, value, ttl) {
    try {
      return this.cache.set(key, value, ttl);
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  del(key) {
    try {
      return this.cache.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  flush() {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  getStats() {
    return this.cache.getStats();
  }
}

module.exports = new CacheManager();