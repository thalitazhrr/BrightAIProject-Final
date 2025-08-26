#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Fixing SQL CONTAINS() errors in total_order_hsi.js...');

let content = fs.readFileSync(filePath, 'utf8');

// Fix all CONTAINS function calls to LIKE
content = content.replace(/CONTAINS\(PACKAGE_NAME,\s*'([^']+)'\)/g, "UPPER(PACKAGE_NAME) LIKE '%$1%'");
content = content.replace(/CONTAINS\(UPPER\(PACKAGE_NAME\),\s*'([^']+)'\)/g, "UPPER(PACKAGE_NAME) LIKE '%$1%'");

// Fix NOT CONTAINS
content = content.replace(/NOT CONTAINS\(PACKAGE_NAME,\s*'([^']+)'\)/g, "NOT (UPPER(PACKAGE_NAME) LIKE '%$1%')");
content = content.replace(/NOT CONTAINS\(UPPER\(PACKAGE_NAME\),\s*'([^']+)'\)/g, "NOT (UPPER(PACKAGE_NAME) LIKE '%$1%')");

// Fix any remaining malformed UPPER() calls
content = content.replace(/UPPER\(PACKAGE_NAME,\s*'([^']+)'\)/g, "UPPER(PACKAGE_NAME) LIKE '%$1%'");
content = content.replace(/UPPER\(UPPER\(PACKAGE_NAME\),\s*'([^']+)'\)/g, "UPPER(PACKAGE_NAME) LIKE '%$1%'");
content = content.replace(/NOT UPPER\(PACKAGE_NAME,\s*'([^']+)'\)/g, "NOT (UPPER(PACKAGE_NAME) LIKE '%$1%')");

// Fix any remaining syntax issues
content = content.replace(/AND NOT UPPER\(PACKAGE_NAME,\s*'([^']+)'\)/g, "AND NOT (UPPER(PACKAGE_NAME) LIKE '%$1%')");

// Fix the schema reference
content = content.replace(/FROM DWH_MOIS\.PS_SCONE_ORDER/g, 'FROM DWHNAS.DWH_MOIS.PS_SCONE_ORDER');

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed SQL CONTAINS() errors');
console.log('✅ Updated schema reference to DWHNAS.DWH_MOIS.PS_SCONE_ORDER');
console.log('Done!');