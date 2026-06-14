const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_010',
    RULE_NAME: 'digital_product_penetration',
    DESCRIPTION: 'Analisis penetrasi produk digital bersama layanan HSI',
    DATABASE: 'BRIGHTAI_SALES',
    CATEGORY: 'DIGITAL_PENETRATION',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'MEDIUM-HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_SALES"),

  KEYWORD_PATTERNS: {
    primary: [
      // Digital penetration - yang biasa digunakan
      'penetrasi digital', 'digital penetration', 'produk digital hsi',
      'adopsi digital', 'digital adoption', 'layanan digital',
      
      // Specific products familiar
      'oca interaction', 'oca blast', 'pijar sekolah', 'pijar', 'netmonk',
      'produk digital', 'bundling digital', 'cross selling digital', 'attachment digital'
    ],
    
    supporting: [
      // Digital terms familiar
      'digital', 'online', 'internet service', 'value added service',
      'add on', 'additional service', 'premium service',
      
      // Analysis terms
      'penetrasi', 'penetration', 'adoption', 'usage', 'attach rate',
      'bundling', 'cross sell', 'upselling', 'monetisasi',
      
      // Business context
      'revenue', 'arpu', 'margin', 'profit', 'customer value'
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
      } else if (lowerInput.includes('digital') && 
                (lowerInput.includes('hsi') || lowerInput.includes('penetrasi'))) {
        score = 65;
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
            EKOSISTEM,
            PROVIDER,
            ND_VOICE,

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
            
            -- Customer Journey Type Classification (from TYPE_TRANS)
            CASE 
                WHEN TYPE_TRANS = 'NEW SALES' THEN 'Akuisisi Customer Baru'
                WHEN TYPE_TRANS IN ('ADD SERVICE', 'MODIFICATION') THEN 'Upsell Customer Existing'
                WHEN TYPE_TRANS = 'RO' THEN 'Resume Layanan'
                ELSE 'Lainnya'
            END as CUSTOMER_JOURNEY_TYPE,
            
            -- Target Ecosystem Classification (from EKOSISTEM)
            CASE
                WHEN UPPER(EKOSISTEM) IN ('EDUCATION', 'SEKOLAH', 'PESANTREN') THEN 'PENDIDIKAN'
                WHEN UPPER(EKOSISTEM) IN ('GOVERNMENT') THEN 'PEMERINTAHAN'
                WHEN UPPER(EKOSISTEM) IN ('HEALTH', 'KLINIK', 'HEALTY') THEN 'KESEHATAN'
                WHEN UPPER(EKOSISTEM) IN ('HOTEL', 'PROPERTY', 'APARTEMEN') THEN 'HOSPITALITAS'
                WHEN UPPER(EKOSISTEM) IN ('AGRI', 'AGRICULTURE') THEN 'PERTANIAN'
                WHEN UPPER(EKOSISTEM) IN ('MEDIA DAN KOMUNIKASI', 'MEDIA & KOMUNIKASI', 'MEDIA AND COMMUNICATION', 'COMMUNICATION', 'MEDIA&COMUNICATION', 'MEDIA DAN COMMUNICATION') THEN 'MEDIA_KOMUNIKASI'
                WHEN UPPER(EKOSISTEM) IN ('MANUFAKTUR', 'PABRIKASI') THEN 'MANUFAKTUR'
                ELSE 'LAINNYA'
            END as TARGET_ECOSYSTEM,
            
            -- Sales Division Classification (from PROVIDER)
            CASE
                WHEN PROVIDER LIKE 'DES%' THEN 'Solusi Enterprise Digital'
                WHEN PROVIDER LIKE 'DGS%' THEN 'Solusi Pemerintahan Digital'
                WHEN PROVIDER LIKE 'DBS%' THEN 'Solusi Bisnis Digital'
                WHEN PROVIDER LIKE 'RBS%' THEN 'Solusi Bisnis Regional'
                WHEN PROVIDER LIKE 'DCS%' THEN 'Solusi Korporat Digital'
                WHEN PROVIDER LIKE 'DPS%' THEN 'Solusi Private Digital'
                WHEN PROVIDER LIKE 'DSS%' THEN 'Solusi Strategis Digital'
                WHEN PROVIDER LIKE 'REG%' THEN 'Solusi Regional'
                ELSE 'Solusi Lainnya'
            END as SALES_DIVISION
            
        FROM DWH_MOIS.BRIGHTAI_SALES
        WHERE ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
    ),
    
    DIGITAL_PENETRATION_ANALYSIS AS (
        SELECT 
            -- Digital product categories
            'Pijar Sekolah' as digital_product_name,
            'PENDIDIKAN' as product_category,
            
            -- Fundamental metrics dengan ORDER_ID, NCLI, ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) as digital_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN NCLI END) as digital_customers,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN ND_HSI END) as digital_services,
            
            -- Customer-Order-Service relationship untuk digital product
            ROUND(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN NCLI END), 0), 2) as avg_orders_per_customer,
            ROUND(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN ND_HSI END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN NCLI END), 0), 2) as avg_services_per_customer,
            
            -- HSI breakdown berdasarkan data aktual
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) as hsi_bisnis_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) as hsi_basic_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_PIJAR_SEKOLAH = 1 THEN NCLI END) as hsi_bisnis_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_PIJAR_SEKOLAH = 1 THEN NCLI END) as hsi_basic_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_PIJAR_SEKOLAH = 1 THEN ND_HSI END) as hsi_bisnis_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_PIJAR_SEKOLAH = 1 THEN ND_HSI END) as hsi_basic_services,
            
            -- Service combination metrics
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 AND HAS_VOICE = 1 THEN ORDER_ID END) as triple_play_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 AND BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as hard_bundling_orders,
            
            -- Technical metrics
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
                     AND CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) > 0
                THEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) END) as avg_bandwidth_kbps,
            
            -- Geographic metrics
            COUNT(DISTINCT REGIONAL) as regional_coverage,
            COUNT(DISTINCT WITEL) as witel_coverage,
            
            -- Revenue estimation
            80000 as estimated_additional_arpu, -- Educational product premium
            
            -- Enhanced metrics dengan customer journey
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 AND CUSTOMER_JOURNEY_TYPE = 'Akuisisi Customer Baru' THEN ORDER_ID END) as new_customer_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 AND CUSTOMER_JOURNEY_TYPE = 'Upsell Customer Existing' THEN ORDER_ID END) as upsell_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 AND TARGET_ECOSYSTEM = 'PENDIDIKAN' THEN ORDER_ID END) as target_ecosystem_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN SALES_DIVISION END) as sales_division_diversity
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
        HAVING COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) > 0
        
        UNION ALL
        
        SELECT 
            'OCA Interaction' as digital_product_name,
            'KOMUNIKASI_BISNIS' as product_category,
            
            -- Fundamental metrics dengan ORDER_ID, NCLI, ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN ORDER_ID END) as digital_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN NCLI END) as digital_customers,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN ND_HSI END) as digital_services,
            
            -- Customer-Order-Service relationship
            ROUND(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN ORDER_ID END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN NCLI END), 0), 2) as avg_orders_per_customer,
            ROUND(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN ND_HSI END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN NCLI END), 0), 2) as avg_services_per_customer,
            
            -- HSI breakdown berdasarkan data aktual
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_OCA_INTERACTION = 1 THEN ORDER_ID END) as hsi_bisnis_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_OCA_INTERACTION = 1 THEN ORDER_ID END) as hsi_basic_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_OCA_INTERACTION = 1 THEN NCLI END) as hsi_bisnis_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_OCA_INTERACTION = 1 THEN NCLI END) as hsi_basic_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_OCA_INTERACTION = 1 THEN ND_HSI END) as hsi_bisnis_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_OCA_INTERACTION = 1 THEN ND_HSI END) as hsi_basic_services,
            
            -- Service combination metrics
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 AND HAS_VOICE = 1 THEN ORDER_ID END) as triple_play_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 AND BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as hard_bundling_orders,
            
            -- Technical metrics
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
                     AND CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) > 0
                THEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) END) as avg_bandwidth_kbps,
            
            -- Geographic metrics
            COUNT(DISTINCT REGIONAL) as regional_coverage,
            COUNT(DISTINCT WITEL) as witel_coverage,
            
            -- Revenue estimation
            120000 as estimated_additional_arpu, -- Premium business communication
            
            -- Enhanced metrics dengan customer journey
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 AND CUSTOMER_JOURNEY_TYPE = 'Akuisisi Customer Baru' THEN ORDER_ID END) as new_customer_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 AND CUSTOMER_JOURNEY_TYPE = 'Upsell Customer Existing' THEN ORDER_ID END) as upsell_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 AND TARGET_ECOSYSTEM IN ('MEDIA_KOMUNIKASI', 'LAINNYA') THEN ORDER_ID END) as target_ecosystem_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN SALES_DIVISION END) as sales_division_diversity
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
        HAVING COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INTERACTION = 1 THEN ORDER_ID END) > 0
        
        UNION ALL
        
        SELECT 
            'OCA Blast' as digital_product_name,
            'OTOMASI_MARKETING' as product_category,
            
            -- Fundamental metrics dengan ORDER_ID, NCLI, ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN ORDER_ID END) as digital_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN NCLI END) as digital_customers,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN ND_HSI END) as digital_services,
            
            -- Customer-Order-Service relationship
            ROUND(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN ORDER_ID END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN NCLI END), 0), 2) as avg_orders_per_customer,
            ROUND(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN ND_HSI END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN NCLI END), 0), 2) as avg_services_per_customer,
            
            -- HSI breakdown berdasarkan data aktual
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_OCA_BLAST = 1 THEN ORDER_ID END) as hsi_bisnis_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_OCA_BLAST = 1 THEN ORDER_ID END) as hsi_basic_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_OCA_BLAST = 1 THEN NCLI END) as hsi_bisnis_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_OCA_BLAST = 1 THEN NCLI END) as hsi_basic_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_OCA_BLAST = 1 THEN ND_HSI END) as hsi_bisnis_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_OCA_BLAST = 1 THEN ND_HSI END) as hsi_basic_services,
            
            -- Service combination metrics
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 AND HAS_VOICE = 1 THEN ORDER_ID END) as triple_play_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 AND BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as hard_bundling_orders,
            
            -- Technical metrics
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
                     AND CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) > 0
                THEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) END) as avg_bandwidth_kbps,
            
            -- Geographic metrics
            COUNT(DISTINCT REGIONAL) as regional_coverage,
            COUNT(DISTINCT WITEL) as witel_coverage,
            
            -- Revenue estimation
            60000 as estimated_additional_arpu, -- Marketing automation service
            
            -- Enhanced metrics dengan customer journey
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 AND CUSTOMER_JOURNEY_TYPE = 'Akuisisi Customer Baru' THEN ORDER_ID END) as new_customer_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 AND CUSTOMER_JOURNEY_TYPE = 'Upsell Customer Existing' THEN ORDER_ID END) as upsell_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 AND TARGET_ECOSYSTEM IN ('MEDIA_KOMUNIKASI', 'HOSPITALITAS', 'LAINNYA') THEN ORDER_ID END) as target_ecosystem_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN SALES_DIVISION END) as sales_division_diversity
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
        HAVING COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN ORDER_ID END) > 0
        
        UNION ALL
        
        SELECT 
            'NETMONK' as digital_product_name,
            'MONITORING_JARINGAN' as product_category,
            
            -- Fundamental metrics dengan ORDER_ID, NCLI, ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN ORDER_ID END) as digital_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN NCLI END) as digital_customers,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN ND_HSI END) as digital_services,
            
            -- Customer-Order-Service relationship
            ROUND(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN ORDER_ID END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN NCLI END), 0), 2) as avg_orders_per_customer,
            ROUND(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN ND_HSI END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN NCLI END), 0), 2) as avg_services_per_customer,
            
            -- HSI breakdown berdasarkan data aktual
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_NETMONK = 1 THEN ORDER_ID END) as hsi_bisnis_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_NETMONK = 1 THEN ORDER_ID END) as hsi_basic_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_NETMONK = 1 THEN NCLI END) as hsi_bisnis_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_NETMONK = 1 THEN NCLI END) as hsi_basic_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 AND IS_NETMONK = 1 THEN ND_HSI END) as hsi_bisnis_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 AND IS_NETMONK = 1 THEN ND_HSI END) as hsi_basic_services,
            
            -- Service combination metrics
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 AND HAS_VOICE = 1 THEN ORDER_ID END) as triple_play_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 AND BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as hard_bundling_orders,
            
            -- Technical metrics
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
                     AND CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) > 0
                THEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) END) as avg_bandwidth_kbps,
            
            -- Geographic metrics
            COUNT(DISTINCT REGIONAL) as regional_coverage,
            COUNT(DISTINCT WITEL) as witel_coverage,
            
            -- Revenue estimation
            150000 as estimated_additional_arpu, -- Premium network monitoring
            
            -- Enhanced metrics dengan customer journey
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 AND CUSTOMER_JOURNEY_TYPE = 'Akuisisi Customer Baru' THEN ORDER_ID END) as new_customer_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 AND CUSTOMER_JOURNEY_TYPE = 'Upsell Customer Existing' THEN ORDER_ID END) as upsell_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 AND TARGET_ECOSYSTEM IN ('PEMERINTAHAN', 'MANUFAKTUR', 'LAINNYA') THEN ORDER_ID END) as target_ecosystem_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN SALES_DIVISION END) as sales_division_diversity
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
        HAVING COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN ORDER_ID END) > 0
    ),
    
    TOTAL_HSI_BASE AS (
        SELECT 
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as total_hsi_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as total_hsi_bisnis_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as total_hsi_basic_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) as total_hsi_customers,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) as total_hsi_services
        FROM HSI_CLASSIFICATION
    ),
    
    PENETRATION_METRICS AS (
        SELECT
            dpa.digital_product_name,
            dpa.product_category,
            dpa.digital_orders,
            dpa.digital_customers,
            dpa.digital_services,
            dpa.avg_orders_per_customer,
            dpa.avg_services_per_customer,
            dpa.hsi_bisnis_orders,
            dpa.hsi_basic_orders,
            dpa.hsi_bisnis_customers,
            dpa.hsi_basic_customers,
            dpa.hsi_bisnis_services,
            dpa.hsi_basic_services,
            dpa.triple_play_orders,
            dpa.hard_bundling_orders,
            dpa.avg_bandwidth_kbps,
            dpa.regional_coverage,
            dpa.witel_coverage,
            dpa.estimated_additional_arpu,
            dpa.new_customer_orders,
            dpa.upsell_orders,
            dpa.target_ecosystem_orders,
            dpa.sales_division_diversity,
            thb.total_hsi_orders,
            thb.total_hsi_bisnis_orders,
            thb.total_hsi_basic_orders,
            thb.total_hsi_customers,
            thb.total_hsi_services,
            
            -- Penetration rates berdasarkan orders
            ROUND(dpa.digital_orders * 100.0 / NULLIF(thb.total_hsi_orders, 0), 2) as penetration_rate_orders,
            ROUND(dpa.hsi_bisnis_orders * 100.0 / NULLIF(thb.total_hsi_bisnis_orders, 0), 2) as penetration_rate_bisnis_orders,
            ROUND(dpa.hsi_basic_orders * 100.0 / NULLIF(thb.total_hsi_basic_orders, 0), 2) as penetration_rate_basic_orders,
            
            -- Penetration rates berdasarkan customers
            ROUND(dpa.digital_customers * 100.0 / NULLIF(thb.total_hsi_customers, 0), 2) as penetration_rate_customers,
            ROUND(dpa.hsi_bisnis_customers * 100.0 / NULLIF(thb.total_hsi_customers, 0), 2) as penetration_rate_bisnis_cust,
            ROUND(dpa.hsi_basic_customers * 100.0 / NULLIF(thb.total_hsi_customers, 0), 2) as penetration_rate_basic_cust,
            
            -- Penetration rates berdasarkan services
            ROUND(dpa.digital_services * 100.0 / NULLIF(thb.total_hsi_services, 0), 2) as penetration_rate_services,
            
            -- Service combination rates
            ROUND(dpa.triple_play_orders * 100.0 / NULLIF(dpa.digital_orders, 0), 2) as triple_play_rate,
            ROUND(dpa.hard_bundling_orders * 100.0 / NULLIF(dpa.digital_orders, 0), 2) as hard_bundling_rate,
            
            -- Customer journey rates
            ROUND(dpa.new_customer_orders * 100.0 / NULLIF(dpa.digital_orders, 0), 2) as new_customer_rate,
            ROUND(dpa.upsell_orders * 100.0 / NULLIF(dpa.digital_orders, 0), 2) as upsell_rate,
            ROUND(dpa.target_ecosystem_orders * 100.0 / NULLIF(dpa.digital_orders, 0), 2) as ecosystem_alignment_rate,
            
            -- Revenue impact berdasarkan customers (lebih akurat)
            dpa.digital_customers * dpa.estimated_additional_arpu as total_addl_monthly_revenue,
            
            -- Market potential (assuming 30% ceiling for premium digital products)
            ROUND((thb.total_hsi_customers * 0.30) - dpa.digital_customers, 0) as market_pot_remaining_cust,
            
            -- Adoption categorization berdasarkan customer penetration
            CASE 
                WHEN dpa.digital_customers * 100.0 / NULLIF(thb.total_hsi_customers, 0) >= 20 THEN 'MAINSTREAM'
                WHEN dpa.digital_customers * 100.0 / NULLIF(thb.total_hsi_customers, 0) >= 10 THEN 'TUMBUH_CEPAT'
                WHEN dpa.digital_customers * 100.0 / NULLIF(thb.total_hsi_customers, 0) >= 5 THEN 'BERKEMBANG'
                WHEN dpa.digital_customers * 100.0 / NULLIF(thb.total_hsi_customers, 0) >= 2 THEN 'AWAL'
                ELSE 'TERBATAS'
            END as kategori_adopsi
            
        FROM DIGITAL_PENETRATION_ANALYSIS dpa
        CROSS JOIN TOTAL_HSI_BASE thb
    )
    SELECT 
        digital_product_name,
        product_category,
        
        -- Fundamental metrics
        digital_orders,
        digital_customers,
        digital_services,
        avg_orders_per_customer,
        avg_services_per_customer,
        
        -- HSI breakdown
        hsi_bisnis_orders,
        hsi_basic_orders,
        hsi_bisnis_customers,
        hsi_basic_customers,
        hsi_bisnis_services,
        hsi_basic_services,
        
        -- Penetration rates
        penetration_rate_orders,
        penetration_rate_customers,
        penetration_rate_services,
        penetration_rate_bisnis_orders,
        penetration_rate_basic_orders,
        penetration_rate_bisnis_cust,
        penetration_rate_basic_cust,
        
        -- Service combination
        triple_play_orders,
        triple_play_rate,
        hard_bundling_orders,
        hard_bundling_rate,
        
        -- Technical metrics
        ROUND(avg_bandwidth_kbps/1000, 0) as avg_bandwidth_mbps,
        regional_coverage,
        witel_coverage,
        
        -- Revenue metrics
        estimated_additional_arpu,
        ROUND(total_addl_monthly_revenue/1000000, 2) as total_revenue_impact_millions,
        market_pot_remaining_cust,
        
        -- Customer journey metrics
        new_customer_orders,
        upsell_orders,
        new_customer_rate,
        upsell_rate,
        target_ecosystem_orders,
        ecosystem_alignment_rate,
        sales_division_diversity,
        
        -- Categories and rankings
        kategori_adopsi,
        RANK() OVER (ORDER BY penetration_rate_customers DESC) as ranking_penetrasi_customer,
        RANK() OVER (ORDER BY penetration_rate_orders DESC) as ranking_penetrasi_order,
        RANK() OVER (ORDER BY digital_customers DESC) as ranking_volume_customer,
        RANK() OVER (ORDER BY digital_orders DESC) as ranking_volume_order,
        RANK() OVER (ORDER BY total_addl_monthly_revenue DESC) as ranking_revenue_impact
    FROM PENETRATION_METRICS
    ORDER BY penetration_rate_customers DESC, digital_customers DESC
  `,

  BUSINESS_LOGIC: {
    assessDigitalProductHealth: function(penetration_rate_customers, digital_customers, regional_coverage, revenue_impact) {
      let health_score = 0;
      
      // Customer penetration rate component (40%)
      if (penetration_rate_customers >= 20) health_score += 40;
      else if (penetration_rate_customers >= 15) health_score += 35;
      else if (penetration_rate_customers >= 10) health_score += 30;
      else if (penetration_rate_customers >= 5) health_score += 20;
      else if (penetration_rate_customers >= 2) health_score += 10;
      else health_score += 5;
      
      // Customer volume component (25%)
      if (digital_customers >= 2000) health_score += 25;
      else if (digital_customers >= 1000) health_score += 20;
      else if (digital_customers >= 500) health_score += 15;
      else if (digital_customers >= 100) health_score += 10;
      else health_score += 5;
      
      // Geographic spread component (20%)
      if (regional_coverage >= 6) health_score += 20;
      else if (regional_coverage >= 4) health_score += 15;
      else if (regional_coverage >= 3) health_score += 10;
      else if (regional_coverage >= 2) health_score += 5;
      else health_score += 2;
      
      // Revenue impact component (15%)
      if (revenue_impact >= 50) health_score += 15;
      else if (revenue_impact >= 20) health_score += 12;
      else if (revenue_impact >= 10) health_score += 8;
      else if (revenue_impact >= 5) health_score += 5;
      else health_score += 2;
      
      const healthCategories = {
        'BERKEMBANG_PESAT': {
          description: 'Produk digital dengan momentum pertumbuhan sangat baik',
          recommendation: 'Accelerate growth dengan aggressive marketing dan capacity expansion'
        },
        'SEHAT': {
          description: 'Produk digital dengan performa solid dan stabil',
          recommendation: 'Maintain momentum dan selective expansion ke market baru'
        },
        'TUMBUH': {
          description: 'Produk digital menunjukkan tren positif namun perlu optimasi',
          recommendation: 'Focus pada conversion improvement dan geographic expansion'
        },
        'PERLU_PERHATIAN': {
          description: 'Produk digital dengan performa di bawah potensi',
          recommendation: 'Strategic review untuk identifikasi barrier dan improvement plan'
        }
      };
      
      if (health_score >= 80) return healthCategories['BERKEMBANG_PESAT'];
      if (health_score >= 65) return healthCategories['SEHAT'];
      if (health_score >= 45) return healthCategories['TUMBUH'];
      return healthCategories['PERLU_PERHATIAN'];
    },
    
    identifyGrowthOpportunities: function(product_name, penetration_bisnis_customers, penetration_basic_customers, triple_play_rate, regional_coverage, new_customer_rate, upsell_rate, ecosystem_alignment_rate, avg_services_per_customer) {
      const opportunities = [];
      
      // Product-specific opportunities
      if (product_name === 'Pijar Sekolah') {
        if (penetration_bisnis_customers < 15) opportunities.push('Ekspansi ke sektor pendidikan bisnis dan korporat');
        if (regional_coverage < 5) opportunities.push('Geographic expansion ke wilayah dengan density sekolah tinggi');
        if (ecosystem_alignment_rate < 80) opportunities.push('Focus targeting ke ekosistem education yang lebih tepat');
      }
      
      if (product_name === 'OCA Interaction') {
        if (penetration_bisnis_customers < 25) opportunities.push('Focus pada enterprise customer dengan komunikasi intensif');
        if (triple_play_rate < 60) opportunities.push('Bundle dengan voice service untuk complete solution');
        if (upsell_rate < 40) opportunities.push('Tingkatkan cross-selling ke existing HSI customer');
      }
      
      if (product_name === 'OCA Blast') {
        if (penetration_basic_customers < 10) opportunities.push('Target UMKM dengan kebutuhan marketing digital');
        if (penetration_bisnis_customers < 20) opportunities.push('Upsell ke HSI Bisnis customer dengan program promosi');
        if (new_customer_rate < 30) opportunities.push('Develop acquisition strategy untuk new customer segment');
      }
      
      if (product_name === 'NETMONK') {
        if (penetration_bisnis_customers < 30) opportunities.push('Positioning sebagai premium enterprise solution');
        if (regional_coverage < 6) opportunities.push('Ekspansi ke regional dengan IT infrastructure demand tinggi');
        if (ecosystem_alignment_rate < 70) opportunities.push('Target government dan manufacturing sector lebih agresif');
      }
      
      // General opportunities based on enhanced metrics
      if (triple_play_rate < 40) {
        opportunities.push('Tingkatkan bundling dengan voice untuk customer stickiness');
      }
      
      if (avg_services_per_customer < 1.5) {
        opportunities.push('Opportunity untuk cross-selling layanan tambahan per customer');
      }
      
      if (new_customer_rate > 70) {
        opportunities.push('Leverage acquisition success untuk scale up marketing investment');
      } else if (new_customer_rate < 30) {
        opportunities.push('Develop customer acquisition strategy dan improve market penetration');
      }
      
      if (upsell_rate > 60) {
        opportunities.push('Optimize upselling strategy sebagai primary growth driver');
      } else if (upsell_rate < 20) {
        opportunities.push('Develop cross-selling program untuk existing customer base');
      }
      
      return opportunities.length > 0 ? opportunities : ['Maintain current growth trajectory dan optimize existing market'];
    },
    
    calculateGrowthPotential: function(current_penetration_customers, market_remaining, product_category) {
      // Market ceiling assumptions by product category
      const market_ceilings = {
        'PENDIDIKAN': 25, // Educational products max ~25% penetration
        'KOMUNIKASI_BISNIS': 35, // Business comm max ~35% penetration
        'OTOMASI_MARKETING': 20, // Marketing tools max ~20% penetration
        'MONITORING_JARINGAN': 30 // Enterprise tools max ~30% penetration
      };
      
      const ceiling = market_ceilings[product_category] || 25;
      const growth_headroom = ceiling - current_penetration_customers;
      const potential_score = (growth_headroom / ceiling) * 100;
      
      const potentialCategories = {
        'SANGAT_TINGGI': 'Potensi pertumbuhan sangat tinggi dengan market masih terbuka lebar',
        'TINGGI': 'Potensi pertumbuhan tinggi dengan space signifikan untuk ekspansi', 
        'SEDANG': 'Potensi pertumbuhan moderat dengan selective opportunities',
        'TERBATAS': 'Potensi pertumbuhan terbatas, focus pada retention dan optimization'
      };
      
      if (potential_score >= 75) return { category: 'SANGAT_TINGGI', description: potentialCategories['SANGAT_TINGGI'] };
      if (potential_score >= 50) return { category: 'TINGGI', description: potentialCategories['TINGGI'] };
      if (potential_score >= 25) return { category: 'SEDANG', description: potentialCategories['SEDANG'] };
      return { category: 'TERBATAS', description: potentialCategories['TERBATAS'] };
    },
    
    analyzeDigitalEcosystem: function(data) {
      const analysis = {
        total_products: data.length,
        total_digital_orders: data.reduce((sum, d) => sum + d.DIGITAL_ORDERS, 0),
        total_digital_customers: data.reduce((sum, d) => sum + d.DIGITAL_CUSTOMERS, 0),
        total_digital_services: data.reduce((sum, d) => sum + d.DIGITAL_SERVICES, 0),
        total_revenue_impact: data.reduce((sum, d) => sum + d.TOTAL_REVENUE_IMPACT_MILLIONS, 0),
        avg_services_per_customer: data.reduce((sum, d) => sum + d.AVG_SERVICES_PER_CUSTOMER, 0) / data.length,
        product_performance: {},
        top_performers: [],
        insights: [],
        customer_journey_insights: {},
        ecosystem_insights: {}
      };
      
      // Product performance distribution
      analysis.product_performance = {
        mainstream: data.filter(d => d.KATEGORI_ADOPSI === 'MAINSTREAM').length,
        tumbuh_cepat: data.filter(d => d.KATEGORI_ADOPSI === 'TUMBUH_CEPAT').length,
        berkembang: data.filter(d => d.KATEGORI_ADOPSI === 'BERKEMBANG').length,
        awal: data.filter(d => d.KATEGORI_ADOPSI === 'AWAL').length,
        terbatas: data.filter(d => d.KATEGORI_ADOPSI === 'TERBATAS').length
      };
      
      // Customer journey insights
      analysis.customer_journey_insights = {
        avg_new_customer_rate: data.reduce((sum, d) => sum + d.NEW_CUSTOMER_RATE, 0) / data.length,
        avg_upsell_rate: data.reduce((sum, d) => sum + d.UPSELL_RATE, 0) / data.length,
        acquisition_focused: data.filter(d => d.NEW_CUSTOMER_RATE > d.UPSELL_RATE).length,
        upsell_focused: data.filter(d => d.UPSELL_RATE > d.NEW_CUSTOMER_RATE).length
      };
      
      // Ecosystem alignment insights
      analysis.ecosystem_insights = {
        avg_ecosystem_alignment: data.reduce((sum, d) => sum + d.ECOSYSTEM_ALIGNMENT_RATE, 0) / data.length,
        well_aligned_products: data.filter(d => d.ECOSYSTEM_ALIGNMENT_RATE >= 70).length,
        sales_diversity: data.reduce((sum, d) => sum + d.SALES_DIVISION_DIVERSITY, 0) / data.length
      };
      
      // Top performers
      analysis.top_performers = data.map(d => ({
        product: d.DIGITAL_PRODUCT_NAME,
        penetrasi_customer: `${d.PENETRATION_RATE_CUSTOMERS}%`,
        penetrasi_order: `${d.PENETRATION_RATE_ORDERS}%`,
        customers: (d.DIGITAL_CUSTOMERS || 0).toLocaleString('id-ID'),
        orders: (d.DIGITAL_ORDERS || 0).toLocaleString('id-ID'),
        services: (d.DIGITAL_SERVICES || 0).toLocaleString('id-ID'),
        revenue_impact: `Rp ${d.TOTAL_REVENUE_IMPACT_MILLIONS}M`,
        kategori: d.KATEGORI_ADOPSI,
        avg_services_per_customer: d.AVG_SERVICES_PER_CUSTOMER,
        new_customer_rate: `${d.NEW_CUSTOMER_RATE}%`,
        upsell_rate: `${d.UPSELL_RATE}%`,
        ecosystem_alignment: `${d.ECOSYSTEM_ALIGNMENT_RATE}%`
      }));
      
      // Generate enhanced insights berdasarkan metrik baru
      const avg_penetration_customers = data.reduce((sum, d) => sum + d.PENETRATION_RATE_CUSTOMERS, 0) / data.length;
      analysis.insights.push(`Rata-rata penetrasi customer produk digital adalah ${(avg_penetration_customers || 0).toFixed(1)}%`);
      
      const avg_penetration_orders = data.reduce((sum, d) => sum + d.PENETRATION_RATE_ORDERS, 0) / data.length;
      analysis.insights.push(`Rata-rata penetrasi order produk digital adalah ${(avg_penetration_orders || 0).toFixed(1)}%`);
      
      analysis.insights.push(`Rata-rata ${(analysis.avg_services_per_customer || 0).toFixed(2)} layanan digital per customer`);
      
      const premium_products = data.filter(d => d.ESTIMATED_ADDITIONAL_ARPU >= 100000);
      if (premium_products.length > 0) {
        const premium_revenue = premium_products.reduce((sum, d) => sum + d.TOTAL_REVENUE_IMPACT_MILLIONS, 0);
        analysis.insights.push(`Produk premium berkontribusi Rp ${(premium_revenue || 0).toFixed(1)}M dari total revenue digital`);
      }
      
      const business_focused = data.filter(d => d.PENETRATION_RATE_BISNIS_CUSTOMERS > d.PENETRATION_RATE_BASIC_CUSTOMERS);
      if (business_focused.length > 0) {
        analysis.insights.push(`${business_focused.length} produk digital lebih populer di segmen HSI Bisnis`);
      }
      
      // Enhanced insights based on new metrics
      if (analysis.customer_journey_insights.acquisition_focused > analysis.customer_journey_insights.upsell_focused) {
        analysis.insights.push(`Mayoritas produk digital fokus pada new customer acquisition (${analysis.customer_journey_insights.acquisition_focused} produk)`);
      } else {
        analysis.insights.push(`Mayoritas produk digital fokus pada existing customer upsell (${analysis.customer_journey_insights.upsell_focused} produk)`);
      }
      
      if (analysis.ecosystem_insights.avg_ecosystem_alignment >= 70) {
        analysis.insights.push(`Produk digital menunjukkan alignment baik dengan target ecosystem (rata-rata ${(analysis.ecosystem_insights.avg_ecosystem_alignment || 0).toFixed(1)}%)`);
      } else {
        analysis.insights.push(`Peluang improvement dalam ecosystem targeting (rata-rata alignment ${(analysis.ecosystem_insights.avg_ecosystem_alignment || 0).toFixed(1)}%)`);
      }
      
      return analysis;
    },
    
    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const ecosystem = this.analyzeDigitalEcosystem(data);
      
      const hasil_analisis = data.map(product => {
        const health = this.assessDigitalProductHealth(
          product.PENETRATION_RATE_CUSTOMERS,
          product.DIGITAL_CUSTOMERS,
          product.REGIONAL_COVERAGE,
          product.TOTAL_REVENUE_IMPACT_MILLIONS
        );
        
        const opportunities = this.identifyGrowthOpportunities(
          product.DIGITAL_PRODUCT_NAME,
          product.PENETRATION_RATE_BISNIS_CUSTOMERS,
          product.PENETRATION_RATE_BASIC_CUSTOMERS,
          product.TRIPLE_PLAY_RATE,
          product.REGIONAL_COVERAGE,
          product.NEW_CUSTOMER_RATE,
          product.UPSELL_RATE,
          product.ECOSYSTEM_ALIGNMENT_RATE,
          product.AVG_SERVICES_PER_CUSTOMER
        );
        
        const growth_potential = this.calculateGrowthPotential(
          product.PENETRATION_RATE_CUSTOMERS,
          product.MARKET_POTENTIAL_REMAINING_CUSTOMERS,
          product.PRODUCT_CATEGORY
        );
        
        return {
          identitas_produk: {
            nama_produk: product.DIGITAL_PRODUCT_NAME,
            kategori_produk: product.PRODUCT_CATEGORY,
            kategori_adopsi: product.KATEGORI_ADOPSI
          },
          metrik_fundamental: {
            total_order_digital: (product.DIGITAL_ORDERS || 0).toLocaleString('id-ID'),
            total_customer_digital: (product.DIGITAL_CUSTOMERS || 0).toLocaleString('id-ID'),
            total_layanan_digital: (product.DIGITAL_SERVICES || 0).toLocaleString('id-ID'),
            rata_rata_order_per_customer: product.AVG_ORDERS_PER_CUSTOMER,
            rata_rata_layanan_per_customer: product.AVG_SERVICES_PER_CUSTOMER
          },
          metrik_penetrasi: {
            penetrasi_customer: `${product.PENETRATION_RATE_CUSTOMERS}%`,
            penetrasi_order: `${product.PENETRATION_RATE_ORDERS}%`,
            penetrasi_layanan: `${product.PENETRATION_RATE_SERVICES}%`,
            penetrasi_bisnis_customer: `${product.PENETRATION_RATE_BISNIS_CUSTOMERS}%`,
            penetrasi_basic_customer: `${product.PENETRATION_RATE_BASIC_CUSTOMERS}%`,
            penetrasi_bisnis_order: `${product.PENETRATION_RATE_BISNIS_ORDERS}%`,
            penetrasi_basic_order: `${product.PENETRATION_RATE_BASIC_ORDERS}%`
          },
          breakdown_hsi: {
            order_hsi_bisnis: (product.HSI_BISNIS_ORDERS || 0).toLocaleString('id-ID'),
            order_hsi_basic: (product.HSI_BASIC_ORDERS || 0).toLocaleString('id-ID'),
            customer_hsi_bisnis: (product.HSI_BISNIS_CUSTOMERS || 0).toLocaleString('id-ID'),
            customer_hsi_basic: (product.HSI_BASIC_CUSTOMERS || 0).toLocaleString('id-ID'),
            layanan_hsi_bisnis: (product.HSI_BISNIS_SERVICES || 0).toLocaleString('id-ID'),
            layanan_hsi_basic: (product.HSI_BASIC_SERVICES || 0).toLocaleString('id-ID'),
            dominasi_segmen: product.HSI_BISNIS_CUSTOMERS > product.HSI_BASIC_CUSTOMERS ? 'Bisnis' : 'Basic'
          },
          metrik_customer_journey: {
            order_customer_baru: (product.NEW_CUSTOMER_ORDERS || 0).toLocaleString('id-ID'),
            order_upsell: (product.UPSELL_ORDERS || 0).toLocaleString('id-ID'),
            tingkat_customer_baru: `${product.NEW_CUSTOMER_RATE}%`,
            tingkat_upsell: `${product.UPSELL_RATE}%`,
            strategi_dominan: product.NEW_CUSTOMER_RATE > product.UPSELL_RATE ? 'Fokus Akuisisi' : 'Fokus Upsell'
          },
          metrik_ecosystem_alignment: {
            order_target_ecosystem: (product.TARGET_ECOSYSTEM_ORDERS || 0).toLocaleString('id-ID'),
            tingkat_alignment_ecosystem: `${product.ECOSYSTEM_ALIGNMENT_RATE}%`,
            keragaman_sales_division: product.SALES_DIVISION_DIVERSITY,
            status_alignment: product.ECOSYSTEM_ALIGNMENT_RATE >= 70 ? 'Alignment Baik' : 'Perlu Perbaikan'
          },
          metrik_layanan: {
            order_triple_play: (product.TRIPLE_PLAY_ORDERS || 0).toLocaleString('id-ID'),
            tingkat_triple_play: `${product.TRIPLE_PLAY_RATE}%`,
            order_hard_bundling: (product.HARD_BUNDLING_ORDERS || 0).toLocaleString('id-ID'),
            tingkat_hard_bundling: `${product.HARD_BUNDLING_RATE}%`,
            rata_rata_bandwidth_mbps: product.AVG_BANDWIDTH_MBPS
          },
          metrik_geografis: {
            cakupan_regional: product.REGIONAL_COVERAGE,
            cakupan_witel: product.WITEL_COVERAGE,
            tingkat_sebaran: product.REGIONAL_COVERAGE >= 5 ? 'Nasional' : product.REGIONAL_COVERAGE >= 3 ? 'Multi Regional' : 'Terbatas'
          },
          metrik_revenue: {
            estimasi_arpu_tambahan: `Rp ${(product.ESTIMATED_ADDITIONAL_ARPU || 0).toLocaleString('id-ID')}`,
            total_dampak_revenue: `Rp ${product.TOTAL_REVENUE_IMPACT_MILLIONS}M`,
            potensi_pasar_tersisa: (product.MARKET_POTENTIAL_REMAINING_CUSTOMERS || 0).toLocaleString('id-ID'),
            tier_revenue: product.ESTIMATED_ADDITIONAL_ARPU >= 120000 ? 'Premium' : product.ESTIMATED_ADDITIONAL_ARPU >= 80000 ? 'Nilai Tinggi' : 'Standar'
          },
          ranking_performance: {
            ranking_penetrasi_customer: product.RANKING_PENETRASI_CUSTOMER,
            ranking_penetrasi_order: product.RANKING_PENETRASI_ORDER,
            ranking_volume_customer: product.RANKING_VOLUME_CUSTOMER,
            ranking_volume_order: product.RANKING_VOLUME_ORDER,
            ranking_dampak_revenue: product.RANKING_REVENUE_IMPACT,
            overall_rank: Math.round((product.RANKING_PENETRASI_CUSTOMER + product.RANKING_VOLUME_CUSTOMER + product.RANKING_REVENUE_IMPACT) / 3)
          },
          health_assessment: {
            kategori_kesehatan: Object.keys(health)[0],
            deskripsi: health.description,
            rekomendasi: health.recommendation
          },
          peluang_pertumbuhan: opportunities,
          potensi_pertumbuhan: growth_potential,
          insight_strategis: {
            kekuatan_utama: product.PENETRATION_RATE_CUSTOMERS >= 15 ? 'Penetrasi Customer Tinggi' : 
                           product.NEW_CUSTOMER_RATE >= 60 ? 'Akuisisi Kuat' :
                           product.UPSELL_RATE >= 60 ? 'Upselling Excellent' :
                           product.ECOSYSTEM_ALIGNMENT_RATE >= 80 ? 'Kesesuaian Ekosistem Sempurna' : 
                           product.AVG_SERVICES_PER_CUSTOMER >= 2 ? 'Cross-selling Efektif' : 'Tahap Pengembangan Pasar',
            fokus_utama: product.NEW_CUSTOMER_RATE > product.UPSELL_RATE ? 'Perbesar Strategi Akuisisi' : 'Optimalkan Cross-selling',
            tindakan_selanjutnya: product.KATEGORI_ADOPSI === 'MAINSTREAM' ? 'Pemeliharaan Kepemimpinan Pasar' :
                                product.KATEGORI_ADOPSI === 'TUMBUH_CEPAT' ? 'Percepat Investasi Pertumbuhan' :
                                product.KATEGORI_ADOPSI === 'BERKEMBANG' ? 'Pengembangan Pasar Strategis' :
                                'Pembangunan Fondasi & Edukasi Pasar',
            efisiensi_customer: product.AVG_SERVICES_PER_CUSTOMER >= 2 ? 'Efisiensi Tinggi' : 'Peluang Cross-sell'
          }
        };
      });
      
      return {
        ringkasan_eksekutif: {
          periode_analisis: 'Tahun 2025 (Januari hingga saat ini)',
          total_produk_digital: ecosystem.total_products,
          total_order_digital: (ecosystem.total_digital_orders || 0).toLocaleString('id-ID'),
          total_customer_digital: (ecosystem.total_digital_customers || 0).toLocaleString('id-ID'),
          total_layanan_digital: (ecosystem.total_digital_services || 0).toLocaleString('id-ID'),
          total_dampak_revenue: `Rp ${(ecosystem.total_revenue_impact || 0).toFixed(1)}M`,
          rata_rata_penetrasi_customer: `${(data.reduce((sum, d) => sum + (d.PENETRATION_RATE_CUSTOMERS || 0), 0) / data.length).toFixed(1)}%`,
          rata_rata_penetrasi_order: `${(data.reduce((sum, d) => sum + (d.PENETRATION_RATE_ORDERS || 0), 0) / data.length).toFixed(1)}%`,
          rata_rata_layanan_per_customer: (ecosystem.avg_services_per_customer || 0).toFixed(2),
          distribusi_adopsi: ecosystem.product_performance,
          overview_customer_journey: ecosystem.customer_journey_insights,
          overview_ecosystem_alignment: ecosystem.ecosystem_insights
        },
        detail_analisis_produk: hasil_analisis,
        insights_strategis: ecosystem.insights,
        top_performers: ecosystem.top_performers,
        metodologi_perhitungan: {
          basis_data: 'Data aktual dari tabel BRIGHTAI_SALES menggunakan ORDER_ID, NCLI, dan ND_HSI',
          metrik_penetrasi: 'Berdasarkan rasio customer/order/service digital terhadap total HSI',
          customer_journey: 'Analisis berdasarkan TYPE_TRANS untuk acquisition vs upselling',
          ecosystem_alignment: 'Kesesuaian produk digital dengan target ekosistem customer'
        },
        rekomendasi_prioritas: [
          'Focus pada produk dengan kategori TUMBUH_CEPAT untuk maksimal ROI customer acquisition',
          'Tingkatkan ecosystem alignment untuk produk dengan alignment rate < 70%',
          'Develop acquisition strategy untuk produk dengan new customer rate rendah',
          'Optimize cross-selling program untuk meningkatkan layanan per customer',
          'Geographic expansion untuk produk dengan regional coverage terbatas',
          'Leverage produk dengan avg_services_per_customer tinggi sebagai model cross-selling',
          'Monitor efisiensi customer-order-service untuk identifikasi best practices'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      const lowerInput = userInput.toLowerCase();
      
      // Determine focus area based on input patterns
      let focus_area = 'general_penetration';
      if (lowerInput.includes('oca interaction') || lowerInput.includes('oca blast')) {
        focus_area = 'oca_products';
      } else if (lowerInput.includes('pijar sekolah') || lowerInput.includes('education')) {
        focus_area = 'education_product';
      } else if (lowerInput.includes('netmonk') || lowerInput.includes('network monitoring')) {
        focus_area = 'monitoring_product';
      } else if (lowerInput.includes('bundling') || lowerInput.includes('cross selling')) {
        focus_area = 'bundling_strategy';
      } else if (lowerInput.includes('ekosistem') || lowerInput.includes('ecosystem')) {
        focus_area = 'ecosystem_analysis';
      } else if (lowerInput.includes('customer journey') || lowerInput.includes('acquisition') || lowerInput.includes('upsell')) {
        focus_area = 'customer_journey';
      } else if (lowerInput.includes('regional') || lowerInput.includes('witel') || lowerInput.includes('geografis')) {
        focus_area = 'geographic_analysis';
      }
      
      // Determine analysis depth based on input complexity
      let analysis_depth = 'standar';
      if (lowerInput.includes('detail') || lowerInput.includes('comprehensive') || lowerInput.includes('mendalam')) {
        analysis_depth = 'detail';
      } else if (lowerInput.includes('summary') || lowerInput.includes('ringkasan') || lowerInput.includes('overview')) {
        analysis_depth = 'ringkasan';
      }
      
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: focus_area,
        analysis_depth: analysis_depth,
        requires_ecosystem_breakdown: lowerInput.includes('ekosistem') || lowerInput.includes('ecosystem') || lowerInput.includes('sektor'),
        requires_journey_analysis: lowerInput.includes('customer journey') || lowerInput.includes('acquisition') || lowerInput.includes('upsell') || lowerInput.includes('new customer'),
        requires_geographic_detail: lowerInput.includes('regional') || lowerInput.includes('witel') || lowerInput.includes('geografis') || lowerInput.includes('wilayah')
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'MEDIUM-HIGH'
};