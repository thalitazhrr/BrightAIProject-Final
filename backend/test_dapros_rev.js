require('dotenv').config();
const db = require('./config/database');

async function test() {
  try {
    await db.initializePools();
    const result = await db.executeQuery(`
      SELECT 
        SUM(CASE WHEN TREMS_REV_P IS NULL THEN 1 ELSE 0 END) as REV_P_NULL,
        SUM(CASE WHEN TREMS_REV_P > 0 THEN 1 ELSE 0 END) as REV_P_GT_0
      FROM DWH_MOIS.BRIGHTAI_DAPROS
      WHERE PLBLCL IN ('BL', 'CL')
    `, []);
    console.log("DAPROS Rev P Summary:", result);
  } catch (err) {
    console.error(err);
  } finally {
    await db.closePools();
  }
}

test();
