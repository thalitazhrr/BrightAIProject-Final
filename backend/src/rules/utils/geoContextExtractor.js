/**
 * geoContextExtractor.js
 *
 * Parses user input to detect geographic scope:
 *   - nasional  → no WHERE filter (return all regions)
 *   - regional  → AND {regional_col} = 'REGIONAL X'
 *   - witel     → AND {witel_col}    = 'WITEL_NAME'
 *
 * NOTE: The dbValue strings below must match the EXACT values stored in each
 * database column. Verify against the actual Oracle tables if needed.
 */

// ── Per-database geographic column names ────────────────────────────────────
const DB_GEO_COLUMNS = {
  BRIGHTAI_SALES:    { regional: 'REGIONAL',      witel: 'WITEL' },
  BRIGHTAI_REVENUE:  { regional: 'REGIONAL_BILL', witel: 'WITEL_BILL' },
  BRIGHTAI_TARGET:   { regional: 'TREG',          witel: 'WITEL' },
  BRIGHTAI_CT0_NAL:  { regional: 'REGIONAL',      witel: 'WITEL' },
  BRIGHTAI_DAPROS:   { regional: 'REGIONAL',      witel: 'WITEL' },
  DADBS:             { regional: 'REGIONAL',      witel: 'WITEL' },
};

// ── Regional number patterns ─────────────────────────────────────────────────
// Each entry: user-input patterns → base dbValue
// BRIGHTAI_TARGET uses TREG with a different format; see getDbValue() below.
const REGIONAL_PATTERNS = [
  {
    patterns: ['regional 1', 'reg 1', 'reg1', 'treg 1', 'treg1', 'divisi 1', 'div1', 'regional1'],
    dbValue: 'REGIONAL 1',
    tregValue: 'TREG 1',
    label: 'Regional 1',
  },
  {
    patterns: ['regional 2', 'reg 2', 'reg2', 'treg 2', 'treg2', 'divisi 2', 'div2', 'regional2'],
    dbValue: 'REGIONAL 2',
    tregValue: 'TREG 2',
    label: 'Regional 2',
  },
  {
    patterns: ['regional 3', 'reg 3', 'reg3', 'treg 3', 'treg3', 'divisi 3', 'div3', 'regional3'],
    dbValue: 'REGIONAL 3',
    tregValue: 'TREG 3',
    label: 'Regional 3',
  },
  {
    patterns: ['regional 4', 'reg 4', 'reg4', 'treg 4', 'treg4', 'divisi 4', 'div4', 'regional4'],
    dbValue: 'REGIONAL 4',
    tregValue: 'TREG 4',
    label: 'Regional 4',
  },
  {
    patterns: ['regional 5', 'reg 5', 'reg5', 'treg 5', 'treg5', 'divisi 5', 'div5', 'regional5'],
    dbValue: 'REGIONAL 5',
    tregValue: 'TREG 5',
    label: 'Regional 5',
  },
];

// ── Witel name patterns ───────────────────────────────────────────────────────
// Map common user-typed names → DB column value (adjust if actual values differ)
const WITEL_PATTERNS = [
  // REG 1 – Sumatera
  { patterns: ['aceh'],                                        dbValue: 'ACEH',                    label: 'Witel Aceh' },
  { patterns: ['sumut', 'sumatera utara', 'medan'],            dbValue: 'SUMUT',                   label: 'Witel Sumut' },
  { patterns: ['sumbar jambi', 'sumbar', 'sumatera barat',
               'padang', 'jambi'],                             dbValue: 'SUMBAR JAMBI',             label: 'Witel Sumbar Jambi' },
  { patterns: ['riau', 'pekanbaru'],                           dbValue: 'RIAU',                    label: 'Witel Riau' },
  { patterns: ['sumbagsel', 'sumatera bagian selatan',
               'palembang'],                                   dbValue: 'SUMBAGSEL',               label: 'Witel Sumbagsel' },
  { patterns: ['lampung bengkulu', 'lampung', 'bengkulu',
               'bandar lampung'],                              dbValue: 'LAMPUNG BENGKULU',         label: 'Witel Lampung Bengkulu' },
  // REG 2 – Jabodetabek & Jawa Barat
  { patterns: ['banten', 'serang', 'cilegon'],                 dbValue: 'BANTEN',                  label: 'Witel Banten' },
  { patterns: ['bekasi karawang', 'bekasi', 'karawang'],       dbValue: 'BEKASI KARAWANG',          label: 'Witel Bekasi Karawang' },
  { patterns: ['bandung'],                                     dbValue: 'BANDUNG',                 label: 'Witel Bandung' },
  { patterns: ['jakarta centrum', 'jakarta selatan',
               'jaksel'],                                      dbValue: 'JAKARTA CENTRUM',          label: 'Witel Jakarta Centrum' },
  { patterns: ['jakarta inner', 'jakarta pusat', 'jakpus'],    dbValue: 'JAKARTA INNER',            label: 'Witel Jakarta Inner' },
  { patterns: ['jakarta outer', 'jakarta utara', 'jakut',
               'jakarta barat', 'jakbar'],                     dbValue: 'JAKARTA OUTER',            label: 'Witel Jakarta Outer' },
  { patterns: ['priangan barat', 'pribar', 'tasikmalaya'],     dbValue: 'PRIANGAN BARAT',           label: 'Witel Priangan Barat' },
  { patterns: ['priangan timur', 'pritim', 'cirebon'],         dbValue: 'PRIANGAN TIMUR',           label: 'Witel Priangan Timur' },
  // REG 3 – Jawa & Bali
  { patterns: ['bali', 'denpasar'],                            dbValue: 'BALI',                    label: 'Witel Bali' },
  { patterns: ['jatim barat', 'surabaya barat'],               dbValue: 'JATIM BARAT',              label: 'Witel Jatim Barat' },
  { patterns: ['jatim timur', 'surabaya timur', 'surabaya'],   dbValue: 'JATIM TIMUR',              label: 'Witel Jatim Timur' },
  { patterns: ['nusa tenggara', 'ntb', 'ntt', 'lombok',
               'kupang', 'mataram'],                           dbValue: 'NUSA TENGGARA',            label: 'Witel Nusa Tenggara' },
  { patterns: ['semarang jateng utara', 'semarang',
               'jateng utara'],                                dbValue: 'SEMARANG JATENG UTARA',    label: 'Witel Semarang Jateng Utara' },
  { patterns: ['solo jateng timur', 'solo', 'jateng timur'],   dbValue: 'SOLO JATENG TIMUR',        label: 'Witel Solo Jateng Timur' },
  { patterns: ['suramadu', 'madura'],                          dbValue: 'SURAMADU',                label: 'Witel Suramadu' },
  { patterns: ['yogya jateng selatan', 'yogya', 'yogyakarta',
               'jateng selatan', 'jogja'],                     dbValue: 'YOGYA JATENG SELATAN',     label: 'Witel Yogya Jateng Selatan' },
  // REG 4 – Kalimantan
  { patterns: ['balikpapan'],                                  dbValue: 'BALIKPAPAN',              label: 'Witel Balikpapan' },
  { patterns: ['kalbar', 'kalimantan barat', 'pontianak'],     dbValue: 'KALBAR',                  label: 'Witel Kalbar' },
  { patterns: ['kalselteng', 'kalimantan selatan',
               'banjarmasin'],                                 dbValue: 'KALSELTENG',              label: 'Witel Kalselteng' },
  { patterns: ['kaltimtara', 'kaltara', 'tarakan',
               'samarinda'],                                   dbValue: 'KALTIMTARA',              label: 'Witel Kaltimtara' },
  // REG 5 – Sulawesi & Papua
  { patterns: ['papua barat', 'manokwari'],                    dbValue: 'PAPUA BARAT',             label: 'Witel Papua Barat' },
  { patterns: ['papua', 'jayapura'],                           dbValue: 'PAPUA',                   label: 'Witel Papua' },
  { patterns: ['sulbagsel', 'sulawesi selatan', 'makassar'],   dbValue: 'SULBAGSEL',               label: 'Witel Sulbagsel' },
  { patterns: ['sulbagteng', 'sulawesi tengah', 'palu'],       dbValue: 'SULBAGTENG',              label: 'Witel Sulbagteng' },
  { patterns: ['sumalut', 'sulut', 'malut', 'sulawesi utara',
               'manado', 'ternate'],                           dbValue: 'SUMALUT',                 label: 'Witel Sumalut' },
];

// ── Nasional keywords ─────────────────────────────────────────────────────────
const NASIONAL_PATTERNS = [
  'nasional', 'national', 'seluruh indonesia', 'semua regional', 'all regional',
  'seluruh wilayah', 'total nasional', 'level nasional',
];

// ── Main extractor ────────────────────────────────────────────────────────────

/**
 * Extracts geographic scope from a user's query string.
 * Returns: { scope: 'nasional'|'regional'|'witel', dbValue: string|null, label: string }
 */
function extractGeoContext(userInput) {
  const input = userInput.toLowerCase().trim();

  // 1. Explicit nasional keywords
  if (NASIONAL_PATTERNS.some(p => input.includes(p))) {
    return { scope: 'nasional', dbValue: null, label: 'Nasional' };
  }

  // 2. Regional number match (check before witel to avoid partial matches)
  for (const reg of REGIONAL_PATTERNS) {
    if (reg.patterns.some(p => input.includes(p))) {
      return { scope: 'regional', dbValue: reg.dbValue, tregValue: reg.tregValue, label: reg.label };
    }
  }

  // 3. Witel match
  for (const witel of WITEL_PATTERNS) {
    if (witel.patterns.some(p => input.includes(p))) {
      return { scope: 'witel', dbValue: witel.dbValue, label: witel.label };
    }
  }

  // Default: no filter (treat as nasional)
  return { scope: 'nasional', dbValue: null, label: 'Nasional' };
}

/**
 * Returns the correct database column value for the geographic context,
 * taking into account per-database column naming differences.
 */
function getDbValue(geoContext, database) {
  if (!geoContext || geoContext.scope === 'nasional') return null;

  // BRIGHTAI_TARGET stores regional as TREG with 'TREG X' format
  if (geoContext.scope === 'regional' && database === 'BRIGHTAI_TARGET') {
    return geoContext.tregValue || geoContext.dbValue;
  }

  return geoContext.dbValue;
}

/**
 * Returns the geo column configuration for a given database name.
 */
function getGeoColumns(database) {
  return DB_GEO_COLUMNS[database] || DB_GEO_COLUMNS.BRIGHTAI_SALES;
}

module.exports = { extractGeoContext, getDbValue, getGeoColumns, DB_GEO_COLUMNS };
