#!/usr/bin/env node

const fs = require('fs');

const filesToFix = [
  '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/order_per_bandwidth.js',
  '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/order_per_struktur_geografis.js'
];

console.log('🔧 Fixing SQL syntax errors in multiple files...');

for (const filePath of filesToFix) {
  console.log(`Processing: ${filePath.split('/').pop()}`);
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix the problematic NOT expressions that need parentheses
  content = content.replace(/AND NOT UPPER\(PACKAGE_NAME\) LIKE ('[^']*')/g, 'AND NOT (UPPER(PACKAGE_NAME) LIKE $1)');

  // Fix specific patterns
  content = content.replace(
    /\) AND NOT UPPER\(PACKAGE_NAME\) LIKE '%Non%' AND NOT UPPER\(PACKAGE_NAME\) LIKE '%Add-on%'/g,
    ') AND NOT (UPPER(PACKAGE_NAME) LIKE \'%Non%\') AND NOT (UPPER(PACKAGE_NAME) LIKE \'%Add-on%\')'
  );

  // Fix WHEN (JENISPSB = 'AO') pattern
  content = content.replace(
    /WHEN JENISPSB = 'AO' AND NOT UPPER\(PACKAGE_NAME\) LIKE '%Non%'/g,
    'WHEN JENISPSB = \'AO\' AND NOT (UPPER(PACKAGE_NAME) LIKE \'%Non%\')'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✅ Fixed: ${filePath.split('/').pop()}`);
}

console.log('🎉 All SQL syntax errors fixed!');