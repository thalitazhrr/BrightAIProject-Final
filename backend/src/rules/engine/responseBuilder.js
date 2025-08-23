// src/rules/engine/responseBuilder.js
const logger = require('../../utils/logger');

class ResponseBuilder {
  async buildResponse(executionResult, rule) {
    try {
      if (!executionResult.success) {
        throw new Error('Execution result was not successful');
      }

      const responseData = executionResult.processed_data || executionResult.data;
      
      const response = {
        ringkasan: this.generateSummary(rule, executionResult),
        metadata: {
          rule_id: rule.RULE_META.RULE_ID,
          rule_name: rule.RULE_META.RULE_NAME,
          description: rule.RULE_META.DESCRIPTION,
          database: rule.RULE_META.DATABASE,
          execution_time: `${executionResult.execution_time}ms`,
          record_count: executionResult.record_count,
          generated_at: new Date().toISOString()
        },
        hasil_analisis: responseData,
        sumber_data: {
          database: rule.DATABASE_CONFIG.DB_CONNECT_STRING,
          schema: rule.DATABASE_CONFIG.SCHEMA,
          table: rule.DATABASE_CONFIG.TABLE
        }
      };

      return response;
      
    } catch (error) {
      logger.error('Response building error:', error);
      throw new Error(`Failed to build response: ${error.message}`);
    }
  }

  generateSummary(rule, executionResult) {
    const recordCount = executionResult.record_count;
    const ruleName = rule.RULE_META.DESCRIPTION;
    
    if (recordCount === 0) {
      return `Analisis ${ruleName} tidak menemukan data yang sesuai dengan kriteria pencarian.`;
    } else if (recordCount === 1) {
      return `Analisis ${ruleName} berhasil dilakukan dengan 1 record data.`;
    } else {
      return `Analisis ${ruleName} berhasil dilakukan dengan ${recordCount.toLocaleString('id-ID')} record data.`;
    }
  }

  formatDataForDisplay(data) {
    if (!Array.isArray(data)) return data;
    
    return data.map(record => {
      const formatted = {};
      for (const [key, value] of Object.entries(record)) {
        if (typeof value === 'number') {
          formatted[key] = value.toLocaleString('id-ID');
        } else if (value instanceof Date) {
          formatted[key] = value.toLocaleDateString('id-ID');
        } else {
          formatted[key] = value;
        }
      }
      return formatted;
    });
  }
}

module.exports = new ResponseBuilder();