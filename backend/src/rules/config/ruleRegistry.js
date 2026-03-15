// src/rules/config/ruleRegistry.js
class RuleRegistry {
  constructor() {
    this.databases = {
      BRIGHTAI_SALES: {
        connection: 'DADBS',
        schema: 'DWH_MOIS.BRIGHTAI_SALES',
        table: 'BRIGHTAI_',
        rules_count: 11,
        rule_prefix: 'sales'
      },
      BRIGHTAI_DAPROS: {
        connection: 'DADBS',
        schema: 'DWH_MOIS.BRIGHTAI_DAPROS',
        table: 'BRIGHTAI_DAPROS',
        rules_count: 7,
        rule_prefix: 'dapros'
      },
      BRIGHTAI_TARGET: {
        connection: 'DADBS',
        schema: 'DWH_MOIS.BRIGHTAI_TARGET',
        table: 'BRIGHTAI_TARGET',
        rules_count: 5,
        rule_prefix: 'target'
      },
      BRIGHTAI_REVENUE: {
        connection: 'DADBS',
        schema: 'DWH_MOIS.BRIGHTAI_REVENUE',
        table: 'BRIGHTAI_REVENUE',
        rules_count: 8,
        rule_prefix: 'mart_rev'
      },
      BRIGHTAI_CT0_NAL: {
        connection: 'DADBS',
        schema: 'DWH_MOIS.BRIGHTAI_CT0_NAL',
        table: 'BRIGHTAI_CT0_NAL',
        rules_count: 6,
        rule_prefix: 'ct0_ebis'
      }
    };
  }

  getTotalRules() {
    return Object.values(this.databases).reduce((total, db) => total + db.rules_count, 0);
  }

  getDatabaseConfig(tableName) {
    try {
      // Check if databases object exists
      if (!this.databases) {
        console.error('ruleRegistry.databases is undefined or null');
        return null;
      }
      
      // Check if tableName is valid
      if (!tableName) {
        console.error('tableName parameter is undefined or null');
        return null;
      }
      
      for (const [dbName, config] of Object.entries(this.databases)) {
        if (!config) {
          console.warn(`Database config for ${dbName} is null/undefined`);
          continue;
        }
        
        if (config.table === tableName || 
            dbName === tableName ||
            (tableName.startsWith('BRIGHTAI_DAPROS_') && dbName === 'BRIGHTAI_DAPROS')) {
          return {
            database: config.connection,
            schema: config.schema,
            table: config.table
          };
        }
      }
      
      console.error(`No database configuration found for table: ${tableName}`);
      return null;
      
    } catch (error) {
      console.error('Error in getDatabaseConfig:', error);
      return null;
    }
  }

  getDatabaseByPrefix(ruleId) {
    const prefix = ruleId.split('_')[0];
    for (const [dbName, config] of Object.entries(this.databases)) {
      if (config.rule_prefix.startsWith(prefix)) {
        return {
          database_name: dbName,
          ...config
        };
      }
    }
    return null;
  }

  getDatabaseNames() {
    return Object.keys(this.databases);
  }

  getConnectionType(databaseName) {
    return this.databases[databaseName]?.connection || 'DADBS';
  }
}

// Export a singleton instance
module.exports = new RuleRegistry();