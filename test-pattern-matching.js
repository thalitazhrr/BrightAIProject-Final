#!/usr/bin/env node

// Test script untuk pattern matching
const queryProcessor = require('./backend/src/rules/engine/queryProcessor');
const ruleLoader = require('./backend/src/rules/engine/ruleLoader');

async function testPatternMatching() {
  console.log('🧪 Testing Pattern Matching Only...\n');
  
  try {
    // Load rules
    console.log('Loading rules...');
    const loadedRules = await ruleLoader.loadAllRules();
    const rulesMap = new Map();
    loadedRules.forEach(rule => {
      rulesMap.set(rule.RULE_META.RULE_ID, rule);
    });
    console.log(`Loaded ${rulesMap.size} rules\n`);
    
    // Test queries
    const testQueries = [
      'Penetrasi HSI di wilayah Jawa Barat',
      'Analisis churn rate berdasarkan regional', 
      'Revenue HSI per bandwidth',
      'Performance target realisasi HSI',
      'Digital product penetration analysis',
      'Customer segmentation HSI',
      'Growth trend analysis HSI',
      'Channel performance HSI',
      'Order HSI per struktur geografis',
      'Fulfillment success rate'
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Testing query: "${query}"`);
      
      try {
        const matchResult = await queryProcessor.findMatchingRule(query, rulesMap);
        
        if (matchResult.success) {
          console.log(`✅ MATCHED!`);
          console.log(`   Rule: ${matchResult.rule.RULE_META.RULE_ID} - ${matchResult.rule.RULE_META.RULE_NAME}`);
          console.log(`   Confidence: ${matchResult.confidence}%`);
          console.log(`   Database: ${matchResult.rule.RULE_META.DATABASE}`);
          console.log(`   Category: ${matchResult.rule.RULE_META.CATEGORY}`);
          console.log(`   Focus Area: ${matchResult.focus_area || 'N/A'}`);
          
          if (matchResult.alternatives && matchResult.alternatives.length > 0) {
            console.log(`   Alternative matches: ${matchResult.alternatives.length}`);
            matchResult.alternatives.forEach((alt, index) => {
              console.log(`     ${index + 1}. ${alt.rule.RULE_META.RULE_NAME} (${alt.confidence}%)`);
            });
          }
        } else {
          console.log(`❌ NO MATCH`);
          console.log(`   Reason: ${matchResult.reason}`);
          console.log(`   Message: ${matchResult.message}`);
        }
      } catch (error) {
        console.log(`💥 ERROR: ${error.message}`);
        console.log(`   Stack: ${error.stack.split('\n')[0]}`);
      }
    }

    console.log('\n📊 Pattern Matching Statistics:');
    console.log(`Total Rules Available: ${rulesMap.size}`);
    
    const rulesByDatabase = Array.from(rulesMap.values()).reduce((acc, rule) => {
      acc[rule.RULE_META.DATABASE] = (acc[rule.RULE_META.DATABASE] || 0) + 1;
      return acc;
    }, {});
    
    Object.keys(rulesByDatabase).forEach(db => {
      console.log(`  ${db}: ${rulesByDatabase[db]} rules`);
    });
    
    const rulesByCategory = Array.from(rulesMap.values()).reduce((acc, rule) => {
      acc[rule.RULE_META.CATEGORY] = (acc[rule.RULE_META.CATEGORY] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nRules by Category:');
    Object.keys(rulesByCategory).forEach(category => {
      console.log(`  ${category}: ${rulesByCategory[category]} rules`);
    });
    
  } catch (error) {
    console.error('Failed to load rules:', error.message);
  }
}

// Run the test
testPatternMatching().catch(console.error);