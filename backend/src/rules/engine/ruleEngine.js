// src/rules/engine/ruleEngine.js
const ruleLoader = require('./ruleLoader');
const queryProcessor = require('./queryProcessor');
const responseBuilder = require('./responseBuilder');
const logger = require('../../utils/logger');
const cache = require('../../utils/cache');
const { extractGeoContext, getDbValue, getGeoColumns } = require('../utils/geoContextExtractor');

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
    const startTime = Date.now();
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const geoContext = context.geoContext
        ? context.geoContext
        : extractGeoContext(userInput);
      const cacheKey = this.generateCacheKey(userInput, geoContext);
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

      const executionResult = await this.executeRule(matchResult.rule, userInput, context, geoContext);
      
      const response = await responseBuilder.buildResponse(executionResult, matchResult.rule, userInput, geoContext);
      
      const result = {
        success: true,
        source: 'rule_based',
        rule_id: matchResult.rule.RULE_META.RULE_ID,
        rule_name: matchResult.rule.RULE_META.RULE_NAME,
        confidence: matchResult.confidence,
        geo_scope: geoContext.label,
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
        processing_time: Date.now() - startTime
      };
    }
  }

  async executeRule(rule, userInput, context, geoContext) {
    const startTime = Date.now();

    try {
      const { executeQuery } = require('../../../config/database');

      const dbInfo = this.getDatabaseForRule(rule);

      // Apply geographic filter to the SQL before execution
      const database = rule.RULE_META.DATABASE;
      const filteredSQL = this.injectGeoFilter(rule.SQL_QUERY, database, geoContext);

      logger.info(`Executing rule ${rule.RULE_META.RULE_ID} | scope: ${geoContext ? geoContext.scope : 'nasional'}${geoContext && geoContext.dbValue ? ` | value: ${geoContext.dbValue}` : ''}`);

      const queryResult = await executeQuery(
        filteredSQL,
        [],
        dbInfo.database
      );

      // Oracle returns column names in UPPERCASE. Normalize each row so that
      // both UPPERCASE and lowercase keys exist — rule BUSINESS_LOGIC functions
      // are inconsistent (some use uppercase, some lowercase), so both must work.
      // Also coerce NULL numeric values to 0 to prevent .toFixed()/.toLocaleString() crashes.
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
        try {
          processedResult = rule.BUSINESS_LOGIC.formatIndonesianResponse(normalizedResult);
        } catch (fmtErr) {
          logger.warn(`formatIndonesianResponse failed for ${rule.RULE_META.RULE_ID}: ${fmtErr.message} — falling back to raw data`);
          processedResult = normalizedResult;
        }
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

  generateCacheKey(userInput, geoContext) {
    const crypto = require('crypto');
    const geoSuffix = geoContext
      ? `${geoContext.scope}:${geoContext.dbValue || 'all'}`
      : 'nasional:all';
    return crypto.createHash('md5')
      .update(`${userInput.toLowerCase().trim()}|${geoSuffix}`)
      .digest('hex');
  }

  /**
   * Injects a geographic WHERE filter into an SQL query at runtime.
   *
   * Supports two modes:
   *   1. Placeholder:    if the SQL contains  / * :GEO_FILTER: * /  it is replaced directly.
   *   2. Auto-inject:    line-by-line scan finds the first FROM DWH_MOIS block and
   *                      inserts the filter clause just before the closing GROUP BY / ) .
   */
  injectGeoFilter(sql, database, geoContext) {
    if (!geoContext || geoContext.scope === 'nasional') return sql;

    const cols = getGeoColumns(database);
    const dbValue = getDbValue(geoContext, database);
    if (!dbValue) return sql;

    let filterClause;
    if (geoContext.scope === 'regional') {
      // BRIGHTAI_DAPROS stores REGIONAL as 'REG-X' or plain '1','2','3'...
      // Other databases (SALES, CT0, etc.) use 'REGIONAL X' format.
      if (database === 'BRIGHTAI_DAPROS') {
        const num = dbValue.replace('REGIONAL ', ''); // '1', '2', ...
        filterClause = `AND (${cols.regional} = 'REG-${num}' OR ${cols.regional} = '${num}')`;
      } else {
        filterClause = `AND ${cols.regional} = '${dbValue}'`;
      }
    } else if (geoContext.scope === 'witel') {
      filterClause = `AND ${cols.witel} = '${dbValue}'`;
    } else {
      return sql;
    }

    // Mode 1: explicit placeholder
    if (sql.includes('/* :GEO_FILTER: */')) {
      return sql.replace('/* :GEO_FILTER: */', filterClause);
    }

    // Mode 2: auto-inject via line-by-line scan
    return this._injectFilterIntoSQL(sql, filterClause);
  }

  /**
   * Line-by-line SQL injection.
   *
   * Finds EVERY  FROM DWH_MOIS.xxx  block in the SQL (handles multi-CTE queries),
   * locates each block's WHERE clause, then tracks parenthesis depth to find the
   * insertion point right before  GROUP BY / ORDER BY / HAVING  or the CTE-closing ')'.
   * Processes injections in reverse line-order so prior splices don't shift later indices.
   */
  _injectFilterIntoSQL(sql, filterClause) {
    const lines = sql.split('\n');

    // Step 1 – collect ALL FROM DWH_MOIS positions
    const fromPositions = [];
    for (let i = 0; i < lines.length; i++) {
      if (/\bFROM\s+DWH_MOIS\./i.test(lines[i])) {
        fromPositions.push(i);
      }
    }
    if (fromPositions.length === 0) return sql;

    const injections = []; // { insertIdx, indent }

    for (let fi = 0; fi < fromPositions.length; fi++) {
      const fromIdx   = fromPositions[fi];
      // Upper bound for WHERE search: the next FROM DWH_MOIS line (or end of file)
      const nextFrom  = fromPositions[fi + 1] !== undefined ? fromPositions[fi + 1] : lines.length;

      // Step 2 – find WHERE clause that belongs to THIS FROM block
      let whereIdx = -1;
      for (let i = fromIdx + 1; i < nextFrom; i++) {
        if (/^\s*WHERE\b/i.test(lines[i])) { whereIdx = i; break; }
        // Stop early if GROUP BY / ORDER BY appears before WHERE (no WHERE in this block)
        if (/^\s*(GROUP\s+BY|ORDER\s+BY|HAVING)\b/i.test(lines[i])) break;
      }
      if (whereIdx === -1) continue; // no WHERE for this FROM → skip

      // Step 3 – scan forward from WHERE to find insertion point
      let parenDepth = 0;
      let insertIdx  = -1;
      for (let i = whereIdx; i < lines.length; i++) {
        for (const ch of lines[i]) {
          if (ch === '(') parenDepth++;
          if (ch === ')') parenDepth--;
        }
        // Closing ) of the CTE / subquery
        if (parenDepth < 0) { insertIdx = i; break; }
        // End-of-WHERE keywords at depth 0, past the WHERE line itself
        if (parenDepth === 0 && i > whereIdx &&
            /^\s*(GROUP\s+BY|ORDER\s+BY|HAVING)\b/i.test(lines[i])) {
          insertIdx = i; break;
        }
      }
      if (insertIdx === -1) continue;

      // Step 4 – mirror indentation from the nearest preceding AND/WHERE line
      let indent = '          '; // fallback: 10 spaces
      for (let i = insertIdx - 1; i >= whereIdx; i--) {
        const trimmed = lines[i].trimStart();
        if (trimmed.startsWith('AND ') || /^\s*WHERE\b/i.test(lines[i])) {
          const m = lines[i].match(/^(\s+)/);
          if (m) { indent = m[1]; break; }
        }
      }

      injections.push({ insertIdx, indent });
    }

    if (injections.length === 0) return sql;

    // Process in REVERSE order so each splice doesn't shift subsequent indices
    injections.sort((a, b) => b.insertIdx - a.insertIdx);
    const seen = new Set();
    for (const { insertIdx, indent } of injections) {
      if (!seen.has(insertIdx)) {
        seen.add(insertIdx);
        lines.splice(insertIdx, 0, `${indent}${filterClause}`);
      }
    }

    return lines.join('\n');
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