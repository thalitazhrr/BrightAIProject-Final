require('dotenv').config();
const db = require('./config/database');

async function test() {
  try {
    await db.initializePools();
    const result = await db.executeQuery(`
      SELECT COUNT(*) as count, TELDA, STO FROM DWH_MOIS.BRIGHTAI_DAPROS
      WHERE PLBLCL IN ('BL', 'CL')
      GROUP BY TELDA, STO
      FETCH FIRST 10 ROWS ONLY
    `, []);
    console.log("TELDA and STO Distribution:", result);
  } catch (err) {
    console.error(err);
  } finally {
    await db.closePools();
  }
}

test();
