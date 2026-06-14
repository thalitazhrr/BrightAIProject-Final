require('dotenv').config();
const db = require('./config/database');
const rule1 = require('./src/rules/databases/brightai_target/target_realisasi_hsi_performance');
const rule2 = require('./src/rules/databases/brightai_target/hsi_segmentation_performance');

async function test() {
  try {
    await db.initializePools();
    
    console.log("Testing Rule 1 (target_realisasi_hsi_performance)...");
    let result1 = await db.executeQuery(rule1.SQL_QUERY, []);
    let formatted1 = rule1.BUSINESS_LOGIC.formatIndonesianResponse(result1);
    console.log("Result 1 snippet:", JSON.stringify(formatted1).substring(0, 300) + '...');
    
    console.log("Testing Rule 2 (hsi_segmentation_performance)...");
    let result2 = await db.executeQuery(rule2.SQL_QUERY, []);
    let formatted2 = rule2.BUSINESS_LOGIC.formatIndonesianResponse(result2);
    console.log("Result 2 snippet:", JSON.stringify(formatted2).substring(0, 300) + '...');
    
  } catch (err) {
    console.error("Error executing rule:", err);
  } finally {
    await db.closePools();
  }
}

test();
