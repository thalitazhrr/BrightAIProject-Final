require('dotenv').config();
const db = require('./config/database');
const fs = require('fs');

async function test() {
  try {
    await db.initializePools();
    
    // Read the query directly from the file to test it exactly as written
    const content = fs.readFileSync('./src/rules/databases/brightai_sales/revenue_per_bandwidth.js', 'utf8');
    const match = content.match(/SQL_QUERY:\s*`([\s\S]*?)`,/);
    if (!match) throw new Error("Could not find SQL_QUERY");
    const query = match[1];

    console.log("Executing query...");
    const res = await db.executeQuery(query);
    console.log("Result rows:", res.length || res.rows?.length);
    console.log(res);
  } catch (e) {
    console.log("Error:", e.message);
  } finally {
    process.exit();
  }
}
test();
