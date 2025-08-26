#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Final fix for COUNT(DISTINCT CASE) statements...');

let content = fs.readFileSync(filePath, 'utf8');

// Replace all remaining ELSE 0 END patterns in COUNT DISTINCT CASE statements
content = content.replace(/THEN ORDER_ID ELSE 0 END\)/g, 'THEN ORDER_ID END)');
content = content.replace(/THEN NCLI ELSE 0 END\)/g, 'THEN NCLI END)');

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Final COUNT(DISTINCT CASE) fix applied');
console.log('Done!');