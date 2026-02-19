// config/database.js
const oracledb = require('oracledb');
const logger = require('../src/utils/logger');

// ---------- Oracle Client Initialization (Thick Mode) ----------
try {
  if (process.env.ORACLE_INSTANT_CLIENT_PATH) {
    // macOS/Linux/Windows via env path
    oracledb.initOracleClient({ libDir: process.env.ORACLE_INSTANT_CLIENT_PATH });
    logger.info(`Oracle Thick mode initialized successfully at ${process.env.ORACLE_INSTANT_CLIENT_PATH}`);
  } else if (process.platform === 'win32') {
    // Windows fallback (ubah sesuai lokasi jika perlu)
    const libDir = 'C:\\Users\\Thalita Zahra\\Downloads\\instantclient-basic-windows\\instantclient_23_8';
    oracledb.initOracleClient({ libDir });
    logger.info('Oracle Thick mode initialized on Windows default path');
  } else {
    logger.info('No Instant Client path provided, running in Thin mode (older DB versions may not be supported)');
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

  connectTimeout: 60,
  transportConnectTimeout: 60000,
};

// ---------- Helpers ----------
function redactConnectString(cs) {
  if (!cs) return '';
  // jangan tampilkan password; connectString tidak mengandung password, jadi aman
  return cs;
}

// ---------- Pool Lifecycle ----------
async function initializePools() {
  try {
    // Log env yang dipakai (tanpa password)
    logger.info(`DADBS  -> ${process.env.ORACLE_DADBS_USER}@${redactConnectString(process.env.ORACLE_DADBS_CONNECT_STRING)}`);

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

// ---------- CLOB Handling ----------
async function processClobData(row) {
  const processedRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Lob') {
      try {
        let clobData = '';
        value.setEncoding('utf8');
        const chunks = [];
        for await (const chunk of value) chunks.push(chunk);
        clobData = chunks.join('');
        processedRow[key] = clobData;
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

// ---------- Query Executor with Fallback ----------
async function executeQuery(query, binds = [], database = 'DADBS') {
  // Dev switch: bypass DB entirely
  if (process.env.USE_DB === 'false') {
    logger.warn('USE_DB=false -> returning mock data for development.');
    return getMockData(query, binds);
  }

  let connection;
  try {
    connection = await getConnection(database);
    const result = await connection.execute(query, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchArraySize: 1000,
      autoCommit: true
    });

    if (query.trim().toUpperCase().startsWith('SELECT')) {
      const processedRows = await Promise.all(result.rows.map(row => processClobData(row)));
      return processedRows;
    }
    return result;
  } catch (error) {
    logger.error('Database query error:', error);

    // Fallback untuk DB tua (Thin mode tak didukung) atau konektivitas (timeout)
    if (error?.code === 'NJS-138' || error?.code === 'NJS-510') {
      logger.warn('Returning mock data due to Oracle connection/version issue');
      return getMockData(query, binds);
    }

    throw error;
  } finally {
    if (connection) {
      try { await connection.close(); } 
      catch (closeError) { logger.error('Error closing connection:', closeError); }
    }
  }
}

// ---------- Mock Data ----------
function getMockData(query, binds) {
  const q = (query || '').toLowerCase().trim();

  // Chats
  if (q.includes('select') && q.includes('usr_rpt.brightai_chat')) {
    return [];
  }

  // Users (mock login - password: Admin123)
  if (q.includes('select') && q.includes('usr_rpt.brightai_user')) {
    if (q.includes('email') || q.includes('username')) {
      return [{
        USER_ID: 1,
        USERNAME: 'Admin123',
        EMAIL: 'admin123@gmail.com',
        PASSWORD_HASH: '$2a$10$0Wor7LQTfzTNoOFyvaNZOujSfpuhGXxYjDabmFtN6Qc0zgXL9wr7O',
        FULL_NAME: 'Admin Telkom Regional',
        ROLE: 'admin',
        IS_ACTIVE: 1,
        CREATED_AT: new Date(),
        UPDATED_AT: new Date()
      }];
    }
    return [];
  }

  // Sessions
  if (q.includes('select') && q.includes('usr_rpt.brightai_session')) {
    return [];
  }

  // DML mock success
  if (q.includes('insert') || q.includes('update') || q.includes('delete')) {
    return [];
  }

  // Sequence mock
  if (q.includes('seq_brightai') && q.includes('currval')) {
    return [{ CHAT_ID: Math.floor(Math.random() * 10000) }];
  }

  return [];
}

// ---------- Pool Shutdown ----------
async function closePools() {
  try {
    if (pools.DADBS)  { await pools.DADBS.close(10);  pools.DADBS  = null; }
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