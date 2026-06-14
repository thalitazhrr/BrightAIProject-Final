require('dotenv').config();
const db = require('./config/database');
async function test() {
  try {
    await db.initializePools();
    const res = await db.executeQuery("SELECT PACKAGE_NAME, COUNT(*) as cnt FROM DWH_MOIS.BRIGHTAI_SALES GROUP BY PACKAGE_NAME FETCH FIRST 10 ROWS ONLY");
    console.log("Packages:", res);
  } catch (e) {
    console.log(e);
  } finally {
    process.exit();
  }
}
test();
