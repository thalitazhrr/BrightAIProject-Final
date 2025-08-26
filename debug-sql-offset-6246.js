#!/usr/bin/env node

const fs = require('fs');

// Load the rule to see the actual SQL query
const rulePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js';
const rule = require(rulePath);

console.log('🔍 Debugging SQL query at character position 6246...');

const sql = rule.SQL_QUERY;
const lines = sql.split('\n');

let charCount = 0;
let errorFound = false;

console.log('Looking for error at position 6246:');
console.log('='.repeat(80));

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineStart = charCount;
  charCount += line.length + 1; // +1 for newline
  
  // Check if error position is in this line
  if (!errorFound && lineStart <= 6246 && charCount >= 6246) {
    const posInLine = 6246 - lineStart;
    console.log(`>>> LINE ${i + 1} (ERROR HERE at position ${posInLine}): ${line}`);
    console.log(`    ${''.padStart(posInLine, ' ')}^--- Error position`);
    errorFound = true;
    
    // Show context around the error
    console.log('\nContext (5 lines before and after):');
    for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
      const marker = j === i ? '>>> ' : '    ';
      console.log(`${marker}LINE ${j + 1}: ${lines[j]}`);
    }
    break;
  }
}

if (!errorFound) {
  console.log('Error position 6246 not found in SQL. SQL length:', sql.length);
}

console.log('\n='.repeat(80));

// Extract the problematic section around character 6246
const start = Math.max(0, 6246 - 100);
const end = Math.min(sql.length, 6246 + 100);
console.log('\n🎯 Context around error position:');
console.log(sql.substring(start, end));
console.log('      ^'.padStart(102, ' ') + ' Error position (approximately)');

console.log('\nDone!');