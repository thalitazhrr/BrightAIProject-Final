// config/database.js
const oracledb = require('oracledb');
const logger = require('../src/utils/logger');

// Initialize Oracle Thick Mode untuk mendukung versi Oracle lama
try {
  // Skip thick mode initialization in WSL/Linux environment
  if (process.platform === 'win32' || process.env.ORACLE_INSTANT_CLIENT_PATH) {
    const libDir = process.env.ORACLE_INSTANT_CLIENT_PATH || 'C:\\Users\\Thalita Zahra\\Downloads\\instantclient-basic-windows\\instantclient_23_8';
    oracledb.initOracleClient({
      libDir: libDir,
      // configDir: libDir + '\\network\\admin' // Optional, jika ada tnsnames.ora
    });
    logger.info('Oracle Thick mode initialized successfully');
  } else {
    logger.info('Skipping Oracle Thick mode initialization (not on Windows platform)');
  }
} catch (err) {
  logger.warn('Oracle Thick mode initialization failed, falling back to Thin mode:', err.message);
  // Jika thick mode gagal, akan tetap menggunakan thin mode
}

const pools = {
  DWHNAS: null,
  DADBS: null
};

const dwhNasConfig = {
  user: process.env.ORACLE_DWHNAS_USER,
  password: process.env.ORACLE_DWHNAS_PASSWORD,
  connectString: process.env.ORACLE_DWHNAS_CONNECT_STRING,
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1
};

const dadbsConfig = {
  user: process.env.ORACLE_DADBS_USER,
  password: process.env.ORACLE_DADBS_PASSWORD,
  connectString: process.env.ORACLE_DADBS_CONNECT_STRING,
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1
};

async function initializePools() {
  try {
    // Check if pools already exist to prevent double initialization
    if (pools.DWHNAS && pools.DADBS) {
      logger.info('Oracle pools already initialized, skipping...');
      return;
    }

    if (!pools.DWHNAS) {
      pools.DWHNAS = await oracledb.createPool({
        ...dwhNasConfig,
        poolAlias: 'DWHNAS'
      });
      logger.info('DWHNAS pool created successfully');
    }
    
    if (!pools.DADBS) {
      pools.DADBS = await oracledb.createPool({
        ...dadbsConfig,
        poolAlias: 'DADBS'
      });
      logger.info('DADBS pool created successfully');
    }
    
    logger.info('Oracle connection pools initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Oracle connection pools:', error);
    throw error;
  }
}

async function getConnection(database = 'DWHNAS') {
  try {
    if (!pools[database]) {
      throw new Error(`Database pool ${database} not initialized`);
    }
    return await pools[database].getConnection();
  } catch (error) {
    logger.error(`Error getting ${database} connection:`, error);
    throw error;
  }
}

async function executeQuery(query, binds = [], database = 'DWHNAS') {
  let connection;
  try {
    connection = await getConnection(database);
    const result = await connection.execute(query, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchArraySize: 1000,
      autoCommit: true
    });
    return result.rows;
  } catch (error) {
    logger.error('Database query error:', error);
    
    // If it's the unsupported database version error, provide mock data for development
    if (error.code === 'NJS-138') {
      logger.warn('Returning mock data due to Oracle version compatibility issue');
      return getMockData(query, binds);
    }
    
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        logger.error('Error closing connection:', closeError);
      }
    }
  }
}

function getMockData(query, binds) {
  const queryLower = query.toLowerCase().trim();
  
  // Mock data for different query types
  if (queryLower.includes('select') && queryLower.includes('brightai_chat')) {
    return []; // Empty chat history
  }
  
  if (queryLower.includes('select') && queryLower.includes('brightai_user')) {
    if (queryLower.includes('email')) {
      return [{
        USER_ID: 1,
        USERNAME: 'testuser',
        EMAIL: 'test@example.com',
        PASSWORD_HASH: '$2b$10$example.hash.here',
        FULL_NAME: 'Test User',
        ROLE: 'user',
        IS_ACTIVE: 1,
        CREATED_AT: new Date(),
        UPDATED_AT: new Date()
      }];
    }
    return [];
  }
  
  if (queryLower.includes('select') && queryLower.includes('brightai_session')) {
    return []; // Empty sessions
  }
  
  if (queryLower.includes('insert') || queryLower.includes('update') || queryLower.includes('delete')) {
    return []; // Mock success for DML operations
  }
  
  if (queryLower.includes('seq_brightai') && queryLower.includes('currval')) {
    return [{ CHAT_ID: Math.floor(Math.random() * 10000) }]; // Mock sequence value
  }
  
  return []; // Default empty result
}

async function closePools() {
  try {
    if (pools.DWHNAS) {
      await pools.DWHNAS.close(10);
      pools.DWHNAS = null;
    }
    if (pools.DADBS) {
      await pools.DADBS.close(10);
      pools.DADBS = null;
    }
    logger.info('All database pools closed');
  } catch (error) {
    logger.error('Error closing pools:', error);
  }
}

process.on('SIGINT', closePools);
process.on('SIGTERM', closePools);

module.exports = {
  initializePools,
  getConnection,
  executeQuery,
  closePools,
  pools
};