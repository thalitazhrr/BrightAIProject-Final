const fs = require('fs');
const XLSX = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Create table schema (FIXED VERSION - Updated for large numbers)
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS telkom_orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) UNIQUE,  -- Fixed: Made unique and reasonable length
    regional VARCHAR(10),         -- Fixed: Regional is 1-5, so smaller
    witel VARCHAR(150),           -- Fixed: Increased for longer names
    datel VARCHAR(150),           -- Fixed: Increased for longer names
    sto VARCHAR(100),
    extern_order_id VARCHAR(150),
    jenispsb VARCHAR(100),
    type_trans VARCHAR(50),
    status_resume VARCHAR(300),   -- Fixed: Increased for longer status messages
    status_message TEXT,
    kcontact TEXT,
    order_date DATE,
    ncli VARCHAR(100),
    ndem VARCHAR(100),
    speedy VARCHAR(100),
    pots VARCHAR(100),
    customer_name VARCHAR(300),   -- Fixed: Increased for longer names
    contact_hp VARCHAR(50),
    contact_email VARCHAR(255),
    ins_address TEXT,             -- Fixed: Changed to TEXT for long addresses
    customer_addr TEXT,           -- Fixed: Changed to TEXT for long addresses
    city_name VARCHAR(150),       -- Fixed: Increased for longer city names
    gps_latitude DECIMAL(15, 10), -- Fixed: Increased precision for GPS coordinates
    gps_longitude DECIMAL(15, 10),-- Fixed: Increased precision for GPS coordinates
    package_name TEXT,            -- Fixed: Changed to TEXT for very long package descriptions
    loc_id VARCHAR(150),
    device_id TEXT,               -- Fixed: Changed to TEXT for long device descriptions
    agent_id VARCHAR(150),
    last_updated_date TIMESTAMP,
    type_layanan VARCHAR(150),
    isi_comment TEXT,
    tindak_lanjut TEXT,
    user_id_tl VARCHAR(150),
    tl_date DATE,
    tgl_proses DATE,
    tgl_manja DATE,
    hide BOOLEAN DEFAULT FALSE,
    category VARCHAR(150),        -- Keep as VARCHAR since it might be mixed data
    provider VARCHAR(150),
    tgl_ps DATE,
    wonum VARCHAR(150),
    detail_manja TEXT,
    lat_alpro DECIMAL(20, 10),    -- Fixed: Much larger precision for alpro coordinates
    long_alpro DECIMAL(20, 10),   -- Fixed: Much larger precision for alpro coordinates
    paket VARCHAR(150),           -- Keep as VARCHAR since it might be mixed data
    channel VARCHAR(150),
    kat_hvc VARCHAR(150),
    product VARCHAR(300),         -- Fixed: Increased for longer product names
    tgl_created_wo DATE,
    order_id_old VARCHAR(150),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create indexes for better performance
const createIndexesQuery = `
  CREATE INDEX IF NOT EXISTS idx_regional ON telkom_orders(regional);
  CREATE INDEX IF NOT EXISTS idx_witel ON telkom_orders(witel);
  CREATE INDEX IF NOT EXISTS idx_order_date ON telkom_orders(order_date);
  CREATE INDEX IF NOT EXISTS idx_status_resume ON telkom_orders(status_resume);
  CREATE INDEX IF NOT EXISTS idx_package_name ON telkom_orders(package_name);
  CREATE INDEX IF NOT EXISTS idx_city_name ON telkom_orders(city_name);
  CREATE INDEX IF NOT EXISTS idx_order_id ON telkom_orders(order_id);
`;

// Helper function to parse date from Excel
function parseExcelDate(excelDate) {
  if (!excelDate) return null;
  
  // If it's already a Date object
  if (excelDate instanceof Date) {
    return excelDate;
  }
  
  // If it's a string
  if (typeof excelDate === 'string') {
    const dateStr = excelDate.trim();
    if (dateStr === '' || dateStr === '0' || dateStr === '-') return null;
    
    // Handle DD-MMM-YY format (04-JUL-23)
    if (dateStr.match(/^\d{2}-[A-Z]{3}-\d{2}$/)) {
      const months = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
      
      const [day, month, year] = dateStr.split('-');
      const fullYear = '20' + year; // Assume 2000s
      const monthNum = months[month];
      
      if (monthNum) {
        const date = new Date(`${fullYear}-${monthNum}-${day}`);
        return isNaN(date.getTime()) ? null : date;
      }
    }
    
    // Try parsing other formats
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // If it's a number (Excel date serial)
  if (typeof excelDate === 'number') {
    // Excel dates start from 1900-01-01 (serial 1)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

// Helper function to parse boolean
function parseBoolean(value) {
  if (!value) return false;
  const lowerValue = value.toString().toLowerCase().trim();
  return ['true', '1', 'yes', 'y', 'ya'].includes(lowerValue);
}

// Helper function to parse decimal with overflow protection
function parseDecimal(value) {
  if (!value || value === '' || value === '-') return null;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return null;
  
  // Handle very large numbers that might cause overflow
  // Convert to string to preserve as VARCHAR if too large for DECIMAL
  if (Math.abs(parsed) > 99999999) {
    return null; // Will be handled as string in category/paket fields
  }
  
  return parsed;
}

// Helper function to parse potential numeric strings
function parseAsString(value) {
  if (!value || value === '' || value === '-') return null;
  return value.toString().trim();
}

// Clean and normalize string values with length limits (SILENT VERSION)
function cleanString(value, maxLength = null) {
  if (!value) return null;
  if (typeof value !== 'string') {
    value = value.toString();
  }
  let cleaned = value.trim().replace(/\s+/g, ' ');
  
  // Apply length limit if specified (silently truncate)
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
    // Removed console.warn to keep output clean
  }
  
  return cleaned === '' || cleaned === '-' ? null : cleaned;
}

// Main import function
async function importXLSXData(xlsxFilePath) {
  try {
    console.log('🚀 Starting Telkom HSI XLSX data import...');
    console.log(`📁 File: ${xlsxFilePath}`);
    
    // Check if file exists
    if (!fs.existsSync(xlsxFilePath)) {
      throw new Error(`File not found: ${xlsxFilePath}`);
    }
    
    // Drop existing table if --clear flag is used
    const clearChoice = process.argv.includes('--clear');
    if (clearChoice) {
      await pool.query('DROP TABLE IF EXISTS telkom_orders CASCADE');
      console.log('🗑️  Existing table dropped');
    }
    
    // Create table and indexes
    await pool.query(createTableQuery);
    await pool.query(createIndexesQuery);
    console.log('✅ Database schema created successfully');

    // Read XLSX file (suppress warnings)
    console.log('📖 Reading XLSX file...');
    
    // Temporarily suppress console warnings for XLSX parsing
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = () => {}; // Suppress warnings
    console.error = () => {}; // Suppress errors during file reading
    
    const workbook = XLSX.readFile(xlsxFilePath);
    
    // Restore console functions
    console.warn = originalWarn;
    console.error = originalError;
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const sheet = workbook.Sheets[sheetName];
    
    console.log(`📊 Processing sheet: ${sheetName}`);
    
    // Convert to JSON with header mapping
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: [
        'ORDER_ID', 'REGIONAL', 'WITEL', 'DATEL', 'STO', 'EXTERN_ORDER_ID',
        'JENISPSB', 'TYPE_TRANS', 'STATUS_RESUME', 'STATUS_MESSAGE', 'KCONTACT',
        'ORDER_DATE', 'NCLI', 'NDEM', 'SPEEDY', 'POTS', 'CUSTOMER_NAME',
        'CONTACT_HP', 'CONTACT_EMAIL', 'INS_ADDRESS', 'CUSTOMER_ADDR', 'CITY_NAME',
        'GPS_LATITUDE', 'GPS_LONGITUDE', 'PACKAGE_NAME', 'LOC_ID', 'DEVICE_ID',
        'AGENT_ID', 'LAST_UPDATED_DATE', 'TYPE_LAYANAN', 'ISI_COMMENT', 'TINDAK_LANJUT',
        'USER_ID_TL', 'TL_DATE', 'TGL_PROSES', 'TGL_MANJA', 'HIDE', 'CATEGORY',
        'PROVIDER', 'TGL_PS', 'WONUM', 'DETAIL_MANJA', 'LAT_ALPRO', 'LONG_ALPRO',
        'PAKET', 'CHANNEL', 'KAT_HVC', 'PRODUCT', 'TGL_CREATED_WO', 'ORDER_ID_OLD'
      ],
      range: 1 // Skip header row (assuming row 0 is header)
    });

    console.log(`📊 Found ${jsonData.length} rows in XLSX`);

    let rowCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let successCount = 0;
    const batchSize = 100; // Reduced batch size for better error handling
    const results = [];

    // Process data
    for (const row of jsonData) {
      try {
        rowCount++;
        
        // Skip rows with missing critical data
        if (!row.ORDER_ID || row.ORDER_ID.toString().trim() === '') {
          skippedCount++;
          continue;
        }

        // Transform and clean data with length limits
        const cleanedRow = {
          order_id: cleanString(row.ORDER_ID, 50),
          regional: cleanString(row.REGIONAL, 10),
          witel: cleanString(row.WITEL, 150),
          datel: cleanString(row.DATEL, 150),
          sto: cleanString(row.STO, 100),
          extern_order_id: cleanString(row.EXTERN_ORDER_ID, 150),
          jenispsb: cleanString(row.JENISPSB, 100),
          type_trans: cleanString(row.TYPE_TRANS, 50),
          status_resume: cleanString(row.STATUS_RESUME, 300),
          status_message: cleanString(row.STATUS_MESSAGE),
          kcontact: cleanString(row.KCONTACT),
          order_date: parseExcelDate(row.ORDER_DATE),
          ncli: cleanString(row.NCLI, 100),
          ndem: cleanString(row.NDEM, 100),
          speedy: cleanString(row.SPEEDY, 100),
          pots: cleanString(row.POTS, 100),
          customer_name: cleanString(row.CUSTOMER_NAME, 300),
          contact_hp: cleanString(row.CONTACT_HP, 50),
          contact_email: cleanString(row.CONTACT_EMAIL, 255),
          ins_address: cleanString(row.INS_ADDRESS),
          customer_addr: cleanString(row.CUSTOMER_ADDR),
          city_name: cleanString(row.CITY_NAME, 150),
          gps_latitude: parseDecimal(row.GPS_LATITUDE),
          gps_longitude: parseDecimal(row.GPS_LONGITUDE),
          package_name: cleanString(row.PACKAGE_NAME), // No limit - using TEXT
          loc_id: cleanString(row.LOC_ID, 150),
          device_id: cleanString(row.DEVICE_ID), // No limit - using TEXT
          agent_id: cleanString(row.AGENT_ID, 150),
          last_updated_date: parseExcelDate(row.LAST_UPDATED_DATE),
          type_layanan: cleanString(row.TYPE_LAYANAN, 150),
          isi_comment: cleanString(row.ISI_COMMENT),
          tindak_lanjut: cleanString(row.TINDAK_LANJUT),
          user_id_tl: cleanString(row.USER_ID_TL, 150),
          tl_date: parseExcelDate(row.TL_DATE),
          tgl_proses: parseExcelDate(row.TGL_PROSES),
          tgl_manja: parseExcelDate(row.TGL_MANJA),
          hide: parseBoolean(row.HIDE),
          category: parseAsString(row.CATEGORY), // Keep as string for large numbers
          provider: cleanString(row.PROVIDER, 150),
          tgl_ps: parseExcelDate(row.TGL_PS),
          wonum: cleanString(row.WONUM, 150),
          detail_manja: cleanString(row.DETAIL_MANJA),
          lat_alpro: parseDecimal(row.LAT_ALPRO),
          long_alpro: parseDecimal(row.LONG_ALPRO),
          paket: parseAsString(row.PAKET), // Keep as string for large numbers
          channel: cleanString(row.CHANNEL, 150),
          kat_hvc: cleanString(row.KAT_HVC, 150),
          product: cleanString(row.PRODUCT, 300),
          tgl_created_wo: parseExcelDate(row.TGL_CREATED_WO),
          order_id_old: cleanString(row.ORDER_ID_OLD, 150)
        };

        results.push(cleanedRow);

        // Process in batches
        if (results.length >= batchSize) {
          const batchResult = await processBatch(results.splice(0, batchSize));
          successCount += batchResult.success;
          errorCount += batchResult.errors;
        }

        if (rowCount % 1000 === 0) {
          console.log(`📊 Processed ${rowCount} rows... (Success: ${successCount}, Errors: ${errorCount > 0 ? errorCount : 'None'})`);
        }

      } catch (error) {
        console.error(`❌ Error processing row ${rowCount}: ${error.message}`);
        errorCount++;
      }
    }

    // Process remaining data
    if (results.length > 0) {
      const batchResult = await processBatch(results);
      successCount += batchResult.success;
      errorCount += batchResult.errors;
    }

    console.log('\n🎉 Import completed!');
    console.log(`📊 Total rows processed: ${rowCount}`);
    console.log(`⏭️  Rows skipped: ${skippedCount}`);
    console.log(`✅ Successfully imported: ${successCount}`);
    console.log(`❌ Errors encountered: ${errorCount}`);
    console.log(`📈 Success rate: ${((successCount) / rowCount * 100).toFixed(2)}%`);

    // Show summary statistics
    await showSummaryStats();

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

// Process batch of records
async function processBatch(batch) {
  const client = await pool.connect();
  let successCount = 0;
  let errorCount = 0;
  
  try {
    // Process each record individually to avoid transaction rollback
    for (const row of batch) {
      try {
        const insertQuery = `
          INSERT INTO telkom_orders (
            order_id, regional, witel, datel, sto, extern_order_id, jenispsb, type_trans,
            status_resume, status_message, kcontact, order_date, ncli, ndem, speedy, pots,
            customer_name, contact_hp, contact_email, ins_address, customer_addr, city_name,
            gps_latitude, gps_longitude, package_name, loc_id, device_id, agent_id,
            last_updated_date, type_layanan, isi_comment, tindak_lanjut, user_id_tl,
            tl_date, tgl_proses, tgl_manja, hide, category, provider, tgl_ps, wonum,
            detail_manja, lat_alpro, long_alpro, paket, channel, kat_hvc, product,
            tgl_created_wo, order_id_old
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
            $45, $46, $47, $48, $49, $50
          ) ON CONFLICT (order_id) DO UPDATE SET
            updated_at = CURRENT_TIMESTAMP,
            status_resume = EXCLUDED.status_resume,
            last_updated_date = EXCLUDED.last_updated_date
        `;

        const values = [
          row.order_id, row.regional, row.witel, row.datel, row.sto, row.extern_order_id,
          row.jenispsb, row.type_trans, row.status_resume, row.status_message, row.kcontact,
          row.order_date, row.ncli, row.ndem, row.speedy, row.pots, row.customer_name,
          row.contact_hp, row.contact_email, row.ins_address, row.customer_addr, row.city_name,
          row.gps_latitude, row.gps_longitude, row.package_name, row.loc_id, row.device_id,
          row.agent_id, row.last_updated_date, row.type_layanan, row.isi_comment, row.tindak_lanjut,
          row.user_id_tl, row.tl_date, row.tgl_proses, row.tgl_manja, row.hide, row.category,
          row.provider, row.tgl_ps, row.wonum, row.detail_manja, row.lat_alpro, row.long_alpro,
          row.paket, row.channel, row.kat_hvc, row.product, row.tgl_created_wo, row.order_id_old
        ];

        await client.query(insertQuery, values);
        successCount++;
        
      } catch (err) {
        errorCount++;
        // Only log critical errors, suppress routine ones
        if (err.message.includes('duplicate key') || err.message.includes('constraint')) {
          if (errorCount <= 3) { // Only log first 3 constraint errors
            console.error(`❌ Database constraint error: ${err.message}`);
          }
        } else if (errorCount <= 5) { // Only log first 5 other errors
          console.error(`❌ Error inserting order ${row.order_id}: ${err.message}`);
          if (errorCount === 1) {
            console.error(`🔍 Sample data causing error:`, JSON.stringify(row, null, 2));
          }
        }
      }
    }

  } catch (error) {
    throw error;
  } finally {
    client.release();
  }
  
  return { success: successCount, errors: errorCount };
}

// Show summary statistics with cleaned package names
async function showSummaryStats() {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(DISTINCT regional) as regions,
        COUNT(DISTINCT witel) as witels,
        COUNT(DISTINCT city_name) as cities,
        COUNT(DISTINCT package_name) as packages,
        COUNT(CASE WHEN status_resume LIKE '%COMPLETE%' OR status_resume LIKE '%SUCCESS%' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status_resume LIKE '%PENDING%' OR status_resume LIKE '%WAIT%' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN order_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_orders
      FROM telkom_orders
    `);

    const regionalStats = await pool.query(`
      SELECT regional, COUNT(*) as order_count,
        ROUND(
          COUNT(CASE WHEN status_resume LIKE '%COMPLETE%' OR status_resume LIKE '%SUCCESS%' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 1
        ) as completion_rate
      FROM telkom_orders 
      WHERE regional IS NOT NULL
      GROUP BY regional 
      ORDER BY order_count DESC 
      LIMIT 10
    `);

    // Extract meaningful package names from complex strings
    const packageStats = await pool.query(`
      SELECT 
        CASE 
          -- JITU Packages
          WHEN package_name LIKE '%JITU 1 1P%30M%' OR package_name LIKE '%JITU%1P%30%' THEN 'JITU 1P 30 Mbps'
          WHEN package_name LIKE '%JITU 1 1P%40M%' OR package_name LIKE '%JITU%1P%40%' THEN 'JITU 1P 40 Mbps'
          WHEN package_name LIKE '%JITU 1 1P%50M%' OR package_name LIKE '%JITU%1P%50%' THEN 'JITU 1P 50 Mbps'
          WHEN package_name LIKE '%JITU 1 1P%75M%' OR package_name LIKE '%JITU%1P%75%' THEN 'JITU 1P 75 Mbps'
          WHEN package_name LIKE '%JITU 1 1P%100M%' OR package_name LIKE '%JITU%1P%100%' THEN 'JITU 1P 100 Mbps'
          WHEN package_name LIKE '%JITU 1 2P-TV%30%Disney%' OR package_name LIKE '%JITU%2P%TV%30%Disney%' THEN 'JITU 2P TV 30M Disney'
          WHEN package_name LIKE '%JITU 1 2P-TV%30%BigCombo%' OR package_name LIKE '%JITU%2P%TV%30%BigCombo%' THEN 'JITU 2P TV 30M BigCombo'
          WHEN package_name LIKE '%JITU 1 2P-TV%' OR package_name LIKE '%JITU%2P%TV%' THEN 'JITU 2P TV'
          WHEN package_name LIKE '%JITU 1 R 1P%' OR package_name LIKE '%JITU%R%1P%' THEN 'JITU Reseller 1P'
          WHEN package_name LIKE '%JITU%1P%' THEN 'JITU 1P (Other)'
          
          -- Indibiz/EBIS Packages  
          WHEN package_name LIKE '%HSI B2B%50M%' OR package_name LIKE '%EBIS%50%' OR package_name LIKE '%Indibiz%50%' THEN 'Indibiz HSI 50 Mbps'
          WHEN package_name LIKE '%HSI B2B%75M%' OR package_name LIKE '%EBIS%75%' OR package_name LIKE '%Indibiz%75%' THEN 'Indibiz HSI 75 Mbps'
          WHEN package_name LIKE '%HSI B2B%100M%' OR package_name LIKE '%EBIS%100%' OR package_name LIKE '%Indibiz%100%' THEN 'Indibiz HSI 100 Mbps'
          WHEN package_name LIKE '%HSI B2B%150M%' OR package_name LIKE '%EBIS%150%' OR package_name LIKE '%Indibiz%150%' THEN 'Indibiz HSI 150 Mbps'
          WHEN package_name LIKE '%HSI B2B%200M%' OR package_name LIKE '%EBIS%200%' OR package_name LIKE '%Indibiz%200%' THEN 'Indibiz HSI 200 Mbps'
          WHEN package_name LIKE '%HSI B2B%300M%' OR package_name LIKE '%EBIS%300%' OR package_name LIKE '%Indibiz%300%' THEN 'Indibiz HSI 300 Mbps'
          WHEN package_name LIKE '%Indibiz 2P Phone%' OR package_name LIKE '%EBIS%2P%Phone%' THEN 'Indibiz 2P Phone'
          WHEN package_name LIKE '%Indibiz 3P%' OR package_name LIKE '%EBIS%3P%' THEN 'Indibiz 3P'
          
          -- IndiHome Packages
          WHEN package_name LIKE '%IndiHome Gamer%20M%' THEN 'IndiHome Gamer 20M'
          WHEN package_name LIKE '%IndiHome Gamer%30M%' THEN 'IndiHome Gamer 30M'
          WHEN package_name LIKE '%IndiHome Gamer%' THEN 'IndiHome Gamer'
          WHEN package_name LIKE '%IndiHome 2P%50M%' THEN 'IndiHome 2P 50M'
          WHEN package_name LIKE '%IndiHome 2P%' THEN 'IndiHome 2P'
          WHEN package_name LIKE '%IndiHome+%50M%' THEN 'IndiHome+ 50M'
          WHEN package_name LIKE '%IndiHome+%30M%' THEN 'IndiHome+ 30M'
          WHEN package_name LIKE '%IndiHome+%' THEN 'IndiHome+'
          
          -- Other Telkom Packages
          WHEN package_name LIKE '%SooltanNet%2P%50M%' THEN 'SooltanNet 2P 50M'
          WHEN package_name LIKE '%SooltanNet%' THEN 'SooltanNet'
          WHEN package_name LIKE '%WiCo%50%' THEN 'WiCo 50 Mbps'
          WHEN package_name LIKE '%WiCo%' THEN 'WiCo Package'
          
          -- Upgrade packages
          WHEN package_name LIKE '%Upgrade HSI%300M%' THEN 'Upgrade HSI 300M'
          WHEN package_name LIKE '%Upgrade HSI%40M%' THEN 'Upgrade HSI 40M'
          WHEN package_name LIKE '%Upgrade HSI%30M%' THEN 'Upgrade HSI 30M'
          WHEN package_name LIKE '%Upgrade HSI%' THEN 'Upgrade HSI'
          
          -- PSB/Billing items (should be filtered out)
          WHEN package_name LIKE '%PSB%' AND package_name LIKE '%Biaya%' THEN 'PSB Fee Package'
          
          -- Simple speed formats (keep as-is)
          WHEN package_name ~ '^[0-9]+ Mbps' THEN package_name
          WHEN package_name ~ '^[0-9]+ Mbps,' THEN package_name
          
          -- Fallback for unmatched long strings
          ELSE CASE 
            WHEN LENGTH(package_name) > 100 THEN 'Other Complex Package'
            ELSE package_name
          END
        END as clean_package_name,
        COUNT(*) as order_count
      FROM telkom_orders 
      WHERE package_name IS NOT NULL
      GROUP BY 
        CASE 
          -- JITU Packages
          WHEN package_name LIKE '%JITU 1 1P%30M%' OR package_name LIKE '%JITU%1P%30%' THEN 'JITU 1P 30 Mbps'
          WHEN package_name LIKE '%JITU 1 1P%40M%' OR package_name LIKE '%JITU%1P%40%' THEN 'JITU 1P 40 Mbps'
          WHEN package_name LIKE '%JITU 1 1P%50M%' OR package_name LIKE '%JITU%1P%50%' THEN 'JITU 1P 50 Mbps'
          WHEN package_name LIKE '%JITU 1 1P%75M%' OR package_name LIKE '%JITU%1P%75%' THEN 'JITU 1P 75 Mbps'
          WHEN package_name LIKE '%JITU 1 1P%100M%' OR package_name LIKE '%JITU%1P%100%' THEN 'JITU 1P 100 Mbps'
          WHEN package_name LIKE '%JITU 1 2P-TV%30%Disney%' OR package_name LIKE '%JITU%2P%TV%30%Disney%' THEN 'JITU 2P TV 30M Disney'
          WHEN package_name LIKE '%JITU 1 2P-TV%30%BigCombo%' OR package_name LIKE '%JITU%2P%TV%30%BigCombo%' THEN 'JITU 2P TV 30M BigCombo'
          WHEN package_name LIKE '%JITU 1 2P-TV%' OR package_name LIKE '%JITU%2P%TV%' THEN 'JITU 2P TV'
          WHEN package_name LIKE '%JITU 1 R 1P%' OR package_name LIKE '%JITU%R%1P%' THEN 'JITU Reseller 1P'
          WHEN package_name LIKE '%JITU%1P%' THEN 'JITU 1P (Other)'
          
          -- Indibiz/EBIS Packages  
          WHEN package_name LIKE '%HSI B2B%50M%' OR package_name LIKE '%EBIS%50%' OR package_name LIKE '%Indibiz%50%' THEN 'Indibiz HSI 50 Mbps'
          WHEN package_name LIKE '%HSI B2B%75M%' OR package_name LIKE '%EBIS%75%' OR package_name LIKE '%Indibiz%75%' THEN 'Indibiz HSI 75 Mbps'
          WHEN package_name LIKE '%HSI B2B%100M%' OR package_name LIKE '%EBIS%100%' OR package_name LIKE '%Indibiz%100%' THEN 'Indibiz HSI 100 Mbps'
          WHEN package_name LIKE '%HSI B2B%150M%' OR package_name LIKE '%EBIS%150%' OR package_name LIKE '%Indibiz%150%' THEN 'Indibiz HSI 150 Mbps'
          WHEN package_name LIKE '%HSI B2B%200M%' OR package_name LIKE '%EBIS%200%' OR package_name LIKE '%Indibiz%200%' THEN 'Indibiz HSI 200 Mbps'
          WHEN package_name LIKE '%HSI B2B%300M%' OR package_name LIKE '%EBIS%300%' OR package_name LIKE '%Indibiz%300%' THEN 'Indibiz HSI 300 Mbps'
          WHEN package_name LIKE '%Indibiz 2P Phone%' OR package_name LIKE '%EBIS%2P%Phone%' THEN 'Indibiz 2P Phone'
          WHEN package_name LIKE '%Indibiz 3P%' OR package_name LIKE '%EBIS%3P%' THEN 'Indibiz 3P'
          
          -- IndiHome Packages
          WHEN package_name LIKE '%IndiHome Gamer%20M%' THEN 'IndiHome Gamer 20M'
          WHEN package_name LIKE '%IndiHome Gamer%30M%' THEN 'IndiHome Gamer 30M'
          WHEN package_name LIKE '%IndiHome Gamer%' THEN 'IndiHome Gamer'
          WHEN package_name LIKE '%IndiHome 2P%50M%' THEN 'IndiHome 2P 50M'
          WHEN package_name LIKE '%IndiHome 2P%' THEN 'IndiHome 2P'
          WHEN package_name LIKE '%IndiHome+%50M%' THEN 'IndiHome+ 50M'
          WHEN package_name LIKE '%IndiHome+%30M%' THEN 'IndiHome+ 30M'
          WHEN package_name LIKE '%IndiHome+%' THEN 'IndiHome+'
          
          -- Other Telkom Packages
          WHEN package_name LIKE '%SooltanNet%2P%50M%' THEN 'SooltanNet 2P 50M'
          WHEN package_name LIKE '%SooltanNet%' THEN 'SooltanNet'
          WHEN package_name LIKE '%WiCo%50%' THEN 'WiCo 50 Mbps'
          WHEN package_name LIKE '%WiCo%' THEN 'WiCo Package'
          
          -- Upgrade packages
          WHEN package_name LIKE '%Upgrade HSI%300M%' THEN 'Upgrade HSI 300M'
          WHEN package_name LIKE '%Upgrade HSI%40M%' THEN 'Upgrade HSI 40M'
          WHEN package_name LIKE '%Upgrade HSI%30M%' THEN 'Upgrade HSI 30M'
          WHEN package_name LIKE '%Upgrade HSI%' THEN 'Upgrade HSI'
          
          -- PSB/Billing items (should be filtered out)
          WHEN package_name LIKE '%PSB%' AND package_name LIKE '%Biaya%' THEN 'PSB Fee Package'
          
          -- Simple speed formats (keep as-is)
          WHEN package_name ~ '^[0-9]+ Mbps' THEN package_name
          WHEN package_name ~ '^[0-9]+ Mbps,' THEN package_name
          
          -- Fallback for unmatched long strings
          ELSE CASE 
            WHEN LENGTH(package_name) > 100 THEN 'Other Complex Package'
            ELSE package_name
          END
        END
      HAVING COUNT(*) > 1  -- Only show packages with more than 1 order
      ORDER BY order_count DESC 
      LIMIT 15
    `);

    console.log('\n📈 DATABASE SUMMARY:');
    console.log('==================');
    console.log(`Total Orders: ${stats.rows[0].total_orders}`);
    console.log(`Regions: ${stats.rows[0].regions}`);
    console.log(`Witels: ${stats.rows[0].witels}`);
    console.log(`Cities: ${stats.rows[0].cities}`);
    console.log(`Package Types: ${stats.rows[0].packages}`);
    console.log(`Completed Orders: ${stats.rows[0].completed_orders}`);
    console.log(`Pending Orders: ${stats.rows[0].pending_orders}`);
    console.log(`Recent Orders (30d): ${stats.rows[0].recent_orders}`);

    console.log('\n🗺️  TOP REGIONS BY ORDER COUNT:');
    console.log('==============================');
    regionalStats.rows.forEach((region, index) => {
      console.log(`${index + 1}. Region ${region.regional}: ${region.order_count} orders (${region.completion_rate}% completion)`);
    });

    console.log('\n📦 TOP PACKAGES:');
    console.log('================');
    packageStats.rows.forEach((pkg, index) => {
      console.log(`${index + 1}. ${pkg.clean_package_name}: ${pkg.order_count} orders`);
    });

  } catch (error) {
    console.error('❌ Error getting summary stats:', error);
  }
}

// Validate XLSX structure
async function validateXLSX(xlsxFilePath) {
  try {
    console.log('🔍 Validating XLSX structure...');
    
    if (!fs.existsSync(xlsxFilePath)) {
      throw new Error(`File not found: ${xlsxFilePath}`);
    }

    const workbook = XLSX.readFile(xlsxFilePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const totalRows = range.e.r + 1;
    const totalCols = range.e.c + 1;
    
    console.log(`📊 Sheet: ${sheetName}`);
    console.log(`📊 Dimensions: ${totalRows} rows x ${totalCols} columns`);
    
    // Get sample data
    const sampleData = XLSX.utils.sheet_to_json(sheet, { range: 1, header: 1 });
    
    return {
      valid: true,
      sheetName,
      totalRows,
      totalCols,
      sampleData: sampleData[0] || {},
      message: 'XLSX structure validated successfully'
    };
    
  } catch (error) {
    throw new Error(`XLSX validation failed: ${error.message}`);
  }
}

// CLI execution
if (require.main === module) {
  const xlsxFilePath = process.argv[2];
  const silentMode = process.argv.includes('--silent');
  
  if (!xlsxFilePath) {
    console.error('❌ Please provide XLSX file path');
    console.log('Usage: node importTelkomData.js <xlsx-file-path> [--clear] [--validate] [--silent]');
    console.log('Examples:');
    console.log('  node importTelkomData.js ./data/SALES_ORDER.xlsx --clear');
    console.log('  node importTelkomData.js ./data/SALES_ORDER.xlsx --clear --silent');
    console.log('  node importTelkomData.js ./data/SALES_ORDER.xlsx --validate');
    process.exit(1);
  }

  const validateOnly = process.argv.includes('--validate');

  async function main() {
    try {
      if (validateOnly) {
        const validation = await validateXLSX(xlsxFilePath);
        console.log('✅ XLSX validation completed:', validation);
        return;
      }

      // Suppress detailed output in silent mode
      if (silentMode) {
        const originalLog = console.log;
        console.log = (msg) => {
          // Only show important messages in silent mode
          if (msg.includes('🚀 Starting') || 
              msg.includes('🎉 Import completed') || 
              msg.includes('✅ Successfully imported') || 
              msg.includes('❌ Process failed') ||
              msg.includes('Success rate')) {
            originalLog(msg);
          }
        };
      }

      await importXLSXData(xlsxFilePath);
      console.log('🎉 Import process completed successfully!');
      
    } catch (error) {
      console.error('❌ Process failed:', error.message);
      process.exit(1);
    } finally {
      await pool.end();
    }
  }

  main();
}

module.exports = { importXLSXData, validateXLSX };