#!/usr/bin/env node

const fs = require('fs');

// Load the rule to see the actual SQL query
const rulePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';
const rule = require(rulePath);

console.log('🔍 Debugging SQL query at character position 3242...');

const sql = rule.SQL_QUERY;
const lines = sql.split('\n');

let charCount = 0;
let errorFound = false;

console.log('SQL Query:');
console.log('='.repeat(80));

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineStart = charCount;
  charCount += line.length + 1; // +1 for newline
  
  // Check if error position is in this line
  if (!errorFound && lineStart <= 3242 && charCount >= 3242) {
    const posInLine = 3242 - lineStart;
    console.log(`>>> LINE ${i + 1} (ERROR HERE at position ${posInLine}): ${line}`);
    console.log(`    ${''.padStart(posInLine, ' ')}^--- Error position`);
    errorFound = true;
  } else {
    console.log(`    LINE ${i + 1}: ${line}`);
  }
  
  // Show some context around the error
  if (errorFound && i > lines.length - 5) {
    break;
  }
}

console.log('='.repeat(80));

// Extract the problematic section around character 3242
const start = Math.max(0, 3242 - 100);
const end = Math.min(sql.length, 3242 + 100);
console.log('\n🎯 Context around error position:');
console.log(sql.substring(start, end));
console.log('      ^'.padStart(102, ' ') + ' Error position (approximately)');

console.log('\nDone!');