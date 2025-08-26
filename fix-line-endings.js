#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Fixing Windows line endings in total_order_hsi.js...');

let content = fs.readFileSync(filePath, 'utf8');

// Convert Windows line endings (\r\n) to Unix line endings (\n)
const beforeLength = content.length;
content = content.replace(/\r\n/g, '\n');
content = content.replace(/\r/g, '\n'); // Also handle any standalone \r

const afterLength = content.length;

fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ Fixed line endings`);
console.log(`Before: ${beforeLength} characters`);
console.log(`After: ${afterLength} characters`);
console.log(`Removed ${beforeLength - afterLength} carriage return characters`);
console.log('Done!');