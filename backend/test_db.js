require('dotenv').config();
const db = require('./config/database');
async function test() {
  try {
    const res = await db.executeQuery("SELECT * FROM DWH_MOIS.BRIGHTAI_SALES WHERE ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD') AND JENISPSB IS NOT NULL AND TRIM(JENISPSB) != '' FETCH FIRST 10 ROWS ONLY");
    console.log("Records found:", res.length);
    if(res.length > 0) {
      console.log("Sample:", res[0]);
    }
  } catch (e) {
    console.log(e);
  } finally {
    process.exit();
  }
}
test();
