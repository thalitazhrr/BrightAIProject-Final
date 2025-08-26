#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Final cleanup - removing CONNECTION_HANDLER completely...');

let content = fs.readFileSync(filePath, 'utf8');

// Find the end of PATTERN_MATCHING and remove everything after it until CACHE_DURATION
const patternEnd = content.indexOf('  },\n\n  CONNECTION_HANDLER:');
const cacheDurationStart = content.indexOf('  CACHE_DURATION: 3600');

if (patternEnd !== -1 && cacheDurationStart !== -1) {
  const beforeConnectionHandler = content.substring(0, patternEnd + 4); // +4 for '  },\n'
  const afterConnectionHandler = content.substring(cacheDurationStart);
  
  content = beforeConnectionHandler + '\n\n  ' + afterConnectionHandler;
}

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Final cleanup completed - CONNECTION_HANDLER completely removed');
console.log('Done!');