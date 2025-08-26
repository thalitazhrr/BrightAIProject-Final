#!/usr/bin/env node

// Test script untuk rule engine
const ruleEngine = require('./backend/src/rules/engine/ruleEngine');

async function testRuleMatching() {
  console.log('🧪 Testing Rule Engine...\n');
  
  // Test queries
  const testQueries = [
    'Penetrasi HSI di wilayah Jawa Barat',
    'Analisis churn rate berdasarkan regional',
    'Revenue HSI per bandwidth', 
    'Performance target realisasi HSI',
    'Digital product penetration analysis',
    'Customer segmentation HSI',
    'Growth trend analysis HSI'
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    
    try {
      const result = await ruleEngine.processQuery(query);
      
      if (result.success) {
        console.log(`✅ MATCHED!`);
        console.log(`   Rule: ${result.rule_id} - ${result.rule_name}`);
        console.log(`   Confidence: ${result.confidence}%`);
        console.log(`   Source: ${result.source}`);
        console.log(`   Processing Time: ${result.processing_time}ms`);
      } else {
        console.log(`❌ NO MATCH`);
        console.log(`   Reason: ${result.reason}`);
        console.log(`   Processing Time: ${result.processing_time}ms`);
      }
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}`);
    }
  }

  console.log('\n📊 Rule Statistics:');
  const allRules = ruleEngine.getAllRulesInfo();
  console.log(`Total Rules Loaded: ${allRules.length}`);
  
  const rulesByDatabase = allRules.reduce((acc, rule) => {
    acc[rule.database] = (acc[rule.database] || 0) + 1;
    return acc;
  }, {});
  
  Object.keys(rulesByDatabase).forEach(db => {
    console.log(`  ${db}: ${rulesByDatabase[db]} rules`);
  });
}

// Run the test
testRuleMatching().catch(console.error);