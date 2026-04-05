const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'dapros_005',
    RULE_NAME: 'hsi_geographic_distribution_profile',
    DESCRIPTION: 'Analisis profil distribusi geografis customer HSI berdasarkan regional dan karakteristik wilayah',
    DATABASE: 'BRIGHTAI_DAPROS',
    CATEGORY: 'geographic_distribution_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_DAPROS"),

  KEYWORD_PATTERNS: {
    primary: [
      'distribusi geografis hsi', 'geographic distribution', 'profil wilayah',
      'regional analysis', 'distribusi regional', 'geographic profile',
      'analisis geografis', 'peta sebaran customer', 'regional coverage hsi', 'sebaran pelanggan'
    ],
    
    supporting: [
      'geografis', 'regional', 'wilayah', 'distribusi', 'sebaran', 'coverage',
      'witel', 'telda', 'datel', 'area', 'lokasi', 'geographic', 'territory'
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
        score = 80 + (primaryMatches * 10) + (supportingMatches * 2);
      } else if (supportingMatches >= 3) {
        score = 65 + (supportingMatches * 4);
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_GEOGRAPHIC_BASE AS (
        SELECT 
            NOTEL, NCLI, PLBLCL, REGIONAL, WITEL, STO, TELDA,
            CAST(SPEED AS NUMBER) as SPEED_NUM,
            CAST(LOS AS NUMBER) as LOS_NUM,
            NVL(TREMS_REV_REF, 0) as REV_HSI,
            NVL(TREMS_REV_P, 0) as REV_TOTAL,
            NVL(ADDON_TOTAL, 0) as ADDON_COUNT,
            NVL(ADDON_PRICE, 0) as ADDON_REV,
            IS_POTS, IS_IPTV, IS_DINAS, KW_IH,
            PACK_NAME, ASSET_STATUS, P_DIGITAL,
            
            -- Regional classification
            CASE 
                WHEN REGIONAL = 'REG-1' THEN 'REGIONAL_1_SUMATRA'
                WHEN REGIONAL = 'REG-2' THEN 'REGIONAL_2_JAKARTA'
                WHEN REGIONAL = 'REG-3' THEN 'REGIONAL_3_JAWA_BARAT'
                WHEN REGIONAL = 'REG-4' THEN 'REGIONAL_4_JAWA_TENGAH'
                WHEN REGIONAL = 'REG-5' THEN 'REGIONAL_5_JAWA_TIMUR'
                WHEN REGIONAL = '1' THEN 'REGIONAL_1_SUMATRA'
                WHEN REGIONAL = '2' THEN 'REGIONAL_2_JAKARTA' 
                WHEN REGIONAL = '3' THEN 'REGIONAL_3_JAWA_BARAT'
                WHEN REGIONAL = '4' THEN 'REGIONAL_4_JAWA_TENGAH'
                WHEN REGIONAL = '5' THEN 'REGIONAL_5_JAWA_TIMUR'
                ELSE 'REGIONAL_TIDAK_DIKETAHUI'
            END as REGIONAL_NAME,
            
            -- Market density classification
            CASE 
                WHEN REGIONAL IN ('REG-2', 'REG-3', '2', '3') THEN 'PASAR_KEPADATAN_TINGGI'
                WHEN REGIONAL IN ('REG-4', 'REG-5', '4', '5') THEN 'PASAR_KEPADATAN_SEDANG'
                WHEN REGIONAL IN ('REG-1', '1') THEN 'PASAR_KEPADATAN_RENDAH'
                ELSE 'PASAR_TIDAK_DIKETAHUI'
            END as MARKET_DENSITY,
            
            -- Customer segment per region
            CASE
                WHEN IS_DINAS = '1' THEN 'SEGMEN_PEMERINTAH'
                WHEN PLBLCL = 'BL' AND NVL(TREMS_REV_REF, 0) >= 500000 THEN 'SEGMEN_KORPORAT'
                WHEN PLBLCL = 'BL' THEN 'SEGMEN_UKM'
                WHEN PLBLCL = 'CL' AND NVL(TREMS_REV_REF, 0) >= 300000 THEN 'SEGMEN_KONSUMEN_PREMIUM'
                ELSE 'SEGMEN_KONSUMEN_MASA'
            END as CUSTOMER_SEGMENT,

            -- Service penetration per area
            CASE
                WHEN IS_POTS = '1' AND IS_IPTV = '1' AND NVL(ADDON_TOTAL, 0) >= 2 THEN 'AREA_LAYANAN_LENGKAP'
                WHEN IS_POTS = '1' AND IS_IPTV = '1' THEN 'AREA_TRIPLE_PLAY'
                WHEN IS_POTS = '1' OR IS_IPTV = '1' THEN 'AREA_LAYANAN_GANDA'
                WHEN NVL(ADDON_TOTAL, 0) > 0 THEN 'AREA_HSI_ENHANCED'
                ELSE 'AREA_HSI_DASAR'
            END as SERVICE_PENETRATION,

            -- Digital readiness per region
            CASE
                WHEN P_DIGITAL = '1' AND CAST(SPEED AS NUMBER) >= 50000 AND NVL(ADDON_TOTAL, 0) >= 2 THEN 'KESIAPAN_DIGITAL_TINGGI'
                WHEN P_DIGITAL = '1' AND CAST(SPEED AS NUMBER) >= 30000 THEN 'KESIAPAN_DIGITAL_SEDANG'
                WHEN P_DIGITAL = '1' OR CAST(SPEED AS NUMBER) >= 50000 THEN 'KESIAPAN_DIGITAL_DASAR'
                ELSE 'AREA_TRADISIONAL'
            END as DIGITAL_READINESS,

            -- Revenue performance per geography
            CASE
                WHEN NVL(TREMS_REV_REF, 0) >= 500000 THEN 'AREA_PENDAPATAN_TINGGI'
                WHEN NVL(TREMS_REV_REF, 0) >= 300000 THEN 'AREA_PENDAPATAN_SEDANG'
                WHEN NVL(TREMS_REV_REF, 0) >= 150000 THEN 'AREA_PENDAPATAN_STANDAR'
                ELSE 'AREA_PENDAPATAN_PEMULA'
            END as REVENUE_PERFORMANCE
            
        FROM (
            SELECT * FROM DWH_MOIS.BRIGHTAI_DAPROS
            WHERE PLBLCL IN ('BL', 'CL')
              AND CITEM NOT LIKE '%W/%'
              AND CITEM NOT LIKE '%WM%'
              AND ASSET_STATUS IN ('ACTIVE', 'NORMAL')
        )
    )
    
    SELECT 
        REGIONAL_NAME,
        MARKET_DENSITY,
        CUSTOMER_SEGMENT,
        SERVICE_PENETRATION,
        DIGITAL_READINESS,
        REVENUE_PERFORMANCE,
        REGIONAL,
        WITEL,
        TELDA,
        COUNT(*) as CUSTOMER_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        
        -- Geographic performance metrics
        ROUND(AVG(REV_HSI), 0) as AVG_HSI_REVENUE,
        ROUND(AVG(REV_TOTAL), 0) as AVG_TOTAL_REVENUE,
        ROUND(AVG(ADDON_REV), 0) as AVG_ADDON_REVENUE,
        ROUND(SUM(REV_HSI), 0) as TOTAL_HSI_CONTRIBUTION,
        ROUND(AVG(SPEED_NUM/1000), 0) as AVG_SPEED_MBPS,
        ROUND(AVG(LOS_NUM), 0) as AVG_TENURE_MONTHS,
        ROUND(AVG(ADDON_COUNT), 1) as AVG_ADDON_COUNT,
        
        -- Service penetration metrics
        ROUND(SUM(CASE WHEN IS_POTS = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as POTS_PENETRATION,
        ROUND(SUM(CASE WHEN IS_IPTV = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as IPTV_PENETRATION,
        ROUND(SUM(CASE WHEN P_DIGITAL = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as DIGITAL_PROGRAM_PENETRATION,
        ROUND(SUM(CASE WHEN SPEED_NUM >= 50000 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as HIGH_SPEED_PENETRATION,
        
        -- Geographic coverage
        COUNT(DISTINCT WITEL) as WITEL_COUNT,
        COUNT(DISTINCT STO) as STO_COUNT,
        COUNT(DISTINCT TELDA) as TELDA_COUNT,
        
        -- Customer type distribution
        ROUND(SUM(CASE WHEN PLBLCL = 'BL' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as BUSINESS_PERCENTAGE,
        ROUND(SUM(CASE WHEN PLBLCL = 'CL' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as CONSUMER_PERCENTAGE,
        ROUND(SUM(CASE WHEN IS_DINAS = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as GOVERNMENT_PERCENTAGE
        
    FROM HSI_GEOGRAPHIC_BASE
    GROUP BY REGIONAL_NAME, MARKET_DENSITY, CUSTOMER_SEGMENT, 
             SERVICE_PENETRATION, DIGITAL_READINESS, REVENUE_PERFORMANCE, REGIONAL, WITEL, TELDA
    ORDER BY TOTAL_HSI_CONTRIBUTION DESC
  `,

  BUSINESS_LOGIC: {
    analyzeGeographicPerformance: function(data) {
      const regionalAnalysis = data.reduce((acc, record) => {
        const region = record.REGIONAL_NAME;
        if (!acc[region]) {
          acc[region] = {
            total_customers: 0,
            total_revenue: 0,
            avg_arpu: 0,
            service_penetration_score: 0,
            digital_readiness_score: 0
          };
        }
        acc[region].total_customers += record.CUSTOMER_COUNT;
        acc[region].total_revenue += record.TOTAL_HSI_CONTRIBUTION;
        return acc;
      }, {});

      // Calculate weighted averages and scores
      Object.keys(regionalAnalysis).forEach(region => {
        const r = regionalAnalysis[region];
        r.avg_arpu = Math.round(r.total_revenue / r.total_customers);
        r.market_share = ((r.total_customers / data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)) * 100).toFixed(1);
        r.revenue_share = ((r.total_revenue / data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0)) * 100).toFixed(1);
      });

      return regionalAnalysis;
    },

    identifyGeographicOpportunities: function(data) {
      const opportunities = [];
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      // High density markets with low penetration
      const highDensityLowPenetration = data.filter(d => 
        d.MARKET_DENSITY === 'PASAR_KEPADATAN_TINGGI' && 
        d.SERVICE_PENETRATION === 'AREA_HSI_DASAR'
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      if (highDensityLowPenetration > 0) {
        opportunities.push({
          area: 'High Density Low Service Penetration',
          count: highDensityLowPenetration,
          percentage: ((highDensityLowPenetration / totalCustomers) * 100).toFixed(1),
          opportunity: 'Service bundling expansion di area kepadatan tinggi',
          priority: 'HIGH',
          potential: 'REVENUE_GROWTH'
        });
      }

      // Traditional areas with digital potential
      const traditionalAreas = data.filter(d => d.DIGITAL_READINESS === 'AREA_TRADISIONAL')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      if (traditionalAreas / totalCustomers > 0.3) {
        opportunities.push({
          area: 'Traditional Digital Areas',
          count: traditionalAreas,
          percentage: ((traditionalAreas / totalCustomers) * 100).toFixed(1),
          opportunity: 'Digital transformation program untuk area tradisional',
          priority: 'STRATEGIC',
          potential: 'MARKET_EXPANSION'
        });
      }

      // Low revenue performance areas
      const lowRevenueAreas = data.filter(d => d.REVENUE_PERFORMANCE === 'AREA_PENDAPATAN_PEMULA')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      if (lowRevenueAreas > 0) {
        opportunities.push({
          area: 'Low Revenue Performance Areas',
          count: lowRevenueAreas,
          percentage: ((lowRevenueAreas / totalCustomers) * 100).toFixed(1),
          opportunity: 'Revenue optimization program dan pricing strategy',
          priority: 'MEDIUM',
          potential: 'ARPU_IMPROVEMENT'
        });
      }

      return opportunities;
    },

    generateRegionalStrategy: function(regionalName, marketDensity) {
      const strategies = {
        'REGIONAL_1_SUMATRA': {
          focus: 'Geographic expansion and service accessibility',
          characteristics: 'Large geographic area, diverse economic centers',
          strategies: [
            'Infrastructure development untuk remote areas',
            'Customized pricing untuk different economic zones',
            'Partnership dengan local businesses',
            'Mobile and satellite backup solutions'
          ]
        },
        'REGIONAL_2_JAKARTA': {
          focus: 'Premium services and high-density optimization',
          characteristics: 'High population density, premium market',
          strategies: [
            'Ultra-high speed service offerings',
            'Enterprise-grade solutions',
            'Smart city integration services',
            'Premium customer experience programs'
          ]
        },
        'REGIONAL_3_JAWA_BARAT': {
          focus: 'Balanced growth and suburban penetration',
          characteristics: 'Mixed urban-suburban market',
          strategies: [
            'Suburban area penetration programs',
            'Family-oriented service bundles',
            'Industrial zone connectivity solutions',
            'Education sector partnerships'
          ]
        },
        'REGIONAL_4_JAWA_TENGAH': {
          focus: 'Cultural adaptation and SME support',
          characteristics: 'Traditional culture with growing digital needs',
          strategies: [
            'Cultural sensitivity dalam service delivery',
            'SME digitalization support programs',
            'Local content dan entertainment offerings',
            'Community-based marketing approaches'
          ]
        },
        'REGIONAL_5_JAWA_TIMUR': {
          focus: 'Industrial support and logistics connectivity',
          characteristics: 'Strong industrial base and logistics hub',
          strategies: [
            'Industrial connectivity solutions',
            'Logistics and supply chain support services',
            'B2B partnership programs',
            'Port and trade area specialized services'
          ]
        }
      };

      return strategies[regionalName] || {
        focus: 'Market development',
        characteristics: 'Diverse market characteristics',
        strategies: ['Develop region-specific approach based on local needs']
      };
    },

    calculateGeographicScore: function(record) {
      let score = 0;
      
      // Market density score (30%)
      const densityScore = {
        'PASAR_KEPADATAN_TINGGI': 30,
        'PASAR_KEPADATAN_SEDANG': 20,
        'PASAR_KEPADATAN_RENDAH': 10,
        'PASAR_TIDAK_DIKETAHUI': 5
      };
      score += (densityScore[record.MARKET_DENSITY] || 0);

      // Service penetration score (35%)
      const serviceScore = {
        'AREA_LAYANAN_LENGKAP': 35,
        'AREA_TRIPLE_PLAY': 28,
        'AREA_LAYANAN_GANDA': 20,
        'AREA_HSI_ENHANCED': 15,
        'AREA_HSI_DASAR': 8
      };
      score += (serviceScore[record.SERVICE_PENETRATION] || 0);

      // Digital readiness score (35%)
      const digitalScore = {
        'KESIAPAN_DIGITAL_TINGGI': 35,
        'KESIAPAN_DIGITAL_SEDANG': 25,
        'KESIAPAN_DIGITAL_DASAR': 15,
        'AREA_TRADISIONAL': 5
      };
      score += (digitalScore[record.DIGITAL_READINESS] || 0);

      return Math.round(score);
    },

    formatIndonesianResponse: function(data) {
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const totalHSIRevenue = data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0);
      const geographicPerformance = this.analyzeGeographicPerformance(data);
      const geographicOpportunities = this.identifyGeographicOpportunities(data);
      
      return {
        ringkasan: 'Analisis profil distribusi geografis pelanggan HSI berdasarkan regional dan karakteristik wilayah',
        total_pelanggan_dianalisis: totalCustomers.toLocaleString('id-ID'),
        total_kontribusi_pendapatan_hsi: `Rp ${totalHSIRevenue.toLocaleString('id-ID')}`,
        
        analisis_performa_geografis: geographicPerformance,
        
        distribusi_regional: {
          regional_1_sumatra: data.filter(d => d.REGIONAL_NAME === 'REGIONAL_1_SUMATRA')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          regional_2_jakarta: data.filter(d => d.REGIONAL_NAME === 'REGIONAL_2_JAKARTA')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          regional_3_jawa_barat: data.filter(d => d.REGIONAL_NAME === 'REGIONAL_3_JAWA_BARAT')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          regional_4_jawa_tengah: data.filter(d => d.REGIONAL_NAME === 'REGIONAL_4_JAWA_TENGAH')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          regional_5_jawa_timur: data.filter(d => d.REGIONAL_NAME === 'REGIONAL_5_JAWA_TIMUR')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          regional_tidak_diketahui: data.filter(d => d.REGIONAL_NAME === 'REGIONAL_TIDAK_DIKETAHUI')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        karakteristik_pasar: {
          pasar_kepadatan_tinggi: data.filter(d => d.MARKET_DENSITY === 'PASAR_KEPADATAN_TINGGI')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pasar_kepadatan_sedang: data.filter(d => d.MARKET_DENSITY === 'PASAR_KEPADATAN_SEDANG')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pasar_kepadatan_rendah: data.filter(d => d.MARKET_DENSITY === 'PASAR_KEPADATAN_RENDAH')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pasar_tidak_diketahui: data.filter(d => d.MARKET_DENSITY === 'PASAR_TIDAK_DIKETAHUI')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        penetrasi_layanan_geografis: {
          area_layanan_lengkap: data.filter(d => d.SERVICE_PENETRATION === 'AREA_LAYANAN_LENGKAP')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          area_triple_play: data.filter(d => d.SERVICE_PENETRATION === 'AREA_TRIPLE_PLAY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          area_layanan_ganda: data.filter(d => d.SERVICE_PENETRATION === 'AREA_LAYANAN_GANDA')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          area_hsi_enhanced: data.filter(d => d.SERVICE_PENETRATION === 'AREA_HSI_ENHANCED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          area_hsi_dasar: data.filter(d => d.SERVICE_PENETRATION === 'AREA_HSI_DASAR')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        kesiapan_digital_regional: {
          kesiapan_digital_tinggi: data.filter(d => d.DIGITAL_READINESS === 'KESIAPAN_DIGITAL_TINGGI')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kesiapan_digital_sedang: data.filter(d => d.DIGITAL_READINESS === 'KESIAPAN_DIGITAL_SEDANG')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kesiapan_digital_dasar: data.filter(d => d.DIGITAL_READINESS === 'KESIAPAN_DIGITAL_DASAR')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          area_tradisional: data.filter(d => d.DIGITAL_READINESS === 'AREA_TRADISIONAL')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        performance_pendapatan_wilayah: {
          area_pendapatan_tinggi: data.filter(d => d.REVENUE_PERFORMANCE === 'AREA_PENDAPATAN_TINGGI')
            .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0),
          area_pendapatan_sedang: data.filter(d => d.REVENUE_PERFORMANCE === 'AREA_PENDAPATAN_SEDANG')
            .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0),
          area_pendapatan_standar: data.filter(d => d.REVENUE_PERFORMANCE === 'AREA_PENDAPATAN_STANDAR')
            .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0),
          area_pendapatan_pemula: data.filter(d => d.REVENUE_PERFORMANCE === 'AREA_PENDAPATAN_PEMULA')
            .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0)
        },

        peluang_geografis: geographicOpportunities,
        
        hierarki_geografis: {
          total_regional: [...new Set(data.map(d => d.REGIONAL))].length,
          total_witel: data.reduce((sum, d) => sum + d.WITEL_COUNT, 0),
          total_telda: data.reduce((sum, d) => sum + d.TELDA_COUNT, 0),
          total_sto: data.reduce((sum, d) => sum + d.STO_COUNT, 0),
          sebaran_kontribusi_regional: data.reduce((acc, d) => {
            const reg = d.REGIONAL || 'Tidak Diketahui';
            acc[reg] = (acc[reg] || 0) + d.TOTAL_HSI_CONTRIBUTION;
            return acc;
          }, {})
        },
        
        wawasan_bisnis: [
          'Identifikasi regional dengan kontribusi pendapatan HSI tertinggi',
          'Analisis penetrasi layanan per karakteristik geografis',
          'Evaluasi kesiapan digital pelanggan berdasarkan wilayah',
          'Pemetaan peluang ekspansi layanan per area cakupan',
          'Strategi regional optimization berdasarkan market density'
        ],
        
        detail_analisis_geografis: data.map(geo => ({
          nama_regional: geo.REGIONAL_NAME,
          kepadatan_pasar: geo.MARKET_DENSITY,
          segmen_pelanggan: geo.CUSTOMER_SEGMENT,
          penetrasi_layanan: geo.SERVICE_PENETRATION,
          kesiapan_digital: geo.DIGITAL_READINESS,
          performance_pendapatan: geo.REVENUE_PERFORMANCE,
          regional: geo.REGIONAL,
          witel: geo.WITEL,
          telda: geo.TELDA,
          jumlah_pelanggan: geo.CUSTOMER_COUNT.toLocaleString('id-ID'),
          persentase: `${geo.PERCENTAGE}%`,
          rata_rata_pendapatan_hsi: `Rp ${geo.AVG_HSI_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_pendapatan_total: `Rp ${geo.AVG_TOTAL_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_pendapatan_tambahan: `Rp ${geo.AVG_ADDON_REVENUE.toLocaleString('id-ID')}`,
          total_kontribusi_hsi: `Rp ${geo.TOTAL_HSI_CONTRIBUTION.toLocaleString('id-ID')}`,
          rata_rata_kecepatan: `${geo.AVG_SPEED_MBPS} Mbps`,
          rata_rata_masa_berlangganan: `${geo.AVG_TENURE_MONTHS} bulan`,
          rata_rata_jumlah_layanan_tambahan: geo.AVG_ADDON_COUNT,
          penetrasi_telepon: `${geo.POTS_PENETRATION}%`,
          penetrasi_iptv: `${geo.IPTV_PENETRATION}%`,
          penetrasi_program_digital: `${geo.DIGITAL_PROGRAM_PENETRATION}%`,
          penetrasi_kecepatan_tinggi: `${geo.HIGH_SPEED_PENETRATION}%`,
          jumlah_witel: geo.WITEL_COUNT,
          jumlah_sto: geo.STO_COUNT,
          jumlah_telda: geo.TELDA_COUNT,
          persentase_bisnis: `${geo.BUSINESS_PERCENTAGE}%`,
          persentase_konsumen: `${geo.CONSUMER_PERCENTAGE}%`,
          persentase_pemerintah: `${geo.GOVERNMENT_PERCENTAGE}%`,
          skor_geografis: this.calculateGeographicScore(geo),
          strategi_regional: this.generateRegionalStrategy(geo.REGIONAL_NAME, geo.MARKET_DENSITY)
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
        focus_area: 'geographic_distribution_analysis'
      };
    },
    
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};