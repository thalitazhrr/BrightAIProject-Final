const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'dapros_006',
    RULE_NAME: 'hsi_speed_distribution_analysis',
    DESCRIPTION: 'Analisis distribusi kecepatan layanan HSI dan penetrasi per kategori speed',
    DATABASE: 'DAPROS_MIGRASI',
    CATEGORY: 'speed_distribution_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("DAPROS_MIGRASI"),

  KEYWORD_PATTERNS: {
    primary: [
      'distribusi speed hsi', 'speed distribution', 'analisis kecepatan',
      'distribusi kecepatan', 'speed analysis', 'kecepatan internet',
      'penetrasi speed', 'speed penetration', 'bandwidth analysis', 'sebaran kecepatan'
    ],
    
    supporting: [
      'speed', 'kecepatan', 'bandwidth', 'mbps', 'distribusi', 'penetrasi',
      'ultra high speed', 'high speed', 'medium speed', 'basic speed',
      'telda', 'datel', 'regional', 'witel', 'wilayah'
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
        score = 85 + (primaryMatches * 8) + (supportingMatches * 2);
      } else if (supportingMatches >= 3) {
        score = 68 + (supportingMatches * 4);
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
    
    HSI_SPEED_BASE AS (
        SELECT 
            NOTEL, NCLI, PLBLCL, REGIONAL, WITEL, STO, TELDA,
            CAST(SPEED AS NUMBER) as SPEED_NUM,
            CAST(LOS AS NUMBER) as LOS_NUM,
            NVL(TREMS_REV_REF, 0) as REV_HSI,
            NVL(TREMS_REV_P, 0) as REV_TOTAL,
            NVL(ADDON_TOTAL, 0) as ADDON_COUNT,
            NVL(ADDON_PRICE, 0) as ADDON_REV,
            IS_POTS, IS_IPTV, IS_DINAS, KW_IH,
            PACK_NAME, ASSET_STATUS, P_DIGITAL, LGEST,
            
            -- Kategori speed utama
            CASE 
                WHEN SPEED_NUM >= 100000 THEN 'ULTRA_HIGH_SPEED'
                WHEN SPEED_NUM >= 50000 THEN 'HIGH_SPEED'
                WHEN SPEED_NUM >= 30000 THEN 'MEDIUM_HIGH_SPEED'
                WHEN SPEED_NUM >= 20000 THEN 'MEDIUM_SPEED'
                WHEN SPEED_NUM >= 10000 THEN 'BASIC_SPEED'
                ELSE 'LOW_SPEED'
            END as SPEED_CATEGORY,
            
            -- Speed tier dalam Mbps
            CASE 
                WHEN SPEED_NUM >= 100000 THEN '100_MBPS_PLUS'
                WHEN SPEED_NUM >= 50000 THEN '50_99_MBPS'
                WHEN SPEED_NUM >= 30000 THEN '30_49_MBPS'
                WHEN SPEED_NUM >= 20000 THEN '20_29_MBPS'
                WHEN SPEED_NUM >= 10000 THEN '10_19_MBPS'
                ELSE 'UNDER_10_MBPS'
            END as SPEED_TIER,
            
            -- Speed readiness untuk teknologi
            CASE 
                WHEN SPEED_NUM >= 100000 AND LGEST LIKE '%FIBER%' THEN 'FIBER_ULTRA_READY'
                WHEN SPEED_NUM >= 50000 AND LGEST LIKE '%FIBER%' THEN 'FIBER_HIGH_READY'
                WHEN SPEED_NUM >= 100000 THEN 'ULTRA_READY_NON_FIBER'
                WHEN SPEED_NUM >= 50000 THEN 'HIGH_READY_NON_FIBER'
                WHEN SPEED_NUM >= 20000 THEN 'STANDARD_READY'
                ELSE 'BASIC_READY'
            END as SPEED_TECH_READINESS,
            
            -- Speed vs Revenue efficiency
            CASE 
                WHEN SPEED_NUM > 0 THEN
                    CASE 
                        WHEN (REV_HSI / (SPEED_NUM/1000)) >= 25000 THEN 'HIGH_REVENUE_EFFICIENCY'
                        WHEN (REV_HSI / (SPEED_NUM/1000)) >= 15000 THEN 'MEDIUM_REVENUE_EFFICIENCY'
                        WHEN (REV_HSI / (SPEED_NUM/1000)) >= 8000 THEN 'STANDARD_REVENUE_EFFICIENCY'
                        ELSE 'LOW_REVENUE_EFFICIENCY'
                    END
                ELSE 'UNDEFINED_EFFICIENCY'
            END as SPEED_REVENUE_EFFICIENCY,
            
            -- Customer segment berdasarkan speed preference
            CASE 
                WHEN PLBLCL = 'BL' AND SPEED_NUM >= 100000 THEN 'ENTERPRISE_POWER_USER'
                WHEN PLBLCL = 'BL' AND SPEED_NUM >= 50000 THEN 'BUSINESS_HIGH_USER'
                WHEN PLBLCL = 'BL' THEN 'BUSINESS_STANDARD_USER'
                WHEN PLBLCL = 'CL' AND SPEED_NUM >= 100000 THEN 'CONSUMER_POWER_USER'
                WHEN PLBLCL = 'CL' AND SPEED_NUM >= 50000 THEN 'CONSUMER_HIGH_USER'
                WHEN PLBLCL = 'CL' AND SPEED_NUM >= 20000 THEN 'CONSUMER_MEDIUM_USER'
                ELSE 'CONSUMER_BASIC_USER'
            END as SPEED_USER_SEGMENT
            
        FROM (
            SELECT * FROM DWHNAS.DWH_MOIS.' || (SELECT table_name FROM LATEST_DAPROS_TABLE) || '
            WHERE PLBLCL IN ('BL', 'CL')
              AND CITEM NOT LIKE '%W/%'
              AND CITEM NOT LIKE '%WM%'
              AND ASSET_STATUS IN ('ACTIVE', 'NORMAL')
              AND SPEED IS NOT NULL
              AND CAST(SPEED AS NUMBER) > 0
        )
    )
    
    SELECT 
        SPEED_CATEGORY,
        SPEED_TIER,
        SPEED_TECH_READINESS,
        SPEED_REVENUE_EFFICIENCY,
        SPEED_USER_SEGMENT,
        PLBLCL as CUSTOMER_TYPE,
        REGIONAL,
        WITEL,
        TELDA,
        COUNT(*) as CUSTOMER_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        
        -- Speed performance metrics
        ROUND(AVG(SPEED_NUM/1000), 1) as AVG_SPEED_MBPS,
        ROUND(MIN(SPEED_NUM/1000), 1) as MIN_SPEED_MBPS,
        ROUND(MAX(SPEED_NUM/1000), 1) as MAX_SPEED_MBPS,
        ROUND(STDDEV(SPEED_NUM/1000), 1) as STDDEV_SPEED_MBPS,
        
        -- Revenue performance per speed
        ROUND(AVG(REV_HSI), 0) as AVG_HSI_REVENUE,
        ROUND(AVG(REV_TOTAL), 0) as AVG_TOTAL_REVENUE,
        ROUND(SUM(REV_HSI), 0) as TOTAL_HSI_CONTRIBUTION,
        ROUND(AVG(CASE WHEN SPEED_NUM > 0 THEN REV_HSI / (SPEED_NUM/1000) ELSE 0 END), 0) as AVG_REVENUE_PER_MBPS,
        
        -- Service adoption per speed
        ROUND(AVG(LOS_NUM), 0) as AVG_TENURE_MONTHS,
        ROUND(AVG(ADDON_COUNT), 1) as AVG_ADDON_COUNT,
        ROUND(AVG(ADDON_REV), 0) as AVG_ADDON_REVENUE,
        
        -- Technology and service penetration
        ROUND(SUM(CASE WHEN IS_POTS = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as POTS_PENETRATION,
        ROUND(SUM(CASE WHEN IS_IPTV = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as IPTV_PENETRATION,
        ROUND(SUM(CASE WHEN P_DIGITAL = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as DIGITAL_PROGRAM_PENETRATION,
        ROUND(SUM(CASE WHEN LGEST LIKE '%FIBER%' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as FIBER_PENETRATION,
        
        -- Geographic coverage
        COUNT(DISTINCT TELDA) as TELDA_COVERAGE,
        COUNT(DISTINCT STO) as STO_COVERAGE
        
    FROM HSI_SPEED_BASE
    GROUP BY SPEED_CATEGORY, SPEED_TIER, SPEED_TECH_READINESS, 
             SPEED_REVENUE_EFFICIENCY, SPEED_USER_SEGMENT, PLBLCL, REGIONAL, WITEL, TELDA
    ORDER BY AVG_SPEED_MBPS DESC, CUSTOMER_COUNT DESC
  `,

  BUSINESS_LOGIC: {
    analyzeSpeedDistribution: function(data) {
      const speedAnalysis = data.reduce((acc, record) => {
        const category = record.SPEED_CATEGORY;
        if (!acc[category]) {
          acc[category] = {
            total_customers: 0,
            total_revenue: 0,
            avg_speed: 0,
            revenue_efficiency: 0,
            market_share: 0
          };
        }
        acc[category].total_customers += record.CUSTOMER_COUNT;
        acc[category].total_revenue += record.TOTAL_HSI_CONTRIBUTION;
        acc[category].avg_speed += record.AVG_SPEED_MBPS * record.CUSTOMER_COUNT;
        acc[category].revenue_efficiency += record.AVG_REVENUE_PER_MBPS * record.CUSTOMER_COUNT;
        return acc;
      }, {});

      const totalCustomers = Object.values(speedAnalysis).reduce((sum, s) => sum + s.total_customers, 0);
      const totalRevenue = Object.values(speedAnalysis).reduce((sum, s) => sum + s.total_revenue, 0);

      // Calculate weighted averages
      Object.keys(speedAnalysis).forEach(category => {
        const s = speedAnalysis[category];
        s.market_share = ((s.total_customers / totalCustomers) * 100).toFixed(1);
        s.revenue_share = ((s.total_revenue / totalRevenue) * 100).toFixed(1);
        s.avg_arpu = Math.round(s.total_revenue / s.total_customers);
        s.weighted_avg_speed = (s.avg_speed / s.total_customers).toFixed(1);
        s.weighted_revenue_efficiency = Math.round(s.revenue_efficiency / s.total_customers);
      });

      return speedAnalysis;
    },

    identifySpeedOpportunities: function(data) {
      const opportunities = [];
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      // Low speed users with upgrade potential
      const lowSpeedUsers = data.filter(d => ['LOW_SPEED', 'BASIC_SPEED'].includes(d.SPEED_CATEGORY))
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (lowSpeedUsers / totalCustomers > 0.3) {
        opportunities.push({
          segment: 'Low Speed Users',
          count: lowSpeedUsers,
          percentage: ((lowSpeedUsers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Speed upgrade campaign - migrate ke medium/high speed packages',
          potential_revenue_impact: 'HIGH',
          priority: 'HIGH'
        });
      }

      // Non-fiber high speed users
      const nonFiberHighSpeed = data.filter(d => 
        d.SPEED_TECH_READINESS === 'HIGH_READY_NON_FIBER' || 
        d.SPEED_TECH_READINESS === 'ULTRA_READY_NON_FIBER'
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (nonFiberHighSpeed > 0) {
        opportunities.push({
          segment: 'Non-Fiber High Speed Users',
          count: nonFiberHighSpeed,
          percentage: ((nonFiberHighSpeed / totalCustomers) * 100).toFixed(1),
          opportunity: 'Fiber migration program - upgrade infrastructure untuk better performance',
          potential_revenue_impact: 'MEDIUM',
          priority: 'STRATEGIC'
        });
      }

      // Low revenue efficiency users
      const lowEfficiencyUsers = data.filter(d => d.SPEED_REVENUE_EFFICIENCY === 'LOW_REVENUE_EFFICIENCY')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (lowEfficiencyUsers > 0) {
        opportunities.push({
          segment: 'Low Revenue Efficiency Users',
          count: lowEfficiencyUsers,
          percentage: ((lowEfficiencyUsers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Pricing optimization - improve revenue per Mbps ratio',
          potential_revenue_impact: 'MEDIUM',
          priority: 'MEDIUM'
        });
      }

      return opportunities;
    },

    generateSpeedStrategy: function(speedCategory) {
      const strategies = {
        'ULTRA_HIGH_SPEED': {
          focus: 'Premium experience and innovation',
          target_market: 'Enterprise power users and tech enthusiasts',
          strategies: [
            'Premium support dan SLA guarantees',
            'Early access ke cutting-edge technologies',
            'Customized enterprise solutions',
            'Innovation partnership programs'
          ],
          pricing_approach: 'Premium pricing dengan value differentiation'
        },
        'HIGH_SPEED': {
          focus: 'Value proposition and service excellence',
          target_market: 'Professional users and advanced consumers',
          strategies: [
            'Enhanced service bundles',
            'Business productivity solutions',
            'Advanced streaming dan gaming optimizations',
            'Priority customer support'
          ],
          pricing_approach: 'Competitive premium pricing'
        },
        'MEDIUM_HIGH_SPEED': {
          focus: 'Growth and market expansion',
          target_market: 'Growing businesses and tech-savvy consumers',
          strategies: [
            'Growth-oriented service packages',
            'Flexible upgrade paths',
            'Family entertainment bundles',
            'Business starter solutions'
          ],
          pricing_approach: 'Market penetration pricing'
        },
        'MEDIUM_SPEED': {
          focus: 'Value for money and reliability',
          target_market: 'Mainstream consumers and small businesses',
          strategies: [
            'Reliable basic services',
            'Family-friendly packages',
            'Small business essentials',
            'Educational content dan parental controls'
          ],
          pricing_approach: 'Value pricing strategy'
        },
        'BASIC_SPEED': {
          focus: 'Accessibility and upgrade incentives',
          target_market: 'Entry-level users and budget-conscious customers',
          strategies: [
            'Affordable entry packages',
            'Gradual upgrade incentives',
            'Basic reliability assurance',
            'Customer education programs'
          ],
          pricing_approach: 'Penetration pricing'
        },
        'LOW_SPEED': {
          focus: 'Customer development and retention',
          target_market: 'Price-sensitive and basic usage customers',
          strategies: [
            'Retention-focused programs',
            'Basic service reliability',
            'Simplified upgrade options',
            'Cost-effective maintenance'
          ],
          pricing_approach: 'Cost-plus pricing'
        }
      };

      return strategies[speedCategory] || {
        focus: 'General speed optimization',
        target_market: 'Diverse customer base',
        strategies: ['Develop speed-specific approach'],
        pricing_approach: 'Market-based pricing'
      };
    },

    calculateSpeedScore: function(record) {
      let score = 0;
      
      // Speed category score (40%)
      const speedScore = {
        'ULTRA_HIGH_SPEED': 40,
        'HIGH_SPEED': 32,
        'MEDIUM_HIGH_SPEED': 25,
        'MEDIUM_SPEED': 18,
        'BASIC_SPEED': 10,
        'LOW_SPEED': 5
      };
      score += (speedScore[record.SPEED_CATEGORY] || 0);

      // Technology readiness score (30%)
      const techScore = {
        'FIBER_ULTRA_READY': 30,
        'FIBER_HIGH_READY': 25,
        'ULTRA_READY_NON_FIBER': 20,
        'HIGH_READY_NON_FIBER': 15,
        'STANDARD_READY': 10,
        'BASIC_READY': 5
      };
      score += (techScore[record.SPEED_TECH_READINESS] || 0);

      // Revenue efficiency score (30%)
      const efficiencyScore = {
        'HIGH_REVENUE_EFFICIENCY': 30,
        'MEDIUM_REVENUE_EFFICIENCY': 22,
        'STANDARD_REVENUE_EFFICIENCY': 15,
        'LOW_REVENUE_EFFICIENCY': 8,
        'UNDEFINED_EFFICIENCY': 0
      };
      score += (efficiencyScore[record.SPEED_REVENUE_EFFICIENCY] || 0);

      return Math.round(score);
    },

    analyzeSpeedTrends: function(data) {
      const trends = {
        high_speed_adoption: 0,
        fiber_readiness: 0,
        revenue_efficiency: 0,
        customer_segmentation: {}
      };

      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      // High speed adoption rate
      const highSpeedCustomers = data.filter(d => 
        ['ULTRA_HIGH_SPEED', 'HIGH_SPEED', 'MEDIUM_HIGH_SPEED'].includes(d.SPEED_CATEGORY)
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      trends.high_speed_adoption = ((highSpeedCustomers / totalCustomers) * 100).toFixed(1);

      // Fiber readiness
      const fiberReadyCustomers = data.filter(d => 
        d.SPEED_TECH_READINESS.includes('FIBER')
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      trends.fiber_readiness = ((fiberReadyCustomers / totalCustomers) * 100).toFixed(1);

      // Average revenue efficiency
      const weightedEfficiency = data.reduce((sum, d) => 
        sum + (d.AVG_REVENUE_PER_MBPS * d.CUSTOMER_COUNT), 0
      );
      trends.revenue_efficiency = Math.round(weightedEfficiency / totalCustomers);

      return trends;
    },

    formatIndonesianResponse: function(data) {
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const totalHSIRevenue = data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0);
      const avgSpeedOverall = data.length > 0 ? 
        (data.reduce((sum, d) => sum + (d.AVG_SPEED_MBPS * d.CUSTOMER_COUNT), 0) / totalCustomers).toFixed(1) : 0;
      
      const speedDistribution = this.analyzeSpeedDistribution(data);
      const speedOpportunities = this.identifySpeedOpportunities(data);
      const speedTrends = this.analyzeSpeedTrends(data);
      
      return {
        ringkasan: 'Analisis distribusi kecepatan layanan HSI dan penetrasi per kategori kecepatan',
        total_pelanggan_dianalisis: totalCustomers.toLocaleString('id-ID'),
        rata_rata_kecepatan_keseluruhan: `${avgSpeedOverall} Mbps`,
        total_kontribusi_pendapatan_hsi: `Rp ${totalHSIRevenue.toLocaleString('id-ID')}`,
        
        tren_kecepatan: {
          adopsi_kecepatan_tinggi: `${speedTrends.high_speed_adoption}%`,
          kesiapan_fiber: `${speedTrends.fiber_readiness}%`,
          efisiensi_revenue_rata_rata: `Rp ${speedTrends.revenue_efficiency.toLocaleString('id-ID')}/Mbps`
        },

        analisis_distribusi_kecepatan: speedDistribution,
        
        distribusi_kategori_kecepatan: {
          kecepatan_ultra_tinggi: data.filter(d => d.SPEED_CATEGORY === 'ULTRA_HIGH_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kecepatan_tinggi: data.filter(d => d.SPEED_CATEGORY === 'HIGH_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kecepatan_menengah_tinggi: data.filter(d => d.SPEED_CATEGORY === 'MEDIUM_HIGH_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kecepatan_menengah: data.filter(d => d.SPEED_CATEGORY === 'MEDIUM_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kecepatan_dasar: data.filter(d => d.SPEED_CATEGORY === 'BASIC_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          kecepatan_rendah: data.filter(d => d.SPEED_CATEGORY === 'LOW_SPEED')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        distribusi_tingkatan_kecepatan: {
          '100_mbps_ke_atas': data.filter(d => d.SPEED_TIER === '100_MBPS_PLUS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          '50_99_mbps': data.filter(d => d.SPEED_TIER === '50_99_MBPS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          '30_49_mbps': data.filter(d => d.SPEED_TIER === '30_49_MBPS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          '20_29_mbps': data.filter(d => d.SPEED_TIER === '20_29_MBPS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          '10_19_mbps': data.filter(d => d.SPEED_TIER === '10_19_MBPS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          'di_bawah_10_mbps': data.filter(d => d.SPEED_TIER === 'UNDER_10_MBPS')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        kesiapan_teknologi_kecepatan: {
          fiber_ultra_siap: data.filter(d => d.SPEED_TECH_READINESS === 'FIBER_ULTRA_READY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          fiber_tinggi_siap: data.filter(d => d.SPEED_TECH_READINESS === 'FIBER_HIGH_READY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          ultra_siap_non_fiber: data.filter(d => d.SPEED_TECH_READINESS === 'ULTRA_READY_NON_FIBER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          tinggi_siap_non_fiber: data.filter(d => d.SPEED_TECH_READINESS === 'HIGH_READY_NON_FIBER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          standar_siap: data.filter(d => d.SPEED_TECH_READINESS === 'STANDARD_READY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          dasar_siap: data.filter(d => d.SPEED_TECH_READINESS === 'BASIC_READY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        segmen_pengguna_kecepatan: {
          pengguna_korporat_power: data.filter(d => d.SPEED_USER_SEGMENT === 'ENTERPRISE_POWER_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_bisnis_tinggi: data.filter(d => d.SPEED_USER_SEGMENT === 'BUSINESS_HIGH_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_bisnis_standar: data.filter(d => d.SPEED_USER_SEGMENT === 'BUSINESS_STANDARD_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_konsumen_power: data.filter(d => d.SPEED_USER_SEGMENT === 'CONSUMER_POWER_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_konsumen_tinggi: data.filter(d => d.SPEED_USER_SEGMENT === 'CONSUMER_HIGH_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_konsumen_menengah: data.filter(d => d.SPEED_USER_SEGMENT === 'CONSUMER_MEDIUM_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pengguna_konsumen_dasar: data.filter(d => d.SPEED_USER_SEGMENT === 'CONSUMER_BASIC_USER')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },

        peluang_kecepatan: speedOpportunities,
        
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
          'Identifikasi distribusi preferensi kecepatan pelanggan HSI per segmen',
          'Analisis korelasi kecepatan dengan efisiensi pendapatan per pelanggan',
          'Evaluasi kesiapan teknologi fiber untuk kecepatan ultra tinggi',
          'Pemetaan penetrasi layanan tambahan berdasarkan kategori kecepatan',
          'Strategi speed tier optimization untuk revenue maximization'
        ],
        
        detail_analisis_kecepatan: data.map(speed => ({
          kategori_kecepatan: speed.SPEED_CATEGORY,
          tingkatan_kecepatan: speed.SPEED_TIER, 
          kesiapan_teknologi_kecepatan: speed.SPEED_TECH_READINESS,
          efisiensi_pendapatan_kecepatan: speed.SPEED_REVENUE_EFFICIENCY,
          segmen_pengguna_kecepatan: speed.SPEED_USER_SEGMENT,
          tipe_pelanggan: speed.CUSTOMER_TYPE,
          regional: speed.REGIONAL,
          witel: speed.WITEL,
          telda: speed.TELDA,
          jumlah_pelanggan: speed.CUSTOMER_COUNT.toLocaleString('id-ID'),
          persentase: `${speed.PERCENTAGE}%`,
          rata_rata_kecepatan: `${speed.AVG_SPEED_MBPS} Mbps`,
          kecepatan_minimum: `${speed.MIN_SPEED_MBPS} Mbps`,
          kecepatan_maksimum: `${speed.MAX_SPEED_MBPS} Mbps`,
          standar_deviasi_kecepatan: `${speed.STDDEV_SPEED_MBPS} Mbps`,
          rata_rata_pendapatan_hsi: `Rp ${speed.AVG_HSI_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_pendapatan_total: `Rp ${speed.AVG_TOTAL_REVENUE.toLocaleString('id-ID')}`,
          total_kontribusi_hsi: `Rp ${speed.TOTAL_HSI_CONTRIBUTION.toLocaleString('id-ID')}`,
          pendapatan_per_mbps: `Rp ${speed.AVG_REVENUE_PER_MBPS.toLocaleString('id-ID')}`,
          rata_rata_masa_berlangganan: `${speed.AVG_TENURE_MONTHS} bulan`,
          rata_rata_jumlah_layanan_tambahan: speed.AVG_ADDON_COUNT,
          rata_rata_pendapatan_tambahan: `Rp ${speed.AVG_ADDON_REVENUE.toLocaleString('id-ID')}`,
          penetrasi_telepon: `${speed.POTS_PENETRATION}%`,
          penetrasi_iptv: `${speed.IPTV_PENETRATION}%`,
          penetrasi_program_digital: `${speed.DIGITAL_PROGRAM_PENETRATION}%`,
          penetrasi_fiber: `${speed.FIBER_PENETRATION}%`,
          cakupan_telda: speed.TELDA_COVERAGE,
          cakupan_sto: speed.STO_COVERAGE,
          skor_kecepatan: this.calculateSpeedScore(speed),
          strategi_kecepatan: this.generateSpeedStrategy(speed.SPEED_CATEGORY)
        }))
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = patternMatcher.calculateConfidence(userInput, module.exports.KEYWORD_PATTERNS);
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: 'speed_distribution_analysis'
      };
    },
    
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};