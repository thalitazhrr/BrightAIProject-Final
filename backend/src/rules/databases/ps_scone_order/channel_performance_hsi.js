const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_009',
    RULE_NAME: 'channel_performance_hsi',
    DESCRIPTION: 'Analisis performa channel dalam akuisisi HSI dengan klasifikasi produk yang tepat',
    DATABASE: 'PS_SCONE_ORDER',
    CATEGORY: 'CHANNEL_PERFORMANCE',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("PS_SCONE_ORDER"),

  KEYWORD_PATTERNS: {
    primary: [
      // Channel performance - yang biasa digunakan
      'performa channel', 'channel performance', 'efektivitas channel',
      'kinerja channel', 'channel hsi', 'saluran penjualan',
      
      // Channel analysis familiar terms
      'analisis channel', 'channel analysis', 'evaluasi channel',
      'produktivitas channel', 'conversion channel', 'akuisisi channel'
    ],
    
    supporting: [
      // Channel terms familiar
      'sales channel', 'saluran', 'distribusi', 'marketing channel',
      'online', 'offline', 'direct', 'indirect', 'partnership',
      
      // Performance indicators
      'konversi', 'conversion', 'efisiensi', 'produktivitas', 'roi',
      'market share', 'pangsa pasar', 'penetrasi', 'coverage',
      
      // Business metrics
      'penjualan', 'akuisisi', 'customer', 'pelanggan', 'lead'
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
      } else if (lowerInput.includes('channel') && 
                (lowerInput.includes('hsi') || lowerInput.includes('internet'))) {
        score = 65;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_CLASSIFICATION AS (
        SELECT *,
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
            END as ECOSYSTEM_STANDARDIZED,
            
            -- Clean channel name
            UPPER(TRIM(COALESCE(CHANNEL, 'TIDAK_DIKETAHUI'))) as CLEAN_CHANNEL_NAME
            
        FROM DWHNAS.DWH_MOIS.PS_SCONE_ORDER
        WHERE ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD') -- Data mulai dari 1 Januari 2025
          AND CHANNEL IS NOT NULL 
          AND TRIM(CHANNEL) != ''
    ),
    
    CHANNEL_METRICS AS (
        SELECT 
            CLEAN_CHANNEL_NAME as CHANNEL_NAME,
            
            -- Order counts by HSI type
            COUNT(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END) as HSI_ORDERS,
            COUNT(CASE WHEN IS_HSI_BISNIS = 1 THEN 1 END) as HSI_BISNIS_ORDERS,
            COUNT(CASE WHEN IS_HSI_BASIC = 1 THEN 1 END) as HSI_BASIC_ORDERS,
            COUNT(*) as TOTAL_ORDERS,
            
            -- Conversion rates
            COUNT(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0) as HSI_CONVERSION_RATE,
            
            COUNT(CASE WHEN IS_HSI_BISNIS = 1 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0) as HSI_BISNIS_CONVERSION_RATE,
            
            COUNT(CASE WHEN IS_HSI_BASIC = 1 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0) as HSI_BASIC_CONVERSION_RATE,
            
            -- Success rates
            COUNT(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                           AND STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END), 0) as HSI_SUCCESS_RATE,
            
            -- Bundling performance
            COUNT(CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN 1 END) as HARD_BUNDLING_ORDERS,
            COUNT(CASE WHEN BUNDLING_TYPE IN ('Hard Bundling', 'Bundling A La Carte') THEN 1 END) as TOTAL_BUNDLING_ORDERS,
            
            COUNT(CASE WHEN BUNDLING_TYPE IN ('Hard Bundling', 'Bundling A La Carte') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END), 0) as BUNDLING_RATE,
            
            -- Digital product performance
            COUNT(CASE WHEN (IS_PIJAR_SEKOLAH = 1 OR IS_OCA_INTERACTION = 1 OR 
                            IS_OCA_BLAST = 1 OR IS_NETMONK = 1) THEN 1 END) as DIGITAL_PRODUCT_ORDERS,
            
            COUNT(CASE WHEN (IS_PIJAR_SEKOLAH = 1 OR IS_OCA_INTERACTION = 1 OR 
                            IS_OCA_BLAST = 1 OR IS_NETMONK = 1) THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END), 0) as DIGITAL_PENETRATION_RATE,

            -- Transaction Type Performance Analysis
            COUNT(CASE WHEN TRANSACTION_TYPE = 'PENJUALAN_BARU' THEN 1 END) as NEW_SALES_ORDERS,
            COUNT(CASE WHEN TRANSACTION_TYPE = 'TAMBAH_LAYANAN' THEN 1 END) as ADD_SERVICE_ORDERS,
            COUNT(CASE WHEN TRANSACTION_TYPE = 'MODIFIKASI' THEN 1 END) as MODIFICATION_ORDERS,

            -- Transaction Type Conversion Rates
            COUNT(CASE WHEN TRANSACTION_TYPE = 'PENJUALAN_BARU' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0) as NEW_SALES_CONVERSION_RATE,
            COUNT(CASE WHEN TRANSACTION_TYPE = 'TAMBAH_LAYANAN' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0) as ADD_SERVICE_CONVERSION_RATE,
            COUNT(CASE WHEN TRANSACTION_TYPE = 'MODIFIKASI' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0) as MODIFICATION_CONVERSION_RATE,

            -- Ecosystem Performance Analysis
            COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'PEMERINTAHAN' THEN 1 END) as GOVERNMENT_ORDERS,
            COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'PENDIDIKAN' THEN 1 END) as EDUCATION_ORDERS,
            COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'KESEHATAN' THEN 1 END) as HEALTHCARE_ORDERS,
            COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'INDIVIDUAL' THEN 1 END) as INDIVIDUAL_ORDERS,
            COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'KEUANGAN' THEN 1 END) as FINANCIAL_ORDERS,

            -- Ecosystem Conversion Rates
            COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'PEMERINTAHAN' AND (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'PEMERINTAHAN' THEN 1 END), 0) as GOVERNMENT_HSI_CONVERSION,
            COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'PENDIDIKAN' AND (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'PENDIDIKAN' THEN 1 END), 0) as EDUCATION_HSI_CONVERSION,
            COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'INDIVIDUAL' AND (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN ECOSYSTEM_STANDARDIZED = 'INDIVIDUAL' THEN 1 END), 0) as INDIVIDUAL_HSI_CONVERSION,
            
            -- Fulfillment time
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                         AND TGL_PS IS NOT NULL AND ORDER_DATE IS NOT NULL 
                     THEN TGL_PS - ORDER_DATE END) as AVG_HSI_FULFILLMENT_TIME,
            
            -- Geographic coverage
            COUNT(DISTINCT REGIONAL) as REGIONAL_COVERAGE,
            COUNT(DISTINCT WITEL) as WITEL_COVERAGE,
            COUNT(DISTINCT STO) as STO_COVERAGE,
            
            -- Premium product focus
            COUNT(CASE WHEN IS_HSI_BISNIS = 1 THEN 1 END) * 100.0 / 
            NULLIF(COUNT(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN 1 END), 0) as PREMIUM_PRODUCT_FOCUS
            
        FROM HSI_CLASSIFICATION
        GROUP BY CLEAN_CHANNEL_NAME
        HAVING COUNT(*) >= 10 -- Minimum volume for analysis
    ),
    
    CHANNEL_PERFORMANCE AS (
        SELECT *,
            -- Market share calculation
            ROUND(HSI_ORDERS * 100.0 / SUM(HSI_ORDERS) OVER(), 2) as MARKET_SHARE_PCT,
            
            -- Effectiveness score calculation
            ROUND(
                (HSI_CONVERSION_RATE * 0.35) + 
                (HSI_SUCCESS_RATE * 0.25) + 
                (BUNDLING_RATE * 0.20) +
                (DIGITAL_PENETRATION_RATE * 0.10) +
                (CASE WHEN AVG_HSI_FULFILLMENT_TIME <= 7 THEN 10 
                      ELSE GREATEST(0, 10 - (AVG_HSI_FULFILLMENT_TIME - 7)) END)
            , 2) as EFFECTIVENESS_SCORE,
            
            -- Channel categorization
            CASE 
                WHEN HSI_ORDERS >= 500 AND HSI_CONVERSION_RATE >= 70 AND HSI_SUCCESS_RATE >= 85 THEN 'CHANNEL_STRATEGIS'
                WHEN HSI_ORDERS >= 200 AND HSI_CONVERSION_RATE >= 60 AND HSI_SUCCESS_RATE >= 80 THEN 'CHANNEL_UTAMA'
                WHEN HSI_ORDERS >= 50 AND HSI_CONVERSION_RATE >= 50 AND HSI_SUCCESS_RATE >= 75 THEN 'CHANNEL_PENDUKUNG'
                WHEN HSI_ORDERS >= 10 AND HSI_CONVERSION_RATE >= 30 THEN 'CHANNEL_BERKEMBANG'
                ELSE 'CHANNEL_PEMULA'
            END as KATEGORI_CHANNEL,
            
            -- Rankings
            RANK() OVER (ORDER BY HSI_ORDERS DESC) as RANKING_VOLUME,
            RANK() OVER (ORDER BY HSI_CONVERSION_RATE DESC) as RANKING_KONVERSI,
            RANK() OVER (ORDER BY EFFECTIVENESS_SCORE DESC) as RANKING_EFEKTIVITAS,
            RANK() OVER (ORDER BY BUNDLING_RATE DESC) as RANKING_BUNDLING
            
        FROM CHANNEL_METRICS
    )
    SELECT 
        CHANNEL_NAME,
        HSI_ORDERS,
        HSI_BISNIS_ORDERS,
        HSI_BASIC_ORDERS,
        TOTAL_ORDERS,
        ROUND(HSI_CONVERSION_RATE, 2) as CONVERSION_RATE_PCT,
        ROUND(HSI_BISNIS_CONVERSION_RATE, 2) as BISNIS_CONVERSION_PCT,
        ROUND(HSI_BASIC_CONVERSION_RATE, 2) as BASIC_CONVERSION_PCT,
        ROUND(HSI_SUCCESS_RATE, 2) as SUCCESS_RATE_PCT,
        HARD_BUNDLING_ORDERS,
        TOTAL_BUNDLING_ORDERS,
        ROUND(BUNDLING_RATE, 2) as BUNDLING_RATE_PCT,
        DIGITAL_PRODUCT_ORDERS,
        ROUND(DIGITAL_PENETRATION_RATE, 2) as DIGITAL_PENETRATION_PCT,
        NEW_SALES_ORDERS,
        ADD_SERVICE_ORDERS,
        MODIFICATION_ORDERS,
        ROUND(NEW_SALES_CONVERSION_RATE, 2) as NEW_SALES_CONVERSION_PCT,
        ROUND(ADD_SERVICE_CONVERSION_RATE, 2) as ADD_SERVICE_CONVERSION_PCT,
        ROUND(MODIFICATION_CONVERSION_RATE, 2) as MODIFICATION_CONVERSION_PCT,
        GOVERNMENT_ORDERS,
        EDUCATION_ORDERS,
        HEALTHCARE_ORDERS,
        INDIVIDUAL_ORDERS,
        FINANCIAL_ORDERS,
        ROUND(GOVERNMENT_HSI_CONVERSION, 2) as GOVERNMENT_HSI_CONVERSION_PCT,
        ROUND(EDUCATION_HSI_CONVERSION, 2) as EDUCATION_HSI_CONVERSION_PCT,
        ROUND(INDIVIDUAL_HSI_CONVERSION, 2) as INDIVIDUAL_HSI_CONVERSION_PCT,
        ROUND(AVG_HSI_FULFILLMENT_TIME, 1) as AVG_FULFILLMENT_DAYS,
        REGIONAL_COVERAGE,
        WITEL_COVERAGE,
        STO_COVERAGE,
        ROUND(PREMIUM_PRODUCT_FOCUS, 2) as PREMIUM_FOCUS_PCT,
        MARKET_SHARE_PCT,
        EFFECTIVENESS_SCORE,
        KATEGORI_CHANNEL,
        RANKING_VOLUME,
        RANKING_KONVERSI,
        RANKING_EFEKTIVITAS,
        RANKING_BUNDLING
    FROM CHANNEL_PERFORMANCE
    ORDER BY EFFECTIVENESS_SCORE DESC, HSI_ORDERS DESC
  `,

  BUSINESS_LOGIC: {
    assessChannelROI: function(volume, conversion_rate, success_rate, bundling_rate, digital_penetration) {
      let roi_score = 0;
      
      // Volume component (25%)
      roi_score += Math.min(volume / 500 * 25, 25);
      
      // Conversion efficiency (30%)
      roi_score += conversion_rate * 0.30;
      
      // Success rate (25%)
      roi_score += success_rate * 0.25;
      
      // Value-add services (20%)
      roi_score += (bundling_rate * 0.15) + (digital_penetration * 0.05);
      
      const roiCategories = {
        'SANGAT_TINGGI': {
          description: 'ROI sangat tinggi dengan performa unggul di semua metrik YTD 2025',
          recommendation: 'Ekspansi agresif dan pertahankan posisi kepemimpinan untuk sisa tahun 2025'
        },
        'TINGGI': {
          description: 'ROI tinggi dengan performa solid dan potensi pertumbuhan dalam 2025',
          recommendation: 'Perbesar investasi dan optimalkan untuk returns maksimal Q4 2025'
        },
        'SEDANG': {
          description: 'ROI moderat dengan performance yang dapat diterima sepanjang 2025',
          recommendation: 'Perbaikan selektif dan optimasi efisiensi untuk closing kuat 2025'
        },
        'RENDAH': {
          description: 'ROI rendah dengan performa di bawah ekspektasi dalam 2025',
          recommendation: 'Review strategis dan program peningkatan performance untuk target 2026'
        }
      };
      
      if (roi_score >= 75) return roiCategories['SANGAT_TINGGI'];
      if (roi_score >= 60) return roiCategories['TINGGI'];
      if (roi_score >= 45) return roiCategories['SEDANG'];
      return roiCategories['RENDAH'];
    },
    
    identifyChannelOpportunities: function(conversion_rate, bundling_rate, digital_penetration, premium_focus) {
      const opportunities = [];
      
      if (conversion_rate < 50) {
        opportunities.push('Optimasi tingkat konversi melalui pelatihan dan perbaikan proses untuk Q4 2025');
      }
      
      if (bundling_rate < 40) {
        opportunities.push('Tingkatkan penetrasi bundling untuk meningkatkan ARPU di sisa tahun 2025');
      }
      
      if (digital_penetration < 25) {
        opportunities.push('Ekspansi portofolio produk digital dan cross-selling untuk target akhir 2025');
      }
      
      if (premium_focus < 30) {
        opportunities.push('Fokus pada HSI Bisnis untuk meningkatkan margin dalam Q4 2025');
      }
      
      return opportunities.length > 0 ? opportunities : ['Pertahankan performa yang sudah baik dan maintain trajectory YTD 2025'];
    },
    
    generateChannelStrategy: function(kategori, market_share, ranking_efektivitas) {
      const strategies = {
        'CHANNEL_STRATEGIS': {
          focus: 'Pemeliharaan Kepemimpinan',
          actions: [
            'Pertahankan posisi kepemimpinan pasar dalam 2025',
            'Investasi dalam ekspansi kapasitas untuk Q4 2025',
            'Manfaatkan sebagai benchmark untuk channel lain',
            'Fokus pada akuisisi customer premium untuk closing 2025'
          ]
        },
        'CHANNEL_UTAMA': {
          focus: 'Akselerasi Pertumbuhan', 
          actions: [
            'Ekspansi market share agresif di sisa 2025',
            'Optimasi proses untuk efisiensi Q4 2025',
            'Program pelatihan terintensif',
            'Pengembangan kemitraan strategis untuk target 2026'
          ]
        },
        'CHANNEL_PENDUKUNG': {
          focus: 'Peningkatan Performance',
          actions: [
            'Optimasi tingkat konversi untuk Q4 2025',
            'Ekspansi geografis selektif',
            'Intensifikasi promosi bundling',
            'Edukasi layanan digital untuk customer'
          ]
        },
        'CHANNEL_BERKEMBANG': {
          focus: 'Pembangunan Fondasi',
          actions: [
            'Pengembangan kapabilitas dasar',
            'Program pelatihan dan sertifikasi intensif',
            'Peningkatan monitoring performance',
            'Peningkatan volume bertahap untuk target 2026'
          ]
        },
        'CHANNEL_PEMULA': {
          focus: 'Asesmen Kapabilitas',
          actions: [
            'Evaluasi performance komprehensif',
            'Tentukan viabilitas untuk investasi berkelanjutan',
            'Pelatihan dan support dasar',
            'Pertimbangkan alternatif strategis'
          ]
        }
      };
      
      return strategies[kategori] || {
        focus: 'Strategi Khusus',
        actions: ['Kembangkan strategi spesifik berdasarkan karakteristik unik']
      };
    },
    
    analyzeChannelLandscape: function(data) {
      const analysis = {
        periode_analisis: 'Tahun 2025 (Januari hingga saat ini)',
        total_channels: data.length,
        total_hsi_orders: data.reduce((sum, d) => sum + d.HSI_ORDERS, 0),
        channel_distribution: {},
        top_performers: [],
        improvement_opportunities: [],
        insights: []
      };
      
      // Channel distribution
      analysis.channel_distribution = {
        strategis: data.filter(d => d.KATEGORI_CHANNEL === 'CHANNEL_STRATEGIS').length,
        utama: data.filter(d => d.KATEGORI_CHANNEL === 'CHANNEL_UTAMA').length,
        pendukung: data.filter(d => d.KATEGORI_CHANNEL === 'CHANNEL_PENDUKUNG').length,
        berkembang: data.filter(d => d.KATEGORI_CHANNEL === 'CHANNEL_BERKEMBANG').length,
        pemula: data.filter(d => d.KATEGORI_CHANNEL === 'CHANNEL_PEMULA').length
      };
      
      // Top performers
      analysis.top_performers = data.slice(0, 5).map(d => ({
        channel: d.CHANNEL_NAME,
        kategori: d.KATEGORI_CHANNEL,
        market_share: `${d.MARKET_SHARE_PCT}%`,
        conversion_rate: `${d.CONVERSION_RATE_PCT}%`,
        effectiveness_score: d.EFFECTIVENESS_SCORE
      }));
      
      // Insights generation
      const avg_conversion = data.reduce((sum, d) => sum + d.CONVERSION_RATE_PCT, 0) / data.length;
      const avg_bundling = data.reduce((sum, d) => sum + d.BUNDLING_RATE_PCT, 0) / data.length;
      
      analysis.insights.push(`Rata-rata tingkat konversi HSI across channels tahun 2025 adalah ${avg_conversion.toFixed(1)}%`);
      analysis.insights.push(`Rata-rata tingkat bundling dalam 2025 adalah ${avg_bundling.toFixed(1)}%`);
      
      const strategic_channels = data.filter(d => d.KATEGORI_CHANNEL === 'CHANNEL_STRATEGIS');
      if (strategic_channels.length > 0) {
        const strategic_share = strategic_channels.reduce((sum, d) => sum + d.MARKET_SHARE_PCT, 0);
        analysis.insights.push(`Channel strategis menguasai ${strategic_share.toFixed(1)}% pangsa pasar HSI dalam 2025`);
      }

      // Transaction type insights
      const avg_new_sales = data.reduce((sum, d) => sum + d.NEW_SALES_CONVERSION_PCT, 0) / data.length;
      const avg_add_service = data.reduce((sum, d) => sum + d.ADD_SERVICE_CONVERSION_PCT, 0) / data.length;
      if (avg_add_service > avg_new_sales) {
        analysis.insights.push(`Channel lebih efektif untuk ekspansi layanan (${avg_add_service.toFixed(1)}%) dibanding akuisisi baru (${avg_new_sales.toFixed(1)}%) dalam YTD 2025`);
      }
      
      return analysis;
    },
    
    formatIndonesianResponse: function(data) {
      const landscape = this.analyzeChannelLandscape(data);
      
      const hasil_analisis = data.map(channel => {
        const roi_assessment = this.assessChannelROI(
          channel.HSI_ORDERS,
          channel.CONVERSION_RATE_PCT,
          channel.SUCCESS_RATE_PCT,
          channel.BUNDLING_RATE_PCT,
          channel.DIGITAL_PENETRATION_PCT
        );
        
        const opportunities = this.identifyChannelOpportunities(
          channel.CONVERSION_RATE_PCT,
          channel.BUNDLING_RATE_PCT,
          channel.DIGITAL_PENETRATION_PCT,
          channel.PREMIUM_FOCUS_PCT
        );
        
        const strategy = this.generateChannelStrategy(
          channel.KATEGORI_CHANNEL,
          channel.MARKET_SHARE_PCT,
          channel.RANKING_EFEKTIVITAS
        );
        
        return {
          identitas_channel: {
            nama_channel: channel.CHANNEL_NAME,
            kategori: channel.KATEGORI_CHANNEL.replace('CHANNEL_', ''),
            pangsa_pasar: `${channel.MARKET_SHARE_PCT}%`
          },
          metrik_volume: {
            total_order_hsi: channel.HSI_ORDERS.toLocaleString('id-ID'),
            order_hsi_bisnis: channel.HSI_BISNIS_ORDERS.toLocaleString('id-ID'),
            order_hsi_basic: channel.HSI_BASIC_ORDERS.toLocaleString('id-ID'),
            total_order_semua: channel.TOTAL_ORDERS.toLocaleString('id-ID'),
            ranking_volume: channel.RANKING_VOLUME
          },
          analisis_konversi: {
            tingkat_konversi_total: `${channel.CONVERSION_RATE_PCT}%`,
            tingkat_konversi_bisnis: `${channel.BISNIS_CONVERSION_PCT}%`,
            tingkat_konversi_basic: `${channel.BASIC_CONVERSION_PCT}%`,
            tingkat_keberhasilan: `${channel.SUCCESS_RATE_PCT}%`,
            ranking_konversi: channel.RANKING_KONVERSI
          },
          performa_bundling: {
            order_hard_bundling: channel.HARD_BUNDLING_ORDERS.toLocaleString('id-ID'),
            order_bundling_total: channel.TOTAL_BUNDLING_ORDERS.toLocaleString('id-ID'),
            tingkat_bundling: `${channel.BUNDLING_RATE_PCT}%`,
            ranking_bundling: channel.RANKING_BUNDLING
          },
          penetrasi_digital: {
            order_produk_digital: channel.DIGITAL_PRODUCT_ORDERS.toLocaleString('id-ID'),
            tingkat_penetrasi_digital: `${channel.DIGITAL_PENETRATION_PCT}%`,
            fokus_premium: `${channel.PREMIUM_FOCUS_PCT}%`
          },
          analisis_jenis_transaksi: {
            order_penjualan_baru: channel.NEW_SALES_ORDERS.toLocaleString('id-ID'),
            order_tambah_layanan: channel.ADD_SERVICE_ORDERS.toLocaleString('id-ID'),
            order_modifikasi: channel.MODIFICATION_ORDERS.toLocaleString('id-ID'),
            konversi_penjualan_baru: `${channel.NEW_SALES_CONVERSION_PCT}%`,
            konversi_tambah_layanan: `${channel.ADD_SERVICE_CONVERSION_PCT}%`,
            konversi_modifikasi: `${channel.MODIFICATION_CONVERSION_PCT}%`
          },
          analisis_ekosistem: {
            order_pemerintahan: channel.GOVERNMENT_ORDERS.toLocaleString('id-ID'),
            order_pendidikan: channel.EDUCATION_ORDERS.toLocaleString('id-ID'),
            order_kesehatan: channel.HEALTHCARE_ORDERS.toLocaleString('id-ID'),
            order_individual: channel.INDIVIDUAL_ORDERS.toLocaleString('id-ID'),
            order_keuangan: channel.FINANCIAL_ORDERS.toLocaleString('id-ID'),
            konversi_pemerintahan: `${channel.GOVERNMENT_HSI_CONVERSION_PCT}%`,
            konversi_pendidikan: `${channel.EDUCATION_HSI_CONVERSION_PCT}%`,
            konversi_individual: `${channel.INDIVIDUAL_HSI_CONVERSION_PCT}%`
          },
          metrik_operasional: {
            rata_rata_fulfillment: `${channel.AVG_FULFILLMENT_DAYS} hari`,
            cakupan_regional: channel.REGIONAL_COVERAGE,
            cakupan_witel: channel.WITEL_COVERAGE,
            cakupan_sto: channel.STO_COVERAGE
          },
          evaluasi_performa: {
            skor_efektivitas: channel.EFFECTIVENESS_SCORE,
            ranking_efektivitas: channel.RANKING_EFEKTIVITAS,
            assessment_roi: roi_assessment.description,
            rekomendasi_roi: roi_assessment.recommendation
          },
          peluang_perbaikan: opportunities,
          strategi_channel: {
            fokus_utama: strategy.focus,
            rencana_aksi: strategy.actions
          }
        };
      });
      
      return {
        ringkasan: 'Analisis performa channel dalam akuisisi HSI dengan klasifikasi produk lengkap',
        periode_analisis: landscape.periode_analisis,
        total_channel_aktif: landscape.total_channels,
        total_order_hsi: landscape.total_hsi_orders.toLocaleString('id-ID'),
        distribusi_kategori_channel: landscape.channel_distribution,
        top_5_performers: landscape.top_performers,
        insight_utama: landscape.insights,
        benchmark_kpi: {
          target_tingkat_konversi: '≥ 60%',
          target_tingkat_keberhasilan: '≥ 85%',
          target_tingkat_bundling: '≥ 40%',
          target_penetrasi_digital: '≥ 25%',
          target_skor_efektivitas: '≥ 70'
        },
        specialization_insights: {
          preferensi_jenis_transaksi: 'Perbandingan efektivitas PENJUALAN_BARU vs TAMBAH_LAYANAN vs MODIFIKASI',
          kesesuaian_ekosistem_pasar: 'Efektivitas channel untuk Pemerintahan vs Pendidikan vs Individual',
          deployment_strategis: 'Deploy channel sesuai kekuatan spesialisasi masing-masing'
        },
        detail_channel: hasil_analisis,
        rekomendasi_strategis: [
          'Prioritaskan investasi pada channel dengan ROI tinggi dan potensi scale-up untuk Q4 2025',
          'Implementasi praktik terbaik dari channel strategis ke channel berkembang',
          'Fokus pada optimasi tingkat konversi di semua level channel untuk closing kuat 2025',
          'Tingkatkan bundling dan penetrasi digital untuk maksimalkan ARPU per channel di sisa 2025',
          'Kembangkan program pelatihan komprehensif untuk peningkatan kapabilitas channel',
          'Deploy resource channel berdasarkan spesialisasi jenis transaksi untuk efisiensi maksimal',
          'Optimalkan kesesuaian channel-ekosistem untuk efisiensi penetrasi pasar yang maksimal dalam 2025'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = patternMatcher.calculateConfidence(userInput, module.exports.KEYWORD_PATTERNS);
      const lowerInput = userInput.toLowerCase();
      
      // Determine focus area based on input patterns
      let focus_area = 'performa_channel';
      if (lowerInput.includes('conversion') || lowerInput.includes('konversi')) {
        focus_area = 'analisis_konversi';
      } else if (lowerInput.includes('bundling') || lowerInput.includes('paket')) {
        focus_area = 'performa_bundling';
      } else if (lowerInput.includes('digital') || lowerInput.includes('produk digital')) {
        focus_area = 'penetrasi_digital';
      } else if (lowerInput.includes('ekosistem') || lowerInput.includes('ecosystem') || lowerInput.includes('sektor')) {
        focus_area = 'analisis_ekosistem';
      } else if (lowerInput.includes('transaksi') || lowerInput.includes('transaction') || lowerInput.includes('penjualan')) {
        focus_area = 'analisis_transaksi';
      }
      
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: focus_area,
        requires_roi_analysis: lowerInput.includes('roi') || lowerInput.includes('return') || lowerInput.includes('efisiensi'),
        requires_comparison: lowerInput.includes('compare') || lowerInput.includes('bandingkan') || lowerInput.includes('vs'),
        requires_geographic_breakdown: lowerInput.includes('regional') || lowerInput.includes('witel') || lowerInput.includes('geografis')
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};