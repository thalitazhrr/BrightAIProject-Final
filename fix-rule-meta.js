#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Fixing RULE_META syntax error...');

let content = fs.readFileSync(filePath, 'utf8');

// Fix the malformed RULE_META section
content = content.replace(
  /RULE_META:\s*\{\s*RULE_ID:\s*'ps_001',\s*RULE_NAME:\s*'total_order_hsi',\s*DESCRIPTION:\s*'[^']*',\s*DATABASE:\s*'PS_SCONE_ORDER',\s*CATEGORY:\s*'order_analytics',\s*COMPLEXITY:\s*'HIGH',\s*EXECUTION_PRIORITY:\s*'HIGH'\s*\n\s*CACHE_DURATION:\s*3600,\s*CREATED_BY:\s*'System',\s*VERSION:\s*'1\.0'\s*\}/,
  `RULE_META: {
    RULE_ID: 'ps_001',
    RULE_NAME: 'total_order_hsi',
    DESCRIPTION: 'Menghitung total order HSI (Bisnis & Basic) dengan analisis pertumbuhan dan bundling',
    DATABASE: 'PS_SCONE_ORDER',
    CATEGORY: 'order_analytics',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  }`
);

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed RULE_META syntax');
console.log('Done!');