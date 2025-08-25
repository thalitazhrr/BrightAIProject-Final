// src/rules/config/ruleRegistry.js
class RuleRegistry {
  constructor() {
    this.databases = {
      PS_SCONE_ORDER: {
        connection: 'DWHNAS',
        schema: 'DWH_MOIS.PS_SCONE_ORDER',
        table: 'PS_SCONE_ORDER',
        rules_count: 11,
        rule_prefix: 'ps_scone'
      },
      DAPROS_MIGRASI: {
        connection: 'DWHNAS', 
        schema: 'DWH_MOIS.DAPROS_MIGRASI_*',
        table: 'DAPROS_MIGRASI_*',
        rules_count: 7,
        rule_prefix: 'dapros'
      },
      TARGET_ALL: {
        connection: 'DWHNAS',
        schema: 'DWH_MOIS.TARGET_ALL', 
        table: 'TARGET_ALL',
        rules_count: 5,
        rule_prefix: 'target'
      },
      MART_REV_PMS_POTS: {
        connection: 'DADBS',
        schema: 'PMSDBS.MART_REV_PMS_POTS',
        table: 'MART_REV_PMS_POTS', 
        rules_count: 8,
        rule_prefix: 'mart_rev'
      },
      CT0_NAL_EBIS: {
        connection: 'DWHNAS',
        schema: 'DWH_MOIS.CT0_NAL_EBIS',
        table: 'CT0_NAL_EBIS',
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
            (tableName.startsWith('DAPROS_MIGRASI_') && dbName === 'DAPROS_MIGRASI')) {
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
    return this.databases[databaseName]?.connection || 'DWHNAS';
  }
}

// Export a singleton instance
module.exports = new RuleRegistry();