const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'dapros_002',
    RULE_NAME: 'hsi_service_bundle_analysis',
    DESCRIPTION: 'Analisis profil pelanggan HSI berdasarkan kombinasi bundle layanan dan add-on',
    DATABASE: 'BRIGHTAI_DAPROS',
    CATEGORY: 'service_bundle_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_DAPROS"),

  KEYWORD_PATTERNS: {
    primary: [
      'bundle layanan hsi', 'service bundle analysis', 'analisis bundle',
      'kombinasi layanan', 'triple play', 'dual play', 'hsi plus',
      'add on analysis', 'layanan tambahan', 'bundle service hsi', 'paket layanan',
      'analisis bundling', 'bundling layanan', 'paket bundling', 'bundling hsi',
      'bundling pelanggan', 'bundle pelanggan'
    ],
    
    supporting: [
      'bundle', 'layanan', 'service', 'add on', 'addon', 'triple', 'dual',
      'pots', 'iptv', 'kombinasi', 'paket', 'tambahan', 'upgrade',
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
        score = 78 + (primaryMatches * 11) + (supportingMatches * 3);
      } else if (lowerInput.includes('bundling') &&
                (lowerInput.includes('hsi') || lowerInput.includes('internet') || lowerInput.includes('pelanggan') || lowerInput.includes('layanan'))) {
        score = 75;
      } else if (supportingMatches >= 3) {
        score = 62 + (supportingMatches * 4);
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_BUNDLE_BASE AS (
        SELECT 
            NOTEL, NCLI, PLBLCL, REGIONAL, WITEL, STO, TELDA,
            IS_POTS, IS_IPTV, IS_DINAS, PACK_NAME, CITEM,
            CAST(SPEED AS NUMBER) as SPEED_NUM,
            CAST(LOS AS NUMBER) as LOS_NUM,
            NVL(TREMS_REV_REF, 0) as REV_HSI,
            NVL(TREMS_REV_P, 0) as REV_TOTAL,
            NVL(ADDON_TOTAL, 0) as ADDON_COUNT,
            NVL(ADDON_PRICE, 0) as ADDON_REV,
            INET_BASIC, INET_OTHERS, ADDON,
            ASSET_STATUS, KW_IH, P_DIGITAL,
            
            -- Klasifikasi bundle utama
            CASE
                WHEN IS_POTS = '1' AND IS_IPTV = '1' AND NVL(ADDON_TOTAL, 0) >= 3 THEN 'QUAD_PLAY'
                WHEN IS_POTS = '1' AND IS_IPTV = '1' THEN 'TRIPLE_PLAY'
                WHEN IS_POTS = '1' AND IS_IPTV = '0' THEN 'HSI_POTS'
                WHEN IS_POTS = '0' AND IS_IPTV = '1' THEN 'HSI_IPTV'
                WHEN NVL(ADDON_TOTAL, 0) > 0 THEN 'HSI_ADDON'
                ELSE 'HSI_BASIC'
            END as BUNDLE_TYPE,

            -- Kategori penetrasi add-on
            CASE
                WHEN NVL(ADDON_TOTAL, 0) >= 4 THEN 'HEAVY_ADDON_USER'
                WHEN NVL(ADDON_TOTAL, 0) >= 2 THEN 'MODERATE_ADDON_USER'
                WHEN NVL(ADDON_TOTAL, 0) = 1 THEN 'LIGHT_ADDON_USER'
                ELSE 'NO_ADDON'
            END as ADDON_PENETRATION,

            -- Status digitalisasi
            CASE
                WHEN P_DIGITAL = '1' AND NVL(ADDON_TOTAL, 0) >= 2 THEN 'DIGITAL_ADVANCED'
                WHEN P_DIGITAL = '1' THEN 'DIGITAL_BASIC'
                WHEN NVL(ADDON_TOTAL, 0) >= 2 THEN 'ANALOG_ADVANCED'
                ELSE 'ANALOG_BASIC'
            END as DIGITAL_STATUS,

            -- Segmen berdasarkan revenue dan bundle
            CASE
                WHEN NVL(TREMS_REV_REF, 0) >= 400000 AND (IS_POTS = '1' OR IS_IPTV = '1') THEN 'HIGH_VALUE_BUNDLE'
                WHEN NVL(TREMS_REV_REF, 0) >= 200000 AND NVL(ADDON_TOTAL, 0) >= 2 THEN 'MEDIUM_VALUE_BUNDLE'
                WHEN NVL(TREMS_REV_REF, 0) < 200000 AND NVL(ADDON_TOTAL, 0) = 0 THEN 'BASIC_VALUE_BUNDLE'
                ELSE 'STANDARD_VALUE_BUNDLE'
            END as VALUE_BUNDLE_SEGMENT
            
        FROM DWH_MOIS.BRIGHTAI_DAPROS
        WHERE PLBLCL IN ('BL', 'CL')
          AND CITEM NOT LIKE '%W/%'
          AND CITEM NOT LIKE '%WM%'
    )
    
    SELECT 
        BUNDLE_TYPE,
        ADDON_PENETRATION,
        DIGITAL_STATUS,
        VALUE_BUNDLE_SEGMENT,
        PLBLCL as CUSTOMER_TYPE,
        REGIONAL,
        WITEL,
        TELDA,
        COUNT(*) as CUSTOMER_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        ROUND(AVG(REV_HSI), 0) as AVG_HSI_REVENUE,
        ROUND(AVG(REV_TOTAL), 0) as AVG_TOTAL_REVENUE,
        ROUND(AVG(ADDON_REV), 0) as AVG_ADDON_REVENUE,
        ROUND(AVG(SPEED_NUM/1000), 0) as AVG_SPEED_MBPS,
        ROUND(AVG(LOS_NUM), 0) as AVG_TENURE_MONTHS,
        ROUND(AVG(ADDON_COUNT), 1) as AVG_ADDON_COUNT,
        COUNT(DISTINCT TELDA) as TELDA_COVERAGE,
        COUNT(DISTINCT STO) as STO_COVERAGE
    FROM HSI_BUNDLE_BASE
    GROUP BY BUNDLE_TYPE, ADDON_PENETRATION, DIGITAL_STATUS, VALUE_BUNDLE_SEGMENT, PLBLCL, REGIONAL, WITEL, TELDA
    ORDER BY CUSTOMER_COUNT DESC
  `,

  BUSINESS_LOGIC: {
    analyzeBundlePenetration: function(data) {
      const bundleAnalysis = data.reduce((acc, record) => {
        const bundle = record.BUNDLE_TYPE;
        if (!acc[bundle]) {
          acc[bundle] = {
            total_customers: 0,
            total_revenue: 0,
            avg_addon_count: 0,
            avg_speed: 0
          };
        }
        acc[bundle].total_customers += record.CUSTOMER_COUNT;
        acc[bundle].total_revenue += record.AVG_HSI_REVENUE * record.CUSTOMER_COUNT;
        acc[bundle].avg_addon_count += record.AVG_ADDON_COUNT * record.CUSTOMER_COUNT;
        acc[bundle].avg_speed += record.AVG_SPEED_MBPS * record.CUSTOMER_COUNT;
        return acc;
      }, {});

      // Calculate penetration rates and averages
      const totalCustomers = Object.values(bundleAnalysis).reduce((sum, b) => sum + b.total_customers, 0);
      
      Object.keys(bundleAnalysis).forEach(bundle => {
        const b = bundleAnalysis[bundle];
        b.penetration_rate = ((b.total_customers / totalCustomers) * 100).toFixed(2);
        b.avg_revenue_per_customer = Math.round(b.total_revenue / b.total_customers);
        b.weighted_avg_addon_count = (b.avg_addon_count / b.total_customers).toFixed(1);
        b.weighted_avg_speed = Math.round(b.avg_speed / b.total_customers);
      });

      return bundleAnalysis;
    },

    identifyUpsellOpportunities: function(data) {
      const opportunities = [];
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      // HSI Basic users - primary upsell target
      const basicUsers = data.filter(d => d.BUNDLE_TYPE === 'HSI_BASIC')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (basicUsers / totalCustomers > 0.4) {
        opportunities.push({
          segment: 'HSI Basic Users',
          count: basicUsers,
          percentage: ((basicUsers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Upsell ke Triple Play atau Dual Play - potensi revenue increase 40-80%',
          priority: 'HIGH'
        });
      }

      // Light addon users - addon expansion opportunity
      const lightAddonUsers = data.filter(d => d.ADDON_PENETRATION === 'LIGHT_ADDON_USER')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (lightAddonUsers > 0) {
        opportunities.push({
          segment: 'Light Addon Users',
          count: lightAddonUsers,
          percentage: ((lightAddonUsers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Cross-sell additional services - potensi addon revenue increase',
          priority: 'MEDIUM'
        });
      }

      // Analog users in digital era
      const analogUsers = data.filter(d => d.DIGITAL_STATUS.includes('ANALOG'))
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (analogUsers > 0) {
        opportunities.push({
          segment: 'Analog Users',
          count: analogUsers,
          percentage: ((analogUsers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Digital transformation - migrate ke platform digital',
          priority: 'STRATEGIC'
        });
      }

      return opportunities;
    },

    generateBundleStrategy: function(bundleType) {
      const strategies = {
        'HSI_BASIC': {
          focus: 'Upselling dan Value Addition',
          recommendations: [
            'Targeted campaign untuk triple play adoption',
            'Introduce entry-level IPTV packages',
            'Promote telephony services dengan discount bundling',
            'Educational content tentang manfaat integrated services'
          ]
        },
        'HSI_ADDON': {
          focus: 'Service Integration dan Expansion',
          recommendations: [
            'Evaluate addon usage patterns untuk bundling optimization',
            'Introduce comprehensive service packages',
            'Cross-sell complementary services',
            'Develop custom bundle packages berdasarkan usage'
          ]
        },
        'HSI_POTS': {
          focus: 'Video Service Addition',
          recommendations: [
            'Promote IPTV services untuk complete triple play',
            'Offer video streaming packages',
            'Introduce smart TV solutions',
            'Bundle dengan premium content subscriptions'
          ]
        },
        'HSI_IPTV': {
          focus: 'Communication Service Addition',
          recommendations: [
            'Promote telephony services dengan enterprise features',
            'Introduce unified communication solutions',
            'Bundle dengan business phone systems',
            'Offer VoIP premium features'
          ]
        },
        'TRIPLE_PLAY': {
          focus: 'Premium Service Enhancement',
          recommendations: [
            'Introduce premium channels dan content',
            'Upgrade bandwidth untuk enhanced experience',
            'Add smart home integration services',
            'Develop loyalty programs untuk retention'
          ]
        },
        'QUAD_PLAY': {
          focus: 'Premium Experience dan Retention',
          recommendations: [
            'VIP customer treatment dan support',
            'Exclusive access ke new services dan features',
            'Premium technical support dan SLA',
            'Customized solutions berdasarkan business needs'
          ]
        }
      };

      return strategies[bundleType] || {
        focus: 'General Service Development',
        recommendations: ['Develop targeted strategy berdasarkan customer needs']
      };
    },

    calculateBundleMetrics: function(data) {
      const metrics = {
        total_customers: data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
        total_revenue: data.reduce((sum, d) => sum + (d.AVG_HSI_REVENUE * d.CUSTOMER_COUNT), 0),
        addon_penetration_rate: 0,
        digital_penetration_rate: 0,
        average_arpu: 0
      };

      const customersWithAddon = data.filter(d => d.ADDON_PENETRATION !== 'NO_ADDON')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      const digitalCustomers = data.filter(d => d.DIGITAL_STATUS.includes('DIGITAL'))
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      metrics.addon_penetration_rate = ((customersWithAddon / metrics.total_customers) * 100).toFixed(1);
      metrics.digital_penetration_rate = ((digitalCustomers / metrics.total_customers) * 100).toFixed(1);
      metrics.average_arpu = Math.round(metrics.total_revenue / metrics.total_customers);

      return metrics;
    },

    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const bundlePenetration = this.analyzeBundlePenetration(data);
      const upsellOpportunities = this.identifyUpsellOpportunities(data);
      const bundleMetrics = this.calculateBundleMetrics(data);
      
      return {
        ringkasan: 'Analisis profil pelanggan HSI berdasarkan kombinasi paket layanan dan penetrasi layanan tambahan',
        total_pelanggan_dianalisis: totalCustomers.toLocaleString('id-ID'),
        
        metrik_keseluruhan: {
          total_pelanggan: bundleMetrics.total_customers.toLocaleString('id-ID'),
          rata_rata_arpu: `Rp ${bundleMetrics.average_arpu.toLocaleString('id-ID')}`,
          penetrasi_addon: `${bundleMetrics.addon_penetration_rate}%`,
          penetrasi_digital: `${bundleMetrics.digital_penetration_rate}%`
        },

        analisis_penetrasi_bundle: bundlePenetration,
        
        distribusi_tipe_paket: {
          paket_empat_layanan: data.filter(d => d.BUNDLE_TYPE === 'QUAD_PLAY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          paket_tiga_layanan: data.filter(d => d.BUNDLE_TYPE === 'TRIPLE_PLAY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          internet_telepon: data.filter(d => d.BUNDLE_TYPE === 'HSI_POTS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          internet_tv: data.filter(d => d.BUNDLE_TYPE === 'HSI_IPTV')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          internet_plus_tambahan: data.filter(d => d.BUNDLE_TYPE === 'HSI_ADDON')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          internet_dasar: data.filter(d => d.BUNDLE_TYPE === 'HSI_BASIC')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        penetrasi_layanan_tambahan: {
          pengguna_berat: data.filter(d => d.ADDON_PENETRATION === 'HEAVY_ADDON_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_sedang: data.filter(d => d.ADDON_PENETRATION === 'MODERATE_ADDON_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_ringan: data.filter(d => d.ADDON_PENETRATION === 'LIGHT_ADDON_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          tanpa_layanan_tambahan: data.filter(d => d.ADDON_PENETRATION === 'NO_ADDON')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        status_digitalisasi: {
          digital_lanjut: data.filter(d => d.DIGITAL_STATUS === 'DIGITAL_ADVANCED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          digital_dasar: data.filter(d => d.DIGITAL_STATUS === 'DIGITAL_BASIC')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          analog_lanjut: data.filter(d => d.DIGITAL_STATUS === 'ANALOG_ADVANCED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          analog_dasar: data.filter(d => d.DIGITAL_STATUS === 'ANALOG_BASIC')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },

        peluang_upselling: upsellOpportunities,
        
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
        
        wawasan_bisnis: [
          'Identifikasi tingkat penetrasi paket layanan per segmen pelanggan',
          'Analisis korelasi paket dengan pendapatan per pelanggan',
          'Evaluasi efektivitas program digitalisasi pada adopsi layanan tambahan',
          'Pemetaan peluang penjualan silang dan peningkatan paket',
          'Strategi bundle optimization berdasarkan customer behavior'
        ],
        
        detail_analisis_paket: data.map(bundle => ({
          tipe_paket: bundle.BUNDLE_TYPE,
          penetrasi_layanan_tambahan: bundle.ADDON_PENETRATION,
          status_digital: bundle.DIGITAL_STATUS,
          segmen_nilai: bundle.VALUE_BUNDLE_SEGMENT,
          tipe_pelanggan: bundle.CUSTOMER_TYPE,
          regional: bundle.REGIONAL,
          witel: bundle.WITEL,
          telda: bundle.TELDA,
          jumlah_pelanggan: bundle.CUSTOMER_COUNT.toLocaleString('id-ID'),
          persentase: `${bundle.PERCENTAGE}%`,
          rata_rata_pendapatan_hsi: `Rp ${bundle.AVG_HSI_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_pendapatan_total: `Rp ${bundle.AVG_TOTAL_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_pendapatan_tambahan: `Rp ${bundle.AVG_ADDON_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_kecepatan: `${bundle.AVG_SPEED_MBPS} Mbps`,
          rata_rata_masa_berlangganan: `${bundle.AVG_TENURE_MONTHS} bulan`,
          rata_rata_jumlah_layanan_tambahan: bundle.AVG_ADDON_COUNT,
          cakupan_telda: bundle.TELDA_COVERAGE,
          cakupan_sto: bundle.STO_COVERAGE,
          strategi_bundle: this.generateBundleStrategy(bundle.BUNDLE_TYPE)
        }))
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: 'service_bundle_analysis'
      };
    },
    
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};