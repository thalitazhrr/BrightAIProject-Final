const configs = {
  DADBS: {
    host: process.env.ORACLE_DADBS_HOST,
    port: process.env.ORACLE_DADBS_PORT,
    database: process.env.ORACLE_DADBS_DATABASE,
    username: process.env.ORACLE_DADBS_USER,
    password: process.env.ORACLE_DADBS_PASSWORD,
  }
};

module.exports = (connectionType) => configs[connectionType];