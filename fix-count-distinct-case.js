#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';

console.log('🔧 Fixing COUNT(DISTINCT CASE...) syntax in total_order_hsi.js...');

let content = fs.readFileSync(filePath, 'utf8');

// Remove ELSE 0 from COUNT(DISTINCT CASE statements as they are invalid in Oracle SQL
content = content.replace(/COUNT\s*\(\s*DISTINCT\s+CASE\s+WHEN\s+([^)]+)\s+THEN\s+([^)]+)\s+ELSE\s+0\s+END\s*\)/gi, 'COUNT(DISTINCT CASE WHEN $1 THEN $2 END)');

// Also handle multi-line CASE statements in COUNT DISTINCT
content = content.replace(/COUNT\s*\(\s*DISTINCT\s+CASE\s+WHEN[^}]+THEN[^}]+ELSE\s+0\s+END\s*\)/gi, (match) => {
  return match.replace(/\s+ELSE\s+0\s+END/, ' END');
});

// Specifically fix the complex multi-line CASE for any_digital_bundling
content = content.replace(
  /COUNT\s*\(\s*DISTINCT\s+CASE\s+WHEN\s+\(IS_HSI_BISNIS\s*=\s*1\s+OR\s+IS_HSI_BASIC\s*=\s*1\)\s+AND\s+\n\s*\(IS_PIJAR\s*=\s*1\s+OR\s+IS_NETMONK\s*=\s*1\s+OR\s+IS_OCA_INT\s*=\s*1\s+OR\s+IS_OCA_BLAST\s*=\s*1\)\s+\n\s*THEN\s+ORDER_ID\s+ELSE\s+0\s+END\s*\)/gi,
  'COUNT(DISTINCT CASE \n                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND \n                     (IS_PIJAR = 1 OR IS_NETMONK = 1 OR IS_OCA_INT = 1 OR IS_OCA_BLAST = 1) \n                THEN ORDER_ID \n            END)'
);

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed COUNT(DISTINCT CASE) statements in total_order_hsi.js');
console.log('Done!');