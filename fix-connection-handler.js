#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Removing problematic CONNECTION_HANDLER section...');

let content = fs.readFileSync(filePath, 'utf8');

// Remove the entire CONNECTION_HANDLER section that's causing issues
content = content.replace(/,\s*CONNECTION_HANDLER:\s*\{[^}]*\{[^}]*\}[^}]*\{[^}]*\}[^}]*\}/s, '');

// Clean up any trailing commas before closing
content = content.replace(/,(\s*CACHE_DURATION:)/, '\n\n  $1');

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Removed CONNECTION_HANDLER section');
console.log('Done!');