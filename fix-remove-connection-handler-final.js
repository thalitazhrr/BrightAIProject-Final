#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Removing CONNECTION_HANDLER section completely...');

let content = fs.readFileSync(filePath, 'utf8');

// Remove the CONNECTION_HANDLER section completely
content = content.replace(/,\s*CONNECTION_HANDLER:\s*\{[^}]*getConnection[^}]*\}[^}]*executeQuery[^}]*\}[^}]*\}/s, '');

// Also remove any trailing comma before CACHE_DURATION
content = content.replace(/\},\s*(\s*CACHE_DURATION:)/, '\n\n  $1');

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Removed CONNECTION_HANDLER section completely');
console.log('Done!');