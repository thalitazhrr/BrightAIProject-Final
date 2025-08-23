const ruleRegistry = require('./ruleRegistry');
const getDbConfig = require('./dbConfig');

/**
 * Load full database config untuk sebuah table/rule
 * Menggabungkan informasi schema & table dari ruleRegistry
 * dengan credential dari dbConfig (env)
 */
function loadRuleDatabase(tableName) {
  const registryConfig = ruleRegistry.getDatabaseConfig(tableName);

  if (!registryConfig) {
    throw new Error(`Database config not found for table: ${tableName}`);
  }

  const baseConfig = getDbConfig(registryConfig.database);

  return {
    ...baseConfig,
    schema: registryConfig.schema,
    table: registryConfig.table
  };
}

module.exports = { loadRuleDatabase };