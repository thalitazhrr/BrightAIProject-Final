require('./backend/node_modules/dotenv').config({ path: './backend/.env' });
const db = require('./backend/config/database');
async function test() {
  try {
    await db.initializePools();
    const result = await db.executeQuery('SELECT * FROM PMSDBS.BRIGHTAI_REVENUE WHERE ROWNUM = 1');
    if (result && result.metaData) {
        console.log("COLUMNS:", result.metaData.map(m => m.name).join(', '));
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
test();
