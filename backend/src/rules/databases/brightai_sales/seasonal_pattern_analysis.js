const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_011',
    RULE_NAME: 'seasonal_pattern_analysis',
    DESCRIPTION: 'Analisis pola musiman order HSI dengan klasifikasi produk menggunakan identifikasi customer-order-layanan yang akurat',
    DATABASE: 'BRIGHTAI_SALES',
    CATEGORY: 'Seasonal Analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'MEDIUM',
    CACHE_DURATION: 21600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_SALES"),

  KEYWORD_PATTERNS: {
    primary: [
      // Seasonal pattern - yang biasa digunakan
      'pola musiman', 'seasonal pattern', 'tren bulanan', 'pattern tahunan',
      'musiman hsi', 'seasonal hsi', 'pola order', 'trend musiman',
      
      // Time-based analysis familiar
      'analisis bulanan', 'monthly analysis', 'tren waktu', 'time trend',
      'pola tahunan', 'yearly pattern', 'siklus order', 'cyclical pattern'
    ],
    
    supporting: [
      // Time terms familiar
      'bulan', 'month', 'tahun', 'year', 'musim', 'season',
      'periode', 'period', 'waktu', 'time', 'siklus', 'cycle',
      
      // Pattern terms
      'pola', 'pattern', 'tren', 'trend', 'fluktuasi', 'fluctuation',
      'variasi', 'variation', 'volatilitas', 'volatility',
      
      // Analysis context
      'forecasting', 'prediksi', 'ramalan', 'planning', 'perencanaan'
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
        score = 75 + (primaryMatches * 12) + (supportingMatches * 3);
      } else if (lowerInput.includes('musiman') || lowerInput.includes('seasonal')) {
        score = 65;
      } else if (lowerInput.includes('pola') && lowerInput.includes('bulan')) {
        score = 60;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_CLASSIFICATION AS (
        SELECT 
            ORDER_ID,          -- Kolom krusial untuk identifikasi unik order
            NCLI,              -- Kolom krusial untuk identifikasi customer
            ND_HSI,            -- Kolom krusial untuk identifikasi layanan HSI
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
                THEN 'Add or Modify Service'
                
                ELSE 'Non Bundling'
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
            
            -- Voice service identification
            CASE WHEN ND_VOICE IS NOT NULL AND TRIM(ND_VOICE) != '' THEN 1 ELSE 0 END as HAS_VOICE,
            
            -- Customer Transaction Type Classification (from TYPE_TRANS)
            CASE 
                WHEN TYPE_TRANS = 'NEW SALES' THEN 'Penjualan Baru'
                WHEN TYPE_TRANS IN ('ADD SERVICE', 'MODIFICATION') THEN 'Ekspansi Layanan'
                WHEN TYPE_TRANS = 'RO' THEN 'Resume Layanan'
                WHEN TYPE_TRANS = 'DO' THEN 'Putus Layanan'
                WHEN TYPE_TRANS = 'SO' THEN 'Suspend Layanan'
                WHEN TYPE_TRANS = 'PDA' THEN 'Pindah Alamat'
                WHEN TYPE_TRANS = 'MIGRASI' THEN 'Migrasi'
                ELSE 'Lainnya'
            END as TRANSACTION_TYPE,
            
            -- Target Ecosystem Classification (from EKOSISTEM)
            CASE 
                WHEN UPPER(EKOSISTEM) IN ('EDUCATION', 'SEKOLAH', 'PESANTREN') THEN 'Pendidikan'
                WHEN UPPER(EKOSISTEM) IN ('GOVERNMENT') THEN 'Pemerintahan' 
                WHEN UPPER(EKOSISTEM) IN ('HEALTH', 'KLINIK', 'HEALTY') THEN 'Kesehatan'
                WHEN UPPER(EKOSISTEM) IN ('HOTEL', 'PROPERTY', 'APARTEMEN') THEN 'Hospitalitas'
                WHEN UPPER(EKOSISTEM) IN ('AGRI', 'AGRICULTURE') THEN 'Pertanian'
                WHEN UPPER(EKOSISTEM) IN ('MEDIA DAN KOMUNIKASI', 'MEDIA & KOMUNIKASI', 'MEDIA AND COMMUNICATION', 'COMMUNICATION', 'MEDIA&COMUNICATION', 'MEDIA DAN COMMUNICATION') THEN 'Media Komunikasi'
                WHEN UPPER(EKOSISTEM) IN ('MANUFAKTUR', 'PABRIKASI') THEN 'Manufaktur'
                ELSE 'Lainnya'
            END as CUSTOMER_ECOSYSTEM,
            
            -- Customer Tenure Analysis (from TGL_PSB)
            CASE 
                WHEN TGL_PSB IS NOT NULL AND ORDER_DATE IS NOT NULL 
                THEN MONTHS_BETWEEN(ORDER_DATE, TGL_PSB)
                ELSE NULL
            END as CUSTOMER_TENURE_MONTHS,
            
            CASE 
                WHEN TGL_PSB IS NOT NULL AND ORDER_DATE IS NOT NULL THEN
                    CASE 
                        WHEN MONTHS_BETWEEN(ORDER_DATE, TGL_PSB) <= 12 THEN 'Customer Baru'
                        WHEN MONTHS_BETWEEN(ORDER_DATE, TGL_PSB) <= 36 THEN 'Customer Established'
                        ELSE 'Customer Jangka Panjang'
                    END
                ELSE 'Tenure Tidak Diketahui'
            END as CUSTOMER_VINTAGE
            
        FROM DWH_MOIS.BRIGHTAI_SALES
        WHERE ORDER_DATE >= ADD_MONTHS(SYSDATE, -24) -- 2 years data for seasonal analysis
          AND ORDER_ID IS NOT NULL    -- Pastikan ORDER_ID tidak null
          AND NCLI IS NOT NULL        -- Pastikan NCLI tidak null
          AND ND_HSI IS NOT NULL      -- Pastikan ND_HSI tidak null untuk layanan HSI
    ),
    
    MONTHLY_PATTERNS AS (
        SELECT 
            EXTRACT(YEAR FROM ORDER_DATE) as tahun,
            EXTRACT(MONTH FROM ORDER_DATE) as bulan,
            CASE EXTRACT(MONTH FROM ORDER_DATE)
                WHEN 1 THEN 'Januari'
                WHEN 2 THEN 'Februari'
                WHEN 3 THEN 'Maret'
                WHEN 4 THEN 'April'
                WHEN 5 THEN 'Mei'
                WHEN 6 THEN 'Juni'
                WHEN 7 THEN 'Juli'
                WHEN 8 THEN 'Agustus'
                WHEN 9 THEN 'September'
                WHEN 10 THEN 'Oktober'
                WHEN 11 THEN 'November'
                WHEN 12 THEN 'Desember'
            END as nama_bulan,
            
            -- Fundamental metrics menggunakan ketiga kolom krusial
            COUNT(DISTINCT ORDER_ID) as total_pesanan,           -- Jumlah unique order
            COUNT(DISTINCT NCLI) as total_pelanggan_unik,        -- Jumlah unique customer
            COUNT(DISTINCT ND_HSI) as total_layanan_hsi_unik,    -- Jumlah unique layanan HSI
            
            -- Customer-Order-Service relationship metrics
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as rata_rata_order_per_pelanggan,
            ROUND(COUNT(DISTINCT ND_HSI) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as rata_rata_layanan_per_pelanggan,
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT ND_HSI), 0), 2) as rata_rata_order_per_layanan,
            
            -- HSI Order counts berdasarkan data aktual menggunakan ORDER_ID
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as total_hsi_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as hsi_bisnis_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as hsi_basic_orders,
            
            -- HSI Customer counts menggunakan NCLI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) as total_hsi_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN NCLI END) as hsi_bisnis_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN NCLI END) as hsi_basic_customers,
            
            -- HSI Service counts menggunakan ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) as total_hsi_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ND_HSI END) as hsi_bisnis_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ND_HSI END) as hsi_basic_services,
            
            -- Success rates berdasarkan ORDER_ID
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                           AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') THEN ORDER_ID END) as successful_hsi_orders,
            
            -- Bundling patterns berdasarkan ORDER_ID
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as hard_bundling_orders,
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE IN ('Hard Bundling', 'Bundling A La Carte') THEN ORDER_ID END) as total_bundling_orders,
            
            -- Digital product patterns berdasarkan ORDER_ID
            COUNT(DISTINCT CASE WHEN (IS_PIJAR_SEKOLAH = 1 OR IS_OCA_INTERACTION = 1 OR 
                            IS_OCA_BLAST = 1 OR IS_NETMONK = 1) THEN ORDER_ID END) as digital_orders,
            
            -- Service combination patterns berdasarkan ORDER_ID dan ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND HAS_VOICE = 1 THEN ORDER_ID END) as voice_combo_orders,
            
            -- Average bandwidth analysis
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                     AND CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) > 0
                THEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) END) as avg_bandwidth_kbps,
            
            -- Geographic spread
            COUNT(DISTINCT REGIONAL) as active_regions,
            COUNT(DISTINCT WITEL) as active_witel,
            
            -- Transaction Type Seasonal Analysis berdasarkan ORDER_ID
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND TRANSACTION_TYPE = 'Penjualan Baru' THEN ORDER_ID END) as new_sales_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND TRANSACTION_TYPE = 'Ekspansi Layanan' THEN ORDER_ID END) as expansion_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND TRANSACTION_TYPE = 'Putus Layanan' THEN ORDER_ID END) as disconnect_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND TRANSACTION_TYPE = 'Resume Layanan' THEN ORDER_ID END) as resume_orders,
            
            -- Ecosystem Seasonal Distribution berdasarkan ORDER_ID
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_ECOSYSTEM = 'Pendidikan' THEN ORDER_ID END) as education_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_ECOSYSTEM = 'Pemerintahan' THEN ORDER_ID END) as government_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_ECOSYSTEM = 'Hospitalitas' THEN ORDER_ID END) as hospitality_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_ECOSYSTEM = 'Pertanian' THEN ORDER_ID END) as agriculture_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_ECOSYSTEM = 'Manufaktur' THEN ORDER_ID END) as manufacturing_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_ECOSYSTEM = 'Kesehatan' THEN ORDER_ID END) as healthcare_orders,
            
            -- Customer Tenure Seasonal Analysis berdasarkan ORDER_ID
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_VINTAGE = 'Customer Baru' THEN ORDER_ID END) as new_customer_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_VINTAGE = 'Customer Established' THEN ORDER_ID END) as established_customer_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_VINTAGE = 'Customer Jangka Panjang' THEN ORDER_ID END) as longterm_customer_orders,
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND CUSTOMER_TENURE_MONTHS IS NOT NULL 
                THEN CUSTOMER_TENURE_MONTHS END) as avg_customer_tenure_months
            
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
        GROUP BY EXTRACT(YEAR FROM ORDER_DATE), EXTRACT(MONTH FROM ORDER_DATE)
    ),
    
    SEASONAL_STATISTICS AS (
        SELECT 
            bulan,
            nama_bulan,
            
            -- Fundamental statistics dengan metrik yang telah diperbaiki
            AVG(total_pesanan) as avg_total_pesanan,
            AVG(total_pelanggan_unik) as avg_total_pelanggan,
            AVG(total_layanan_hsi_unik) as avg_total_layanan_hsi,
            AVG(rata_rata_order_per_pelanggan) as avg_order_per_pelanggan_ratio,
            AVG(rata_rata_layanan_per_pelanggan) as avg_layanan_per_pelanggan_ratio,
            AVG(rata_rata_order_per_layanan) as avg_order_per_layanan_ratio,
            
            -- Order volume statistics
            AVG(total_hsi_orders) as avg_total_hsi_orders,
            STDDEV(total_hsi_orders) as stddev_total_orders,
            MIN(total_hsi_orders) as min_total_orders,
            MAX(total_hsi_orders) as max_total_orders,
            
            -- Customer statistics  
            AVG(total_hsi_customers) as avg_total_hsi_customers,
            AVG(hsi_bisnis_customers) as avg_bisnis_customers,
            AVG(hsi_basic_customers) as avg_basic_customers,
            
            -- Service statistics
            AVG(total_hsi_services) as avg_total_hsi_services,
            AVG(hsi_bisnis_services) as avg_bisnis_services,
            AVG(hsi_basic_services) as avg_basic_services,
            
            -- Product mix statistics
            AVG(hsi_bisnis_orders) as avg_bisnis_orders,
            AVG(hsi_basic_orders) as avg_basic_orders,
            AVG(hsi_bisnis_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_bisnis_mix_pct,
            AVG(hsi_basic_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_basic_mix_pct,
            
            -- Success rate statistics
            AVG(successful_hsi_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_success_rate,
            
            -- Bundling statistics
            AVG(total_bundling_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_bundling_rate,
            AVG(hard_bundling_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_hard_bundling_rate,
            
            -- Digital penetration statistics
            AVG(digital_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_digital_penetration,
            
            -- Service combination statistics
            AVG(voice_combo_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_voice_combo_rate,
            
            -- Technical statistics
            AVG(avg_bandwidth_kbps) as avg_monthly_bandwidth_kbps,
            AVG(active_regions) as avg_regional_coverage,
            
            -- Transaction Type Seasonal Patterns
            AVG(new_sales_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_new_sales_mix_pct,
            AVG(expansion_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_expansion_mix_pct,
            AVG(disconnect_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_disconnect_rate_pct,
            AVG(resume_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_resume_rate_pct,
            
            -- Ecosystem Seasonal Patterns
            AVG(education_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_education_mix_pct,
            AVG(government_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_government_mix_pct,
            AVG(hospitality_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_hospitality_mix_pct,
            AVG(agriculture_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_agriculture_mix_pct,
            AVG(manufacturing_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_manufacturing_mix_pct,
            AVG(healthcare_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_healthcare_mix_pct,
            
            -- Customer Tenure Seasonal Patterns
            AVG(new_customer_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_new_customer_mix_pct,
            AVG(established_customer_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_established_mix_pct,
            AVG(longterm_customer_orders * 100.0 / NULLIF(total_hsi_orders, 0)) as avg_longterm_mix_pct,
            AVG(avg_customer_tenure_months) as avg_tenure_months,
            
            -- Data quality
            COUNT(*) as years_of_data
            
        FROM MONTHLY_PATTERNS
        GROUP BY bulan, nama_bulan
    ),
    
    OVERALL_AVERAGES AS (
        SELECT 
            AVG(avg_total_pesanan) as grand_avg_pesanan,
            AVG(avg_total_pelanggan) as grand_avg_pelanggan,
            AVG(avg_total_layanan_hsi) as grand_avg_layanan,
            AVG(avg_total_hsi_orders) as grand_avg_orders,
            AVG(avg_total_hsi_customers) as grand_avg_customers,
            AVG(avg_bisnis_mix_pct) as grand_avg_bisnis_mix,
            AVG(avg_bundling_rate) as grand_avg_bundling_rate,
            AVG(avg_digital_penetration) as grand_avg_digital_penetration,
            AVG(avg_new_sales_mix_pct) as grand_avg_new_sales_mix,
            AVG(avg_education_mix_pct) as grand_avg_education_mix,
            AVG(avg_new_customer_mix_pct) as grand_avg_new_customer_mix
        FROM SEASONAL_STATISTICS
    ),
    
    SEASONAL_ANALYSIS AS (
        SELECT 
            ss.*,
            oa.grand_avg_pesanan,
            oa.grand_avg_pelanggan,
            oa.grand_avg_layanan,
            oa.grand_avg_orders,
            oa.grand_avg_customers,
            oa.grand_avg_bisnis_mix,
            oa.grand_avg_bundling_rate,
            oa.grand_avg_digital_penetration,
            oa.grand_avg_new_sales_mix,
            oa.grand_avg_education_mix,
            oa.grand_avg_new_customer_mix,
            
            -- Seasonal indices calculation dengan metrik yang diperluas
            ROUND((ss.avg_total_pesanan - oa.grand_avg_pesanan) / oa.grand_avg_pesanan * 100, 1) as seasonal_index_pesanan,
            ROUND((ss.avg_total_pelanggan - oa.grand_avg_pelanggan) / oa.grand_avg_pelanggan * 100, 1) as seasonal_index_pelanggan,
            ROUND((ss.avg_total_hsi_orders - oa.grand_avg_orders) / oa.grand_avg_orders * 100, 1) as seasonal_index_volume,
            ROUND((ss.avg_total_hsi_customers - oa.grand_avg_customers) / oa.grand_avg_customers * 100, 1) as seasonal_index_customers,
            ROUND((ss.avg_bisnis_mix_pct - oa.grand_avg_bisnis_mix) / oa.grand_avg_bisnis_mix * 100, 1) as seasonal_index_bisnis_mix,
            ROUND((ss.avg_bundling_rate - oa.grand_avg_bundling_rate) / oa.grand_avg_bundling_rate * 100, 1) as seasonal_index_bundling,
            ROUND((ss.avg_digital_penetration - oa.grand_avg_digital_penetration) / oa.grand_avg_digital_penetration * 100, 1) as seasonal_index_digital,
            ROUND((ss.avg_new_sales_mix_pct - oa.grand_avg_new_sales_mix) / oa.grand_avg_new_sales_mix * 100, 1) as seasonal_index_new_sales,
            ROUND((ss.avg_education_mix_pct - oa.grand_avg_education_mix) / oa.grand_avg_education_mix * 100, 1) as seasonal_index_education,
            ROUND((ss.avg_new_customer_mix_pct - oa.grand_avg_new_customer_mix) / oa.grand_avg_new_customer_mix * 100, 1) as seasonal_index_new_customer,
            
            -- Volatility assessment
            ROUND(ss.stddev_total_orders / ss.avg_total_hsi_orders * 100, 1) as coefficient_of_variation,
            
            -- Seasonal categorization based on volume
            CASE 
                WHEN (ss.avg_total_hsi_orders - oa.grand_avg_orders) / oa.grand_avg_orders * 100 >= 20 THEN 'PUNCAK'
                WHEN (ss.avg_total_hsi_orders - oa.grand_avg_orders) / oa.grand_avg_orders * 100 >= 10 THEN 'TINGGI'
                WHEN (ss.avg_total_hsi_orders - oa.grand_avg_orders) / oa.grand_avg_orders * 100 >= -10 THEN 'NORMAL'
                WHEN (ss.avg_total_hsi_orders - oa.grand_avg_orders) / oa.grand_avg_orders * 100 >= -20 THEN 'RENDAH'
                ELSE 'LEMBAH'
            END as kategori_musiman
            
        FROM SEASONAL_STATISTICS ss
        CROSS JOIN OVERALL_AVERAGES oa
    )
    SELECT 
        bulan,
        nama_bulan,
        
        -- Fundamental metrics dengan hubungan customer-order-layanan yang akurat
        ROUND(avg_total_pesanan, 0) as rata_rata_total_pesanan,
        ROUND(avg_total_pelanggan, 0) as rata_rata_total_pelanggan,
        ROUND(avg_total_layanan_hsi, 0) as rata_rata_total_layanan_hsi,
        ROUND(avg_order_per_pelanggan_ratio, 2) as rata_rata_order_per_pelanggan,
        ROUND(avg_layanan_per_pelanggan_ratio, 2) as rata_rata_layanan_per_pelanggan,
        ROUND(avg_order_per_layanan_ratio, 2) as rata_rata_order_per_layanan,
        
        -- HSI metrics berdasarkan identifikasi yang tepat
        ROUND(avg_total_hsi_orders, 0) as rata_rata_order_hsi,
        ROUND(avg_total_hsi_customers, 0) as rata_rata_customer_hsi,
        ROUND(avg_total_hsi_services, 0) as rata_rata_layanan_hsi,
        ROUND(avg_bisnis_orders, 0) as rata_rata_order_bisnis,
        ROUND(avg_basic_orders, 0) as rata_rata_order_basic,
        ROUND(avg_bisnis_customers, 0) as rata_rata_customer_bisnis,
        ROUND(avg_basic_customers, 0) as rata_rata_customer_basic,
        ROUND(avg_bisnis_services, 0) as rata_rata_layanan_bisnis,
        ROUND(avg_basic_services, 0) as rata_rata_layanan_basic,
        ROUND(avg_bisnis_mix_pct, 1) as rata_rata_bisnis_mix_pct,
        ROUND(avg_basic_mix_pct, 1) as rata_rata_basic_mix_pct,
        ROUND(avg_success_rate, 1) as rata_rata_success_rate_pct,
        ROUND(avg_bundling_rate, 1) as rata_rata_bundling_rate_pct,
        ROUND(avg_hard_bundling_rate, 1) as rata_rata_hard_bundling_pct,
        ROUND(avg_digital_penetration, 1) as rata_rata_digital_penetration_pct,
        ROUND(avg_voice_combo_rate, 1) as rata_rata_voice_combo_pct,
        ROUND(avg_monthly_bandwidth_kbps/1000, 0) as rata_rata_bandwidth_mbps,
        ROUND(avg_regional_coverage, 0) as rata_rata_cakupan_regional,
        ROUND(stddev_total_orders, 0) as volatilitas_order,
        min_total_orders,
        max_total_orders,
        
        -- Seasonal indices
        seasonal_index_pesanan,
        seasonal_index_pelanggan,
        seasonal_index_volume,
        seasonal_index_customers,
        seasonal_index_bisnis_mix,
        seasonal_index_bundling,
        seasonal_index_digital,
        coefficient_of_variation,
        kategori_musiman,
        years_of_data,
        
        -- Rankings
        RANK() OVER (ORDER BY avg_total_hsi_orders DESC) as ranking_volume_order,
        RANK() OVER (ORDER BY avg_total_hsi_customers DESC) as ranking_volume_customer,
        RANK() OVER (ORDER BY avg_bundling_rate DESC) as ranking_bundling,
        RANK() OVER (ORDER BY avg_digital_penetration DESC) as ranking_digital,
        
        -- Enhanced output metrics dengan transaction type
        ROUND(avg_new_sales_mix_pct, 1) as rata_rata_new_sales_mix_pct,
        ROUND(avg_expansion_mix_pct, 1) as rata_rata_expansion_mix_pct,
        ROUND(avg_disconnect_rate_pct, 1) as rata_rata_disconnect_rate_pct,
        ROUND(avg_resume_rate_pct, 1) as rata_rata_resume_rate_pct,
        seasonal_index_new_sales,
        
        -- Enhanced output metrics dengan ecosystem
        ROUND(avg_education_mix_pct, 1) as rata_rata_education_mix_pct,
        ROUND(avg_government_mix_pct, 1) as rata_rata_government_mix_pct,
        ROUND(avg_hospitality_mix_pct, 1) as rata_rata_hospitality_mix_pct,
        ROUND(avg_agriculture_mix_pct, 1) as rata_rata_agriculture_mix_pct,
        ROUND(avg_manufacturing_mix_pct, 1) as rata_rata_manufacturing_mix_pct,
        ROUND(avg_healthcare_mix_pct, 1) as rata_rata_healthcare_mix_pct,
        seasonal_index_education,
        
        -- Enhanced output metrics dengan customer tenure
        ROUND(avg_new_customer_mix_pct, 1) as rata_rata_new_customer_mix_pct,
        ROUND(avg_established_mix_pct, 1) as rata_rata_established_mix_pct,
        ROUND(avg_longterm_mix_pct, 1) as rata_rata_longterm_mix_pct,
        ROUND(avg_tenure_months, 1) as rata_rata_tenure_bulan,
        seasonal_index_new_customer
    FROM SEASONAL_ANALYSIS
    ORDER BY bulan
  `,

  BUSINESS_LOGIC: {
    identifySeasonalPatterns: function(data) {
      const patterns = {
        puncak: data.filter(d => d.KATEGORI_MUSIMAN === 'PUNCAK'),
        tinggi: data.filter(d => d.KATEGORI_MUSIMAN === 'TINGGI'),
        normal: data.filter(d => d.KATEGORI_MUSIMAN === 'NORMAL'),
        rendah: data.filter(d => d.KATEGORI_MUSIMAN === 'RENDAH'),
        lembah: data.filter(d => d.KATEGORI_MUSIMAN === 'LEMBAH')
      };
      
      const insights = [];
      
      if (patterns.puncak.length > 0) {
        const puncakBulans = patterns.puncak.map(d => d.NAMA_BULAN);
        insights.push(`Bulan puncak aktivitas HSI: ${puncakBulans.join(', ')}`);
      }
      
      if (patterns.lembah.length > 0) {
        const lembahBulans = patterns.lembah.map(d => d.NAMA_BULAN);
        insights.push(`Bulan lembah aktivitas HSI: ${lembahBulans.join(', ')}`);
      }
      
      // Identify highest volatility months
      const highVolatility = data.filter(d => d.COEFFICIENT_OF_VARIATION > 20);
      if (highVolatility.length > 0) {
        const volatileBulans = highVolatility.map(d => d.NAMA_BULAN);
        insights.push(`Bulan dengan volatilitas tinggi: ${volatileBulans.join(', ')}`);
      }
      
      return {
        patterns: patterns,
        insights: insights,
        total_peak_months: patterns.puncak.length,
        total_low_months: patterns.rendah.length + patterns.lembah.length
      };
    },
    
    analyzeCustomerEfficiency: function(data) {
      const efficiency_analysis = {
        best_efficiency_months: [],
        worst_efficiency_months: [],
        avg_order_per_customer: 0,
        avg_service_per_customer: 0,
        avg_order_per_service: 0,
        insights: []
      };
      
      // Calculate averages dengan ketiga metrik hubungan
      efficiency_analysis.avg_order_per_customer = data.reduce((sum, d) => 
        sum + d.RATA_RATA_ORDER_PER_PELANGGAN, 0) / data.length;
      efficiency_analysis.avg_service_per_customer = data.reduce((sum, d) => 
        sum + d.RATA_RATA_LAYANAN_PER_PELANGGAN, 0) / data.length;
      efficiency_analysis.avg_order_per_service = data.reduce((sum, d) => 
        sum + d.RATA_RATA_ORDER_PER_LAYANAN, 0) / data.length;
      
      // Find best and worst efficiency months
      const sortedByOrderEfficiency = [...data].sort((a, b) => 
        b.RATA_RATA_ORDER_PER_PELANGGAN - a.RATA_RATA_ORDER_PER_PELANGGAN);
      const sortedByServiceEfficiency = [...data].sort((a, b) => 
        b.RATA_RATA_LAYANAN_PER_PELANGGAN - a.RATA_RATA_LAYANAN_PER_PELANGGAN);
      
      efficiency_analysis.best_efficiency_months = [
        {
          bulan: sortedByOrderEfficiency[0].NAMA_BULAN,
          metric: 'Order per Customer',
          value: sortedByOrderEfficiency[0].RATA_RATA_ORDER_PER_PELANGGAN
        },
        {
          bulan: sortedByServiceEfficiency[0].NAMA_BULAN,
          metric: 'Service per Customer', 
          value: sortedByServiceEfficiency[0].RATA_RATA_LAYANAN_PER_PELANGGAN
        }
      ];
      
      efficiency_analysis.worst_efficiency_months = [
        {
          bulan: sortedByOrderEfficiency[11].NAMA_BULAN,
          metric: 'Order per Customer',
          value: sortedByOrderEfficiency[11].RATA_RATA_ORDER_PER_PELANGGAN
        },
        {
          bulan: sortedByServiceEfficiency[11].NAMA_BULAN,
          metric: 'Service per Customer',
          value: sortedByServiceEfficiency[11].RATA_RATA_LAYANAN_PER_PELANGGAN
        }
      ];
      
      // Generate insights dengan mempertimbangkan hubungan customer-order-service
      if (efficiency_analysis.avg_service_per_customer > 1.5) {
        efficiency_analysis.insights.push('Tingkat cross-selling layanan per customer cukup baik sepanjang tahun');
      } else {
        efficiency_analysis.insights.push('Peluang peningkatan cross-selling layanan per customer');
      }
      
      if (efficiency_analysis.avg_order_per_customer > 2) {
        efficiency_analysis.insights.push('Customer menunjukkan aktivitas order yang tinggi');
      }
      
      if (efficiency_analysis.avg_order_per_service > 1.3) {
        efficiency_analysis.insights.push('Tingkat modifikasi/ekspansi layanan HSI tinggi');
      }
      
      return efficiency_analysis;
    },
    
    analyzeTransactionSeasonality: function(data) {
      const transaction_analysis = {
        new_sales_peak: null,
        expansion_peak: null,
        disconnect_concerns: [],
        insights: []
      };
      
      // Find peak months for different transaction types
      const newSalesPeak = data.reduce((max, current) => 
        current.RATA_RATA_NEW_SALES_MIX_PCT > max.RATA_RATA_NEW_SALES_MIX_PCT ? current : max);
      const expansionPeak = data.reduce((max, current) => 
        current.RATA_RATA_EXPANSION_MIX_PCT > max.RATA_RATA_EXPANSION_MIX_PCT ? current : max);
          
      transaction_analysis.new_sales_peak = {
        bulan: newSalesPeak.NAMA_BULAN,
        percentage: newSalesPeak.RATA_RATA_NEW_SALES_MIX_PCT
      };
      
      transaction_analysis.expansion_peak = {
        bulan: expansionPeak.NAMA_BULAN,
        percentage: expansionPeak.RATA_RATA_EXPANSION_MIX_PCT
      };
      
      // Identify months with high disconnect rates
      transaction_analysis.disconnect_concerns = data
        .filter(d => d.RATA_RATA_DISCONNECT_RATE_PCT > 5)
        .map(d => ({
          bulan: d.NAMA_BULAN,
          disconnect_rate: d.RATA_RATA_DISCONNECT_RATE_PCT
        }));
      
      // Generate insights
      transaction_analysis.insights.push(
        `Puncak penjualan baru terjadi di bulan ${transaction_analysis.new_sales_peak.bulan} (${transaction_analysis.new_sales_peak.percentage}%)`
      );
      
      transaction_analysis.insights.push(
        `Puncak ekspansi layanan terjadi di bulan ${transaction_analysis.expansion_peak.bulan} (${transaction_analysis.expansion_peak.percentage}%)`
      );
      
      if (transaction_analysis.disconnect_concerns.length > 0) {
        const concernMonths = transaction_analysis.disconnect_concerns.map(d => d.bulan);
        transaction_analysis.insights.push(
          `Bulan dengan tingkat disconnect tinggi: ${concernMonths.join(', ')}`
        );
      }
      
      return transaction_analysis;
    },
    
    analyzeEcosystemSeasonality: function(data) {
      const ecosystem_analysis = {
        education_pattern: null,
        government_pattern: null,
        seasonal_ecosystems: [],
        insights: []
      };
      
      // Education sector analysis (likely seasonal due to academic calendar)
      const educationData = data.map(d => ({
        bulan: d.NAMA_BULAN,
        percentage: d.RATA_RATA_EDUCATION_MIX_PCT,
        seasonal_index: d.SEASONAL_INDEX_EDUCATION
      })).sort((a, b) => b.percentage - a.percentage);
      
      ecosystem_analysis.education_pattern = {
        peak_month: educationData[0],
        low_month: educationData[11],
        is_seasonal: Math.abs(educationData[0].seasonal_index) > 20
      };
      
      // Government sector analysis
      const governmentData = data.map(d => ({
        bulan: d.NAMA_BULAN,
        percentage: d.RATA_RATA_GOVERNMENT_MIX_PCT
      })).sort((a, b) => b.percentage - a.percentage);
      
      ecosystem_analysis.government_pattern = {
        peak_month: governmentData[0],
        low_month: governmentData[11]
      };
      
      // Identify highly seasonal ecosystems
      ecosystem_analysis.seasonal_ecosystems = data
        .filter(d => Math.abs(d.SEASONAL_INDEX_EDUCATION) > 15)
        .map(d => ({
          bulan: d.NAMA_BULAN,
          education_index: d.SEASONAL_INDEX_EDUCATION
        }));
      
      // Generate insights
      if (ecosystem_analysis.education_pattern.is_seasonal) {
        ecosystem_analysis.insights.push(
          `Sektor pendidikan menunjukkan pola musiman yang kuat dengan puncak di ${ecosystem_analysis.education_pattern.peak_month.bulan}`
        );
      }
      
      ecosystem_analysis.insights.push(
        `Sektor pemerintahan paling aktif di bulan ${ecosystem_analysis.government_pattern.peak_month.bulan}`
      );
      
      return ecosystem_analysis;
    },
    
    generateForecastingInsights: function(data) {
      const forecasting = {
        peak_preparation_months: [],
        low_season_opportunities: [],
        capacity_planning: {
          high_demand_months: [],
          low_demand_months: []
        },
        recommendations: []
      };
      
      // Identify months requiring capacity preparation
      const highDemandMonths = data.filter(d => 
        d.KATEGORI_MUSIMAN === 'PUNCAK' || d.KATEGORI_MUSIMAN === 'TINGGI'
      );
      
      const lowDemandMonths = data.filter(d => 
        d.KATEGORI_MUSIMAN === 'RENDAH' || d.KATEGORI_MUSIMAN === 'LEMBAH'
      );
      
      forecasting.capacity_planning.high_demand_months = highDemandMonths.map(d => ({
        bulan: d.NAMA_BULAN,
        expected_orders: d.RATA_RATA_ORDER_HSI,
        expected_customers: d.RATA_RATA_CUSTOMER_HSI,
        expected_services: d.RATA_RATA_LAYANAN_HSI,
        kategori: d.KATEGORI_MUSIMAN
      }));
      
      forecasting.capacity_planning.low_demand_months = lowDemandMonths.map(d => ({
        bulan: d.NAMA_BULAN,
        expected_orders: d.RATA_RATA_ORDER_HSI,
        expected_customers: d.RATA_RATA_CUSTOMER_HSI,
        expected_services: d.RATA_RATA_LAYANAN_HSI,
        kategori: d.KATEGORI_MUSIMAN
      }));
      
      // Generate recommendations berdasarkan hubungan customer-order-service
      if (highDemandMonths.length > 0) {
        const peakMonths = highDemandMonths.map(d => d.NAMA_BULAN);
        forecasting.recommendations.push(
          `Persiapan kapasitas ekstra untuk bulan ${peakMonths.join(', ')} - fokus pada customer acquisition dan service activation`
        );
      }
      
      if (lowDemandMonths.length > 0) {
        const lowMonths = lowDemandMonths.map(d => d.NAMA_BULAN);
        forecasting.recommendations.push(
          `Manfaatkan bulan ${lowMonths.join(', ')} untuk maintenance dan program retention customer`
        );
      }
      
      // Bundling strategy recommendations
      const highBundlingMonths = data.filter(d => d.RATA_RATA_BUNDLING_RATE_PCT > 
        data.reduce((sum, d) => sum + d.RATA_RATA_BUNDLING_RATE_PCT, 0) / data.length + 5
      );
      
      if (highBundlingMonths.length > 0) {
        const bundlingMonths = highBundlingMonths.map(d => d.NAMA_BULAN);
        forecasting.recommendations.push(
          `Intensifkan strategi bundling di bulan ${bundlingMonths.join(', ')}`
        );
      }
      
      return forecasting;
    },
    
    formatIndonesianResponse: function(data) {
      const seasonal_patterns = this.identifySeasonalPatterns(data);
      const customer_efficiency = this.analyzeCustomerEfficiency(data);
      const transaction_seasonality = this.analyzeTransactionSeasonality(data);
      const ecosystem_seasonality = this.analyzeEcosystemSeasonality(data);
      const forecasting_insights = this.generateForecastingInsights(data);
      
      const hasil_analisis = data.map(month => ({
        identitas_bulan: {
          bulan_nomor: month.BULAN,
          nama_bulan: month.NAMA_BULAN,
          kategori_musiman: month.KATEGORI_MUSIMAN,
          tahun_data: month.YEARS_OF_DATA
        },
        metrik_fundamental: {
          rata_rata_total_pesanan: month.RATA_RATA_TOTAL_PESANAN.toLocaleString('id-ID'),
          rata_rata_total_pelanggan: month.RATA_RATA_TOTAL_PELANGGAN.toLocaleString('id-ID'),
          rata_rata_total_layanan_hsi: month.RATA_RATA_TOTAL_LAYANAN_HSI.toLocaleString('id-ID'),
          efisiensi_order_per_pelanggan: month.RATA_RATA_ORDER_PER_PELANGGAN,
          efisiensi_layanan_per_pelanggan: month.RATA_RATA_LAYANAN_PER_PELANGGAN,
          efisiensi_order_per_layanan: month.RATA_RATA_ORDER_PER_LAYANAN
        },
        metrik_hsi: {
          rata_rata_order_hsi: month.RATA_RATA_ORDER_HSI.toLocaleString('id-ID'),
          rata_rata_customer_hsi: month.RATA_RATA_CUSTOMER_HSI.toLocaleString('id-ID'),
          rata_rata_layanan_hsi: month.RATA_RATA_LAYANAN_HSI.toLocaleString('id-ID'),
          rata_rata_order_bisnis: month.RATA_RATA_ORDER_BISNIS.toLocaleString('id-ID'),
          rata_rata_order_basic: month.RATA_RATA_ORDER_BASIC.toLocaleString('id-ID'),
          rata_rata_customer_bisnis: month.RATA_RATA_CUSTOMER_BISNIS.toLocaleString('id-ID'),
          rata_rata_customer_basic: month.RATA_RATA_CUSTOMER_BASIC.toLocaleString('id-ID'),
          komposisi_bisnis: `${month.RATA_RATA_BISNIS_MIX_PCT}%`,
          komposisi_basic: `${month.RATA_RATA_BASIC_MIX_PCT}%`
        },
        metrik_performa: {
          tingkat_keberhasilan: `${month.RATA_RATA_SUCCESS_RATE_PCT}%`,
          tingkat_bundling: `${month.RATA_RATA_BUNDLING_RATE_PCT}%`,
          tingkat_hard_bundling: `${month.RATA_RATA_HARD_BUNDLING_PCT}%`,
          penetrasi_digital: `${month.RATA_RATA_DIGITAL_PENETRATION_PCT}%`,
          kombinasi_voice: `${month.RATA_RATA_VOICE_COMBO_PCT}%`,
          rata_rata_bandwidth_mbps: month.RATA_RATA_BANDWIDTH_MBPS
        },
        analisis_transaksi: {
          new_sales_mix: `${month.RATA_RATA_NEW_SALES_MIX_PCT}%`,
          expansion_mix: `${month.RATA_RATA_EXPANSION_MIX_PCT}%`,
          disconnect_rate: `${month.RATA_RATA_DISCONNECT_RATE_PCT}%`,
          resume_rate: `${month.RATA_RATA_RESUME_RATE_PCT}%`,
          seasonal_index_new_sales: month.SEASONAL_INDEX_NEW_SALES
        },
        analisis_ekosistem: {
          pendidikan_mix: `${month.RATA_RATA_EDUCATION_MIX_PCT}%`,
          pemerintahan_mix: `${month.RATA_RATA_GOVERNMENT_MIX_PCT}%`,
          hospitalitas_mix: `${month.RATA_RATA_HOSPITALITY_MIX_PCT}%`,
          pertanian_mix: `${month.RATA_RATA_AGRICULTURE_MIX_PCT}%`,
          manufaktur_mix: `${month.RATA_RATA_MANUFACTURING_MIX_PCT}%`,
          kesehatan_mix: `${month.RATA_RATA_HEALTHCARE_MIX_PCT}%`,
          seasonal_index_education: month.SEASONAL_INDEX_EDUCATION
        },
        analisis_customer_tenure: {
          new_customer_mix: `${month.RATA_RATA_NEW_CUSTOMER_MIX_PCT}%`,
          established_mix: `${month.RATA_RATA_ESTABLISHED_MIX_PCT}%`,
          longterm_mix: `${month.RATA_RATA_LONGTERM_MIX_PCT}%`,
          rata_rata_tenure_bulan: month.RATA_RATA_TENURE_BULAN,
          seasonal_index_new_customer: month.SEASONAL_INDEX_NEW_CUSTOMER
        },
        indeks_musiman: {
          indeks_volume_pesanan: month.SEASONAL_INDEX_PESANAN,
          indeks_volume_pelanggan: month.SEASONAL_INDEX_PELANGGAN,
          indeks_volume_order: month.SEASONAL_INDEX_VOLUME,
          indeks_volume_customer: month.SEASONAL_INDEX_CUSTOMERS,
          indeks_bisnis_mix: month.SEASONAL_INDEX_BISNIS_MIX,
          indeks_bundling: month.SEASONAL_INDEX_BUNDLING,
          indeks_digital: month.SEASONAL_INDEX_DIGITAL
        },
        metrik_volatilitas: {
          volatilitas_order: month.VOLATILITAS_ORDER.toLocaleString('id-ID'),
          coefficient_of_variation: `${month.COEFFICIENT_OF_VARIATION}%`,
          order_minimum: month.MIN_TOTAL_ORDERS.toLocaleString('id-ID'),
          order_maksimum: month.MAX_TOTAL_ORDERS.toLocaleString('id-ID'),
          stabilitas: month.COEFFICIENT_OF_VARIATION < 15 ? 'Stabil' : month.COEFFICIENT_OF_VARIATION < 25 ? 'Moderat' : 'Tinggi'
        },
        ranking_performa: {
          ranking_volume_order: month.RANKING_VOLUME_ORDER,
          ranking_volume_customer: month.RANKING_VOLUME_CUSTOMER,
          ranking_bundling: month.RANKING_BUNDLING,
          ranking_digital: month.RANKING_DIGITAL
        }
      }));
      
      return {
        ringkasan_eksekutif: {
          periode_analisis: '24 bulan terakhir untuk analisis pola musiman',
          total_bulan_analisis: data.length,
          rata_rata_efisiensi_order_per_customer: customer_efficiency.avg_order_per_customer.toFixed(2),
          rata_rata_efisiensi_service_per_customer: customer_efficiency.avg_service_per_customer.toFixed(2),
          rata_rata_efisiensi_order_per_service: customer_efficiency.avg_order_per_service.toFixed(2),
          bulan_puncak: seasonal_patterns.total_peak_months,
          bulan_rendah: seasonal_patterns.total_low_months
        },
        pola_musiman: {
          kategori_bulanan: seasonal_patterns.patterns,
          insights_pola: seasonal_patterns.insights,
          puncak_aktivitas: seasonal_patterns.patterns.puncak.map(d => d.NAMA_BULAN),
          lembah_aktivitas: seasonal_patterns.patterns.lembah.map(d => d.NAMA_BULAN)
        },
        analisis_efisiensi_customer: customer_efficiency,
        analisis_seasonalitas_transaksi: transaction_seasonality,
        analisis_seasonalitas_ekosistem: ecosystem_seasonality,
        insights_forecasting: forecasting_insights,
        detail_bulanan: hasil_analisis,
        metodologi_perhitungan: {
          basis_data: 'Data aktual dari tabel BRIGHTAI_SALES menggunakan ORDER_ID, NCLI, dan ND_HSI untuk identifikasi akurat hubungan customer-order-layanan',
          periode_data: '24 bulan terakhir untuk capture seasonal patterns',
          indeks_musiman: 'Perbandingan performance bulanan terhadap grand average tahunan',
          efisiensi_metrics: 'Rasio order dan service per customer untuk analisis cross-selling, ditambah rasio order per service untuk analisis aktivitas layanan',
          data_quality: 'Menggunakan ketiga kolom krusial (ORDER_ID, NCLI, ND_HSI) untuk perhitungan yang akurat tanpa duplikasi'
        },
        rekomendasi_strategis: [
          'Persiapan kapasitas dan resource di bulan-bulan puncak untuk avoid service degradation',
          'Manfaatkan bulan lembah untuk maintenance, training, dan customer retention programs',
          'Intensifkan strategi bundling di bulan dengan tingkat bundling tinggi secara historical',
          'Focus pada sektor pendidikan dengan timing yang tepat sesuai kalender akademik',
          'Optimize cross-selling strategy berdasarkan pola efisiensi layanan per customer',
          'Monitor closely bulan dengan volatilitas tinggi untuk risk mitigation',
          'Develop seasonal campaign berdasarkan pola transaction type dan ecosystem',
          'Leverage hubungan customer-order-service untuk capacity planning yang lebih akurat',
          'Implement early warning system untuk seasonal anomaly berdasarkan historical patterns'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      const lowerInput = userInput.toLowerCase();
      
      // Determine focus area based on input patterns
      let focus_area = 'analisis_musiman';
      if (lowerInput.includes('forecast') || lowerInput.includes('prediksi') || lowerInput.includes('ramalan')) {
        focus_area = 'persiapan_forecasting';
      } else if (lowerInput.includes('ekosistem') || lowerInput.includes('ecosystem') || lowerInput.includes('sektor')) {
        focus_area = 'musiman_ekosistem';
      } else if (lowerInput.includes('new sales') || lowerInput.includes('penjualan baru') || lowerInput.includes('akuisisi') || lowerInput.includes('customer journey')) {
        focus_area = 'musiman_transaksi';
      } else if (lowerInput.includes('pendidikan') || lowerInput.includes('education') || lowerInput.includes('pemerintahan') || lowerInput.includes('government') || lowerInput.includes('hospitalitas') || lowerInput.includes('hospitality')) {
        focus_area = 'musiman_sektor';
      } else if (lowerInput.includes('efisiensi') || lowerInput.includes('efficiency') || lowerInput.includes('customer') || lowerInput.includes('pelanggan')) {
        focus_area = 'efisiensi_customer';
      }
      
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: focus_area,
        requires_ecosystem_breakdown: lowerInput.includes('ekosistem') || lowerInput.includes('ecosystem') || lowerInput.includes('sektor'),
        requires_transaction_analysis: lowerInput.includes('new sales') || lowerInput.includes('penjualan baru') || lowerInput.includes('akuisisi') || lowerInput.includes('ekspansi'),
        requires_tenure_analysis: lowerInput.includes('customer') || lowerInput.includes('tenure') || lowerInput.includes('vintage') || lowerInput.includes('masa berlangganan'),
        requires_efficiency_analysis: lowerInput.includes('efisiensi') || lowerInput.includes('efficiency') || lowerInput.includes('cross-selling') || lowerInput.includes('layanan per customer')
      };
    },
    
  },

  CACHE_DURATION: 21600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'MEDIUM'
};