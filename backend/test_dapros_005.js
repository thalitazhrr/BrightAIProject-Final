require('dotenv').config();
const db = require('./config/database');
const rule = require('./src/rules/databases/brightai_dapros/hsi_geographic_distribution_profile');

async function test() {
  try {
    await db.initializePools();
    // We modify the query to add a ROWNUM limit so it returns faster
    const query = rule.SQL_QUERY;
    const result = await db.executeQuery(query, []);
    console.log("Rule dapros_005 result sample:", JSON.stringify(result[0] || result, null, 2));
    
    // Test the keyword matching for dapros_006
    const rule_006 = require('./src/rules/databases/brightai_dapros/hsi_speed_distribution_analysis');
    const rule_ps_003 = require('./src/rules/databases/brightai_sales/order_per_bandwidth');
    const input = "Distribusi kecepatan layanan HSI per customer";
    
    console.log("Confidence dapros_006:", rule_006.PATTERN_MATCHING.checkMatch(input));
    console.log("Confidence ps_003:", rule_ps_003.PATTERN_MATCHING.checkMatch(input));
    
  } catch (err) {
    console.error(err);
  } finally {
    await db.closePools();
  }
}

test();
