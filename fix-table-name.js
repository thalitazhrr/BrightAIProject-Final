#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Fixing table name in SQL query...');

let content = fs.readFileSync(filePath, 'utf8');

// Fix the incorrect table reference
content = content.replace(/FROM DWHNAS\.DWH_MOIS\.PS_SCONE_ORDER/g, 'FROM DWH_MOIS.PS_SCONE_ORDER');

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed table name from DWHNAS.DWH_MOIS.PS_SCONE_ORDER to DWH_MOIS.PS_SCONE_ORDER');
console.log('Done!');