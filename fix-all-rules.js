#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to find all JavaScript files in rules/databases directory
function findRuleFiles(dir) {
  const files = [];
  
  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (stat.isFile() && item.endsWith('.js') && item !== 'index.js') {
        files.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return files;
}

// Function to fix pattern matching in rule files
function fixPatternMatching(filePath) {
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix the pattern matching call
  const oldPattern = /patternMatcher\.calculateConfidence\(userInput, module\.exports\.KEYWORD_PATTERNS\)/g;
  const newPattern = 'module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput)';
  
  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newPattern);
    modified = true;
    console.log(`  ✓ Fixed pattern matching call`);
  }
  
  // Save the file if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ File updated successfully`);
  } else {
    console.log(`  - No changes needed`);
  }
  
  return modified;
}

// Main execution
function main() {
  const rulesDir = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases';
  
  console.log('🔧 Starting rule pattern matching fixes...\n');
  
  const ruleFiles = findRuleFiles(rulesDir);
  console.log(`Found ${ruleFiles.length} rule files\n`);
  
  let totalFixed = 0;
  
  for (const filePath of ruleFiles) {
    const wasModified = fixPatternMatching(filePath);
    if (wasModified) {
      totalFixed++;
    }
    console.log('');
  }
  
  console.log(`🎉 Completed! Fixed ${totalFixed} out of ${ruleFiles.length} files`);
}

// Run the script
if (require.main === module) {
  main();
}