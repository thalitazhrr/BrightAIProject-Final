require('dotenv').config();
const db = require('./config/database');
const rule = require('./src/rules/databases/brightai_dapros/hsi_customer_segmentation');

async function test() {
  try {
    await db.initializePools();
    const query = rule.SQL_QUERY;
    const result = await db.executeQuery(query, []);
    
    const formatted = rule.BUSINESS_LOGIC.formatIndonesianResponse(result);
    console.log("Rule dapros_001 distribution output:", JSON.stringify(formatted.distribusi_segmen_utama, null, 2));
    console.log("Rule dapros_001 regional output:", JSON.stringify(formatted.distribusi_geografis, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await db.closePools();
  }
}

test();
