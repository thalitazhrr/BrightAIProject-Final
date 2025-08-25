const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_006',
    RULE_NAME: 'fulfillment_success_rate',
    DESCRIPTION: 'Tingkat keberhasilan fulfillment order HSI dengan klasifikasi produk yang tepat',
    DATABASE: 'PS_SCONE_ORDER',
    CATEGORY: 'OPERATIONAL_PERFORMANCE',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("PS_SCONE_ORDER"),

  KEYWORD_PATTERNS: {
    primary: [
      // Fulfillment success - yang biasa digunakan
      'tingkat keberhasilan', 'success rate', 'keberhasilan fulfillment',
      'tingkat sukses', 'persentase keberhasilan', 'completion rate',
      
      // Performance terms familiar
      'performa fulfillment', 'kinerja fulfillment', 'efisiensi fulfillment',
      'penyelesaian order', 'sukses order', 'keberhasilan instalasi'
    ],
    
    supporting: [
      // Process terms familiar
      'proses', 'instalasi', 'penyelesaian', 'waktu', 'durasi',
      
      // Geographic familiar terms
      'regional', 'witel', 'wilayah', 'area', 'cabang',
      
      // HSI familiar terms
      'hsi', 'internet', 'broadband', 'indibiz', 'fiber'
    ],
    
    // Simplified confidence calculation
    calculateConfidence: function(input) {
      const lowerInput = input.toLowerCase();
      let score = 0;
      
      // Check primary keywords
      const primaryMatches = this.primary.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      
      // Check supporting keywords
      const supportingMatches = this.supporting.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      
      if (primaryMatches > 0) {
        score = 70 + (primaryMatches * 15) + (supportingMatches * 3);
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_CLASSIFICATION AS (
        SELECT 
            ORDER_ID,  -- ADDED: Identifier untuk setiap transaksi order
            NCLI,      -- ADDED: Identifier untuk pelanggan
            ND_HSI,    -- ADDED: Identifier untuk layanan HSI
            REGIONAL,
            WITEL,
            DATEL,
            ORDER_DATE,
            TGL_PS,
            STATUS_RESUME,
            JENISPSB,
            TYPE_TRANS,
            PACKAGE_NAME,
            PRODUCT,
            EKOSISTEM,
            
            -- HSI Bisnis Classification
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
            
            -- HSI Basic Classification  
            CASE 
                WHEN UPPER(PRODUCT) = 'WMS' THEN 0
                WHEN (UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                THEN 1 
                ELSE 0 
            END as IS_HSI_BASIC,
            
            -- Bundling Type Classification
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
                THEN 'Tambah atau Modifikasi Layanan'
                
                ELSE 'Tanpa Bundling'
            END as BUNDLING_TYPE,
            
            -- Digital Product Classifications
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

            -- Transaction Type Classification (TYPE_TRANS)
            CASE 
                WHEN TYPE_TRANS = 'NEW SALES' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'PENJUALAN_BARU'
                WHEN TYPE_TRANS = 'ADD SERVICE' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'TAMBAH_LAYANAN'
                WHEN TYPE_TRANS = 'MODIFICATION' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'MODIFIKASI'
                WHEN TYPE_TRANS = 'PDA' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'PINDAH_ALAMAT'
                WHEN TYPE_TRANS = 'MIGRASI' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'MIGRASI'
                ELSE 'LAINNYA'
            END as TRANSACTION_TYPE,

            -- Ecosystem Standardization (EKOSISTEM)
            CASE 
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('EDUCATION', 'SEKOLAH', 'PESANTREN') THEN 'PENDIDIKAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('GOVERNMENT', 'GOV') THEN 'PEMERINTAHAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('HEALTH', 'HEALTY', 'KLINIK') THEN 'KESEHATAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('HOTEL', 'PROPERTY', 'APARTEMEN') THEN 'HOSPITALITAS'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('MEDIA DAN KOMUNIKASI', 'MEDIA & KOMUNIKASI', 'MEDIA AND COMMUNICATION', 'COMMUNICATION', 'MEDIA&COMUNICATION', 'MEDIA DAN COMMUNICATION') THEN 'MEDIA_KOMUNIKASI'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('AGRI', 'AGRICULTURE') THEN 'PERTANIAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('MANUFAKTUR', 'PABRIKASI') THEN 'MANUFAKTUR'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('EKSPEDISI', 'EKPEDISI') THEN 'LOGISTIK'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('MIGAS', 'ENERGI') THEN 'ENERGI'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('MULTIFINANCE') THEN 'KEUANGAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('RUKO', 'HOST') THEN 'RUANG_KOMERSIAL'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('PERORANGAN') THEN 'INDIVIDUAL'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('OTHERS', 'UN ADDRES', 'UNMAPPING') THEN 'LAINNYA'
                ELSE 'LAINNYA'
            END as ECOSYSTEM_STANDARDIZED
            
        FROM DWHNAS.DWH_MOIS.PS_SCONE_ORDER  -- CORRECTED: Added full table name
        WHERE ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD') -- Data mulai dari 1 Januari 2025
          AND ORDER_ID IS NOT NULL  -- ADDED: Pastikan ada order ID
          AND NCLI IS NOT NULL       -- ADDED: Pastikan ada customer identifier
          AND ND_HSI IS NOT NULL     -- ADDED: Pastikan ada HSI service identifier
    ),
    
    FULFILLMENT_ANALYSIS AS (
        SELECT 
            REGIONAL,
            WITEL,
            DATEL,
            
            -- ADDED: Fundamental metrics berdasarkan ketiga identifier
            COUNT(DISTINCT ORDER_ID) as TOTAL_ORDERS,
            COUNT(DISTINCT NCLI) as TOTAL_CUSTOMERS,
            COUNT(DISTINCT ND_HSI) as TOTAL_HSI_SERVICES,
            
            -- ADDED: Customer-Order-Service relationship metrics
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as AVG_ORDERS_PER_CUSTOMER,
            ROUND(COUNT(DISTINCT ND_HSI) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as AVG_SERVICES_PER_CUSTOMER,
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT ND_HSI), 0), 2) as AVG_ORDERS_PER_SERVICE,
            
            -- Order counts by HSI type (refined with service consideration)
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as TOTAL_HSI_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as HSI_BISNIS_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as HSI_BASIC_ORDERS,
            
            -- ADDED: HSI service counts berdasarkan ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) as TOTAL_HSI_SERVICES_ACTIVE,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ND_HSI END) as HSI_BISNIS_SERVICES,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ND_HSI END) as HSI_BASIC_SERVICES,
            
            -- ADDED: HSI customer counts berdasarkan NCLI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) as TOTAL_HSI_CUSTOMERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN NCLI END) as HSI_BISNIS_CUSTOMERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN NCLI END) as HSI_BASIC_CUSTOMERS,
            
            -- Success counts (order-based)
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_HSI_ORDERS,
                          
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_BISNIS_ORDERS,
                          
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_BASIC_ORDERS,
                          
            -- ADDED: Success counts (service-based)
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ND_HSI END) as SUCCESSFUL_HSI_SERVICES,
                          
            -- ADDED: Success counts (customer-based)
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN NCLI END) as SUCCESSFUL_HSI_CUSTOMERS,
            
            -- Failure counts
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                               AND STATUS_RESUME NOT IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as FAILED_HSI_ORDERS,
            
            -- Bundling success analysis
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_HARD_BUNDLING,
                          
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as TOTAL_HARD_BUNDLING,
            
            -- Digital product success analysis
            COUNT(DISTINCT CASE WHEN IS_PIJAR_SEKOLAH = 1 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_PIJAR,
                          
            COUNT(DISTINCT CASE WHEN IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) as TOTAL_PIJAR,
            
            -- Transaction Type Success Analysis
            COUNT(DISTINCT CASE WHEN TRANSACTION_TYPE = 'PENJUALAN_BARU' 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_NEW_SALES,
            COUNT(DISTINCT CASE WHEN TRANSACTION_TYPE = 'PENJUALAN_BARU' THEN ORDER_ID END) as TOTAL_NEW_SALES,
            
            COUNT(DISTINCT CASE WHEN TRANSACTION_TYPE = 'TAMBAH_LAYANAN' 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_ADD_SERVICE,
            COUNT(DISTINCT CASE WHEN TRANSACTION_TYPE = 'TAMBAH_LAYANAN' THEN ORDER_ID END) as TOTAL_ADD_SERVICE,
            
            COUNT(DISTINCT CASE WHEN TRANSACTION_TYPE = 'MODIFIKASI' 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_MODIFICATION,
            COUNT(DISTINCT CASE WHEN TRANSACTION_TYPE = 'MODIFIKASI' THEN ORDER_ID END) as TOTAL_MODIFICATION,

            -- Ecosystem Success Analysis
            COUNT(DISTINCT CASE WHEN ECOSYSTEM_STANDARDIZED = 'PENDIDIKAN' 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_EDUCATION,
            COUNT(DISTINCT CASE WHEN ECOSYSTEM_STANDARDIZED = 'PENDIDIKAN' THEN ORDER_ID END) as TOTAL_EDUCATION,
            
            COUNT(DISTINCT CASE WHEN ECOSYSTEM_STANDARDIZED = 'PEMERINTAHAN' 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_GOVERNMENT,
            COUNT(DISTINCT CASE WHEN ECOSYSTEM_STANDARDIZED = 'PEMERINTAHAN' THEN ORDER_ID END) as TOTAL_GOVERNMENT,
            
            COUNT(DISTINCT CASE WHEN ECOSYSTEM_STANDARDIZED = 'KESEHATAN' 
                               AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') 
                          THEN ORDER_ID END) as SUCCESSFUL_HEALTHCARE,
            COUNT(DISTINCT CASE WHEN ECOSYSTEM_STANDARDIZED = 'KESEHATAN' THEN ORDER_ID END) as TOTAL_HEALTHCARE,
            
            -- Time analysis for successful orders
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                          AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
                          AND TGL_PS IS NOT NULL AND ORDER_DATE IS NOT NULL 
                     THEN TGL_PS - ORDER_DATE END) as AVG_FULFILLMENT_TIME,
                     
            PERCENTILE_CONT(0.5) WITHIN GROUP (
                ORDER BY CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                              AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
                              AND TGL_PS IS NOT NULL 
                         THEN TGL_PS - ORDER_DATE END
            ) as MEDIAN_FULFILLMENT_TIME,
            
            -- Lead time analysis by product type
            AVG(CASE WHEN IS_HSI_BISNIS = 1 
                          AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
                          AND TGL_PS IS NOT NULL 
                     THEN TGL_PS - ORDER_DATE END) as AVG_BISNIS_FULFILLMENT_TIME,
                     
            AVG(CASE WHEN IS_HSI_BASIC = 1 
                          AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
                          AND TGL_PS IS NOT NULL 
                     THEN TGL_PS - ORDER_DATE END) as AVG_BASIC_FULFILLMENT_TIME,

            -- Lead time analysis by transaction type
            AVG(CASE WHEN TRANSACTION_TYPE = 'PENJUALAN_BARU' 
                          AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
                          AND TGL_PS IS NOT NULL 
                     THEN TGL_PS - ORDER_DATE END) as AVG_NEW_SALES_FULFILLMENT_TIME,
                     
            AVG(CASE WHEN TRANSACTION_TYPE = 'TAMBAH_LAYANAN' 
                          AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
                          AND TGL_PS IS NOT NULL 
                     THEN TGL_PS - ORDER_DATE END) as AVG_ADD_SERVICE_FULFILLMENT_TIME
            
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
        GROUP BY REGIONAL, WITEL, DATEL
        HAVING COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) >= 5
    ),
    
    FULFILLMENT_METRICS AS (
        SELECT *,
            -- Success rates (order-based)
            ROUND(SUCCESSFUL_HSI_ORDERS * 100.0 / NULLIF(TOTAL_HSI_ORDERS, 0), 2) as SUCCESS_RATE_TOTAL,
            ROUND(SUCCESSFUL_BISNIS_ORDERS * 100.0 / NULLIF(HSI_BISNIS_ORDERS, 0), 2) as SUCCESS_RATE_BISNIS,
            ROUND(SUCCESSFUL_BASIC_ORDERS * 100.0 / NULLIF(HSI_BASIC_ORDERS, 0), 2) as SUCCESS_RATE_BASIC,
            ROUND(FAILED_HSI_ORDERS * 100.0 / NULLIF(TOTAL_HSI_ORDERS, 0), 2) as FAILURE_RATE,
            
            -- ADDED: Success rates (service-based)
            ROUND(SUCCESSFUL_HSI_SERVICES * 100.0 / NULLIF(TOTAL_HSI_SERVICES_ACTIVE, 0), 2) as SERVICE_SUCCESS_RATE,
            
            -- ADDED: Success rates (customer-based)
            ROUND(SUCCESSFUL_HSI_CUSTOMERS * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS, 0), 2) as CUSTOMER_SUCCESS_RATE,
            
            -- Bundling success rate
            ROUND(SUCCESSFUL_HARD_BUNDLING * 100.0 / NULLIF(TOTAL_HARD_BUNDLING, 0), 2) as HARD_BUNDLING_SUCCESS_RATE,
            
            -- Digital product success rate
            ROUND(SUCCESSFUL_PIJAR * 100.0 / NULLIF(TOTAL_PIJAR, 0), 2) as PIJAR_SUCCESS_RATE,
            
            -- Transaction Type Success Rates
            ROUND(SUCCESSFUL_NEW_SALES * 100.0 / NULLIF(TOTAL_NEW_SALES, 0), 2) as NEW_SALES_SUCCESS_RATE,
            ROUND(SUCCESSFUL_ADD_SERVICE * 100.0 / NULLIF(TOTAL_ADD_SERVICE, 0), 2) as ADD_SERVICE_SUCCESS_RATE,
            ROUND(SUCCESSFUL_MODIFICATION * 100.0 / NULLIF(TOTAL_MODIFICATION, 0), 2) as MODIFICATION_SUCCESS_RATE,

            -- Ecosystem Success Rates
            ROUND(SUCCESSFUL_EDUCATION * 100.0 / NULLIF(TOTAL_EDUCATION, 0), 2) as EDUCATION_SUCCESS_RATE,
            ROUND(SUCCESSFUL_GOVERNMENT * 100.0 / NULLIF(TOTAL_GOVERNMENT, 0), 2) as GOVERNMENT_SUCCESS_RATE,
            ROUND(SUCCESSFUL_HEALTHCARE * 100.0 / NULLIF(TOTAL_HEALTHCARE, 0), 2) as HEALTHCARE_SUCCESS_RATE,
            
            -- ADDED: Enhanced performance categorization dengan customer dan service metrics
            CASE 
                WHEN SUCCESSFUL_HSI_ORDERS * 100.0 / NULLIF(TOTAL_HSI_ORDERS, 0) >= 95 AND 
                     AVG_FULFILLMENT_TIME <= 7 AND
                     SUCCESSFUL_HSI_CUSTOMERS * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS, 0) >= 90 THEN 'SANGAT_BAIK'
                WHEN SUCCESSFUL_HSI_ORDERS * 100.0 / NULLIF(TOTAL_HSI_ORDERS, 0) >= 90 AND 
                     AVG_FULFILLMENT_TIME <= 10 AND
                     SUCCESSFUL_HSI_CUSTOMERS * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS, 0) >= 85 THEN 'BAIK'
                WHEN SUCCESSFUL_HSI_ORDERS * 100.0 / NULLIF(TOTAL_HSI_ORDERS, 0) >= 85 AND 
                     AVG_FULFILLMENT_TIME <= 14 AND
                     SUCCESSFUL_HSI_CUSTOMERS * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS, 0) >= 80 THEN 'CUKUP'
                WHEN SUCCESSFUL_HSI_ORDERS * 100.0 / NULLIF(TOTAL_HSI_ORDERS, 0) >= 80 THEN 'PERLU_PERBAIKAN'
                ELSE 'KRITIS'
            END as KATEGORI_PERFORMA,
            
            -- ADDED: Enhanced efficiency score dengan customer-service relationship
            ROUND(
                (SUCCESSFUL_HSI_ORDERS * 100.0 / NULLIF(TOTAL_HSI_ORDERS, 0) * 0.4) + 
                (SUCCESSFUL_HSI_CUSTOMERS * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS, 0) * 0.2) +
                (SUCCESSFUL_HSI_SERVICES * 100.0 / NULLIF(TOTAL_HSI_SERVICES_ACTIVE, 0) * 0.2) +
                (CASE WHEN AVG_FULFILLMENT_TIME <= 7 THEN 20
                      WHEN AVG_FULFILLMENT_TIME <= 10 THEN 15
                      WHEN AVG_FULFILLMENT_TIME <= 14 THEN 10
                      ELSE 5 END * 0.2)
            , 1) as SKOR_EFISIENSI
            
        FROM FULFILLMENT_ANALYSIS
    )
    SELECT 
        REGIONAL,
        WITEL,
        DATEL,
        TOTAL_ORDERS,
        TOTAL_CUSTOMERS,
        TOTAL_HSI_SERVICES,
        TOTAL_HSI_ORDERS,
        HSI_BISNIS_ORDERS,
        HSI_BASIC_ORDERS,
        TOTAL_HSI_SERVICES_ACTIVE,
        TOTAL_HSI_CUSTOMERS,
        AVG_ORDERS_PER_CUSTOMER,
        AVG_SERVICES_PER_CUSTOMER,
        AVG_ORDERS_PER_SERVICE,
        SUCCESSFUL_HSI_ORDERS,
        SUCCESSFUL_HSI_SERVICES,
        SUCCESSFUL_HSI_CUSTOMERS,
        FAILED_HSI_ORDERS,
        SUCCESS_RATE_TOTAL,
        SUCCESS_RATE_BISNIS,
        SUCCESS_RATE_BASIC,
        SERVICE_SUCCESS_RATE,
        CUSTOMER_SUCCESS_RATE,
        FAILURE_RATE,
        HARD_BUNDLING_SUCCESS_RATE,
        PIJAR_SUCCESS_RATE,
        NEW_SALES_SUCCESS_RATE,
        ADD_SERVICE_SUCCESS_RATE,
        MODIFICATION_SUCCESS_RATE,
        EDUCATION_SUCCESS_RATE,
        GOVERNMENT_SUCCESS_RATE,
        HEALTHCARE_SUCCESS_RATE,
        ROUND(AVG_FULFILLMENT_TIME, 1) as AVG_FULFILLMENT_DAYS,
        ROUND(MEDIAN_FULFILLMENT_TIME, 1) as MEDIAN_FULFILLMENT_DAYS,
        ROUND(AVG_BISNIS_FULFILLMENT_TIME, 1) as AVG_BISNIS_FULFILLMENT_DAYS,
        ROUND(AVG_BASIC_FULFILLMENT_TIME, 1) as AVG_BASIC_FULFILLMENT_DAYS,
        ROUND(AVG_NEW_SALES_FULFILLMENT_TIME, 1) as AVG_NEW_SALES_FULFILLMENT_DAYS,
        ROUND(AVG_ADD_SERVICE_FULFILLMENT_TIME, 1) as AVG_ADD_SERVICE_FULFILLMENT_DAYS,
        KATEGORI_PERFORMA,
        SKOR_EFISIENSI,
        RANK() OVER (ORDER BY SUCCESS_RATE_TOTAL DESC, TOTAL_HSI_ORDERS DESC) as RANKING_NASIONAL,
        RANK() OVER (ORDER BY CUSTOMER_SUCCESS_RATE DESC, TOTAL_HSI_CUSTOMERS DESC) as RANKING_CUSTOMER_NASIONAL,
        RANK() OVER (ORDER BY SERVICE_SUCCESS_RATE DESC, TOTAL_HSI_SERVICES_ACTIVE DESC) as RANKING_SERVICE_NASIONAL
    FROM FULFILLMENT_METRICS
    ORDER BY SUCCESS_RATE_TOTAL DESC, TOTAL_HSI_ORDERS DESC
  `,

  BUSINESS_LOGIC: {
    assessFulfillmentHealth: function(success_rate, customer_success_rate, service_success_rate, avg_time, total_orders) {
      let health_score = 0;
      
      // Komponen tingkat keberhasilan order (40%)
      if (success_rate >= 95) health_score += 40;
      else if (success_rate >= 90) health_score += 32;
      else if (success_rate >= 85) health_score += 24;
      else if (success_rate >= 80) health_score += 16;
      else health_score += 8;
      
      // ADDED: Komponen tingkat keberhasilan customer (20%)
      if (customer_success_rate >= 90) health_score += 20;
      else if (customer_success_rate >= 85) health_score += 16;
      else if (customer_success_rate >= 80) health_score += 12;
      else health_score += 6;
      
      // ADDED: Komponen tingkat keberhasilan service (20%)
      if (service_success_rate >= 90) health_score += 20;
      else if (service_success_rate >= 85) health_score += 16;
      else if (service_success_rate >= 80) health_score += 12;
      else health_score += 6;
      
      // Komponen efisiensi waktu (20%)
      if (avg_time <= 7) health_score += 20;
      else if (avg_time <= 10) health_score += 15;
      else if (avg_time <= 14) health_score += 10;
      else health_score += 5;
      
      const healthCategories = {
        'SEHAT': {
          description: 'Fulfillment berjalan sangat baik dengan tingkat keberhasilan tinggi di semua dimensi sepanjang 2025',
          tindakan: 'Pertahankan standar excellence dan dokumentasikan best practice untuk sisa 2025'
        },
        'STABIL': {
          description: 'Performa fulfillment dalam kondisi baik namun ada ruang optimasi di beberapa dimensi dalam 2025',
          tindakan: 'Identifikasi area perbaikan dan lakukan fine tuning untuk Q4 2025'
        },
        'BERISIKO': {
          description: 'Ada indikasi masalah dalam proses fulfillment YTD 2025, terutama di level customer atau service',
          tindakan: 'Analisis mendalam dan rencana perbaikan terstruktur untuk closing kuat 2025'
        },
        'KRITIS': {
          description: 'Fulfillment mengalami masalah serius di multiple dimensi dalam 2025',
          tindakan: 'Intervensi segera dan audit proses menyeluruh sebelum 2026'
        }
      };
      
      if (health_score >= 85) return { kategori: 'SEHAT', skor: health_score, ...healthCategories['SEHAT'] };
      if (health_score >= 70) return { kategori: 'STABIL', skor: health_score, ...healthCategories['STABIL'] };
      if (health_score >= 50) return { kategori: 'BERISIKO', skor: health_score, ...healthCategories['BERISIKO'] };
      return { kategori: 'KRITIS', skor: health_score, ...healthCategories['KRITIS'] };
    },
    
    generateActionPlan: function(performance_category, success_rate, customer_success_rate, service_success_rate, avg_time, total_orders) {
      const plans = {
        'KRITIS': {
          prioritas: 'SANGAT TINGGI',
          timeline: '1-2 minggu (urgent untuk Q4 2025)',
          tindakan: [
            'Audit menyeluruh proses fulfillment multi-dimensi sebelum akhir 2025',
            'Identifikasi bottleneck yang mempengaruhi customer dan service success rate',
            'Eskalasi ke manajemen untuk resource tambahan Q4 2025',
            'Daily monitoring customer dan service metrics sampai 2026'
          ]
        },
        'PERLU_PERBAIKAN': {
          prioritas: 'TINGGI',
          timeline: '2-4 minggu (sebelum akhir 2025)',
          tindakan: [
            'Analisis root cause kegagalan di level order, customer, dan service',
            'Pelatihan tim untuk gap yang teridentifikasi di setiap dimensi',
            'Perbaikan SOP dan workflow untuk standar multi-dimensi 2026',
            'Monitoring mingguan progress customer dan service success rate'
          ]
        },
        'CUKUP': {
          prioritas: 'SEDANG',
          timeline: '1-2 bulan (preparation untuk 2026)',
          tindakan: [
            'Optimasi proses untuk meningkatkan customer experience dan service quality',
            'Sharing best practice antar tim untuk multi-dimensional excellence',
            'Implementasi preventive measure berbasis customer dan service analytics',
            'Monitoring bulanan untuk maintain progress di semua dimensi'
          ]
        },
        'BAIK': {
          prioritas: 'RENDAH',
          timeline: '2-3 bulan (planning 2026)',
          tindakan: [
            'Pertahankan standar YTD 2025 yang sudah baik di semua dimensi',
            'Continuous improvement initiatives untuk customer dan service excellence 2026',
            'Dokumentasi knowledge base multi-dimensional',
            'Quarterly review untuk maintain excellence di order, customer, dan service'
          ]
        },
        'SANGAT_BAIK': {
          prioritas: 'MAINTENANCE',
          timeline: 'Ongoing (benchmark untuk 2026)',
          tindakan: [
            'Pertahankan excellence standards yang dicapai dalam 2025 di semua dimensi',
            'Mentoring unit lain untuk replikasi multi-dimensional success',
            'Innovation dan process enhancement untuk leadership 2026',
            'Benchmark setting untuk standar nasional customer dan service excellence'
          ]
        }
      };
      
      return plans[performance_category] || {
        prioritas: 'EVALUASI',
        timeline: 'TBD',
        tindakan: ['Diperlukan analisis khusus sesuai kondisi spesifik multi-dimensional']
      };
    },
    
    analyzeFulfillmentTrends: function(data) {
      const analysis = {
        periode_analisis: 'Tahun 2025 (Januari hingga saat ini)',
        total_unit: data.length,
        distribusi_performa: {},
        unit_terbaik: [],
        unit_terburuk: [],
        unit_customer_excellence: [],
        unit_service_excellence: [],
        insights: []
      };
      
      // Performance distribution
      analysis.distribusi_performa = {
        sangat_baik: data.filter(d => d.KATEGORI_PERFORMA === 'SANGAT_BAIK').length,
        baik: data.filter(d => d.KATEGORI_PERFORMA === 'BAIK').length,
        cukup: data.filter(d => d.KATEGORI_PERFORMA === 'CUKUP').length,
        perlu_perbaikan: data.filter(d => d.KATEGORI_PERFORMA === 'PERLU_PERBAIKAN').length,
        kritis: data.filter(d => d.KATEGORI_PERFORMA === 'KRITIS').length
      };
      
      // Top and bottom performers
      analysis.unit_terbaik = data
        .filter(d => d.KATEGORI_PERFORMA === 'SANGAT_BAIK')
        .slice(0, 5)
        .map(d => ({
          regional: d.REGIONAL,
          witel: d.WITEL,
          success_rate: `${d.SUCCESS_RATE_TOTAL}%`,
          customer_success_rate: `${d.CUSTOMER_SUCCESS_RATE}%`,
          service_success_rate: `${d.SERVICE_SUCCESS_RATE}%`,
          avg_time: `${d.AVG_FULFILLMENT_DAYS} hari`,
          total_orders: d.TOTAL_HSI_ORDERS
        }));
        
      analysis.unit_terburuk = data
        .filter(d => d.KATEGORI_PERFORMA === 'KRITIS')
        .slice(0, 5)
        .map(d => ({
          regional: d.REGIONAL,
          witel: d.WITEL,
          success_rate: `${d.SUCCESS_RATE_TOTAL}%`,
          customer_success_rate: `${d.CUSTOMER_SUCCESS_RATE}%`,
          service_success_rate: `${d.SERVICE_SUCCESS_RATE}%`,
          avg_time: `${d.AVG_FULFILLMENT_DAYS} hari`,
          total_orders: d.TOTAL_HSI_ORDERS
        }));
        
      // ADDED: Customer excellence units
      analysis.unit_customer_excellence = data
        .sort((a, b) => b.CUSTOMER_SUCCESS_RATE - a.CUSTOMER_SUCCESS_RATE)
        .slice(0, 5)
        .map(d => ({
          regional: d.REGIONAL,
          witel: d.WITEL,
          customer_success_rate: `${d.CUSTOMER_SUCCESS_RATE}%`,
          total_customers: d.TOTAL_HSI_CUSTOMERS,
          ranking: d.RANKING_CUSTOMER_NASIONAL
        }));
        
      // ADDED: Service excellence units
      analysis.unit_service_excellence = data
        .sort((a, b) => b.SERVICE_SUCCESS_RATE - a.SERVICE_SUCCESS_RATE)
        .slice(0, 5)
        .map(d => ({
          regional: d.REGIONAL,
          witel: d.WITEL,
          service_success_rate: `${d.SERVICE_SUCCESS_RATE}%`,
          total_services: d.TOTAL_HSI_SERVICES_ACTIVE,
          ranking: d.RANKING_SERVICE_NASIONAL
        }));
      
      // Generate insights
      const avg_success_rate = data.reduce((sum, d) => sum + d.SUCCESS_RATE_TOTAL, 0) / data.length;
      const avg_customer_success = data.reduce((sum, d) => sum + d.CUSTOMER_SUCCESS_RATE, 0) / data.length;
      const avg_service_success = data.reduce((sum, d) => sum + d.SERVICE_SUCCESS_RATE, 0) / data.length;
      const avg_fulfillment_time = data.reduce((sum, d) => sum + d.AVG_FULFILLMENT_DAYS, 0) / data.length;
      
      analysis.insights.push(`Rata-rata tingkat keberhasilan fulfillment order HSI dalam 2025 adalah ${avg_success_rate.toFixed(1)}%`);
      analysis.insights.push(`Rata-rata tingkat keberhasilan customer HSI dalam 2025 adalah ${avg_customer_success.toFixed(1)}%`);
      analysis.insights.push(`Rata-rata tingkat keberhasilan service HSI dalam 2025 adalah ${avg_service_success.toFixed(1)}%`);
      analysis.insights.push(`Rata-rata waktu fulfillment YTD 2025 adalah ${avg_fulfillment_time.toFixed(1)} hari`);
      
      if (analysis.distribusi_performa.kritis > 0) {
        analysis.insights.push(`Terdapat ${analysis.distribusi_performa.kritis} unit dengan performa kritis yang memerlukan perhatian segera untuk closing 2025`);
      }
      
      // ADDED: Multi-dimensional insights
      const order_customer_gap = data.filter(d => Math.abs(d.SUCCESS_RATE_TOTAL - d.CUSTOMER_SUCCESS_RATE) > 10).length;
      if (order_customer_gap > 0) {
        analysis.insights.push(`${order_customer_gap} unit memiliki gap signifikan antara success rate order dan customer - indikasi masalah customer experience`);
      }
      
      const service_performance_low = data.filter(d => d.SERVICE_SUCCESS_RATE < 80).length;
      if (service_performance_low > 0) {
        analysis.insights.push(`${service_performance_low} unit memiliki service success rate rendah - perlu optimisasi service delivery`);
      }
      
      // YTD 2025 specific insights
      const excellent_units = analysis.distribusi_performa.sangat_baik + analysis.distribusi_performa.baik;
      const total_units = analysis.total_unit;
      const excellence_rate = (excellent_units / total_units * 100).toFixed(1);
      analysis.insights.push(`${excellence_rate}% unit mencapai performa baik atau sangat baik dalam 2025`);
      
      return analysis;
    },
    
    formatIndonesianResponse: function(data) {
      const trends = this.analyzeFulfillmentTrends(data);
      
      const hasil_analisis = data.map(unit => {
        const health = this.assessFulfillmentHealth(
          unit.SUCCESS_RATE_TOTAL,
          unit.CUSTOMER_SUCCESS_RATE,
          unit.SERVICE_SUCCESS_RATE,
          unit.AVG_FULFILLMENT_DAYS,
          unit.TOTAL_HSI_ORDERS
        );
        
        const actionPlan = this.generateActionPlan(
          unit.KATEGORI_PERFORMA,
          unit.SUCCESS_RATE_TOTAL,
          unit.CUSTOMER_SUCCESS_RATE,
          unit.SERVICE_SUCCESS_RATE,
          unit.AVG_FULFILLMENT_DAYS,
          unit.TOTAL_HSI_ORDERS
        );
        
        return {
          identitas_unit: {
            regional: unit.REGIONAL,
            witel: unit.WITEL,
            datel: unit.DATEL
          },
          
          metrik_volume: {
            total_order: unit.TOTAL_ORDERS.toLocaleString('id-ID'),
            total_customer: unit.TOTAL_CUSTOMERS.toLocaleString('id-ID'),
            total_layanan_hsi: unit.TOTAL_HSI_SERVICES.toLocaleString('id-ID'),
            efisiensi_customer: `${unit.AVG_ORDERS_PER_CUSTOMER} order/customer`,
            efisiensi_layanan: `${unit.AVG_ORDERS_PER_SERVICE} order/layanan`,
            penetrasi_multi_service: `${unit.AVG_SERVICES_PER_CUSTOMER} layanan/customer`
          },
          
          metrik_fulfillment: {
            total_order_hsi: unit.TOTAL_HSI_ORDERS.toLocaleString('id-ID'),
            order_hsi_bisnis: unit.HSI_BISNIS_ORDERS.toLocaleString('id-ID'),
            order_hsi_basic: unit.HSI_BASIC_ORDERS.toLocaleString('id-ID'),
            total_customer_hsi: unit.TOTAL_HSI_CUSTOMERS.toLocaleString('id-ID'),
            total_layanan_hsi_aktif: unit.TOTAL_HSI_SERVICES_ACTIVE.toLocaleString('id-ID'),
            order_berhasil: unit.SUCCESSFUL_HSI_ORDERS.toLocaleString('id-ID'),
            customer_berhasil: unit.SUCCESSFUL_HSI_CUSTOMERS.toLocaleString('id-ID'),
            layanan_berhasil: unit.SUCCESSFUL_HSI_SERVICES.toLocaleString('id-ID'),
            order_gagal: unit.FAILED_HSI_ORDERS.toLocaleString('id-ID')
          },
          
          tingkat_keberhasilan: {
            order_success_rate: `${unit.SUCCESS_RATE_TOTAL}%`,
            customer_success_rate: `${unit.CUSTOMER_SUCCESS_RATE}%`,
            service_success_rate: `${unit.SERVICE_SUCCESS_RATE}%`,
            bisnis_success_rate: `${unit.SUCCESS_RATE_BISNIS || 0}%`,
            basic_success_rate: `${unit.SUCCESS_RATE_BASIC || 0}%`,
            failure_rate: `${unit.FAILURE_RATE}%`
          },
          
          analisis_waktu: {
            rata_rata_fulfillment: `${unit.AVG_FULFILLMENT_DAYS} hari`,
            median_fulfillment: `${unit.MEDIAN_FULFILLMENT_DAYS} hari`,
            rata_rata_bisnis: `${unit.AVG_BISNIS_FULFILLMENT_DAYS || 0} hari`,
            rata_rata_basic: `${unit.AVG_BASIC_FULFILLMENT_DAYS || 0} hari`,
            rata_rata_penjualan_baru: `${unit.AVG_NEW_SALES_FULFILLMENT_DAYS || 0} hari`,
            rata_rata_tambah_layanan: `${unit.AVG_ADD_SERVICE_FULFILLMENT_DAYS || 0} hari`
          },
          
          performa_bundling: {
            keberhasilan_hard_bundling: `${unit.HARD_BUNDLING_SUCCESS_RATE || 0}%`,
            keberhasilan_pijar: `${unit.PIJAR_SUCCESS_RATE || 0}%`
          },
          
          analisis_jenis_transaksi: {
            keberhasilan_penjualan_baru: `${unit.NEW_SALES_SUCCESS_RATE || 0}%`,
            keberhasilan_tambah_layanan: `${unit.ADD_SERVICE_SUCCESS_RATE || 0}%`,
            keberhasilan_modifikasi: `${unit.MODIFICATION_SUCCESS_RATE || 0}%`
          },
          
          analisis_ekosistem: {
            keberhasilan_pendidikan: `${unit.EDUCATION_SUCCESS_RATE || 0}%`,
            keberhasilan_pemerintahan: `${unit.GOVERNMENT_SUCCESS_RATE || 0}%`,
            keberhasilan_kesehatan: `${unit.HEALTHCARE_SUCCESS_RATE || 0}%`
          },
          
          evaluasi_kesehatan: {
            kategori_performa: unit.KATEGORI_PERFORMA.replace('_', ' '),
            skor_efisiensi: unit.SKOR_EFISIENSI,
            status_kesehatan: health.kategori,
            ranking_order_nasional: unit.RANKING_NASIONAL,
            ranking_customer_nasional: unit.RANKING_CUSTOMER_NASIONAL,
            ranking_service_nasional: unit.RANKING_SERVICE_NASIONAL
          },
          
          rencana_tindakan: actionPlan
        };
      });
      
      return {
        ringkasan: 'Analisis Tingkat Keberhasilan Fulfillment Order HSI Multi-Dimensional',
        periode_analisis: trends.periode_analisis,
        total_unit_dianalisis: trends.total_unit,
        
        distribusi_performa: trends.distribusi_performa,
        
        unit_unggulan: {
          performa_terbaik: trends.unit_terbaik,
          customer_excellence: trends.unit_customer_excellence,
          service_excellence: trends.unit_service_excellence
        },
        
        unit_perlu_perhatian: trends.unit_terburuk,
        
        insight_utama: trends.insights,
        
        target_kpi: {
          tingkat_keberhasilan_order: '≥ 95%',
          tingkat_keberhasilan_customer: '≥ 90%',
          tingkat_keberhasilan_service: '≥ 90%',
          waktu_fulfillment: '≤ 7 hari',
          kategori_performa: 'BAIK atau lebih tinggi'
        },
        
        detail_unit: hasil_analisis.slice(0, 15),
        
        rekomendasi_strategis: [
          'Prioritaskan unit dengan kategori kritis untuk intervensi segera sebelum akhir 2025',
          'Replikasi best practice dari unit dengan performa sangat baik ke seluruh jaringan',
          'Implementasi sistem early warning untuk monitoring real-time fulfillment multi-dimensional',
          'Standardisasi proses fulfillment untuk mengurangi variabilitas antar unit di semua dimensi',
          'Optimasi proses berdasarkan jenis transaksi yang paling bermasalah dalam 2025',
          'Kembangkan pendekatan khusus untuk ekosistem dengan tingkat keberhasilan rendah',
          'Focus pada peningkatan customer success rate untuk meningkatkan customer satisfaction',
          'Optimasi service delivery untuk meningkatkan service success rate dan efficiency',
          'Implementasi customer journey mapping untuk memahami gap antara order dan customer success',
          'Persiapan infrastructure dan capacity untuk target ambitious multi-dimensional 2026'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = patternMatcher.calculateConfidence(userInput, module.exports.KEYWORD_PATTERNS);
      const lowerInput = userInput.toLowerCase();
      
      // Determine focus area based on input patterns
      let focus_area = 'keberhasilan_umum';
      if (lowerInput.includes('fulfillment') || lowerInput.includes('penyelesaian')) {
        focus_area = 'fulfillment_spesifik';
      } else if (lowerInput.includes('customer') || lowerInput.includes('pelanggan')) {
        focus_area = 'customer_success';
      } else if (lowerInput.includes('service') || lowerInput.includes('layanan')) {
        focus_area = 'service_success';
      } else if (lowerInput.includes('waktu') || lowerInput.includes('durasi') || lowerInput.includes('time')) {
        focus_area = 'analisis_waktu';
      } else if (lowerInput.includes('regional') || lowerInput.includes('witel') || lowerInput.includes('geografis')) {
        focus_area = 'performa_geografis';
      } else if (lowerInput.includes('transaksi') || lowerInput.includes('transaction') || lowerInput.includes('jenis')) {
        focus_area = 'analisis_transaksi';
      }
      
      return {
        matches: confidence >= 70,
        confidence: confidence,
        focus_area: focus_area,
        requires_time_analysis: lowerInput.includes('waktu') || lowerInput.includes('durasi') || lowerInput.includes('time'),
        requires_geographic_breakdown: lowerInput.includes('regional') || lowerInput.includes('witel') || lowerInput.includes('geografis'),
        requires_performance_ranking: lowerInput.includes('ranking') || lowerInput.includes('terbaik') || lowerInput.includes('terburuk'),
        requires_customer_focus: lowerInput.includes('customer') || lowerInput.includes('pelanggan'),
        requires_service_focus: lowerInput.includes('service') || lowerInput.includes('layanan')
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};