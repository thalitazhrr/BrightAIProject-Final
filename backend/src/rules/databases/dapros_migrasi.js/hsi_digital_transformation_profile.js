const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'dapros_003',
    RULE_NAME: 'hsi_digital_transformation_profile',
    DESCRIPTION: 'Profil adopsi teknologi digital dan transformasi customer HSI',
    DATABASE: 'DAPROS_MIGRASI',
    CATEGORY: 'digital_transformation_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("DAPROS_MIGRASI"),

  KEYWORD_PATTERNS: {
    primary: [
      'transformasi digital hsi', 'digital transformation', 'adopsi teknologi',
      'profil digital', 'digitalisasi customer', 'teknologi adoption',
      'customer digital behavior', 'digital maturity hsi', 'tech adoption', 'modernisasi'
    ],
    
    supporting: [
      'digital', 'teknologi', 'transformasi', 'adopsi', 'digitalisasi',
      'technology', 'innovation', 'modernisasi', 'upgrade', 'fiber', 'gpon',
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
        score = 82 + (primaryMatches * 9) + (supportingMatches * 2);
      } else if (supportingMatches >= 3) {
        score = 68 + (supportingMatches * 3);
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
    
    HSI_DIGITAL_BASE AS (
        SELECT 
            NOTEL, NCLI, PLBLCL, REGIONAL, WITEL, STO, TELDA,
            CAST(SPEED AS NUMBER) as SPEED_NUM,
            CAST(LOS AS NUMBER) as LOS_NUM,
            NVL(TREMS_REV_REF, 0) as REV_HSI,
            NVL(ADDON_TOTAL, 0) as ADDON_COUNT,
            NVL(ADDON_PRICE, 0) as ADDON_REV,
            IS_POTS, IS_IPTV, P_DIGITAL, LOY_PROGRAM,
            LGEST, ASSET_STATUS, KW_IH, PACK_NAME,
            
            -- Klasifikasi teknologi infrastruktur
            CASE 
                WHEN LGEST LIKE '%GPON%' OR LGEST LIKE '%FIBER%' THEN 'FIBER_MODERN'
                WHEN LGEST LIKE '%MSAN%' OR LGEST LIKE '%IP%' THEN 'IP_BASED'
                WHEN LGEST LIKE '%DSLAM%' OR LGEST LIKE '%DSL%' THEN 'LEGACY_DSL'
                ELSE 'UNDEFINED_TECH'
            END as TECHNOLOGY_TYPE,
            
            -- Level kecepatan digital
            CASE 
                WHEN SPEED_NUM >= 100000 THEN 'ULTRA_HIGH_SPEED'
                WHEN SPEED_NUM >= 50000 THEN 'HIGH_SPEED'
                WHEN SPEED_NUM >= 20000 THEN 'MEDIUM_SPEED'
                ELSE 'BASIC_SPEED'
            END as SPEED_CATEGORY,
            
            -- Digital maturity berdasarkan adopsi
            CASE 
                WHEN P_DIGITAL = '1' AND ADDON_COUNT >= 3 AND SPEED_NUM >= 50000 THEN 'DIGITAL_PIONEER'
                WHEN P_DIGITAL = '1' AND (ADDON_COUNT >= 2 OR SPEED_NUM >= 30000) THEN 'DIGITAL_ADOPTER'
                WHEN P_DIGITAL = '1' OR ADDON_COUNT >= 1 THEN 'DIGITAL_BEGINNER'
                ELSE 'TRADITIONAL_USER'
            END as DIGITAL_MATURITY,
            
            -- Profil billing dan usage digital
            CASE 
                WHEN KW_IH = '4' AND P_DIGITAL = '1' THEN 'FULL_DIGITAL_ACTIVE'
                WHEN KW_IH = '4' THEN 'BILLING_USAGE_ACTIVE'
                WHEN KW_IH = '3' THEN 'USAGE_ONLY_ACTIVE'
                WHEN KW_IH = '2' THEN 'BILLING_ONLY_ACTIVE'
                ELSE 'INACTIVE_DIGITAL'
            END as DIGITAL_ACTIVITY,
            
            -- Segmen transformasi
            CASE 
                WHEN LGEST LIKE '%FIBER%' AND SPEED_NUM >= 100000 AND P_DIGITAL = '1' THEN 'FULLY_TRANSFORMED'
                WHEN LGEST LIKE '%FIBER%' AND SPEED_NUM >= 50000 THEN 'TECH_TRANSFORMED'
                WHEN P_DIGITAL = '1' AND ADDON_COUNT >= 2 THEN 'SERVICE_TRANSFORMED'
                WHEN SPEED_NUM >= 50000 OR ADDON_COUNT >= 1 THEN 'PARTIALLY_TRANSFORMED'
                ELSE 'NOT_TRANSFORMED'
            END as TRANSFORMATION_STAGE
            
        FROM (
            SELECT * FROM DWHNAS.DWH_MOIS.' || (SELECT table_name FROM LATEST_DAPROS_TABLE) || '
            WHERE PLBLCL IN ('BL', 'CL')
              AND CITEM NOT LIKE '%W/%'
              AND CITEM NOT LIKE '%WM%'
              AND ASSET_STATUS IN ('ACTIVE', 'NORMAL')
        )
    )
    
    SELECT 
        TECHNOLOGY_TYPE,
        SPEED_CATEGORY,
        DIGITAL_MATURITY,
        DIGITAL_ACTIVITY,
        TRANSFORMATION_STAGE,
        PLBLCL as CUSTOMER_TYPE,
        REGIONAL,
        WITEL,
        TELDA,
        COUNT(*) as CUSTOMER_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        ROUND(AVG(REV_HSI), 0) as AVG_HSI_REVENUE,
        ROUND(AVG(SPEED_NUM/1000), 0) as AVG_SPEED_MBPS,
        ROUND(AVG(LOS_NUM), 0) as AVG_TENURE_MONTHS,
        ROUND(AVG(ADDON_COUNT), 1) as AVG_ADDON_COUNT,
        ROUND(AVG(ADDON_REV), 0) as AVG_ADDON_REVENUE,
        COUNT(DISTINCT TELDA) as TELDA_COVERAGE,
        COUNT(DISTINCT STO) as STO_COVERAGE,
        
        -- Metrics digital transformation
        ROUND(SUM(CASE WHEN P_DIGITAL = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as DIGITAL_PROGRAM_PENETRATION,
        ROUND(SUM(CASE WHEN LGEST LIKE '%FIBER%' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as FIBER_PENETRATION,
        ROUND(SUM(CASE WHEN SPEED_NUM >= 50000 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as HIGH_SPEED_PENETRATION
        
    FROM HSI_DIGITAL_BASE
    GROUP BY TECHNOLOGY_TYPE, SPEED_CATEGORY, DIGITAL_MATURITY, DIGITAL_ACTIVITY, TRANSFORMATION_STAGE, PLBLCL, REGIONAL, WITEL, TELDA
    ORDER BY CUSTOMER_COUNT DESC
  `,

  BUSINESS_LOGIC: {
    analyzeDigitalTransformationTrends: function(data) {
      const transformationAnalysis = data.reduce((acc, record) => {
        const stage = record.TRANSFORMATION_STAGE;
        if (!acc[stage]) {
          acc[stage] = {
            total_customers: 0,
            total_revenue: 0,
            avg_speed: 0,
            fiber_rate: 0,
            digital_program_rate: 0
          };
        }
        acc[stage].total_customers += record.CUSTOMER_COUNT;
        acc[stage].total_revenue += record.AVG_HSI_REVENUE * record.CUSTOMER_COUNT;
        acc[stage].avg_speed += record.AVG_SPEED_MBPS * record.CUSTOMER_COUNT;
        acc[stage].fiber_rate += record.FIBER_PENETRATION * record.CUSTOMER_COUNT;
        acc[stage].digital_program_rate += record.DIGITAL_PROGRAM_PENETRATION * record.CUSTOMER_COUNT;
        return acc;
      }, {});

      // Calculate weighted averages
      Object.keys(transformationAnalysis).forEach(stage => {
        const t = transformationAnalysis[stage];
        t.avg_revenue_per_customer = Math.round(t.total_revenue / t.total_customers);
        t.weighted_avg_speed = Math.round(t.avg_speed / t.total_customers);
        t.weighted_fiber_penetration = (t.fiber_rate / t.total_customers).toFixed(1);
        t.weighted_digital_penetration = (t.digital_program_rate / t.total_customers).toFixed(1);
      });

      return transformationAnalysis;
    },

    assessDigitalReadiness: function(data) {
      const readinessMetrics = {
        fiber_readiness: 0,
        speed_readiness: 0,
        digital_program_readiness: 0,
        overall_readiness: 0
      };

      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      // Calculate readiness scores
      data.forEach(record => {
        const weight = record.CUSTOMER_COUNT / totalCustomers;
        readinessMetrics.fiber_readiness += record.FIBER_PENETRATION * weight;
        readinessMetrics.speed_readiness += record.HIGH_SPEED_PENETRATION * weight;
        readinessMetrics.digital_program_readiness += record.DIGITAL_PROGRAM_PENETRATION * weight;
      });

      readinessMetrics.overall_readiness = (
        (readinessMetrics.fiber_readiness * 0.4) +
        (readinessMetrics.speed_readiness * 0.3) +
        (readinessMetrics.digital_program_readiness * 0.3)
      ).toFixed(1);

      return readinessMetrics;
    },

    identifyTransformationOpportunities: function(data) {
      const opportunities = [];
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      // Legacy technology users
      const legacyUsers = data.filter(d => d.TECHNOLOGY_TYPE === 'LEGACY_DSL')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (legacyUsers / totalCustomers > 0.2) {
        opportunities.push({
          segment: 'Legacy DSL Users',
          count: legacyUsers,
          percentage: ((legacyUsers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Fiber migration program - upgrade ke teknologi modern',
          impact: 'HIGH',
          priority: 'STRATEGIC'
        });
      }

      // Non-digital program users
      const nonDigitalUsers = data.filter(d => d.DIGITAL_MATURITY === 'TRADITIONAL_USER')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (nonDigitalUsers > 0) {
        opportunities.push({
          segment: 'Traditional Users',
          count: nonDigitalUsers,
          percentage: ((nonDigitalUsers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Digital onboarding program - introduce digital services',
          impact: 'MEDIUM',
          priority: 'HIGH'
        });
      }

      // Basic speed users
      const basicSpeedUsers = data.filter(d => d.SPEED_CATEGORY === 'BASIC_SPEED')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (basicSpeedUsers / totalCustomers > 0.3) {
        opportunities.push({
          segment: 'Basic Speed Users',
          count: basicSpeedUsers,
          percentage: ((basicSpeedUsers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Speed upgrade campaign - promote high-speed packages',
          impact: 'MEDIUM',
          priority: 'MEDIUM'
        });
      }

      return opportunities;
    },

    generateTransformationRoadmap: function(stage) {
      const roadmaps = {
        'NOT_TRANSFORMED': {
          current_state: 'Belum ada transformasi digital',
          next_steps: [
            'Assessment infrastruktur existing',
            'Digital awareness campaign',
            'Basic speed upgrade promotion',
            'Introduction to digital services'
          ],
          timeline: '6-12 bulan',
          success_metrics: ['Fiber adoption rate', 'Speed upgrade rate', 'Digital service signup']
        },
        'PARTIALLY_TRANSFORMED': {
          current_state: 'Transformasi parsial - sebagian teknologi/layanan',
          next_steps: [
            'Complete technology migration',
            'Enhanced digital service bundling',
            'Customer education program',
            'Value-added service introduction'
          ],
          timeline: '3-6 bulan',
          success_metrics: ['Complete transformation rate', 'Service bundle adoption', 'Customer satisfaction']
        },
        'SERVICE_TRANSFORMED': {
          current_state: 'Transformasi layanan - digital services active',
          next_steps: [
            'Infrastructure modernization',
            'High-speed service promotion',
            'Advanced digital features',
            'Premium service offering'
          ],
          timeline: '3-9 bulan',
          success_metrics: ['Infrastructure upgrade rate', 'Premium service adoption', 'ARPU growth']
        },
        'TECH_TRANSFORMED': {
          current_state: 'Transformasi teknologi - infrastruktur modern',
          next_steps: [
            'Digital service expansion',
            'Advanced feature activation',
            'Loyalty program enhancement',
            'Cross-selling optimization'
          ],
          timeline: '2-4 bulan',
          success_metrics: ['Digital service penetration', 'Feature usage rate', 'Customer loyalty score']
        },
        'FULLY_TRANSFORMED': {
          current_state: 'Transformasi penuh - teknologi dan layanan modern',
          next_steps: [
            'Innovation pilot programs',
            'Premium experience enhancement',
            'Advanced analytics implementation',
            'Future technology preparation'
          ],
          timeline: 'Ongoing',
          success_metrics: ['Innovation adoption rate', 'Premium retention rate', 'Technology leadership']
        }
      };

      return roadmaps[stage] || {
        current_state: 'Status tidak diketahui',
        next_steps: ['Assessment komprehensif diperlukan'],
        timeline: 'TBD',
        success_metrics: ['TBD']
      };
    },

    calculateTransformationScore: function(record) {
      let score = 0;
      
      // Technology component (40%)
      const techScore = {
        'FIBER_MODERN': 40,
        'IP_BASED': 25,
        'LEGACY_DSL': 10,
        'UNDEFINED_TECH': 5
      };
      score += (techScore[record.TECHNOLOGY_TYPE] || 0);

      // Speed component (30%)
      const speedScore = {
        'ULTRA_HIGH_SPEED': 30,
        'HIGH_SPEED': 22,
        'MEDIUM_SPEED': 15,
        'BASIC_SPEED': 8
      };
      score += (speedScore[record.SPEED_CATEGORY] || 0);

      // Digital maturity component (30%)
      const digitalScore = {
        'DIGITAL_PIONEER': 30,
        'DIGITAL_ADOPTER': 22,
        'DIGITAL_BEGINNER': 15,
        'TRADITIONAL_USER': 5
      };
      score += (digitalScore[record.DIGITAL_MATURITY] || 0);

      return Math.round(score);
    },

    formatIndonesianResponse: function(data) {
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const transformationTrends = this.analyzeDigitalTransformationTrends(data);
      const digitalReadiness = this.assessDigitalReadiness(data);
      const transformationOpportunities = this.identifyTransformationOpportunities(data);
      
      return {
        ringkasan: 'Profil adopsi teknologi digital dan tingkat transformasi pelanggan HSI',
        total_pelanggan_dianalisis: totalCustomers.toLocaleString('id-ID'),
        
        skor_kesiapan_digital: {
          kesiapan_fiber: `${digitalReadiness.fiber_readiness.toFixed(1)}%`,
          kesiapan_kecepatan: `${digitalReadiness.speed_readiness.toFixed(1)}%`,
          kesiapan_program_digital: `${digitalReadiness.digital_program_readiness.toFixed(1)}%`,
          kesiapan_keseluruhan: `${digitalReadiness.overall_readiness}%`
        },

        analisis_tren_transformasi: transformationTrends,
        
        distribusi_teknologi: {
          fiber_modern: data.filter(d => d.TECHNOLOGY_TYPE === 'FIBER_MODERN')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          berbasis_ip: data.filter(d => d.TECHNOLOGY_TYPE === 'IP_BASED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          dsl_lama: data.filter(d => d.TECHNOLOGY_TYPE === 'LEGACY_DSL')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          teknologi_tidak_diketahui: data.filter(d => d.TECHNOLOGY_TYPE === 'UNDEFINED_TECH')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        kategori_kecepatan: {
          kecepatan_ultra_tinggi: data.filter(d => d.SPEED_CATEGORY === 'ULTRA_HIGH_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kecepatan_tinggi: data.filter(d => d.SPEED_CATEGORY === 'HIGH_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kecepatan_sedang: data.filter(d => d.SPEED_CATEGORY === 'MEDIUM_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kecepatan_dasar: data.filter(d => d.SPEED_CATEGORY === 'BASIC_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        kematangan_digital: {
          pelopor_digital: data.filter(d => d.DIGITAL_MATURITY === 'DIGITAL_PIONEER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          adopter_digital: data.filter(d => d.DIGITAL_MATURITY === 'DIGITAL_ADOPTER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pemula_digital: data.filter(d => d.DIGITAL_MATURITY === 'DIGITAL_BEGINNER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_tradisional: data.filter(d => d.DIGITAL_MATURITY === 'TRADITIONAL_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        tahap_transformasi: {
          transformasi_penuh: data.filter(d => d.TRANSFORMATION_STAGE === 'FULLY_TRANSFORMED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          transformasi_teknologi: data.filter(d => d.TRANSFORMATION_STAGE === 'TECH_TRANSFORMED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          transformasi_layanan: data.filter(d => d.TRANSFORMATION_STAGE === 'SERVICE_TRANSFORMED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          transformasi_sebagian: data.filter(d => d.TRANSFORMATION_STAGE === 'PARTIALLY_TRANSFORMED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          belum_transformasi: data.filter(d => d.TRANSFORMATION_STAGE === 'NOT_TRANSFORMED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },

        peluang_transformasi: transformationOpportunities,
        
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
        
        metrik_transformasi: {
          rata_rata_penetrasi_program_digital: data.length > 0 ? 
            (data.reduce((sum, d) => sum + d.DIGITAL_PROGRAM_PENETRATION, 0) / data.length).toFixed(2) + '%' : '0%',
          rata_rata_penetrasi_fiber: data.length > 0 ? 
            (data.reduce((sum, d) => sum + d.FIBER_PENETRATION, 0) / data.length).toFixed(2) + '%' : '0%',
          rata_rata_penetrasi_kecepatan_tinggi: data.length > 0 ? 
            (data.reduce((sum, d) => sum + d.HIGH_SPEED_PENETRATION, 0) / data.length).toFixed(2) + '%' : '0%'
        },
        
        wawasan_bisnis: [
          'Identifikasi tingkat adopsi teknologi fiber versus infrastruktur lama',
          'Analisis korelasi kecepatan internet dengan perilaku digital pelanggan',
          'Evaluasi efektivitas program digitalisasi pada keterlibatan pelanggan', 
          'Pemetaan kesiapan pelanggan untuk teknologi dan layanan baru',
          'Roadmap strategis untuk akselerasi transformasi digital'
        ],
        
        detail_profil_digital: data.map(profile => ({
          tipe_teknologi: profile.TECHNOLOGY_TYPE,
          kategori_kecepatan: profile.SPEED_CATEGORY,
          kematangan_digital: profile.DIGITAL_MATURITY,
          aktivitas_digital: profile.DIGITAL_ACTIVITY,
          tahap_transformasi: profile.TRANSFORMATION_STAGE,
          tipe_pelanggan: profile.CUSTOMER_TYPE,
          regional: profile.REGIONAL,
          witel: profile.WITEL,
          telda: profile.TELDA,
          jumlah_pelanggan: profile.CUSTOMER_COUNT.toLocaleString('id-ID'),
          persentase: `${profile.PERCENTAGE}%`,
          rata_rata_pendapatan_hsi: `Rp ${profile.AVG_HSI_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_kecepatan: `${profile.AVG_SPEED_MBPS} Mbps`,
          rata_rata_masa_berlangganan: `${profile.AVG_TENURE_MONTHS} bulan`,
          rata_rata_jumlah_layanan_tambahan: profile.AVG_ADDON_COUNT,
          rata_rata_pendapatan_tambahan: `Rp ${profile.AVG_ADDON_REVENUE.toLocaleString('id-ID')}`,
          penetrasi_program_digital: `${profile.DIGITAL_PROGRAM_PENETRATION}%`,
          penetrasi_fiber: `${profile.FIBER_PENETRATION}%`,
          penetrasi_kecepatan_tinggi: `${profile.HIGH_SPEED_PENETRATION}%`,
          cakupan_telda: profile.TELDA_COVERAGE,
          cakupan_sto: profile.STO_COVERAGE,
          skor_transformasi: this.calculateTransformationScore(profile),
          roadmap_transformasi: this.generateTransformationRoadmap(profile.TRANSFORMATION_STAGE)
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
        focus_area: 'digital_transformation_analysis'
      };
    },
    
    parent: this
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};