// src/rules/engine/ruleEngine.js
const ruleLoader = require('./ruleLoader');
const queryProcessor = require('./queryProcessor');
const responseBuilder = require('./responseBuilder');
const logger = require('../../utils/logger');
const cache = require('../../utils/cache');

class RuleEngine {
  constructor() {
    this.rules = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      logger.info('Initializing Rule Engine...');
      
      const loadedRules = await ruleLoader.loadAllRules();
      loadedRules.forEach(rule => {
        this.rules.set(rule.RULE_META.RULE_ID, rule);
      });
      
      this.isInitialized = true;
      logger.info(`Rule Engine initialized with ${this.rules.size} rules`);
      
    } catch (error) {
      logger.error('Failed to initialize Rule Engine:', error);
      throw error;
    }
  }

  async processQuery(userInput, context = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const startTime = Date.now();
      
      const cacheKey = this.generateCacheKey(userInput);
      const cachedResult = cache.get(cacheKey);
      if (cachedResult) {
        logger.info(`Cache hit for query: ${userInput}`);
        return {
          ...cachedResult,
          cached: true,
          processing_time: Date.now() - startTime
        };
      }

      const matchResult = await queryProcessor.findMatchingRule(userInput, this.rules);
      
      if (!matchResult.success) {
        return {
          success: false,
          source: 'fallback',
          reason: matchResult.reason,
          processing_time: Date.now() - startTime
        };
      }

      const executionResult = await this.executeRule(matchResult.rule, userInput, context);
      
      const response = await responseBuilder.buildResponse(executionResult, matchResult.rule, userInput);
      
      const result = {
        success: true,
        source: 'rule_based',
        rule_id: matchResult.rule.RULE_META.RULE_ID,
        rule_name: matchResult.rule.RULE_META.RULE_NAME,
        confidence: matchResult.confidence,
        data: executionResult.data,
        response: response,
        processing_time: Date.now() - startTime
      };

      cache.set(cacheKey, result, matchResult.rule.CACHE_DURATION || 1800);
      
      return result;
      
    } catch (error) {
      logger.error('Rule Engine processing error:', error);
      return {
        success: false,
        source: 'error',
        error: error.message,
        processing_time: Date.now() - Date.now()
      };
    }
  }

  async executeRule(rule, userInput, context) {
    const startTime = Date.now();
    
    try {
      const { executeQuery } = require('../../../config/database');
      
      const dbInfo = this.getDatabaseForRule(rule);
      
      const queryResult = await executeQuery(
        rule.SQL_QUERY,
        [],
        dbInfo.database
      );

      // Oracle returns column names in UPPERCASE. Normalize each row so that
      // both UPPERCASE and lowercase keys exist — rule BUSINESS_LOGIC functions
      // are inconsistent (some use uppercase, some lowercase), so both must work.
      const normalizedResult = Array.isArray(queryResult)
        ? queryResult.map(row => {
            const normalized = {};
            for (const [key, value] of Object.entries(row)) {
              normalized[key.toUpperCase()] = value;
              normalized[key.toLowerCase()] = value;
            }
            return normalized;
          })
        : queryResult;

      let processedResult = normalizedResult;
      if (rule.BUSINESS_LOGIC && rule.BUSINESS_LOGIC.formatIndonesianResponse) {
        processedResult = rule.BUSINESS_LOGIC.formatIndonesianResponse(normalizedResult);
      }

      return {
        success: true,
        data: normalizedResult,
        processed_data: processedResult,
        execution_time: Date.now() - startTime,
        record_count: Array.isArray(normalizedResult) ? normalizedResult.length : 1
      };
      
    } catch (error) {
      logger.error(`Rule execution error for ${rule.RULE_META.RULE_ID}:`, error);
      throw new Error(`Failed to execute rule: ${error.message}`);
    }
  }

  getDatabaseForRule(rule) {
    try {
      const ruleRegistry = require('../config/ruleRegistry');
      
      // First check if DATABASE_CONFIG exists and has required properties
      if (!rule.DATABASE_CONFIG) {
        logger.error(`Rule ${rule.RULE_META.RULE_ID} missing DATABASE_CONFIG`);
        throw new Error(`Rule ${rule.RULE_META.RULE_ID} missing DATABASE_CONFIG`);
      }
      
      // Check if table property exists
      if (!rule.DATABASE_CONFIG.table) {
        logger.error(`Rule ${rule.RULE_META.RULE_ID} DATABASE_CONFIG missing table property`);
        logger.debug(`DATABASE_CONFIG contents:`, rule.DATABASE_CONFIG);
        throw new Error(`Rule ${rule.RULE_META.RULE_ID} DATABASE_CONFIG missing table property`);
      }
      
      const dbConfig = ruleRegistry.getDatabaseConfig(rule.DATABASE_CONFIG.table);
      
      if (!dbConfig) {
        logger.error(`No database configuration found for table: ${rule.DATABASE_CONFIG.table}`);
        throw new Error(`No database configuration found for table: ${rule.DATABASE_CONFIG.table}`);
      }
      
      return dbConfig;
      
    } catch (error) {
      logger.error(`Error getting database for rule ${rule.RULE_META.RULE_ID}:`, error);
      throw error;
    }
  }

  generateCacheKey(userInput) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(userInput.toLowerCase().trim()).digest('hex');
  }

  getRuleStats(ruleId) {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;
    
    return {
      rule_id: ruleId,
      rule_name: rule.RULE_META.RULE_NAME,
      complexity: rule.RULE_META.COMPLEXITY,
      priority: rule.RULE_META.EXECUTION_PRIORITY,
      cache_duration: rule.CACHE_DURATION
    };
  }

  getAllRulesInfo() {
    return Array.from(this.rules.values()).map(rule => ({
      rule_id: rule.RULE_META.RULE_ID,
      rule_name: rule.RULE_META.RULE_NAME,
      description: rule.RULE_META.DESCRIPTION,
      database: rule.RULE_META.DATABASE,
      category: rule.RULE_META.CATEGORY,
      complexity: rule.RULE_META.COMPLEXITY
    }));
  }
}

module.exports = new RuleEngine();