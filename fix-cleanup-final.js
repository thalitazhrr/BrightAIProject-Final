#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Cleaning up malformed JavaScript structure...');

let content = fs.readFileSync(filePath, 'utf8');

// Remove everything from the executeQuery function onwards that's causing the malformed structure
content = content.replace(/executeQuery:\s*async\s*function\([^)]*\)\s*\{[^}]*\}[^}]*\s*CACHE_DURATION:/s, 'CACHE_DURATION:');

// Clean up any remaining malformed sections
content = content.replace(/\}\s*\}\s*(\s*CACHE_DURATION:)/s, '\n\n  $1');

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Cleaned up malformed JavaScript structure');
console.log('Done!');