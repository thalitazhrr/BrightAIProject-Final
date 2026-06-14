require('dotenv').config();
const db = require('./config/database');

async function test() {
  try {
    await db.initializePools();
    const result = await db.executeQuery(`
      SELECT DISTINCT REGIONAL FROM DWH_MOIS.BRIGHTAI_DAPROS
      WHERE ROWNUM <= 1000
    `, []);
    console.log("Distinct REGIONAL in BRIGHTAI_DAPROS:", result);
  } catch (err) {
    console.error(err);
  } finally {
    await db.closePools();
  }
}

test();
