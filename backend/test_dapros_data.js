require('dotenv').config();
const db = require('./config/database');

async function test() {
  try {
    await db.initializePools();
    const result = await db.executeQuery(`
      SELECT 
        COUNT(*) as TOTAL,
        SUM(CASE WHEN SPEED IS NULL THEN 1 ELSE 0 END) as SPEED_NULL,
        SUM(CASE WHEN TREMS_REV_REF IS NULL THEN 1 ELSE 0 END) as REV_NULL,
        SUM(CASE WHEN IS_DINAS = '1' THEN 1 ELSE 0 END) as IS_DINAS_1,
        SUM(CASE WHEN PLBLCL = 'BL' THEN 1 ELSE 0 END) as PLBLCL_BL,
        SUM(CASE WHEN PLBLCL = 'CL' THEN 1 ELSE 0 END) as PLBLCL_CL,
        SUM(CASE WHEN IS_POTS = '1' THEN 1 ELSE 0 END) as POTS_1,
        SUM(CASE WHEN IS_IPTV = '1' THEN 1 ELSE 0 END) as IPTV_1,
        SUM(CASE WHEN ADDON_TOTAL > 0 THEN 1 ELSE 0 END) as ADDON_GT_0
      FROM DWH_MOIS.BRIGHTAI_DAPROS
      WHERE PLBLCL IN ('BL', 'CL')
    `, []);
    console.log("DAPROS Data Summary:", result);
  } catch (err) {
    console.error(err);
  } finally {
    await db.closePools();
  }
}

test();
