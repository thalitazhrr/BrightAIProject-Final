const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_012',
    RULE_NAME: 'growth_trend_analysis',
    DESCRIPTION: 'Analisis tren pertumbuhan HSI dengan multiple timeframes dan klasifikasi produk menggunakan identifikasi customer-order-layanan yang akurat',
    DATABASE: 'BRIGHTAI_SALES',
    CATEGORY: 'ORDER_ANALYSIS',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_SALES"),

  KEYWORD_PATTERNS: {
    primary: [
      'tren pertumbuhan', 'growth trend', 'momentum bisnis', 'growth momentum',
      'perkembangan hsi', 'hsi growth', 'pertumbuhan order', 'order growth',
      'analisis tren', 'trend analysis', 'proyeksi growth', 'growth projection',
      'pola pertumbuhan', 'growth pattern', 'momentum penjualan', 'sales momentum'
    ],
    
    supporting: [
      'pertumbuhan', 'growth', 'peningkatan', 'kenaikan', 'ekspansi',
      'penurunan', 'decline', 'stagnasi', 'momentum', 'velocity',
      'bulanan', 'monthly', 'mingguan', 'weekly', 'harian', 'daily',
      'periode', 'period', 'jangka waktu', 'timeframe',
      'bisnis', 'business', 'performa', 'performance', 'trend', 'trajectory'
    ],

    calculateConfidence: function(input) {
      const lowerInput = input.toLowerCase();
      let score = 0;
      
      const primaryMatches = this.primary.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      
      const supportingMatches = this.supporting.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      
      if (primaryMatches > 0) {
        score = 75 + (primaryMatches * 15) + (supportingMatches * 2);
      } else if (lowerInput.includes('tren') || lowerInput.includes('trend')) {
        score = 65;
      } else if (lowerInput.includes('pertumbuhan') || lowerInput.includes('growth')) {
        score = 70;
      }
      
      return Math.min(score, 100);
    }
  },

    SQL_QUERY: `
    WITH HSI_CLASSIFICATION AS (
        SELECT 
            ORDER_ID,
            NCLI,
            ND_HSI,
            REGIONAL,
            WITEL,
            DATEL,
            STO,
            ORDER_DATE,
            JENISPSB,
            TYPE_TRANS,
            PACKAGE_NAME,
            PRODUCT,
            BW,
            STATUS_RESUME,
            EKOSISTEM,
            PROVIDER,
            ND_VOICE,
            TGL_PSB,
            LAST_UPDATED_DATE,
            
            CASE 
                WHEN UPPER(PRODUCT) = 'WMS' THEN 0
                WHEN (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%')
                     AND NOT (UPPER(PACKAGE_NAME) LIKE '%HSIEF%' 
                             OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                             OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                THEN 1 
                ELSE 0 
            END as IS_HSI_BISNIS,
            
            CASE 
                WHEN UPPER(PRODUCT) = 'WMS' THEN 0
                WHEN (UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                THEN 1 
                ELSE 0 
            END as IS_HSI_BASIC,
            
            CASE 
                WHEN UPPER(JENISPSB) = 'AO' 
                     AND (UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS BUNDLING %'
                         OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS BASIC BUNDLING %'
                         OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ 2S %')
                     AND PACKAGE_NAME NOT LIKE '%Non%'
                     AND PACKAGE_NAME NOT LIKE '%Add-on%'
                THEN 'Hard Bundling'
                
                WHEN UPPER(JENISPSB) = 'AO'
                     AND PACKAGE_NAME NOT LIKE '%Non%'
                     AND (UPPER(PACKAGE_NAME) LIKE '%HSIE%'
                         OR UPPER(PACKAGE_NAME) LIKE '%BUNDLING%'
                         OR PACKAGE_NAME LIKE '%;%')
                THEN 'Bundling A La Carte'
                
                WHEN UPPER(JENISPSB) IN ('MO', 'AS')
                     AND PACKAGE_NAME NOT LIKE '%Non%'
                THEN 'Add or Modify Service'
                
                ELSE 'Non Bundling'
            END as BUNDLING_TYPE,
            
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%SEKOLAH%' THEN 1 ELSE 0 END as IS_PIJAR_SEKOLAH,
            
            CASE WHEN (UPPER(PACKAGE_NAME) LIKE '%OCAINT%'
                      OR UPPER(PACKAGE_NAME) LIKE '%2S OCA%'
                      OR UPPER(PACKAGE_NAME) LIKE '%INTERACTION%'
                      OR UPPER(PACKAGE_NAME) LIKE '%BUNDLING OCA%')
                 THEN 1 ELSE 0 END as IS_OCA_INTERACTION,
                 
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%BLAST%'
                      AND NOT (UPPER(PACKAGE_NAME) LIKE '%OCAINT%'
                              OR UPPER(PACKAGE_NAME) LIKE '%2S OCA%'
                              OR UPPER(PACKAGE_NAME) LIKE '%INTERACTION%'
                              OR UPPER(PACKAGE_NAME) LIKE '%BUNDLING OCA%')
                 THEN 1 ELSE 0 END as IS_OCA_BLAST,
                 
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%NETMONK%' THEN 1 ELSE 0 END as IS_NETMONK,
            
            CASE WHEN ND_VOICE IS NOT NULL AND TRIM(ND_VOICE) != '' THEN 1 ELSE 0 END as HAS_VOICE,
            
            CASE 
                WHEN TYPE_TRANS = 'NEW SALES' THEN 'PERTUMBUHAN_ORGANIK'
                WHEN TYPE_TRANS = 'ADD SERVICE' THEN 'EKSPANSI_EXISTING' 
                WHEN TYPE_TRANS IN ('DO', 'SO') THEN 'CHURN_ACTIVITY'
                ELSE 'OPERASIONAL_LAINNYA'
            END as KATEGORI_TRANSAKSI,
            
            CASE 
                WHEN UPPER(NVL(PROVIDER, 'OTHERS')) LIKE '%DES%' THEN 'ENTERPRISE_SERVICES'
                WHEN UPPER(NVL(PROVIDER, 'OTHERS')) LIKE '%DGS%' THEN 'GOVERNMENT_SERVICES' 
                WHEN UPPER(NVL(PROVIDER, 'OTHERS')) LIKE '%DBS%' THEN 'BUSINESS_SERVICES'
                WHEN UPPER(NVL(PROVIDER, 'OTHERS')) LIKE '%RBS%' THEN 'REGIONAL_BUSINESS'
                ELSE 'OTHERS'
            END as KATEGORI_PROVIDER,
            
            CASE 
                WHEN LAST_UPDATED_DATE IS NOT NULL 
                     AND MONTHS_BETWEEN(SYSDATE, TO_DATE(LAST_UPDATED_DATE, 'YYYY-MM-DD')) >= 6 
                THEN 1 ELSE 0 
            END as POTENTIAL_CHURN_RISK
            
        FROM DWH_MOIS.BRIGHTAI_SALES
        WHERE ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
          AND ORDER_ID IS NOT NULL
          AND NCLI IS NOT NULL
          AND ND_HSI IS NOT NULL
    ),
    
    DAILY_AGGREGATES AS (
        SELECT 
            TRUNC(ORDER_DATE) as ORDER_DAY,
            
            COUNT(DISTINCT ORDER_ID) as DAILY_TOTAL_ORDERS,
            COUNT(DISTINCT NCLI) as DAILY_TOTAL_CUSTOMERS,
            COUNT(DISTINCT ND_HSI) as DAILY_TOTAL_SERVICES,
            
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as DAILY_ORDER_PER_CUSTOMER,
            ROUND(COUNT(DISTINCT ND_HSI) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as DAILY_SERVICE_PER_CUSTOMER,
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT ND_HSI), 0), 2) as DAILY_ORDER_PER_SERVICE,
            
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as DAILY_TOTAL_HSI_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as DAILY_HSI_BISNIS_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as DAILY_HSI_BASIC_ORDERS,
            
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) as DAILY_TOTAL_HSI_CUSTOMERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN NCLI END) as DAILY_HSI_BISNIS_CUSTOMERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN NCLI END) as DAILY_HSI_BASIC_CUSTOMERS,
            
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) as DAILY_TOTAL_HSI_SERVICES,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ND_HSI END) as DAILY_HSI_BISNIS_SERVICES,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ND_HSI END) as DAILY_HSI_BASIC_SERVICES,
            
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as DAILY_HARD_BUNDLING_ORDERS,
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE IN ('Hard Bundling', 'Bundling A La Carte') THEN ORDER_ID END) as DAILY_TOTAL_BUNDLING_ORDERS,
            
            COUNT(DISTINCT CASE WHEN (IS_PIJAR_SEKOLAH = 1 OR IS_OCA_INTERACTION = 1 OR 
                            IS_OCA_BLAST = 1 OR IS_NETMONK = 1) THEN ORDER_ID END) as DAILY_DIGITAL_ORDERS,
            
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND HAS_VOICE = 1 THEN ORDER_ID END) as DAILY_VOICE_COMBO_ORDERS,
            
            COUNT(DISTINCT CASE WHEN KATEGORI_TRANSAKSI = 'PERTUMBUHAN_ORGANIK' THEN ORDER_ID END) as DAILY_ORGANIC_GROWTH_ORDERS,
            COUNT(DISTINCT CASE WHEN KATEGORI_TRANSAKSI = 'EKSPANSI_EXISTING' THEN ORDER_ID END) as DAILY_EXPANSION_ORDERS,
            COUNT(DISTINCT CASE WHEN KATEGORI_TRANSAKSI = 'CHURN_ACTIVITY' THEN ORDER_ID END) as DAILY_CHURN_ORDERS,
            
            COUNT(DISTINCT CASE WHEN KATEGORI_PROVIDER = 'ENTERPRISE_SERVICES' THEN ORDER_ID END) as DAILY_ENTERPRISE_ORDERS,
            COUNT(DISTINCT CASE WHEN KATEGORI_PROVIDER = 'GOVERNMENT_SERVICES' THEN ORDER_ID END) as DAILY_GOVERNMENT_ORDERS,
            COUNT(DISTINCT CASE WHEN KATEGORI_PROVIDER = 'BUSINESS_SERVICES' THEN ORDER_ID END) as DAILY_BUSINESS_ORDERS,
            
            COUNT(DISTINCT CASE WHEN POTENTIAL_CHURN_RISK = 1 THEN ORDER_ID END) as DAILY_CHURN_RISK_ORDERS,
            
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                     AND CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) > 0
                THEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) END) as DAILY_AVG_BANDWIDTH_KBPS,
            
            COUNT(DISTINCT REGIONAL) as DAILY_REGIONAL_ACTIVITY,
            COUNT(DISTINCT WITEL) as DAILY_WITEL_ACTIVITY
            
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
        GROUP BY TRUNC(ORDER_DATE)
    ),
    
    WEEKLY_AGGREGATES AS (
        SELECT 
            TO_CHAR(ORDER_DAY, 'IYYY-IW') as WEEK_PERIOD,
            TRUNC(ORDER_DAY, 'IW') as WEEK_START,
            
            SUM(DAILY_TOTAL_ORDERS) as WEEKLY_TOTAL_ORDERS,
            SUM(DAILY_TOTAL_CUSTOMERS) as WEEKLY_TOTAL_CUSTOMERS,
            SUM(DAILY_TOTAL_SERVICES) as WEEKLY_TOTAL_SERVICES,
            AVG(DAILY_ORDER_PER_CUSTOMER) as WEEKLY_AVG_ORDER_PER_CUSTOMER,
            AVG(DAILY_SERVICE_PER_CUSTOMER) as WEEKLY_AVG_SERVICE_PER_CUSTOMER,
            AVG(DAILY_ORDER_PER_SERVICE) as WEEKLY_AVG_ORDER_PER_SERVICE,
            
            SUM(DAILY_TOTAL_HSI_ORDERS) as WEEKLY_TOTAL_HSI_ORDERS,
            SUM(DAILY_HSI_BISNIS_ORDERS) as WEEKLY_HSI_BISNIS_ORDERS,
            SUM(DAILY_HSI_BASIC_ORDERS) as WEEKLY_HSI_BASIC_ORDERS,
            SUM(DAILY_TOTAL_HSI_CUSTOMERS) as WEEKLY_TOTAL_HSI_CUSTOMERS,
            SUM(DAILY_HSI_BISNIS_CUSTOMERS) as WEEKLY_HSI_BISNIS_CUSTOMERS,
            SUM(DAILY_HSI_BASIC_CUSTOMERS) as WEEKLY_HSI_BASIC_CUSTOMERS,
            SUM(DAILY_TOTAL_HSI_SERVICES) as WEEKLY_TOTAL_HSI_SERVICES,
            SUM(DAILY_HSI_BISNIS_SERVICES) as WEEKLY_HSI_BISNIS_SERVICES,
            SUM(DAILY_HSI_BASIC_SERVICES) as WEEKLY_HSI_BASIC_SERVICES,
            
            SUM(DAILY_TOTAL_BUNDLING_ORDERS) as WEEKLY_BUNDLING_ORDERS,
            SUM(DAILY_DIGITAL_ORDERS) as WEEKLY_DIGITAL_ORDERS,
            SUM(DAILY_VOICE_COMBO_ORDERS) as WEEKLY_VOICE_COMBO_ORDERS,
            
            SUM(DAILY_ORGANIC_GROWTH_ORDERS) as WEEKLY_ORGANIC_GROWTH_ORDERS,
            SUM(DAILY_EXPANSION_ORDERS) as WEEKLY_EXPANSION_ORDERS,
            SUM(DAILY_CHURN_ORDERS) as WEEKLY_CHURN_ORDERS,
            
            SUM(DAILY_ENTERPRISE_ORDERS) as WEEKLY_ENTERPRISE_ORDERS,
            SUM(DAILY_GOVERNMENT_ORDERS) as WEEKLY_GOVERNMENT_ORDERS,
            SUM(DAILY_BUSINESS_ORDERS) as WEEKLY_BUSINESS_ORDERS,
            
            SUM(DAILY_CHURN_RISK_ORDERS) as WEEKLY_CHURN_RISK_ORDERS,
            
            AVG(DAILY_AVG_BANDWIDTH_KBPS) as WEEKLY_AVG_BANDWIDTH_KBPS,
            MAX(DAILY_REGIONAL_ACTIVITY) as WEEKLY_MAX_REGIONAL_ACTIVITY,
            
            SUM(DAILY_HSI_BISNIS_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as WEEKLY_BISNIS_MIX_PCT,
            SUM(DAILY_TOTAL_BUNDLING_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as WEEKLY_BUNDLING_RATE_PCT,
            SUM(DAILY_DIGITAL_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as WEEKLY_DIGITAL_RATE_PCT,
            
            SUM(DAILY_ORGANIC_GROWTH_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as WEEKLY_ORGANIC_GROWTH_PCT,
            SUM(DAILY_EXPANSION_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as WEEKLY_EXPANSION_PCT,
            SUM(DAILY_CHURN_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as WEEKLY_CHURN_PCT
            
        FROM DAILY_AGGREGATES
        GROUP BY TO_CHAR(ORDER_DAY, 'IYYY-IW'), TRUNC(ORDER_DAY, 'IW')
    ),
    
    MONTHLY_AGGREGATES AS (
        SELECT 
            TO_CHAR(ORDER_DAY, 'YYYY-MM') as MONTH_PERIOD,
            TRUNC(ORDER_DAY, 'MM') as MONTH_START,
            
            SUM(DAILY_TOTAL_ORDERS) as MONTHLY_TOTAL_ORDERS,
            SUM(DAILY_TOTAL_CUSTOMERS) as MONTHLY_TOTAL_CUSTOMERS,
            SUM(DAILY_TOTAL_SERVICES) as MONTHLY_TOTAL_SERVICES,
            AVG(DAILY_ORDER_PER_CUSTOMER) as MONTHLY_AVG_ORDER_PER_CUSTOMER,
            AVG(DAILY_SERVICE_PER_CUSTOMER) as MONTHLY_AVG_SERVICE_PER_CUSTOMER,
            AVG(DAILY_ORDER_PER_SERVICE) as MONTHLY_AVG_ORDER_PER_SERVICE,
            
            SUM(DAILY_TOTAL_HSI_ORDERS) as MONTHLY_TOTAL_HSI_ORDERS,
            SUM(DAILY_HSI_BISNIS_ORDERS) as MONTHLY_HSI_BISNIS_ORDERS,
            SUM(DAILY_HSI_BASIC_ORDERS) as MONTHLY_HSI_BASIC_ORDERS,
            SUM(DAILY_TOTAL_HSI_CUSTOMERS) as MONTHLY_TOTAL_HSI_CUSTOMERS,
            SUM(DAILY_HSI_BISNIS_CUSTOMERS) as MONTHLY_HSI_BISNIS_CUSTOMERS,
            SUM(DAILY_HSI_BASIC_CUSTOMERS) as MONTHLY_HSI_BASIC_CUSTOMERS,
            SUM(DAILY_TOTAL_HSI_SERVICES) as MONTHLY_TOTAL_HSI_SERVICES,
            SUM(DAILY_HSI_BISNIS_SERVICES) as MONTHLY_HSI_BISNIS_SERVICES,
            SUM(DAILY_HSI_BASIC_SERVICES) as MONTHLY_HSI_BASIC_SERVICES,
            
            SUM(DAILY_TOTAL_BUNDLING_ORDERS) as MONTHLY_BUNDLING_ORDERS,
            SUM(DAILY_DIGITAL_ORDERS) as MONTHLY_DIGITAL_ORDERS,
            SUM(DAILY_VOICE_COMBO_ORDERS) as MONTHLY_VOICE_COMBO_ORDERS,
            
            SUM(DAILY_ORGANIC_GROWTH_ORDERS) as MONTHLY_ORGANIC_GROWTH_ORDERS,
            SUM(DAILY_EXPANSION_ORDERS) as MONTHLY_EXPANSION_ORDERS,
            SUM(DAILY_CHURN_ORDERS) as MONTHLY_CHURN_ORDERS,
            
            SUM(DAILY_ENTERPRISE_ORDERS) as MONTHLY_ENTERPRISE_ORDERS,
            SUM(DAILY_GOVERNMENT_ORDERS) as MONTHLY_GOVERNMENT_ORDERS,
            SUM(DAILY_BUSINESS_ORDERS) as MONTHLY_BUSINESS_ORDERS,
            
            SUM(DAILY_CHURN_RISK_ORDERS) as MONTHLY_CHURN_RISK_ORDERS,
            
            AVG(DAILY_AVG_BANDWIDTH_KBPS) as MONTHLY_AVG_BANDWIDTH_KBPS,
            MAX(DAILY_REGIONAL_ACTIVITY) as MONTHLY_MAX_REGIONAL_ACTIVITY,
            
            SUM(DAILY_HSI_BISNIS_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as MONTHLY_BISNIS_MIX_PCT,
            SUM(DAILY_TOTAL_BUNDLING_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as MONTHLY_BUNDLING_RATE_PCT,
            SUM(DAILY_DIGITAL_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as MONTHLY_DIGITAL_RATE_PCT,
            
            SUM(DAILY_ORGANIC_GROWTH_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as MONTHLY_ORGANIC_GROWTH_PCT,
            SUM(DAILY_EXPANSION_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as MONTHLY_EXPANSION_PCT,
            SUM(DAILY_CHURN_ORDERS) * 100.0 / NULLIF(SUM(DAILY_TOTAL_HSI_ORDERS), 0) as MONTHLY_CHURN_PCT,
            
            STDDEV(DAILY_TOTAL_HSI_ORDERS) as MONTHLY_VOLATILITY
            
        FROM DAILY_AGGREGATES
        GROUP BY TO_CHAR(ORDER_DAY, 'YYYY-MM'), TRUNC(ORDER_DAY, 'MM')
    ),
    
    TREND_CALCULATIONS AS (
        SELECT 
            'WEEKLY' as TIMEFRAME,
            'Mingguan' as TIMEFRAME_INDONESIAN,
            WEEK_PERIOD as PERIOD,
            WEEK_START as PERIOD_START,
            
            WEEKLY_TOTAL_ORDERS as TOTAL_ORDERS,
            WEEKLY_TOTAL_CUSTOMERS as TOTAL_CUSTOMERS,
            WEEKLY_TOTAL_SERVICES as TOTAL_SERVICES,
            WEEKLY_AVG_ORDER_PER_CUSTOMER as AVG_ORDER_PER_CUSTOMER,
            WEEKLY_AVG_SERVICE_PER_CUSTOMER as AVG_SERVICE_PER_CUSTOMER,
            WEEKLY_AVG_ORDER_PER_SERVICE as AVG_ORDER_PER_SERVICE,
            
            WEEKLY_TOTAL_HSI_ORDERS as TOTAL_HSI_ORDERS,
            WEEKLY_HSI_BISNIS_ORDERS as BISNIS_ORDERS,
            WEEKLY_HSI_BASIC_ORDERS as BASIC_ORDERS,
            WEEKLY_TOTAL_HSI_CUSTOMERS as TOTAL_HSI_CUSTOMERS,
            WEEKLY_HSI_BISNIS_CUSTOMERS as BISNIS_CUSTOMERS,
            WEEKLY_HSI_BASIC_CUSTOMERS as BASIC_CUSTOMERS,
            WEEKLY_TOTAL_HSI_SERVICES as TOTAL_HSI_SERVICES,
            WEEKLY_HSI_BISNIS_SERVICES as BISNIS_SERVICES,
            WEEKLY_HSI_BASIC_SERVICES as BASIC_SERVICES,
            
            WEEKLY_BUNDLING_ORDERS as BUNDLING_ORDERS,
            WEEKLY_DIGITAL_ORDERS as DIGITAL_ORDERS,
            WEEKLY_AVG_BANDWIDTH_KBPS as AVG_BANDWIDTH_KBPS,
            WEEKLY_BISNIS_MIX_PCT as BISNIS_MIX_PCT,
            WEEKLY_BUNDLING_RATE_PCT as BUNDLING_RATE_PCT,
            WEEKLY_DIGITAL_RATE_PCT as DIGITAL_RATE_PCT,
            WEEKLY_MAX_REGIONAL_ACTIVITY as REGIONAL_ACTIVITY,
            
            WEEKLY_ORGANIC_GROWTH_ORDERS as ORGANIC_GROWTH_ORDERS,
            WEEKLY_EXPANSION_ORDERS as EXPANSION_ORDERS,
            WEEKLY_CHURN_ORDERS as CHURN_ORDERS,
            WEEKLY_ORGANIC_GROWTH_PCT as ORGANIC_GROWTH_PCT,
            WEEKLY_EXPANSION_PCT as EXPANSION_PCT,
            WEEKLY_CHURN_PCT as CHURN_PCT,
            
            WEEKLY_ENTERPRISE_ORDERS as ENTERPRISE_ORDERS,
            WEEKLY_GOVERNMENT_ORDERS as GOVERNMENT_ORDERS,
            WEEKLY_BUSINESS_ORDERS as BUSINESS_ORDERS,
            WEEKLY_CHURN_RISK_ORDERS as CHURN_RISK_ORDERS,
            
            LAG(WEEKLY_TOTAL_HSI_ORDERS, 1) OVER (ORDER BY WEEK_START) as PREV_PERIOD_ORDERS,
            LAG(WEEKLY_TOTAL_HSI_ORDERS, 4) OVER (ORDER BY WEEK_START) as MONTH_AGO_ORDERS,
            LAG(WEEKLY_TOTAL_HSI_CUSTOMERS, 1) OVER (ORDER BY WEEK_START) as PREV_PERIOD_CUSTOMERS,
            LAG(WEEKLY_TOTAL_HSI_SERVICES, 1) OVER (ORDER BY WEEK_START) as PREV_PERIOD_SERVICES,
            LAG(WEEKLY_BISNIS_MIX_PCT, 1) OVER (ORDER BY WEEK_START) as PREV_BISNIS_MIX_PCT,
            LAG(WEEKLY_BUNDLING_RATE_PCT, 1) OVER (ORDER BY WEEK_START) as PREV_BUNDLING_RATE_PCT,
            LAG(WEEKLY_DIGITAL_RATE_PCT, 1) OVER (ORDER BY WEEK_START) as PREV_DIGITAL_RATE_PCT,
            LAG(WEEKLY_ORGANIC_GROWTH_PCT, 1) OVER (ORDER BY WEEK_START) as PREV_ORGANIC_GROWTH_PCT
            
        FROM WEEKLY_AGGREGATES
        WHERE WEEK_START >= ADD_MONTHS(TO_DATE('2025-01-01', 'YYYY-MM-DD'), -3)
        
        UNION ALL
        
        SELECT 
            'MONTHLY' as TIMEFRAME,
            'Bulanan' as TIMEFRAME_INDONESIAN,
            MONTH_PERIOD as PERIOD,
            MONTH_START as PERIOD_START,
            
            MONTHLY_TOTAL_ORDERS as TOTAL_ORDERS,
            MONTHLY_TOTAL_CUSTOMERS as TOTAL_CUSTOMERS,
            MONTHLY_TOTAL_SERVICES as TOTAL_SERVICES,
            MONTHLY_AVG_ORDER_PER_CUSTOMER as AVG_ORDER_PER_CUSTOMER,
            MONTHLY_AVG_SERVICE_PER_CUSTOMER as AVG_SERVICE_PER_CUSTOMER,
            MONTHLY_AVG_ORDER_PER_SERVICE as AVG_ORDER_PER_SERVICE,
            
            MONTHLY_TOTAL_HSI_ORDERS as TOTAL_HSI_ORDERS,
            MONTHLY_HSI_BISNIS_ORDERS as BISNIS_ORDERS,
            MONTHLY_HSI_BASIC_ORDERS as BASIC_ORDERS,
            MONTHLY_TOTAL_HSI_CUSTOMERS as TOTAL_HSI_CUSTOMERS,
            MONTHLY_HSI_BISNIS_CUSTOMERS as BISNIS_CUSTOMERS,
            MONTHLY_HSI_BASIC_CUSTOMERS as BASIC_CUSTOMERS,
            MONTHLY_TOTAL_HSI_SERVICES as TOTAL_HSI_SERVICES,
            MONTHLY_HSI_BISNIS_SERVICES as BISNIS_SERVICES,
            MONTHLY_HSI_BASIC_SERVICES as BASIC_SERVICES,
            
            MONTHLY_BUNDLING_ORDERS as BUNDLING_ORDERS,
            MONTHLY_DIGITAL_ORDERS as DIGITAL_ORDERS,
            MONTHLY_AVG_BANDWIDTH_KBPS as AVG_BANDWIDTH_KBPS,
            MONTHLY_BISNIS_MIX_PCT as BISNIS_MIX_PCT,
            MONTHLY_BUNDLING_RATE_PCT as BUNDLING_RATE_PCT,
            MONTHLY_DIGITAL_RATE_PCT as DIGITAL_RATE_PCT,
            MONTHLY_MAX_REGIONAL_ACTIVITY as REGIONAL_ACTIVITY,
            
            MONTHLY_ORGANIC_GROWTH_ORDERS as ORGANIC_GROWTH_ORDERS,
            MONTHLY_EXPANSION_ORDERS as EXPANSION_ORDERS,
            MONTHLY_CHURN_ORDERS as CHURN_ORDERS,
            MONTHLY_ORGANIC_GROWTH_PCT as ORGANIC_GROWTH_PCT,
            MONTHLY_EXPANSION_PCT as EXPANSION_PCT,
            MONTHLY_CHURN_PCT as CHURN_PCT,
            
            MONTHLY_ENTERPRISE_ORDERS as ENTERPRISE_ORDERS,
            MONTHLY_GOVERNMENT_ORDERS as GOVERNMENT_ORDERS,
            MONTHLY_BUSINESS_ORDERS as BUSINESS_ORDERS,
            MONTHLY_CHURN_RISK_ORDERS as CHURN_RISK_ORDERS,
            
            LAG(MONTHLY_TOTAL_HSI_ORDERS, 1) OVER (ORDER BY MONTH_START) as PREV_PERIOD_ORDERS,
            LAG(MONTHLY_TOTAL_HSI_ORDERS, 3) OVER (ORDER BY MONTH_START) as MONTH_AGO_ORDERS,
            LAG(MONTHLY_TOTAL_HSI_CUSTOMERS, 1) OVER (ORDER BY MONTH_START) as PREV_PERIOD_CUSTOMERS,
            LAG(MONTHLY_TOTAL_HSI_SERVICES, 1) OVER (ORDER BY MONTH_START) as PREV_PERIOD_SERVICES,
            LAG(MONTHLY_BISNIS_MIX_PCT, 1) OVER (ORDER BY MONTH_START) as PREV_BISNIS_MIX_PCT,
            LAG(MONTHLY_BUNDLING_RATE_PCT, 1) OVER (ORDER BY MONTH_START) as PREV_BUNDLING_RATE_PCT,
            LAG(MONTHLY_DIGITAL_RATE_PCT, 1) OVER (ORDER BY MONTH_START) as PREV_DIGITAL_RATE_PCT,
            LAG(MONTHLY_ORGANIC_GROWTH_PCT, 1) OVER (ORDER BY MONTH_START) as PREV_ORGANIC_GROWTH_PCT
            
        FROM MONTHLY_AGGREGATES
        WHERE MONTH_START >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
    )
    SELECT 
        TIMEFRAME,
        TIMEFRAME_INDONESIAN,
        PERIOD,
        PERIOD_START,
        
        TOTAL_ORDERS,
        TOTAL_CUSTOMERS,
        TOTAL_SERVICES,
        ROUND(AVG_ORDER_PER_CUSTOMER, 2) as AVG_ORDER_PER_CUSTOMER,
        ROUND(AVG_SERVICE_PER_CUSTOMER, 2) as AVG_SERVICE_PER_CUSTOMER,
        ROUND(AVG_ORDER_PER_SERVICE, 2) as AVG_ORDER_PER_SERVICE,
        
        TOTAL_HSI_ORDERS,
        BISNIS_ORDERS,
        BASIC_ORDERS,
        TOTAL_HSI_CUSTOMERS,
        BISNIS_CUSTOMERS,
        BASIC_CUSTOMERS,
        TOTAL_HSI_SERVICES,
        BISNIS_SERVICES,
        BASIC_SERVICES,
        
        BUNDLING_ORDERS,
        DIGITAL_ORDERS,
        ROUND(AVG_BANDWIDTH_KBPS/1000, 0) as AVG_BANDWIDTH_MBPS,
        ROUND(BISNIS_MIX_PCT, 1) as BISNIS_MIX_PCT,
        ROUND(BUNDLING_RATE_PCT, 1) as BUNDLING_RATE_PCT,
        ROUND(DIGITAL_RATE_PCT, 1) as DIGITAL_RATE_PCT,
        REGIONAL_ACTIVITY,
        PREV_PERIOD_ORDERS,
        PREV_PERIOD_CUSTOMERS,
        PREV_PERIOD_SERVICES,
        MONTH_AGO_ORDERS,
        
        ORGANIC_GROWTH_ORDERS,
        EXPANSION_ORDERS,
        CHURN_ORDERS,
        ROUND(ORGANIC_GROWTH_PCT, 1) as ORGANIC_GROWTH_PCT,
        ROUND(EXPANSION_PCT, 1) as EXPANSION_PCT,
        ROUND(CHURN_PCT, 1) as CHURN_PCT,
        
        ENTERPRISE_ORDERS,
        GOVERNMENT_ORDERS,
        BUSINESS_ORDERS,
        CHURN_RISK_ORDERS,
        
        CASE 
            WHEN PREV_PERIOD_ORDERS > 0 THEN 
                ROUND((TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / PREV_PERIOD_ORDERS, 2)
            ELSE NULL 
        END as PERTUMBUHAN_ORDER_PERIODE_PCT,
        
        CASE 
            WHEN PREV_PERIOD_CUSTOMERS > 0 THEN 
                ROUND((TOTAL_HSI_CUSTOMERS - PREV_PERIOD_CUSTOMERS) * 100.0 / PREV_PERIOD_CUSTOMERS, 2)
            ELSE NULL 
        END as PERTUMBUHAN_CUSTOMER_PERIODE_PCT,
        
        CASE 
            WHEN PREV_PERIOD_SERVICES > 0 THEN 
                ROUND((TOTAL_HSI_SERVICES - PREV_PERIOD_SERVICES) * 100.0 / PREV_PERIOD_SERVICES, 2)
            ELSE NULL 
        END as PERTUMBUHAN_SERVICE_PERIODE_PCT,
        
        CASE 
            WHEN MONTH_AGO_ORDERS > 0 THEN 
                ROUND((TOTAL_HSI_ORDERS - MONTH_AGO_ORDERS) * 100.0 / MONTH_AGO_ORDERS, 2)
            ELSE NULL 
        END as PERTUMBUHAN_EXTENDED_PCT,
        
        ROUND(BISNIS_MIX_PCT - COALESCE(PREV_BISNIS_MIX_PCT, BISNIS_MIX_PCT), 1) as BISNIS_MIX_CHANGE,
        ROUND(BUNDLING_RATE_PCT - COALESCE(PREV_BUNDLING_RATE_PCT, BUNDLING_RATE_PCT), 1) as BUNDLING_RATE_CHANGE,
        ROUND(DIGITAL_RATE_PCT - COALESCE(PREV_DIGITAL_RATE_PCT, DIGITAL_RATE_PCT), 1) as DIGITAL_RATE_CHANGE,
        ROUND(ORGANIC_GROWTH_PCT - COALESCE(PREV_ORGANIC_GROWTH_PCT, ORGANIC_GROWTH_PCT), 1) as ORGANIC_GROWTH_CHANGE,
        
        CASE 
            WHEN PREV_PERIOD_ORDERS > 0 AND MONTH_AGO_ORDERS > 0 THEN
                CASE 
                    WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / PREV_PERIOD_ORDERS > 
                         (PREV_PERIOD_ORDERS - MONTH_AGO_ORDERS) * 100.0 / MONTH_AGO_ORDERS THEN 'PERCEPATAN'
                    WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / PREV_PERIOD_ORDERS < 
                         (PREV_PERIOD_ORDERS - MONTH_AGO_ORDERS) * 100.0 / MONTH_AGO_ORDERS THEN 'PERLAMBATAN'
                    ELSE 'STABIL'
                END
            ELSE 'DATA_TERBATAS'
        END as MOMENTUM_PERTUMBUHAN,
        
        CASE 
            WHEN PREV_PERIOD_CUSTOMERS > 0 THEN
                CASE 
                    WHEN (TOTAL_HSI_CUSTOMERS - PREV_PERIOD_CUSTOMERS) * 100.0 / PREV_PERIOD_CUSTOMERS >= 15 THEN 'AKUISISI_KUAT'
                    WHEN (TOTAL_HSI_CUSTOMERS - PREV_PERIOD_CUSTOMERS) * 100.0 / PREV_PERIOD_CUSTOMERS >= 5 THEN 'AKUISISI_SEDANG'
                    WHEN (TOTAL_HSI_CUSTOMERS - PREV_PERIOD_CUSTOMERS) * 100.0 / PREV_PERIOD_CUSTOMERS >= 0 THEN 'AKUISISI_LAMBAT'
                    ELSE 'CUSTOMER_CHURN'
                END
            ELSE 'DATA_TERBATAS'
        END as MOMENTUM_CUSTOMER,
        
        CASE 
            WHEN PREV_PERIOD_SERVICES > 0 THEN
                CASE 
                    WHEN (TOTAL_HSI_SERVICES - PREV_PERIOD_SERVICES) * 100.0 / PREV_PERIOD_SERVICES >= 10 THEN 'EKSPANSI_LAYANAN_KUAT'
                    WHEN (TOTAL_HSI_SERVICES - PREV_PERIOD_SERVICES) * 100.0 / PREV_PERIOD_SERVICES >= 3 THEN 'EKSPANSI_LAYANAN_SEDANG'
                    WHEN (TOTAL_HSI_SERVICES - PREV_PERIOD_SERVICES) * 100.0 / PREV_PERIOD_SERVICES >= 0 THEN 'EKSPANSI_LAYANAN_MINIMAL'
                    ELSE 'PENURUNAN_LAYANAN'
                END
            ELSE 'DATA_TERBATAS'
        END as MOMENTUM_SERVICE,
        
        CASE 
            WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / NULLIF(PREV_PERIOD_ORDERS, 0) >= 25 THEN 'PERTUMBUHAN_EKSPLOSIF'
            WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / NULLIF(PREV_PERIOD_ORDERS, 0) >= 15 THEN 'PERTUMBUHAN_KUAT'
            WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / NULLIF(PREV_PERIOD_ORDERS, 0) >= 8 THEN 'PERTUMBUHAN_SEDANG'
            WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / NULLIF(PREV_PERIOD_ORDERS, 0) >= 3 THEN 'PERTUMBUHAN_LAMBAT'
            WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / NULLIF(PREV_PERIOD_ORDERS, 0) >= 0 THEN 'PERTUMBUHAN_MINIMAL'
            WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / NULLIF(PREV_PERIOD_ORDERS, 0) >= -5 THEN 'PENURUNAN_RINGAN'
            WHEN (TOTAL_HSI_ORDERS - PREV_PERIOD_ORDERS) * 100.0 / NULLIF(PREV_PERIOD_ORDERS, 0) >= -15 THEN 'PENURUNAN_SEDANG'
            ELSE 'PENURUNAN_SIGNIFIKAN'
        END as KATEGORI_TREN
        
    FROM TREND_CALCULATIONS
    ORDER BY TIMEFRAME, PERIOD_START DESC
  `,

  BUSINESS_LOGIC: {
    assessTrendHealth: function(pertumbuhan_order, pertumbuhan_customer, pertumbuhan_service, momentum, kategori_tren) {
        let health_score = 0;
        
        // Order growth component (30%)
        if (pertumbuhan_order >= 20) health_score += 30;
        else if (pertumbuhan_order >= 10) health_score += 26;
        else if (pertumbuhan_order >= 5) health_score += 21;
        else if (pertumbuhan_order >= 0) health_score += 15;
        else if (pertumbuhan_order >= -5) health_score += 8;
        else health_score += 3;
        
        // Customer growth component (35%)
        if (pertumbuhan_customer >= 15) health_score += 35;
        else if (pertumbuhan_customer >= 8) health_score += 30;
        else if (pertumbuhan_customer >= 3) health_score += 24;
        else if (pertumbuhan_customer >= 0) health_score += 18;
        else if (pertumbuhan_customer >= -3) health_score += 10;
        else health_score += 5;
        
        // Service growth component (25%)
        if (pertumbuhan_service >= 10) health_score += 25;
        else if (pertumbuhan_service >= 5) health_score += 21;
        else if (pertumbuhan_service >= 2) health_score += 17;
        else if (pertumbuhan_service >= 0) health_score += 12;
        else if (pertumbuhan_service >= -3) health_score += 6;
        else health_score += 2;
        
        // Momentum component (10%)
        const momentum_scores = {
        'PERCEPATAN': 10,
        'STABIL': 8,
        'PERLAMBATAN': 5,
        'DATA_TERBATAS': 6
        };
        health_score += momentum_scores[momentum] || 4;
        
        const healthCategories = {
        'SANGAT_SEHAT': {
            description: 'Tren pertumbuhan sangat positif dengan momentum kuat di semua aspek (order, customer, service)',
            recommendation: 'Maksimalkan peluang pertumbuhan dengan ekspansi agresif dan investasi pada kapasitas'
        },
        'SEHAT': {
            description: 'Tren pertumbuhan positif dan berkelanjutan dengan keseimbangan yang baik',
            recommendation: 'Pertahankan momentum dengan investasi strategis dan optimasi operasional'
        },
        'MODERAT': {
            description: 'Tren pertumbuhan stabil namun perlu optimasi pada beberapa aspek',
            recommendation: 'Fokus pada peningkatan efisiensi dan pertumbuhan selektif dengan prioritas customer acquisition'
        },
        'PERLU_PERHATIAN': {
            description: 'Tren menunjukkan tanda-tanda perlambatan di beberapa area krusial',
            recommendation: 'Identifikasi akar masalah dan implementasi tindakan korektif segera'
        },
        'KRITIS': {
            description: 'Tren negatif yang memerlukan intervensi segera di multiple area',
            recommendation: 'Tinjauan strategis menyeluruh dan implementasi rencana pemulihan darurat'
        }
        };
        
        if (health_score >= 85) return healthCategories['SANGAT_SEHAT'];
        if (health_score >= 70) return healthCategories['SEHAT'];
        if (health_score >= 55) return healthCategories['MODERAT'];
        if (health_score >= 40) return healthCategories['PERLU_PERHATIAN'];
        return healthCategories['KRITIS'];
    },
    
    identifyTrendDrivers: function(bisnis_mix_change, bundling_change, digital_change, organic_change, momentum_customer, momentum_service, kategori_tren) {
        const drivers = [];
        
        // Customer acquisition drivers
        if (momentum_customer === 'AKUISISI_KUAT') {
        drivers.push('Akuisisi customer baru yang sangat kuat mendorong ekspansi pasar');
        } else if (momentum_customer === 'CUSTOMER_CHURN') {
        drivers.push('Churn customer menjadi tantangan utama yang perlu diatasi');
        }
        
        // Service expansion drivers
        if (momentum_service === 'EKSPANSI_LAYANAN_KUAT') {
        drivers.push('Ekspansi layanan HSI per customer menunjukkan cross-selling yang efektif');
        } else if (momentum_service === 'PENURUNAN_LAYANAN') {
        drivers.push('Penurunan layanan mengindikasikan downgrade atau disconnect');
        }
        
        // Product mix drivers
        if (bisnis_mix_change > 3) {
        drivers.push('Pergeseran ke HSI Bisnis mendorong pertumbuhan premium dan nilai customer');
        } else if (bisnis_mix_change < -3) {
        drivers.push('Dominasi HSI Basic menunjukkan ekspansi pasar massal namun margin rendah');
        }
        
        // Bundling drivers
        if (bundling_change > 5) {
        drivers.push('Peningkatan tingkat bundling meningkatkan nilai pelanggan dan ARPU');
        } else if (bundling_change < -5) {
        drivers.push('Penurunan bundling mungkin indikasi tekanan kompetitif atau simplifikasi customer');
        }
        
        // Digital adoption drivers
        if (digital_change > 3) {
        drivers.push('Adopsi produk digital semakin kuat mendukung transformasi digital customer');
        } else if (digital_change < -3) {
        drivers.push('Penurunan adopsi digital perlu tinjauan strategis produk dan positioning');
        }
        
        // Organic growth drivers
        if (organic_change > 5) {
        drivers.push('Pertumbuhan organik yang kuat menunjukkan efektivitas akuisisi customer baru');
        } else if (organic_change < -5) {
        drivers.push('Penurunan pertumbuhan organik mengindikasikan tantangan kompetitif atau saturasi pasar');
        }
        
        // Trend-specific drivers
        if (kategori_tren.includes('EKSPLOSIF') || kategori_tren.includes('KUAT')) {
        drivers.push('Ekspansi pasar yang agresif dengan keunggulan kompetitif yang kuat');
        } else if (kategori_tren.includes('PENURUNAN')) {
        drivers.push('Saturasi pasar atau tekanan kompetitif yang signifikan');
        }
        
        return drivers.length > 0 ? drivers : ['Tren stabil dengan faktor normal tanpa driver signifikan'];
    },
    
    calculateGrowthProjection: function(current_orders, current_customers, current_services, pertumbuhan_order, pertumbuhan_customer, momentum, timeframe) {
        let order_multiplier = 1;
        let customer_multiplier = 1;
        let service_multiplier = 1;
        
        // Base projection from current growth rates
        if (pertumbuhan_order !== null) {
        order_multiplier = 1 + (pertumbuhan_order / 100);
        }
        if (pertumbuhan_customer !== null) {
        customer_multiplier = 1 + (pertumbuhan_customer / 100);
        }
        
        // Momentum adjustments
        const momentum_adjustments = {
        'PERCEPATAN': 1.15,      // Growth is accelerating
        'STABIL': 1.05,          // Stable growth
        'PERLAMBATAN': 0.95,     // Growth is decelerating
        'DATA_TERBATAS': 1.02    // Conservative estimate
        };
        
        order_multiplier *= momentum_adjustments[momentum] || 1.0;
        customer_multiplier *= momentum_adjustments[momentum] || 1.0;
        
        // Projection periods
        const periods_ahead = timeframe === 'WEEKLY' ? 4 : 3; // 4 weeks or 3 months
        
        // Calculate compound projections
        const projected_orders = current_orders * Math.pow(order_multiplier, periods_ahead);
        const projected_customers = current_customers * Math.pow(customer_multiplier, periods_ahead);
        const projected_services = current_services * Math.pow(service_multiplier, periods_ahead);
        
        // Confidence level based on momentum and trend stability
        let confidence = 0.75; // Base confidence
        if (momentum === 'STABIL') confidence = 0.85;
        else if (momentum === 'PERCEPATAN') confidence = 0.80;
        else if (momentum === 'PERLAMBATAN') confidence = 0.70;
        else confidence = 0.65;
        
        return {
        proyeksi_pesanan: Math.round(projected_orders),
        proyeksi_customer: Math.round(projected_customers),
        proyeksi_layanan: Math.round(projected_services),
        tingkat_kepercayaan: confidence,
        periode_proyeksi: timeframe === 'WEEKLY' ? '4 minggu' : '3 bulan',
        metodologi: 'Pertumbuhan majemuk dengan penyesuaian momentum berdasarkan hubungan customer-order-service',
        asumsi_pertumbuhan_order: `${((order_multiplier - 1) * 100).toFixed(1)}% per periode`,
        asumsi_pertumbuhan_customer: `${((customer_multiplier - 1) * 100).toFixed(1)}% per periode`
        };
    },
    
    analyzeGrowthTrends: function(data) {
        const analysis = {
        perbandingan_timeframe: {},
        pola_pertumbuhan: {},
        tren_komposisi: {},
        hubungan_customer_order_service: {},
        wawasan: []
        };
        
        // Separate weekly and monthly data
        const weekly_data = data.filter(d => d.TIMEFRAME === 'WEEKLY');
        const monthly_data = data.filter(d => d.TIMEFRAME === 'MONTHLY');
        
        // Timeframe comparison
        if (weekly_data.length > 0 && monthly_data.length > 0) {
        const latest_weekly = weekly_data[0];
        const latest_monthly = monthly_data[0];
        
        analysis.perbandingan_timeframe = {
            pertumbuhan_order_mingguan_terkini: latest_weekly.PERTUMBUHAN_ORDER_PERIODE_PCT,
            pertumbuhan_order_bulanan_terkini: latest_monthly.PERTUMBUHAN_ORDER_PERIODE_PCT,
            pertumbuhan_customer_mingguan_terkini: latest_weekly.PERTUMBUHAN_CUSTOMER_PERIODE_PCT,
            pertumbuhan_customer_bulanan_terkini: latest_monthly.PERTUMBUHAN_CUSTOMER_PERIODE_PCT,
            konsistensi_pertumbuhan: Math.abs((latest_weekly.PERTUMBUHAN_ORDER_PERIODE_PCT || 0) - (latest_monthly.PERTUMBUHAN_ORDER_PERIODE_PCT || 0)) <= 5 ? 'KONSISTEN' : 'FLUKTUATIF'
        };
        }
        
        // Growth patterns analysis
        const recent_trends = data.slice(0, 6); // Last 6 periods
        const positive_order_growth_periods = recent_trends.filter(d => (d.PERTUMBUHAN_ORDER_PERIODE_PCT || 0) > 0).length;
        const positive_customer_growth_periods = recent_trends.filter(d => (d.PERTUMBUHAN_CUSTOMER_PERIODE_PCT || 0) > 0).length;
        
        analysis.pola_pertumbuhan = {
        periode_order_positif: positive_order_growth_periods,
        periode_customer_positif: positive_customer_growth_periods,
        konsistensi_pertumbuhan_order: positive_order_growth_periods >= 4 ? 'KONSISTEN_POSITIF' : positive_order_growth_periods >= 2 ? 'CAMPURAN' : 'KONSISTEN_NEGATIF',
        konsistensi_pertumbuhan_customer: positive_customer_growth_periods >= 4 ? 'KONSISTEN_POSITIF' : positive_customer_growth_periods >= 2 ? 'CAMPURAN' : 'KONSISTEN_NEGATIF'
        };
        
        // Customer-Order-Service relationship analysis
        const avg_order_per_customer = data.reduce((sum, d) => sum + (d.AVG_ORDER_PER_CUSTOMER || 0), 0) / data.length;
        const avg_service_per_customer = data.reduce((sum, d) => sum + (d.AVG_SERVICE_PER_CUSTOMER || 0), 0) / data.length;
        const avg_order_per_service = data.reduce((sum, d) => sum + (d.AVG_ORDER_PER_SERVICE || 0), 0) / data.length;
        
        analysis.hubungan_customer_order_service = {
        rata_rata_order_per_customer: avg_order_per_customer.toFixed(2),
        rata_rata_service_per_customer: avg_service_per_customer.toFixed(2),
        rata_rata_order_per_service: avg_order_per_service.toFixed(2),
        efisiensi_cross_selling: avg_service_per_customer > 1.5 ? 'TINGGI' : avg_service_per_customer > 1.2 ? 'SEDANG' : 'RENDAH',
        aktivitas_layanan: avg_order_per_service > 1.3 ? 'AKTIF' : 'STABIL'
        };
        
        // Composition trends
        const avg_bisnis_mix = data.reduce((sum, d) => sum + (d.BISNIS_MIX_PCT || 0), 0) / data.length;
        const avg_bundling_rate = data.reduce((sum, d) => sum + (d.BUNDLING_RATE_PCT || 0), 0) / data.length;
        const avg_digital_rate = data.reduce((sum, d) => sum + (d.DIGITAL_RATE_PCT || 0), 0) / data.length;
        const avg_organic_rate = data.reduce((sum, d) => sum + (d.ORGANIC_GROWTH_PCT || 0), 0) / data.length;
        
        analysis.tren_komposisi = {
        rata_rata_mix_bisnis: avg_bisnis_mix.toFixed(1),
        rata_rata_tingkat_bundling: avg_bundling_rate.toFixed(1),
        rata_rata_tingkat_digital: avg_digital_rate.toFixed(1),
        rata_rata_pertumbuhan_organik: avg_organic_rate.toFixed(1)
        };
        
        // Generate insights berdasarkan hubungan customer-order-service
        if (positive_order_growth_periods >= 4 && positive_customer_growth_periods >= 4) {
        analysis.wawasan.push('Tren pertumbuhan menunjukkan konsistensi positif dalam order dan customer acquisition');
        } else {
        analysis.wawasan.push('Tren pertumbuhan menunjukkan volatilitas yang perlu diperhatikan pada aspek tertentu');
        }
        
        if (avg_bisnis_mix > 50) {
        analysis.wawasan.push('Dominasi HSI Bisnis menunjukkan fokus pada segmen premium dengan nilai customer tinggi');
        }
        
        if (avg_bundling_rate > 40) {
        analysis.wawasan.push('Tingkat bundling yang tinggi menunjukkan sofistikasi customer dan cross-selling efektif');
        }
        
        if (avg_organic_rate > 60) {
        analysis.wawasan.push('Pertumbuhan organik yang kuat menunjukkan efektivitas akuisisi customer baru');
        }
        
        if (avg_service_per_customer > 1.5) {
        analysis.wawasan.push('Rasio layanan per customer tinggi menunjukkan customer value optimization yang baik');
        }
        
        if (avg_order_per_service > 1.3) {
        analysis.wawasan.push('Aktivitas order per layanan tinggi mengindikasikan customer engagement yang baik');
        }
        
        return analysis;
    },
    
    formatIndonesianResponse: function(data) {
        const trends = this.analyzeGrowthTrends(data);
        
        const hasil_analisis = data.map(period => {
        const health = this.assessTrendHealth(
            period.PERTUMBUHAN_ORDER_PERIODE_PCT,
            period.PERTUMBUHAN_CUSTOMER_PERIODE_PCT,
            period.PERTUMBUHAN_SERVICE_PERIODE_PCT,
            period.MOMENTUM_PERTUMBUHAN,
            period.KATEGORI_TREN
        );
        
        const drivers = this.identifyTrendDrivers(
            period.BISNIS_MIX_CHANGE,
            period.BUNDLING_RATE_CHANGE,
            period.DIGITAL_RATE_CHANGE,
            period.ORGANIC_GROWTH_CHANGE,
            period.MOMENTUM_CUSTOMER,
            period.MOMENTUM_SERVICE,
            period.KATEGORI_TREN
        );
        
        const projection = this.calculateGrowthProjection(
            period.TOTAL_HSI_ORDERS,
            period.TOTAL_HSI_CUSTOMERS,
            period.TOTAL_HSI_SERVICES,
            period.PERTUMBUHAN_ORDER_PERIODE_PCT,
            period.PERTUMBUHAN_CUSTOMER_PERIODE_PCT,
            period.MOMENTUM_PERTUMBUHAN,
            period.TIMEFRAME
        );
        
        return {
            identitas_periode: {
            timeframe: period.TIMEFRAME_INDONESIAN,
            periode: period.PERIOD,
            tanggal_mulai: period.PERIOD_START
            },
            metrik_fundamental: {
            total_pesanan: period.TOTAL_ORDERS.toLocaleString('id-ID'),
            total_customer: period.TOTAL_CUSTOMERS.toLocaleString('id-ID'),
            total_layanan: period.TOTAL_SERVICES.toLocaleString('id-ID'),
            rasio_order_per_customer: period.AVG_ORDER_PER_CUSTOMER,
            rasio_service_per_customer: period.AVG_SERVICE_PER_CUSTOMER,
            rasio_order_per_service: period.AVG_ORDER_PER_SERVICE
            },
            metrik_volume_hsi: {
            total_pesanan_hsi: period.TOTAL_HSI_ORDERS.toLocaleString('id-ID'),
            total_customer_hsi: period.TOTAL_HSI_CUSTOMERS.toLocaleString('id-ID'),
            total_layanan_hsi: period.TOTAL_HSI_SERVICES.toLocaleString('id-ID'),
            pesanan_hsi_bisnis: period.BISNIS_ORDERS.toLocaleString('id-ID'),
            pesanan_hsi_basic: period.BASIC_ORDERS.toLocaleString('id-ID'),
            customer_hsi_bisnis: period.BISNIS_CUSTOMERS.toLocaleString('id-ID'),
            customer_hsi_basic: period.BASIC_CUSTOMERS.toLocaleString('id-ID'),
            layanan_hsi_bisnis: period.BISNIS_SERVICES.toLocaleString('id-ID'),
            layanan_hsi_basic: period.BASIC_SERVICES.toLocaleString('id-ID'),
            pesanan_bundling: period.BUNDLING_ORDERS.toLocaleString('id-ID'),
            pesanan_digital: period.DIGITAL_ORDERS.toLocaleString('id-ID'),
            rata_rata_bandwidth: `${period.AVG_BANDWIDTH_MBPS} Mbps`
            },
            analisis_pertumbuhan: {
            pertumbuhan_order_periode: `${period.PERTUMBUHAN_ORDER_PERIODE_PCT || 0}%`,
            pertumbuhan_customer_periode: `${period.PERTUMBUHAN_CUSTOMER_PERIODE_PCT || 0}%`,
            pertumbuhan_service_periode: `${period.PERTUMBUHAN_SERVICE_PERIODE_PCT || 0}%`,
            pertumbuhan_extended: `${period.PERTUMBUHAN_EXTENDED_PCT || 0}%`,
            momentum_order: period.MOMENTUM_PERTUMBUHAN,
            momentum_customer: period.MOMENTUM_CUSTOMER,
            momentum_service: period.MOMENTUM_SERVICE,
            kategori_tren: period.KATEGORI_TREN,
            status_kesehatan: health.description,
            rekomendasi: health.recommendation
            },
            komposisi_produk: {
            mix_bisnis: `${period.BISNIS_MIX_PCT}%`,
            tingkat_bundling: `${period.BUNDLING_RATE_PCT}%`,
            tingkat_digital: `${period.DIGITAL_RATE_PCT}%`,
            perubahan_mix_bisnis: `${period.BISNIS_MIX_CHANGE}%`,
            perubahan_bundling: `${period.BUNDLING_RATE_CHANGE}%`,
            perubahan_digital: `${period.DIGITAL_RATE_CHANGE}%`
            },
            analisis_transaksi: {
            pertumbuhan_organik: period.ORGANIC_GROWTH_ORDERS.toLocaleString('id-ID'),
            ekspansi_existing: period.EXPANSION_ORDERS.toLocaleString('id-ID'),
            aktivitas_churn: period.CHURN_ORDERS.toLocaleString('id-ID'),
            persentase_organik: `${period.ORGANIC_GROWTH_PCT}%`,
            persentase_ekspansi: `${period.EXPANSION_PCT}%`,
            persentase_churn: `${period.CHURN_PCT}%`,
            perubahan_organik: `${period.ORGANIC_GROWTH_CHANGE}%`
            },
            analisis_provider: {
            enterprise_services: period.ENTERPRISE_ORDERS.toLocaleString('id-ID'),
            government_services: period.GOVERNMENT_ORDERS.toLocaleString('id-ID'),
            business_services: period.BUSINESS_ORDERS.toLocaleString('id-ID'),
            risiko_churn: period.CHURN_RISK_ORDERS.toLocaleString('id-ID')
            },
            proyeksi_pertumbuhan: projection,
            faktor_pendorong: drivers
        };
        });
        
        return {
        ringkasan: 'Analisis tren pertumbuhan HSI dengan multiple timeframes menggunakan hubungan customer-order-service yang akurat periode 2025',
        total_periode_dianalisis: hasil_analisis.length,
        tren_terkini: hasil_analisis.slice(0, 4),
        perbandingan_timeframe: trends.perbandingan_timeframe,
        pola_pertumbuhan: trends.pola_pertumbuhan,
        tren_komposisi: trends.tren_komposisi,
        hubungan_customer_order_service: trends.hubungan_customer_order_service,
        wawasan_utama: trends.wawasan,
        metodologi_perhitungan: {
            basis_data: 'Data aktual dari tabel BRIGHTAI_SALES menggunakan ORDER_ID, NCLI, dan ND_HSI untuk identifikasi akurat hubungan customer-order-layanan',
            periode_data: 'Data 2025 dengan agregasi harian, mingguan, dan bulanan',
            metrik_pertumbuhan: 'Perhitungan growth rate berdasarkan unique count ORDER_ID, NCLI, dan ND_HSI untuk akurasi tinggi',
            hubungan_metrics: 'Rasio order per customer, service per customer, dan order per service untuk analisis efisiensi bisnis',
            data_quality: 'Menggunakan ketiga kolom krusial untuk perhitungan yang akurat tanpa duplikasi atau missing relationship'
        },
        rekomendasi_strategis: [
            'Monitor konsistensi pertumbuhan organik berdasarkan akuisisi customer baru (NCLI) untuk memastikan sustainability',
            'Optimasi rasio order per customer untuk meningkatkan customer lifetime value',
            'Leverage ekspansi layanan per customer (ND_HSI per NCLI) untuk cross-selling yang efektif',
            'Focus pada momentum customer acquisition dan service expansion secara bersamaan',
            'Implementasi early warning system untuk deteksi perlambatan di level customer, order, atau service',
            'Optimasi mix produk berdasarkan tren pergeseran bisnis vs basic dengan mempertimbangkan customer value',
            'Percepat adopsi produk digital sebagai differentiator dengan tracking per customer',
            'Monitor aktivitas order per layanan untuk deteksi customer engagement dan loyalitas',
            'Implementasi strategi retention berbasis analisis hubungan customer-order-service untuk mengurangi churn'
        ]
        };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      const lowerInput = userInput.toLowerCase();
      
      let focus_area = 'growth_analysis';
      if (lowerInput.includes('momentum')) {
        focus_area = 'momentum_analysis';
      } else if (lowerInput.includes('customer') || lowerInput.includes('pelanggan')) {
        focus_area = 'customer_growth_analysis';
      } else if (lowerInput.includes('service') || lowerInput.includes('layanan')) {
        focus_area = 'service_growth_analysis';
      } else if (lowerInput.includes('efisiensi') || lowerInput.includes('efficiency')) {
        focus_area = 'efficiency_analysis';
      } else if (lowerInput.includes('cross-selling') || lowerInput.includes('ekspansi layanan')) {
        focus_area = 'cross_selling_analysis';
      }
      
      return {
        matches: confidence >= 65,
        confidence: confidence,
        focus_area: focus_area,
        requires_customer_analysis: lowerInput.includes('customer') || lowerInput.includes('pelanggan') || lowerInput.includes('akuisisi'),
        requires_service_analysis: lowerInput.includes('service') || lowerInput.includes('layanan') || lowerInput.includes('cross-selling'),
        requires_efficiency_analysis: lowerInput.includes('efisiensi') || lowerInput.includes('efficiency') || lowerInput.includes('rasio') || lowerInput.includes('per customer'),
        requires_momentum_analysis: lowerInput.includes('momentum') || lowerInput.includes('percepatan') || lowerInput.includes('perlambatan')
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};