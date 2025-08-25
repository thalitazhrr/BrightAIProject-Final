const ruleRegistry = require('./ruleRegistry');
const getDbConfig = require('./dbConfig');

/**
 * Load full database config untuk sebuah table/rule
 * Menggabungkan informasi schema & table dari ruleRegistry
 * dengan credential dari dbConfig (env)
 */
function loadRuleDatabase(tableName) {
  try {
    const registryConfig = ruleRegistry.getDatabaseConfig(tableName);

    if (!registryConfig) {
      throw new Error(`Database config not found for table: ${tableName}`);
    }

    const baseConfig = getDbConfig(registryConfig.database);

    const finalConfig = {
      ...baseConfig,
      schema: registryConfig.schema,
      table: registryConfig.table
    };
    
    return finalConfig;
    
  } catch (error) {
    console.error(`Error in loadRuleDatabase for table ${tableName}:`, error);
    throw error;
  }
}

module.exports = { loadRuleDatabase };