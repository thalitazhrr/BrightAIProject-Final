#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Fixing SQL syntax errors in total_order_hsi.js...');

let content = fs.readFileSync(filePath, 'utf8');

// Fix the problematic NOT expressions that need parentheses
content = content.replace(/AND NOT UPPER\(PACKAGE_NAME\) LIKE '[^']*'/g, (match) => {
  return match.replace(/AND NOT /, 'AND NOT (') + ')';
});

content = content.replace(/\) AND NOT \(UPPER\(PACKAGE_NAME\) LIKE '[^']*'\) AND NOT \(UPPER\(PACKAGE_NAME\) LIKE '[^']*'\)/g, 
  ') AND NOT (UPPER(PACKAGE_NAME) LIKE \'%Non%\') AND NOT (UPPER(PACKAGE_NAME) LIKE \'%Add-on%\')');

// Fix the specific problematic lines
content = content.replace(
  /\) AND NOT \(UPPER\(PACKAGE_NAME\) LIKE '%Non%'\) AND NOT \(UPPER\(PACKAGE_NAME\) LIKE '%Add-on%'\)/g,
  ') AND NOT (UPPER(PACKAGE_NAME) LIKE \'%Non%\') AND NOT (UPPER(PACKAGE_NAME) LIKE \'%Add-on%\')'
);

// Fix any remaining AND NOT patterns
content = content.replace(/AND NOT UPPER\(PACKAGE_NAME\) LIKE ('[^']*')/g, 'AND NOT (UPPER(PACKAGE_NAME) LIKE $1)');

// Fix WHEN (JENISPSB = 'MO' OR JENISPSB = 'AS') AND NOT (UPPER(PACKAGE_NAME) LIKE '%Non%')
content = content.replace(
  /WHEN \(JENISPSB = 'MO' OR JENISPSB = 'AS'\) AND NOT \(UPPER\(PACKAGE_NAME\) LIKE '%Non%'\)/g,
  'WHEN (JENISPSB = \'MO\' OR JENISPSB = \'AS\') AND NOT (UPPER(PACKAGE_NAME) LIKE \'%Non%\')'
);

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed SQL syntax errors');
console.log('Done!');

// Let's also validate by reading a snippet
const lines = content.split('\n');
const problemLines = lines.filter((line, index) => 
  line.includes('AND NOT UPPER(PACKAGE_NAME)') && !line.includes('AND NOT (UPPER(PACKAGE_NAME)')
);

if (problemLines.length > 0) {
  console.log('⚠️ Still found potential issues:');
  problemLines.forEach((line, i) => {
    console.log(`Line: ${line.trim()}`);
  });
} else {
  console.log('✅ No remaining AND NOT syntax issues found');
}