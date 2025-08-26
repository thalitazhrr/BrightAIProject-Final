#!/usr/bin/env node

const fs = require('fs');

const filePath = '/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ct0_nal_ebis/churn_rate_regional_analysis.js';

console.log('🔧 Fixing churn_rate_regional_analysis.js structure...');

let content = fs.readFileSync(filePath, 'utf8');

// Fix the malformed KEYWORD_PATTERNS structure
const fixedKeywordPatterns = `  KEYWORD_PATTERNS: {
    required: {
      churn_keywords: [
        'churn rate', 'tingkat churn', 'cabut pelanggan', 'pelanggan cabut',
        'churn regional', 'churn per regional', 'analisis churn',
        'kehilangan pelanggan', 'pelanggan hilang', 'customer churn'
      ],
      service_keywords: [
        'internet', 'broadband', 'hsi', 'koneksi internet'
      ]
    },
    
    optional: {
      location_keywords: [
        'regional', 'wilayah', 'area', 'daerah'
      ],
      analysis_keywords: [
        'analisis', 'analysis', 'performa', 'kinerja'
      ],
      technical_keywords: [
        'ct0', 'dinolkan', 'nonaktif'
      ]
    },
    
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
    }
  },`;

// Replace the malformed section
const startPattern = /KEYWORD_PATTERNS:\s*\{/;
const endPattern = /},\s*SQL_QUERY:/;

const startMatch = content.match(startPattern);
const endMatch = content.match(endPattern);

if (startMatch && endMatch) {
  const beforeKeywords = content.substring(0, startMatch.index);
  const afterKeywords = content.substring(endMatch.index + 2); // +2 for the "},\n"
  
  content = beforeKeywords + fixedKeywordPatterns + '\n\n  SQL_QUERY:' + afterKeywords;
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Fixed churn_rate_regional_analysis.js structure');
} else {
  console.log('❌ Could not find the pattern to fix');
}

console.log('Done!');