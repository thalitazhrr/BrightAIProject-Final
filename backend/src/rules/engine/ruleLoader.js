// src/rules/engine/ruleLoader.js
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

class RuleLoader {
  constructor() {
    this.rulesPath = path.join(__dirname, '../databases');
    this.loadedRules = [];
  }

  async loadAllRules() {
    try {
      this.loadedRules = [];
      const databases = this.getDatabaseDirectories();
      
      for (const database of databases) {
        const databaseRules = await this.loadDatabaseRules(database);
        this.loadedRules.push(...databaseRules);
      }
      
      logger.info(`Successfully loaded ${this.loadedRules.length} rules from ${databases.length} databases`);
      return this.loadedRules;
      
    } catch (error) {
      logger.error('Failed to load rules:', error);
      throw error;
    }
  }

  getDatabaseDirectories() {
    try {
      return fs.readdirSync(this.rulesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    } catch (error) {
      logger.error('Error reading rules directory:', error);
      return [];
    }
  }

  async loadDatabaseRules(databaseName) {
    const databasePath = path.join(this.rulesPath, databaseName);
    const rules = [];
    
    try {
      const files = fs.readdirSync(databasePath);
      
      for (const file of files) {
        if (file.endsWith('.js') && file !== 'index.js') {
          try {
            const rulePath = path.join(databasePath, file);
            
            delete require.cache[require.resolve(rulePath)];
            
            const rule = require(rulePath);
            
            if (this.validateRule(rule, file)) {
              rule.RULE_META.DATABASE_NAME = databaseName;
              rule.RULE_META.FILE_NAME = file;
              rule.RULE_META.LOADED_AT = new Date().toISOString();
              
              rules.push(rule);
              logger.info(`Loaded rule: ${rule.RULE_META.RULE_ID} from ${databaseName}/${file}`);
            }
            
          } catch (error) {
            logger.error(`Error loading rule from ${databaseName}/${file}:`, error);
          }
        }
      }
      
    } catch (error) {
      logger.error(`Error reading database directory ${databaseName}:`, error);
    }
    
    return rules;
  }

  validateRule(rule, filename) {
    const requiredFields = [
      'RULE_META',
      'DATABASE_CONFIG', 
      'KEYWORD_PATTERNS',
      'SQL_QUERY',
      'PATTERN_MATCHING'
    ];
    
    for (const field of requiredFields) {
      if (!rule[field]) {
        logger.error(`Rule validation failed: Missing ${field} in ${filename}`);
        return false;
      }
    }
    
    const requiredMeta = ['RULE_ID', 'RULE_NAME', 'DESCRIPTION', 'DATABASE'];
    for (const field of requiredMeta) {
      if (!rule.RULE_META[field]) {
        logger.error(`Rule validation failed: Missing RULE_META.${field} in ${filename}`);
        return false;
      }
    }
    
    if (typeof rule.PATTERN_MATCHING.checkMatch !== 'function') {
      logger.error(`Rule validation failed: PATTERN_MATCHING.checkMatch must be a function in ${filename}`);
      return false;
    }
    
    return true;
  }

  async reloadRule(ruleId) {
    const rule = this.loadedRules.find(r => r.RULE_META.RULE_ID === ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }
    
    const rulePath = path.join(
      this.rulesPath, 
      rule.RULE_META.DATABASE_NAME, 
      rule.RULE_META.FILE_NAME
    );
    
    delete require.cache[require.resolve(rulePath)];
    const reloadedRule = require(rulePath);
    
    if (this.validateRule(reloadedRule, rule.RULE_META.FILE_NAME)) {
      const index = this.loadedRules.findIndex(r => r.RULE_META.RULE_ID === ruleId);
      this.loadedRules[index] = reloadedRule;
      
      logger.info(`Successfully reloaded rule: ${ruleId}`);
      return reloadedRule;
    } else {
      throw new Error(`Validation failed for reloaded rule: ${ruleId}`);
    }
  }
}

module.exports = new RuleLoader();