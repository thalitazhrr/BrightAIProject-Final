#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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

function addCalculateConfidenceFunction(filePath) {
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if this file uses required/optional structure and doesn't have calculateConfidence
  const hasRequiredOptional = /required:\s*\{/.test(content) && /optional:\s*\{/.test(content);
  const hasCalculateConfidence = /calculateConfidence.*function.*userInput/.test(content);
  
  if (hasRequiredOptional && !hasCalculateConfidence) {
    // Find the KEYWORD_PATTERNS closing brace
    const keywordPatternsMatch = content.match(/(KEYWORD_PATTERNS:\s*\{[\s\S]*?)\s*\}/);
    
    if (keywordPatternsMatch) {
      const keywordPatternsContent = keywordPatternsMatch[1];
      const closingBraceIndex = content.indexOf('}', keywordPatternsMatch.index + keywordPatternsMatch[0].length - 1);
      
      // Add calculateConfidence function
      const calculateConfidenceFunction = `,
    
    calculateConfidence: function(inputPengguna) {
      const input = inputPengguna.toLowerCase().trim();
      let totalScore = 0;
      let maxPossibleScore = 0;
      
      // Check required keywords
      if (this.required) {
        Object.keys(this.required).forEach(category => {
          const keywords = this.required[category];
          const matches = keywords.filter(keyword => input.includes(keyword.toLowerCase())).length;
          const categoryScore = (matches / keywords.length) * 100;
          totalScore += categoryScore * 2; // Double weight for required
          maxPossibleScore += 200;
        });
      }
      
      // Check optional keywords  
      if (this.optional) {
        Object.keys(this.optional).forEach(category => {
          const keywords = this.optional[category];
          const matches = keywords.filter(keyword => input.includes(keyword.toLowerCase())).length;
          const categoryScore = (matches / keywords.length) * 100;
          totalScore += categoryScore;
          maxPossibleScore += 100;
        });
      }
      
      return maxPossibleScore > 0 ? Math.min(100, (totalScore / maxPossibleScore) * 100) : 0;
    }`;
      
      const beforeClosing = content.substring(0, closingBraceIndex);
      const afterClosing = content.substring(closingBraceIndex);
      
      content = beforeClosing + calculateConfidenceFunction + '\n  ' + afterClosing;
      modified = true;
      console.log(`  ✓ Added calculateConfidence function`);
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ File updated successfully`);
  } else {
    console.log(`  - No changes needed`);
  }
  
  return modified;
}

function main() {
  const rulesDir = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases';
  
  console.log('🔧 Adding calculateConfidence functions to rules with required/optional structure...\n');
  
  const ruleFiles = findRuleFiles(rulesDir);
  console.log(`Found ${ruleFiles.length} rule files\n`);
  
  let totalFixed = 0;
  
  for (const filePath of ruleFiles) {
    const wasModified = addCalculateConfidenceFunction(filePath);
    if (wasModified) {
      totalFixed++;
    }
    console.log('');
  }
  
  console.log(`🎉 Completed! Added calculateConfidence to ${totalFixed} out of ${ruleFiles.length} files`);
}

if (require.main === module) {
  main();
}