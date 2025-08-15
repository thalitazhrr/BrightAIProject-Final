// DATABASE.JS
const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'telkom_brightai_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Thalita_1601',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully at:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Initialize database with required extensions and functions
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    
    // Try to create extensions (skip if permission denied)
    try {
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "pg_trgm";
      `);
      console.log('✅ Database extensions created successfully');
    } catch (extensionError) {
      console.log('⚠️  Extensions may already exist or insufficient permissions:', extensionError.message);
    }

    // Try to create function (skip if permission denied)
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);
      console.log('✅ Database function created successfully');
    } catch (functionError) {
      console.log('⚠️  Function creation failed:', functionError.message);
    }

    // Check if telkom_orders table exists before creating trigger
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'telkom_orders'
      );
    `);

    if (tableExists.rows[0].exists) {
      try {
        await client.query(`
          DROP TRIGGER IF EXISTS update_telkom_orders_updated_at ON telkom_orders;
          CREATE TRIGGER update_telkom_orders_updated_at
            BEFORE UPDATE ON telkom_orders
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);
        console.log('✅ Database trigger created successfully');
      } catch (triggerError) {
        console.log('⚠️  Trigger creation failed:', triggerError.message);
      }
    } else {
      console.log('⚠️  Table telkom_orders does not exist, skipping trigger creation');
    }

    console.log('✅ Database initialized successfully');
    client.release();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't throw error, just log warning
    console.log('⚠️  Database initialization warning:', error.message);
  }
}

// Execute query with error handling
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: duration + 'ms',
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Database query error:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      error: error.message,
      params: params ? JSON.stringify(params).substring(0, 200) : 'none'
    });
    throw error;
  }
}

// Get database statistics
async function getDatabaseStats() {
  try {
    const result = await query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE schemaname = 'public' AND tablename = 'telkom_orders'
      ORDER BY tablename, attname;
    `);

    const tableSize = await query(`
      SELECT 
        pg_size_pretty(pg_total_relation_size('telkom_orders')) as total_size,
        pg_size_pretty(pg_relation_size('telkom_orders')) as table_size,
        pg_size_pretty(pg_total_relation_size('telkom_orders') - pg_relation_size('telkom_orders')) as index_size
    `);

    return {
      columnStats: result.rows,
      tableSize: tableSize.rows[0]
    };
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    return null;
  }
}

// Health check function
async function healthCheck() {
  try {
    const client = await pool.connect();
    
    // Check basic connectivity
    const connectionTest = await client.query('SELECT 1 as connected');
    
    // Check table existence
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'telkom_orders'
      );
    `);
    
    // Get record count
    let recordCount = 0;
    if (tableCheck.rows[0].exists) {
      const countResult = await client.query('SELECT COUNT(*) FROM telkom_orders');
      recordCount = parseInt(countResult.rows[0].count);
    }

    // Get connection pool status
    const poolStatus = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    };

    client.release();

    return {
      status: 'healthy',
      database: {
        connected: connectionTest.rows[0].connected === 1,
        tableExists: tableCheck.rows[0].exists,
        recordCount: recordCount
      },
      pool: poolStatus,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Graceful shutdown
async function closePool() {
  try {
    await pool.end();
    console.log('✅ Database pool closed successfully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down database connection...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Shutting down database connection...');
  await closePool();
  process.exit(0);
});

// Export all functions
module.exports = {
  pool,
  query,
  testConnection,
  initializeDatabase,
  getDatabaseStats,
  healthCheck,
  closePool
};