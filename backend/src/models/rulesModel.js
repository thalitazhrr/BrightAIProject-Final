// src/models/rulesModel.js
const { executeQuery } = require('../../config/database');
const logger = require('../utils/logger');

class RulesModel {
  constructor() {
    this.tableName = 'BRIGHTAI_RULES';
    this.database = 'DWHNAS';
    this.schema = 'DWH_MOIS';
    this.initializeTable();
  }

  // Initialize rules table if not exists
  async initializeTable() {
    try {
      const createTableQuery = `
        BEGIN
          EXECUTE IMMEDIATE 'CREATE TABLE ${this.schema}.${this.tableName} (
            RULE_ID VARCHAR2(50) NOT NULL,
            RULE_NAME VARCHAR2(255) NOT NULL,
            KEYWORDS CLOB,
            RESPONSE_TEMPLATE CLOB,
            PRIORITY NUMBER DEFAULT 1,
            IS_ACTIVE NUMBER(1) DEFAULT 1 NOT NULL,
            CATEGORY VARCHAR2(50),
            CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            CONSTRAINT BRIGHTAI_RULES_PK PRIMARY KEY (RULE_ID),
            CONSTRAINT BRIGHTAI_RULES_ACTIVE_CHK CHECK (IS_ACTIVE IN (0, 1))
          )';
        EXCEPTION
          WHEN OTHERS THEN
            IF SQLCODE != -955 THEN
              RAISE;
            END IF;
        END;
      `;

      await executeQuery(createTableQuery, [], this.database);
      logger.info('BRIGHTAI_RULES table initialized');
      
      // Insert default rules if table is empty
      await this.insertDefaultRules();
    } catch (error) {
      logger.error('Error initializing BRIGHTAI_RULES table:', error);
    }
  }

  // Insert default rules
  async insertDefaultRules() {
    try {
      const countQuery = `SELECT COUNT(*) as count FROM ${this.schema}.${this.tableName}`;
      const countResult = await executeQuery(countQuery, [], this.database);
      
      if (countResult[0].COUNT === 0) {
        const defaultRules = [
          {
            rule_id: 'RULE001',
            rule_name: 'Greeting Rule',
            keywords: 'halo,hi,hello,selamat,hai',
            response_template: 'Halo! Selamat datang di BrightAI. Bagaimana saya bisa membantu Anda hari ini?',
            category: 'greeting',
            priority: 1
          },
          {
            rule_id: 'RULE002',
            rule_name: 'Telkom Product Info',
            keywords: 'telkom,paket,internet,wifi,indihome,speedy',
            response_template: 'Saya dapat membantu Anda dengan informasi produk dan layanan Telkom. Apa yang ingin Anda ketahui?',
            category: 'product_info',
            priority: 2
          },
          {
            rule_id: 'RULE003',
            rule_name: 'Help Request',
            keywords: 'bantuan,help,tolong,bingung',
            response_template: 'Tentu saja! Saya siap membantu Anda. Silakan jelaskan apa yang Anda butuhkan.',
            category: 'help',
            priority: 3
          }
        ];

        for (const rule of defaultRules) {
          await this.create(rule);
        }
        
        logger.info('Default rules inserted successfully');
      }
    } catch (error) {
      logger.error('Error inserting default rules:', error);
    }
  }

  // Create new rule
  async create(ruleData) {
    try {
      const { rule_id, rule_name, keywords, response_template, priority = 1, category } = ruleData;
      
      const query = `
        INSERT INTO ${this.schema}.${this.tableName} 
        (RULE_ID, RULE_NAME, KEYWORDS, RESPONSE_TEMPLATE, PRIORITY, CATEGORY)
        VALUES (:rule_id, :rule_name, :keywords, :response_template, :priority, :category)
      `;
      
      await executeQuery(query, {
        rule_id,
        rule_name,
        keywords,
        response_template,
        priority,
        category
      }, this.database);
      
      logger.info(`Rule created with ID: ${rule_id}`);
      return rule_id;
      
    } catch (error) {
      logger.error('Error creating rule:', error);
      throw error;
    }
  }

  // Find rule by ID
  async findById(rule_id) {
    try {
      const query = `
        SELECT RULE_ID, RULE_NAME, KEYWORDS, RESPONSE_TEMPLATE, PRIORITY, IS_ACTIVE, CATEGORY, CREATED_AT, UPDATED_AT
        FROM ${this.schema}.${this.tableName}
        WHERE RULE_ID = :rule_id
      `;
      
      const result = await executeQuery(query, { rule_id }, this.database);
      
      return result.length > 0 ? result[0] : null;
      
    } catch (error) {
      logger.error('Error finding rule by ID:', error);
      throw error;
    }
  }

  // Get all active rules
  async getActiveRules() {
    try {
      const query = `
        SELECT RULE_ID, RULE_NAME, KEYWORDS, RESPONSE_TEMPLATE, PRIORITY, CATEGORY
        FROM ${this.schema}.${this.tableName}
        WHERE IS_ACTIVE = 1
        ORDER BY PRIORITY ASC, RULE_NAME ASC
      `;
      
      const result = await executeQuery(query, [], this.database);
      
      return result;
      
    } catch (error) {
      logger.error('Error getting active rules:', error);
      throw error;
    }
  }

  // Get rules by category
  async getRulesByCategory(category) {
    try {
      const query = `
        SELECT RULE_ID, RULE_NAME, KEYWORDS, RESPONSE_TEMPLATE, PRIORITY
        FROM ${this.schema}.${this.tableName}
        WHERE CATEGORY = :category AND IS_ACTIVE = 1
        ORDER BY PRIORITY ASC
      `;
      
      const result = await executeQuery(query, { category }, this.database);
      
      return result;
      
    } catch (error) {
      logger.error('Error getting rules by category:', error);
      throw error;
    }
  }

  // Update rule
  async update(rule_id, updateData) {
    try {
      const { rule_name, keywords, response_template, priority, category } = updateData;
      
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET RULE_NAME = :rule_name,
            KEYWORDS = :keywords,
            RESPONSE_TEMPLATE = :response_template,
            PRIORITY = :priority,
            CATEGORY = :category,
            UPDATED_AT = CURRENT_TIMESTAMP
        WHERE RULE_ID = :rule_id
      `;
      
      await executeQuery(query, {
        rule_name,
        keywords,
        response_template,
        priority,
        category,
        rule_id
      }, this.database);
      
    } catch (error) {
      logger.error('Error updating rule:', error);
      throw error;
    }
  }

  // Activate/Deactivate rule
  async setActive(rule_id, is_active) {
    try {
      const query = `
        UPDATE ${this.schema}.${this.tableName}
        SET IS_ACTIVE = :is_active,
            UPDATED_AT = CURRENT_TIMESTAMP
        WHERE RULE_ID = :rule_id
      `;
      
      await executeQuery(query, { is_active: is_active ? 1 : 0, rule_id }, this.database);
      
    } catch (error) {
      logger.error('Error setting rule active status:', error);
      throw error;
    }
  }

  // Find matching rules by keywords
  async findMatchingRules(message) {
    try {
      const query = `
        SELECT RULE_ID, RULE_NAME, KEYWORDS, RESPONSE_TEMPLATE, PRIORITY, CATEGORY
        FROM ${this.schema}.${this.tableName}
        WHERE IS_ACTIVE = 1
        ORDER BY PRIORITY ASC
      `;
      
      const rules = await executeQuery(query, [], this.database);
      const matchingRules = [];
      
      for (const rule of rules) {
        if (rule.KEYWORDS) {
          const keywords = rule.KEYWORDS.toLowerCase().split(',');
          const messageText = message.toLowerCase();
          
          for (const keyword of keywords) {
            if (messageText.includes(keyword.trim())) {
              matchingRules.push({
                ...rule,
                matchedKeyword: keyword.trim()
              });
              break; // Only count first match per rule
            }
          }
        }
      }
      
      return matchingRules;
      
    } catch (error) {
      logger.error('Error finding matching rules:', error);
      throw error;
    }
  }

  // Get rule statistics
  async getRuleStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_rules,
          COUNT(CASE WHEN IS_ACTIVE = 1 THEN 1 END) as active_rules,
          COUNT(CASE WHEN IS_ACTIVE = 0 THEN 1 END) as inactive_rules,
          COUNT(DISTINCT CATEGORY) as categories
        FROM ${this.schema}.${this.tableName}
      `;
      
      const result = await executeQuery(query, [], this.database);
      
      return result[0];
      
    } catch (error) {
      logger.error('Error getting rule stats:', error);
      throw error;
    }
  }

  // Delete rule
  async deleteById(rule_id) {
    try {
      const query = `
        DELETE FROM ${this.schema}.${this.tableName}
        WHERE RULE_ID = :rule_id
      `;
      
      await executeQuery(query, { rule_id }, this.database);
      
    } catch (error) {
      logger.error('Error deleting rule:', error);
      throw error;
    }
  }
}

module.exports = new RulesModel();