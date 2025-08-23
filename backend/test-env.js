// Test script untuk verifikasi environment variables
require('dotenv').config();

console.log('=== TESTING ENVIRONMENT VARIABLES ===');

// Test Oracle DWHNAS Configuration
console.log('\n📋 ORACLE DWHNAS Configuration:');
console.log('HOST:', process.env.ORACLE_DWHNAS_HOST || '❌ NOT SET');
console.log('PORT:', process.env.ORACLE_DWHNAS_PORT || '❌ NOT SET');
console.log('DATABASE:', process.env.ORACLE_DWHNAS_DATABASE || '❌ NOT SET');
console.log('USER:', process.env.ORACLE_DWHNAS_USER || '❌ NOT SET');
console.log('PASSWORD:', process.env.ORACLE_DWHNAS_PASSWORD ? '✅ SET' : '❌ NOT SET');

// Test Oracle DADBS Configuration  
console.log('\n📋 ORACLE DADBS Configuration:');
console.log('HOST:', process.env.ORACLE_DADBS_HOST || '❌ NOT SET');
console.log('PORT:', process.env.ORACLE_DADBS_PORT || '❌ NOT SET');
console.log('DATABASE:', process.env.ORACLE_DADBS_DATABASE || '❌ NOT SET');
console.log('USER:', process.env.ORACLE_DADBS_USER || '❌ NOT SET');
console.log('PASSWORD:', process.env.ORACLE_DADBS_PASSWORD ? '✅ SET' : '❌ NOT SET');

// Test Application Configuration
console.log('\n📋 APPLICATION Configuration:');
console.log('NODE_ENV:', process.env.NODE_ENV || '❌ NOT SET');
console.log('PORT:', process.env.PORT || '❌ NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET' : '❌ NOT SET');

// Test Cache Configuration
console.log('\n📋 CACHE Configuration:');
console.log('CACHE_TTL:', process.env.CACHE_TTL || '❌ NOT SET');
console.log('CACHE_MAX_KEYS:', process.env.CACHE_MAX_KEYS || '❌ NOT SET');

// Test Database Configuration Loading
console.log('\n🔍 Testing Database Config Loading...');
try {
  const dbConfig = require('./src/rules/config/dbConfig');
  const dwhnas = dbConfig('DWHNAS');
  const dadbs = dbConfig('DADBS');
  
  console.log('DWHNAS Config:', dwhnas ? '✅ LOADED' : '❌ FAILED');
  console.log('DADBS Config:', dadbs ? '✅ LOADED' : '❌ FAILED');
} catch (error) {
  console.log('❌ Error loading database config:', error.message);
}

console.log('\n=== TEST COMPLETED ===');