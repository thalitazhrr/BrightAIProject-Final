// config/database.js
const oracledb = require('oracledb');
const logger = require('../src/utils/logger');

// ---------- Oracle Client Initialization (Thick Mode) ----------
try {
  if (process.env.ORACLE_INSTANT_CLIENT_PATH) {
    oracledb.initOracleClient({ libDir: process.env.ORACLE_INSTANT_CLIENT_PATH });
    logger.info(`Oracle Thick mode initialized successfully at ${process.env.ORACLE_INSTANT_CLIENT_PATH}`);
  } else if (process.platform === 'win32') {
    const libDir = 'C:\\Users\\Thalita Zahra\\Downloads\\instantclient-basic-windows\\instantclient_23_8';
    oracledb.initOracleClient({ libDir });
    logger.info('Oracle Thick mode initialized on Windows default path');
  } else {
    logger.info('No Instant Client path provided, running in Thin mode');
  }
} catch (err) {
  logger.warn(`Oracle Thick mode initialization failed, falling back to Thin mode: ${err.message}`);
}

// ---------- Connection Pool Config ----------
const pools = {
  DADBS: null
};

const dadbsConfig = {
  user: process.env.ORACLE_DADBS_USER,
  password: process.env.ORACLE_DADBS_PASSWORD,
  connectString: process.env.ORACLE_DADBS_CONNECT_STRING,
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1,
  connectTimeout: 10,
  transportConnectTimeout: 10000,
};

// ---------- Pool Lifecycle ----------
async function initializePools() {
  try {
    logger.info(`DADBS -> ${process.env.ORACLE_DADBS_USER}@${process.env.ORACLE_DADBS_CONNECT_STRING}`);

    if (!pools.DADBS) {
      pools.DADBS = await oracledb.createPool({ ...dadbsConfig, poolAlias: 'DADBS' });
      logger.info('DADBS pool created successfully');
    }

    logger.info('Oracle connection pools initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Oracle connection pools:', error);
    throw error;
  }
}

async function getConnection(database = 'DADBS') {
  if (!pools[database]) {
    throw new Error(`Database pool '${database}' is not initialized. Ensure Oracle is reachable and the server was started successfully.`);
  }
  try {
    return await pools[database].getConnection();
  } catch (error) {
    logger.error(`Error getting ${database} connection:`, error);
    throw error;
  }
}

// ---------- CLOB Handling ----------
async function processClobData(row) {
  const processedRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Lob') {
      try {
        value.setEncoding('utf8');
        const chunks = [];
        for await (const chunk of value) chunks.push(chunk);
        processedRow[key] = chunks.join('');
      } catch (err) {
        logger.error(`Error reading CLOB for ${key}:`, err);
        processedRow[key] = '[Error reading CLOB data]';
      }
    } else {
      processedRow[key] = value;
    }
  }
  return processedRow;
}

// ---------- Query Executor ----------
async function executeQuery(query, binds = [], database = 'DADBS') {
  let connection;
  try {
    connection = await getConnection(database);
    const result = await connection.execute(query, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchArraySize: 1000,
      autoCommit: true
    });

    const trimmedUpper = query.trim().toUpperCase();
    if (trimmedUpper.startsWith('SELECT') || trimmedUpper.startsWith('WITH')) {
      return await Promise.all(result.rows.map(row => processClobData(row)));
    }
    return result;
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); }
      catch (closeError) { logger.error('Error closing connection:', closeError); }
    }
  }
}

// ---------- Pool Shutdown ----------
async function closePools() {
  try {
    if (pools.DADBS) { await pools.DADBS.close(10); pools.DADBS = null; }
    logger.info('All database pools closed');
  } catch (error) {
    logger.error('Error closing pools:', error);
  }
}

process.on('SIGINT', async () => { await closePools(); process.exit(0); });
process.on('SIGTERM', async () => { await closePools(); process.exit(0); });

module.exports = {
  initializePools,
  getConnection,
  executeQuery,
  closePools,
  pools
};
