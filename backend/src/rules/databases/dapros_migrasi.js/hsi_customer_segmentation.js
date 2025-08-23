const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'dapros_001',
    RULE_NAME: 'hsi_customer_segmentation',
    DESCRIPTION: 'Segmentasi profil pelanggan HSI berdasarkan karakteristik bisnis dan layanan',
    DATABASE: 'DAPROS_MIGRASI',
    CATEGORY: 'customer_segmentation',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("DAPROS_MIGRASI"),

  KEYWORD_PATTERNS: {
    primary: [
      'segmentasi pelanggan hsi', 'customer segmentation', 'profil pelanggan',
      'kategori customer', 'tipe pelanggan', 'klasifikasi pelanggan hsi',
      'segmen bisnis', 'customer profile', 'segmentasi hsi', 'distribusi pelanggan'
    ],
    
    supporting: [
      'segmentasi', 'profil', 'kategori', 'klasifikasi', 'tipe', 'bisnis', 
      'consumer', 'enterprise', 'government', 'sme', 'customer', 'pelanggan',
      'telda', 'datel', 'regional', 'witel', 'wilayah', 'distribusi'
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
        score = 75 + (primaryMatches * 12) + (supportingMatches * 3);
      } else if (supportingMatches >= 2) {
        score = 60 + (supportingMatches * 5);
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH LATEST_DAPROS_TABLE AS (
        SELECT table_name
        FROM (
            SELECT table_name,
                   ROW_NUMBER() OVER (ORDER BY SUBSTR(table_name, -6) DESC) as rn
            FROM all_tables 
            WHERE owner = 'DWHNAS' 
              AND table_name LIKE 'DAPROS_MIGRASI_%'
              AND REGEXP_LIKE(SUBSTR(table_name, -6), '^[0-9]{6}$')
              AND SUBSTR(table_name, -6) <= TO_CHAR(SYSDATE, 'YYYYMM')
        )
        WHERE rn = 1
    ),
    
    HSI_CUSTOMER_BASE AS (
        SELECT 
            NOTEL, ND_REFERENCE, NCLI, PERIOD, PRODTYPE, PLBLCL, CGEST, STO,
            IS_DINAS, IS_POTS, IS_IPTV, LOS, VALID_FROM, PACK_NAME, CITEM,
            SPEED, KW_IH, TREMS_REV_P, TREMS_REV_REF, ASSET_STATUS, LGEST,
            INET_BASIC, INET_OTHERS, ADDON, ADDON_TOTAL, ADDON_PRICE,
            REGIONAL, WITEL, TELDA, CEK_CGEST, CEK_LGEST, LOY_PROGRAM, P_DIGITAL,
            
            -- Segmentasi utama customer
            CASE 
                WHEN IS_DINAS = '1' THEN 'GOVERNMENT'
                WHEN PLBLCL = 'BL' AND CAST(SPEED AS NUMBER) >= 50000 THEN 'ENTERPRISE'
                WHEN PLBLCL = 'BL' AND CAST(SPEED AS NUMBER) < 50000 THEN 'SME'
                WHEN PLBLCL = 'CL' AND CAST(SPEED AS NUMBER) >= 50000 THEN 'CONSUMER_HIGH_SPEED'
                WHEN PLBLCL = 'CL' AND CAST(SPEED AS NUMBER) < 50000 THEN 'CONSUMER_STANDARD'
                ELSE 'UNDEFINED'
            END as CUSTOMER_SEGMENT,
            
            -- Klasifikasi bundle layanan
            CASE 
                WHEN IS_POTS = '1' AND IS_IPTV = '1' AND ADDON_TOTAL > 2 THEN 'TRIPLE_PLAY_PLUS'
                WHEN IS_POTS = '1' AND IS_IPTV = '1' THEN 'TRIPLE_PLAY'
                WHEN IS_POTS = '1' OR IS_IPTV = '1' THEN 'DUAL_PLAY'
                WHEN ADDON_TOTAL > 0 THEN 'HSI_PLUS'
                ELSE 'HSI_ONLY'
            END as SERVICE_BUNDLE,
            
            -- Tier berdasarkan revenue HSI
            CASE 
                WHEN TREMS_REV_REF >= 500000 THEN 'HIGH_VALUE'
                WHEN TREMS_REV_REF >= 300000 THEN 'MEDIUM_VALUE'
                WHEN TREMS_REV_REF >= 150000 THEN 'STANDARD_VALUE'
                ELSE 'ENTRY_VALUE'
            END as REVENUE_TIER,
            
            -- Kategori tenure
            CASE 
                WHEN CAST(LOS AS NUMBER) >= 60 THEN 'LONG_TERM'
                WHEN CAST(LOS AS NUMBER) >= 24 THEN 'MEDIUM_TERM'
                WHEN CAST(LOS AS NUMBER) >= 12 THEN 'ESTABLISHED'
                ELSE 'NEW_CUSTOMER'
            END as TENURE_CATEGORY
            
        FROM (
            SELECT * FROM DWHNAS.DWH_MOIS.' || (SELECT table_name FROM LATEST_DAPROS_TABLE) || '
            WHERE PLBLCL IN ('BL', 'CL')
              AND CITEM NOT LIKE '%W/%'
              AND CITEM NOT LIKE '%WM%'
        )
    )
    
    SELECT 
        CUSTOMER_SEGMENT,
        SERVICE_BUNDLE,
        REVENUE_TIER,
        TENURE_CATEGORY,
        REGIONAL,
        WITEL,
        TELDA,
        COUNT(*) as CUSTOMER_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as CUSTOMER_PERCENTAGE,
        ROUND(AVG(TREMS_REV_REF), 0) as AVG_HSI_REVENUE,
        ROUND(AVG(CAST(SPEED AS NUMBER)/1000), 0) as AVG_SPEED_MBPS,
        ROUND(AVG(CAST(LOS AS NUMBER)), 0) as AVG_TENURE_MONTHS,
        COUNT(DISTINCT TELDA) as TELDA_COVERAGE,
        COUNT(DISTINCT STO) as STO_COVERAGE
    FROM HSI_CUSTOMER_BASE
    GROUP BY CUSTOMER_SEGMENT, SERVICE_BUNDLE, REVENUE_TIER, TENURE_CATEGORY, REGIONAL, WITEL, TELDA
    ORDER BY CUSTOMER_COUNT DESC
  `,

  BUSINESS_LOGIC: {
    analyzeSegmentTrends: function(data) {
      const segmentAnalysis = data.reduce((acc, record) => {
        const segment = record.CUSTOMER_SEGMENT;
        if (!acc[segment]) {
          acc[segment] = {
            total_customers: 0,
            total_revenue: 0,
            avg_speed: 0,
            avg_tenure: 0,
            coverage_count: 0
          };
        }
        acc[segment].total_customers += record.CUSTOMER_COUNT;
        acc[segment].total_revenue += record.AVG_HSI_REVENUE * record.CUSTOMER_COUNT;
        acc[segment].avg_speed += record.AVG_SPEED_MBPS * record.CUSTOMER_COUNT;
        acc[segment].avg_tenure += record.AVG_TENURE_MONTHS * record.CUSTOMER_COUNT;
        acc[segment].coverage_count++;
        return acc;
      }, {});

      // Calculate weighted averages
      Object.keys(segmentAnalysis).forEach(segment => {
        const seg = segmentAnalysis[segment];
        seg.avg_revenue_per_customer = Math.round(seg.total_revenue / seg.total_customers);
        seg.weighted_avg_speed = Math.round(seg.avg_speed / seg.total_customers);
        seg.weighted_avg_tenure = Math.round(seg.avg_tenure / seg.total_customers);
      });

      return segmentAnalysis;
    },

    identifyGrowthOpportunities: function(data) {
      const opportunities = [];
      
      // Analyze service bundle penetration
      const bundleAnalysis = data.reduce((acc, record) => {
        acc[record.SERVICE_BUNDLE] = (acc[record.SERVICE_BUNDLE] || 0) + record.CUSTOMER_COUNT;
        return acc;
      }, {});

      const totalCustomers = Object.values(bundleAnalysis).reduce((sum, count) => sum + count, 0);
      
      if (bundleAnalysis['HSI_ONLY'] / totalCustomers > 0.6) {
        opportunities.push('Peluang upselling: 60%+ pelanggan masih menggunakan HSI saja - potensi triple play');
      }
      
      if (bundleAnalysis['TRIPLE_PLAY_PLUS'] / totalCustomers < 0.1) {
        opportunities.push('Peluang premium services: Penetrasi paket premium masih rendah');
      }

      // Analyze revenue tier distribution
      const revenueAnalysis = data.reduce((acc, record) => {
        acc[record.REVENUE_TIER] = (acc[record.REVENUE_TIER] || 0) + record.CUSTOMER_COUNT;
        return acc;
      }, {});

      if (revenueAnalysis['HIGH_VALUE'] / totalCustomers < 0.15) {
        opportunities.push('Peluang monetisasi: Segmen high-value masih terbatas - potensi ARPU growth');
      }

      return opportunities;
    },

    generateSegmentStrategy: function(segmentData) {
      const strategies = {
        'GOVERNMENT': {
          focus: 'Stabilitas dan keamanan layanan',
          recommendations: [
            'Prioritaskan SLA tinggi dan dukungan teknis 24/7',
            'Tawarkan solusi keamanan cyber dan backup dedicated',
            'Kembangkan paket khusus sektor publik dengan compliance',
            'Implementasi account management khusus pemerintah'
          ]
        },
        'ENTERPRISE': {
          focus: 'Solusi terintegrasi dan skalabilitas',
          recommendations: [
            'Tawarkan managed services dan cloud connectivity',
            'Kembangkan solusi SD-WAN untuk multi-site',
            'Prioritaskan dedicated bandwidth dan redundancy',
            'Implementasi enterprise support dengan escalation matrix'
          ]
        },
        'SME': {
          focus: 'Value for money dan pertumbuhan bisnis',
          recommendations: [
            'Tawarkan paket bundling dengan telephony dan collaboration tools',
            'Kembangkan solusi e-commerce dan digital marketing support',
            'Berikan fleksibilitas upgrade sesuai pertumbuhan bisnis',
            'Implementasi self-service portal untuk efisiensi cost'
          ]
        },
        'CONSUMER_HIGH_SPEED': {
          focus: 'Premium experience dan value-added services',
          recommendations: [
            'Prioritaskan kualitas streaming dan gaming experience',
            'Tawarkan premium content dan entertainment bundles',
            'Kembangkan smart home integration services',
            'Implementasi priority customer support'
          ]
        },
        'CONSUMER_STANDARD': {
          focus: 'Affordability dan essential connectivity',
          recommendations: [
            'Optimalkan price point untuk mass market penetration',
            'Tawarkan family packages dengan multiple devices',
            'Kembangkan educational content dan parental controls',
            'Fokus pada reliability dan consistent performance'
          ]
        }
      };

      return strategies;
    },

    formatIndonesianResponse: function(data) {
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const segmentTrends = this.analyzeSegmentTrends(data);
      const growthOpportunities = this.identifyGrowthOpportunities(data);
      const segmentStrategies = this.generateSegmentStrategy();
      
      return {
        ringkasan: 'Segmentasi profil pelanggan HSI berdasarkan karakteristik bisnis dan layanan',
        total_pelanggan_dianalisis: totalCustomers.toLocaleString('id-ID'),
        periode_data: data[0]?.PERIOD || 'Terbaru',
        
        distribusi_segmen_utama: {
          pemerintah: data.filter(d => d.CUSTOMER_SEGMENT === 'GOVERNMENT')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          korporat: data.filter(d => d.CUSTOMER_SEGMENT === 'ENTERPRISE')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          usaha_kecil_menengah: data.filter(d => d.CUSTOMER_SEGMENT === 'SME')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          konsumen_kecepatan_tinggi: data.filter(d => d.CUSTOMER_SEGMENT === 'CONSUMER_HIGH_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          konsumen_standar: data.filter(d => d.CUSTOMER_SEGMENT === 'CONSUMER_STANDARD')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        distribusi_bundle_layanan: {
          paket_lengkap_plus: data.filter(d => d.SERVICE_BUNDLE === 'TRIPLE_PLAY_PLUS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          paket_lengkap: data.filter(d => d.SERVICE_BUNDLE === 'TRIPLE_PLAY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          paket_ganda: data.filter(d => d.SERVICE_BUNDLE === 'DUAL_PLAY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          internet_plus: data.filter(d => d.SERVICE_BUNDLE === 'HSI_PLUS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          internet_saja: data.filter(d => d.SERVICE_BUNDLE === 'HSI_ONLY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        distribusi_geografis: {
          total_regional: [...new Set(data.map(d => d.REGIONAL))].length,
          total_witel: [...new Set(data.map(d => d.WITEL))].length,
          total_telda: [...new Set(data.map(d => d.TELDA))].length,
          sebaran_regional: data.reduce((acc, d) => {
            const reg = d.REGIONAL || 'Tidak Diketahui';
            acc[reg] = (acc[reg] || 0) + d.CUSTOMER_COUNT;
            return acc;
          }, {})
        },

        analisis_tren_segmen: segmentTrends,
        
        peluang_pertumbuhan: growthOpportunities,
        
        strategi_per_segmen: segmentStrategies,
        
        wawasan_bisnis: [
          'Identifikasi segmen pelanggan dominan dalam basis HSI',
          'Analisis penetrasi paket layanan per segmen pelanggan',
          'Pemetaan distribusi tingkatan pendapatan pelanggan',
          'Evaluasi karakteristik masa berlangganan pelanggan HSI',
          'Dasar untuk strategi segmentasi dan targeting'
        ],
        
        detail_segmentasi: data.map(segment => ({
          segmen_pelanggan: segment.CUSTOMER_SEGMENT,
          paket_layanan: segment.SERVICE_BUNDLE,
          tingkat_pendapatan: segment.REVENUE_TIER,
          kategori_masa_berlangganan: segment.TENURE_CATEGORY,
          regional: segment.REGIONAL,
          witel: segment.WITEL,
          telda: segment.TELDA,
          jumlah_pelanggan: segment.CUSTOMER_COUNT.toLocaleString('id-ID'),
          persentase: `${segment.CUSTOMER_PERCENTAGE}%`,
          rata_rata_pendapatan_hsi: `Rp ${segment.AVG_HSI_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_kecepatan: `${segment.AVG_SPEED_MBPS} Mbps`,
          rata_rata_masa_berlangganan: `${segment.AVG_TENURE_MONTHS} bulan`,
          cakupan_telda: segment.TELDA_COVERAGE,
          cakupan_sto: segment.STO_COVERAGE
        }))
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = patternMatcher.calculateConfidence(userInput, this.parent.KEYWORD_PATTERNS);
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: 'customer_segmentation'
      };
    },
    
    parent: this
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};