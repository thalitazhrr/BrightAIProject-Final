require('dotenv').config();
const db = require('./config/database');

async function test() {
  try {
    await db.initializePools();
    const result = await db.executeQuery(`
      SELECT * FROM DWH_MOIS.BRIGHTAI_DAPROS WHERE ROWNUM <= 1
    `, []);
    console.log("Columns in BRIGHTAI_DAPROS:", Object.keys(result[0] || {}));
  } catch (err) {
    console.error(err);
  } finally {
    await db.closePools();
  }
}

test();
