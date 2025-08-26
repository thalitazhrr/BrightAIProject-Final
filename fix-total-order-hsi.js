#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Fixing remaining SQL syntax in total_order_hsi.js...');

let content = fs.readFileSync(filePath, 'utf8');

// Check and fix any remaining parentheses issues around character 3242
// The issue is likely in the complex CASE statements or CTE joins

// Fix any remaining AND NOT patterns without proper parentheses
content = content.replace(/AND NOT UPPER\(PACKAGE_NAME\) LIKE ('[^']*')/g, 'AND NOT (UPPER(PACKAGE_NAME) LIKE $1)');

// Fix any malformed CASE WHEN patterns
content = content.replace(/WHEN\s+\(\s*JENISPSB\s*=\s*'([^']+)'\s*OR\s*JENISPSB\s*=\s*'([^']+)'\s*\)\s+AND\s+NOT\s+UPPER\(PACKAGE_NAME\)\s+LIKE\s+'([^']+)'/g, 
  "WHEN (JENISPSB = '$1' OR JENISPSB = '$2') AND NOT (UPPER(PACKAGE_NAME) LIKE '$3')");

// Ensure all CASE statements have proper closing
content = content.replace(/CASE\s+(.*?)\s+END(?!\s+as)/gs, (match, caseContent) => {
  // Count WHEN clauses to ensure we have proper structure
  const whenCount = (caseContent.match(/WHEN/g) || []).length;
  const thenCount = (caseContent.match(/THEN/g) || []).length;
  
  if (whenCount === thenCount && !caseContent.includes('ELSE')) {
    return `CASE ${caseContent} ELSE 0 END`;
  }
  return match;
});

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Applied additional SQL syntax fixes to total_order_hsi.js');

// Verify the SQL syntax by checking character count around expected error position
const lines = content.split('\n');
let charCount = 0;
let errorLineFound = false;

for (let i = 0; i < lines.length; i++) {
  charCount += lines[i].length + 1; // +1 for newline
  
  if (charCount >= 3240 && charCount <= 3250 && !errorLineFound) {
    console.log(`📍 Character 3242 is around line ${i + 1}: "${lines[i].trim()}"`);
    errorLineFound = true;
  }
}

console.log('Done!');