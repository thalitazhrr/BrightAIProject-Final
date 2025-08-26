#!/usr/bin/env node

const fs = require('fs');

const content = fs.readFileSync('/mnt/d/MAGANG TELKOM/BrightAIProject-Final/backend/src/rules/databases/ps_scone_order/total_order_hsi.js', 'utf8');

// Extract SQL query
const sqlStart = content.indexOf('SQL_QUERY: `');
if (sqlStart !== -1) {
  const sqlEnd = content.indexOf('`,', sqlStart);
  const sqlQuery = content.substring(sqlStart + 12, sqlEnd);
  
  console.log('SQL Query length:', sqlQuery.length);
  console.log('Error offset: 6246');
  
  if (sqlQuery.length > 6246) {
    console.log('Character at offset 6246:', JSON.stringify(sqlQuery.charAt(6246)));
    console.log('Context around offset 6246:');
    console.log(sqlQuery.substring(6240, 6260));
  } else {
    console.log('SQL query is shorter than offset 6246');
    console.log('Actual length:', sqlQuery.length);
    // Show end of query
    console.log('End of query:');
    console.log(sqlQuery.substring(sqlQuery.length - 50));
  }
} else {
  console.log('SQL_QUERY not found');
}