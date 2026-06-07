const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'dapros_007',
    RULE_NAME: 'hsi_customer_loyalty_analysis',
    DESCRIPTION: 'Analisis loyalitas pelanggan HSI berdasarkan tenure, program loyalty dan customer retention',
    DATABASE: 'BRIGHTAI_DAPROS',
    CATEGORY: 'customer_loyalty_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_DAPROS"),

  KEYWORD_PATTERNS: {
    primary: [
      'loyalitas pelanggan hsi', 'customer loyalty', 'analisis loyalitas',
      'customer retention', 'analisis tenure', 'loyalty analysis',
      'program loyalitas', 'loyalty program', 'customer loyalty hsi', 'kesetiaan pelanggan',
      'loyalitas pelanggan internet', 'tingkat loyalitas pelanggan',
      'loyalitas pelanggan', 'tingkat loyalitas'
    ],

    supporting: [
      'loyalitas', 'loyalty', 'tenure', 'retention', 'setia', 'loyal',
      'program', 'reward', 'point', 'lama berlangganan', 'customer lifetime',
      'telda', 'datel', 'regional', 'witel', 'wilayah', 'distribusi',
      'pelanggan', 'internet', 'hsi', 'customer'
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
        score = 70 + (supportingMatches * 3);
      }

      // Fallback: loyalitas + (pelanggan|customer|internet|hsi)
      if (score === 0 && lowerInput.includes('loyalitas')) {
        if (lowerInput.includes('pelanggan') || lowerInput.includes('customer') ||
            lowerInput.includes('internet') || lowerInput.includes('hsi')) {
          score = 78;
        }
      }

      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_LOYALTY_BASE AS (
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
            LOY_PROGRAM, VALID_FROM,
            
            -- Kategori tenure utama (disederhanakan menjadi 6 kategori)
            CASE
                WHEN CAST(LOS AS NUMBER) >= 60 THEN 'SANGAT_LOYAL'
                WHEN CAST(LOS AS NUMBER) >= 36 THEN 'LOYAL'
                WHEN CAST(LOS AS NUMBER) >= 24 THEN 'BERKOMITMEN'
                WHEN CAST(LOS AS NUMBER) >= 12 THEN 'MAPAN'
                WHEN CAST(LOS AS NUMBER) >= 6 THEN 'BERKEMBANG'
                ELSE 'PELANGGAN_BARU'
            END as LOYALTY_CATEGORY,

            -- Program loyalty participation
            CASE
                WHEN LOY_PROGRAM IS NOT NULL AND LOY_PROGRAM != '' THEN 'PROGRAM_LOYALITAS_AKTIF'
                ELSE 'TANPA_PROGRAM_LOYALITAS'
            END as LOYALTY_PROGRAM_STATUS,

            -- Customer retention risk
            CASE
                WHEN CAST(LOS AS NUMBER) >= 60 AND NVL(TREMS_REV_REF, 0) >= 300000 AND NVL(ADDON_TOTAL, 0) >= 2 THEN 'RISIKO_RENDAH'
                WHEN CAST(LOS AS NUMBER) >= 36 AND NVL(TREMS_REV_REF, 0) >= 200000 THEN 'RISIKO_MENENGAH_RENDAH'
                WHEN CAST(LOS AS NUMBER) >= 24 AND NVL(TREMS_REV_REF, 0) >= 150000 THEN 'RISIKO_MENENGAH'
                WHEN CAST(LOS AS NUMBER) >= 12 THEN 'RISIKO_MENENGAH_TINGGI'
                WHEN CAST(LOS AS NUMBER) >= 6 THEN 'RISIKO_TINGGI'
                ELSE 'RISIKO_SANGAT_TINGGI'
            END as CHURN_RISK_CATEGORY,

            -- Loyalty value classification
            CASE
                WHEN CAST(LOS AS NUMBER) >= 60 AND NVL(TREMS_REV_REF, 0) >= 500000 THEN 'PELANGGAN_LOYAL_PREMIUM'
                WHEN CAST(LOS AS NUMBER) >= 36 AND NVL(TREMS_REV_REF, 0) >= 300000 THEN 'PELANGGAN_LOYAL_TINGGI'
                WHEN CAST(LOS AS NUMBER) >= 24 AND NVL(TREMS_REV_REF, 0) >= 200000 THEN 'PELANGGAN_LOYAL_SEDANG'
                WHEN CAST(LOS AS NUMBER) >= 12 AND NVL(TREMS_REV_REF, 0) >= 150000 THEN 'PELANGGAN_LOYAL_STANDAR'
                WHEN CAST(LOS AS NUMBER) >= 12 THEN 'PELANGGAN_LOYAL'
                ELSE 'PELANGGAN_BERKEMBANG'
            END as LOYALTY_VALUE_SEGMENT,

            -- Service evolution pattern
            CASE
                WHEN CAST(LOS AS NUMBER) >= 36 AND NVL(ADDON_TOTAL, 0) >= 3 THEN 'EKSPANSI_LAYANAN'
                WHEN CAST(LOS AS NUMBER) >= 24 AND NVL(ADDON_TOTAL, 0) >= 2 THEN 'ADOPSI_LAYANAN'
                WHEN CAST(LOS AS NUMBER) >= 12 AND NVL(ADDON_TOTAL, 0) >= 1 THEN 'EKSPLORASI_LAYANAN'
                WHEN CAST(LOS AS NUMBER) >= 36 AND NVL(ADDON_TOTAL, 0) = 0 THEN 'KONSERVATIF_LAYANAN'
                ELSE 'LAYANAN_DASAR'
            END as SERVICE_EVOLUTION_PATTERN,

            -- Digital loyalty behavior
            CASE
                WHEN P_DIGITAL = '1' AND CAST(LOS AS NUMBER) >= 24 AND NVL(ADDON_TOTAL, 0) >= 2 THEN 'ADOPTER_DIGITAL_LOYAL'
                WHEN P_DIGITAL = '1' AND CAST(LOS AS NUMBER) >= 12 THEN 'DIGITAL_LOYAL_DASAR'
                WHEN CAST(LOS AS NUMBER) >= 36 AND NVL(ADDON_TOTAL, 0) >= 2 THEN 'ANALOG_LOYAL_LANJUT'
                WHEN CAST(LOS AS NUMBER) >= 24 THEN 'ANALOG_LOYAL_STANDAR'
                ELSE 'PELANGGAN_TRADISIONAL'
            END as DIGITAL_LOYALTY_TYPE
            
        FROM (
            SELECT * FROM DWH_MOIS.BRIGHTAI_DAPROS
            WHERE PLBLCL IN ('BL', 'CL')
              AND CITEM NOT LIKE '%W/%'
              AND CITEM NOT LIKE '%WM%'
              AND LOS IS NOT NULL
              AND CAST(LOS AS NUMBER) >= 0
        )
    )
    
    SELECT 
        LOYALTY_CATEGORY,
        LOYALTY_PROGRAM_STATUS,
        CHURN_RISK_CATEGORY,
        LOYALTY_VALUE_SEGMENT,
        SERVICE_EVOLUTION_PATTERN,
        DIGITAL_LOYALTY_TYPE,
        PLBLCL as CUSTOMER_TYPE,
        REGIONAL,
        WITEL,
        TELDA,
        COUNT(*) as CUSTOMER_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        
        -- Loyalty metrics
        ROUND(AVG(LOS_NUM), 1) as AVG_TENURE_MONTHS,
        ROUND(MIN(LOS_NUM), 0) as MIN_TENURE_MONTHS,
        ROUND(MAX(LOS_NUM), 0) as MAX_TENURE_MONTHS,
        ROUND(STDDEV(LOS_NUM), 1) as STDDEV_TENURE_MONTHS,
        
        -- Revenue performance per loyalty
        ROUND(AVG(REV_HSI), 0) as AVG_HSI_REVENUE,
        ROUND(AVG(REV_TOTAL), 0) as AVG_TOTAL_REVENUE,
        ROUND(SUM(REV_HSI), 0) as TOTAL_HSI_CONTRIBUTION,
        ROUND(AVG(REV_HSI / NULLIF(LOS_NUM, 0)), 0) as AVG_MONTHLY_REVENUE_RATE,
        
        -- Service adoption per loyalty
        ROUND(AVG(SPEED_NUM/1000), 0) as AVG_SPEED_MBPS,
        ROUND(AVG(ADDON_COUNT), 1) as AVG_ADDON_COUNT,
        ROUND(AVG(ADDON_REV), 0) as AVG_ADDON_REVENUE,
        
        -- Loyalty program effectiveness
        ROUND(SUM(CASE WHEN LOY_PROGRAM IS NOT NULL AND LOY_PROGRAM != '' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as LOYALTY_PROGRAM_PENETRATION,
        ROUND(SUM(CASE WHEN P_DIGITAL = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as DIGITAL_PROGRAM_PENETRATION,
        
        -- Service penetration per loyalty level
        ROUND(SUM(CASE WHEN IS_POTS = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as POTS_PENETRATION,
        ROUND(SUM(CASE WHEN IS_IPTV = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as IPTV_PENETRATION,
        ROUND(SUM(CASE WHEN IS_POTS = '1' AND IS_IPTV = '1' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as TRIPLE_PLAY_PENETRATION,
        
        -- Customer lifetime value indicators
        ROUND(AVG(REV_HSI * LOS_NUM), 0) as AVG_CUSTOMER_LIFETIME_VALUE,
        ROUND(SUM(REV_HSI * LOS_NUM), 0) as TOTAL_CUSTOMER_LIFETIME_VALUE,
        
        -- Loyalty behavior indicators
        ROUND(SUM(CASE WHEN KW_IH = '4' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as ACTIVE_BILLING_USAGE_RATE,
        ROUND(SUM(CASE WHEN SPEED_NUM >= 50000 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as HIGH_SPEED_ADOPTION_RATE,
        ROUND(SUM(CASE WHEN ADDON_COUNT >= 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as MULTI_ADDON_ADOPTION_RATE,
        
        -- Geographic loyalty distribution
        COUNT(DISTINCT TELDA) as TELDA_COVERAGE,
        COUNT(DISTINCT STO) as STO_COVERAGE,
        
        -- Loyalty progression metrics
        ROUND(SUM(CASE WHEN LOS_NUM >= 36 AND ADDON_COUNT > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN LOS_NUM >= 36 THEN 1 ELSE 0 END), 0), 2) as LOYAL_CUST_SVC_EXPANSION_RATE,
        ROUND(SUM(CASE WHEN LOS_NUM >= 24 AND REV_HSI >= 200000 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN LOS_NUM >= 24 THEN 1 ELSE 0 END), 0), 2) as ESTABLISHED_CUST_VALUE_RATE
        
    FROM HSI_LOYALTY_BASE
    GROUP BY LOYALTY_CATEGORY, LOYALTY_PROGRAM_STATUS, CHURN_RISK_CATEGORY, 
             LOYALTY_VALUE_SEGMENT, SERVICE_EVOLUTION_PATTERN, DIGITAL_LOYALTY_TYPE, PLBLCL, REGIONAL, WITEL, TELDA
    ORDER BY AVG_TENURE_MONTHS DESC, TOTAL_HSI_CONTRIBUTION DESC
  `,

  BUSINESS_LOGIC: {
    analyzeLoyaltyTrends: function(data) {
      const loyaltyAnalysis = data.reduce((acc, record) => {
        const category = record.LOYALTY_CATEGORY;
        if (!acc[category]) {
          acc[category] = {
            total_customers: 0,
            total_revenue: 0,
            total_ltv: 0,
            avg_tenure: 0,
            churn_risk_distribution: {},
            service_evolution: {}
          };
        }
        acc[category].total_customers += record.CUSTOMER_COUNT;
        acc[category].total_revenue += record.TOTAL_HSI_CONTRIBUTION;
        acc[category].total_ltv += record.TOTAL_CUSTOMER_LIFETIME_VALUE;
        acc[category].avg_tenure += record.AVG_TENURE_MONTHS * record.CUSTOMER_COUNT;
        return acc;
      }, {});

      // Calculate weighted averages
      Object.keys(loyaltyAnalysis).forEach(category => {
        const l = loyaltyAnalysis[category];
        l.avg_arpu = Math.round(l.total_revenue / l.total_customers);
        l.avg_ltv = Math.round(l.total_ltv / l.total_customers);
        l.weighted_avg_tenure = (l.avg_tenure / l.total_customers).toFixed(1);
        l.customer_share = ((l.total_customers / data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)) * 100).toFixed(1);
        l.revenue_share = ((l.total_revenue / data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0)) * 100).toFixed(1);
      });

      return loyaltyAnalysis;
    },

    identifyLoyaltyOpportunities: function(data) {
      const opportunities = [];
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      // High risk customers with good tenure
      const highRiskEstablished = data.filter(d => 
        ['RISIKO_TINGGI', 'RISIKO_SANGAT_TINGGI'].includes(d.CHURN_RISK_CATEGORY) &&
        ['MAPAN', 'BERKOMITMEN'].includes(d.LOYALTY_CATEGORY)
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      if (highRiskEstablished > 0) {
        opportunities.push({
          segment: 'High Risk Established Customers',
          count: highRiskEstablished,
          percentage: ((highRiskEstablished / totalCustomers) * 100).toFixed(1),
          opportunity: 'Proactive retention program untuk pelanggan mapan dengan risiko tinggi',
          priority: 'CRITICAL',
          potential: 'CHURN_PREVENTION'
        });
      }

      // Loyal customers without loyalty program
      const loyalWithoutProgram = data.filter(d => 
        ['SANGAT_LOYAL', 'LOYAL'].includes(d.LOYALTY_CATEGORY) &&
        d.LOYALTY_PROGRAM_STATUS === 'TANPA_PROGRAM_LOYALITAS'
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      if (loyalWithoutProgram > 0) {
        opportunities.push({
          segment: 'Loyal Customers Without Program',
          count: loyalWithoutProgram,
          percentage: ((loyalWithoutProgram / totalCustomers) * 100).toFixed(1),
          opportunity: 'Enrollment ke loyalty program untuk maximize retention',
          priority: 'HIGH',
          potential: 'PROGRAM_EXPANSION'
        });
      }

      // Conservative service users with good loyalty
      const conservativeLoyalCustomers = data.filter(d => 
        d.SERVICE_EVOLUTION_PATTERN === 'KONSERVATIF_LAYANAN' &&
        ['SANGAT_LOYAL', 'LOYAL', 'BERKOMITMEN'].includes(d.LOYALTY_CATEGORY)
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      if (conservativeLoyalCustomers > 0) {
        opportunities.push({
          segment: 'Conservative Loyal Customers',
          count: conservativeLoyalCustomers,
          percentage: ((conservativeLoyalCustomers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Service expansion program untuk loyal customers dengan layanan konservatif',
          priority: 'MEDIUM',
          potential: 'REVENUE_GROWTH'
        });
      }

      return opportunities;
    },

    generateLoyaltyStrategy: function(loyaltyCategory) {
      const strategies = {
        'SANGAT_LOYAL': {
          focus: 'VIP treatment and advocacy development',
          characteristics: '60+ months tenure, highest loyalty tier',
          strategies: [
            'VIP customer program dengan exclusive benefits',
            'Customer advocacy dan referral programs',
            'Early access ke new products dan services',
            'Personalized relationship management'
          ],
          retention_approach: 'Relationship deepening dan value maximization'
        },
        'LOYAL': {
          focus: 'Value enhancement and loyalty reinforcement',
          characteristics: '36-59 months tenure, strong loyalty foundation',
          strategies: [
            'Premium service packages dan upgrades',
            'Loyalty reward programs enhancement',
            'Cross-selling opportunities optimization',
            'Community building initiatives'
          ],
          retention_approach: 'Value proposition strengthening'
        },
        'BERKOMITMEN': {
          focus: 'Loyalty deepening and service expansion',
          characteristics: '24-35 months tenure, committed relationship',
          strategies: [
            'Service bundle optimization',
            'Loyalty milestone recognition programs',
            'Proactive customer care improvements',
            'Usage-based incentive programs'
          ],
          retention_approach: 'Commitment to loyalty transition'
        },
        'MAPAN': {
          focus: 'Stability maintenance and growth encouragement',
          characteristics: '12-23 months tenure, established relationship',
          strategies: [
            'Stable service delivery assurance',
            'Growth incentive programs',
            'Service education dan optimization',
            'Consistent customer experience'
          ],
          retention_approach: 'Stability to commitment progression'
        },
        'BERKEMBANG': {
          focus: 'Relationship building and value demonstration',
          characteristics: '6-11 months tenure, developing relationship',
          strategies: [
            'Onboarding excellence programs',
            'Value demonstration initiatives',
            'Regular satisfaction monitoring',
            'Service adoption encouragement'
          ],
          retention_approach: 'Development to establishment transition'
        },
        'PELANGGAN_BARU': {
          focus: 'First impression excellence and quick wins',
          characteristics: '0-5 months tenure, new relationship',
          strategies: [
            'White-glove onboarding experience',
            'Quick value realization programs',
            'Proactive support dan guidance',
            'Early loyalty program enrollment'
          ],
          retention_approach: 'Critical first 6 months success'
        }
      };

      return strategies[loyaltyCategory] || {
        focus: 'General loyalty development',
        characteristics: 'Mixed loyalty characteristics',
        strategies: ['Develop tenure-specific approach'],
        retention_approach: 'Customized retention strategy'
      };
    },

    calculateLoyaltyScore: function(record) {
      let score = 0;
      
      // Tenure score (40%)
      const tenureScore = {
        'SANGAT_LOYAL': 40,
        'LOYAL': 32,
        'BERKOMITMEN': 25,
        'MAPAN': 18,
        'BERKEMBANG': 10,
        'PELANGGAN_BARU': 5
      };
      score += (tenureScore[record.LOYALTY_CATEGORY] || 0);

      // Churn risk score (30% - inverted, lower risk = higher score)
      const riskScore = {
        'RISIKO_RENDAH': 30,
        'RISIKO_MENENGAH_RENDAH': 25,
        'RISIKO_MENENGAH': 18,
        'RISIKO_MENENGAH_TINGGI': 12,
        'RISIKO_TINGGI': 6,
        'RISIKO_SANGAT_TINGGI': 2
      };
      score += (riskScore[record.CHURN_RISK_CATEGORY] || 0);

      // Service evolution score (30%)
      const evolutionScore = {
        'EKSPANSI_LAYANAN': 30,
        'ADOPSI_LAYANAN': 24,
        'EKSPLORASI_LAYANAN': 18,
        'KONSERVATIF_LAYANAN': 12,
        'LAYANAN_DASAR': 6
      };
      score += (evolutionScore[record.SERVICE_EVOLUTION_PATTERN] || 0);

      return Math.round(score);
    },

    predictLoyaltyTrend: function(data) {
      const trends = {
        loyalty_maturation_rate: 0,
        program_effectiveness: 0,
        digital_loyalty_adoption: 0,
        at_risk_segments: []
      };

      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);

      // Loyalty maturation rate (customers with 24+ months)
      const matureCustomers = data.filter(d => 
        ['SANGAT_LOYAL', 'LOYAL', 'BERKOMITMEN'].includes(d.LOYALTY_CATEGORY)
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      trends.loyalty_maturation_rate = ((matureCustomers / totalCustomers) * 100).toFixed(1);

      // Program effectiveness (program participants with good loyalty)
      const programLoyalCustomers = data.filter(d => 
        d.LOYALTY_PROGRAM_STATUS === 'PROGRAM_LOYALITAS_AKTIF' &&
        ['SANGAT_LOYAL', 'LOYAL', 'BERKOMITMEN'].includes(d.LOYALTY_CATEGORY)
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      const totalProgramCustomers = data.filter(d => 
        d.LOYALTY_PROGRAM_STATUS === 'PROGRAM_LOYALITAS_AKTIF'
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (totalProgramCustomers > 0) {
        trends.program_effectiveness = ((programLoyalCustomers / totalProgramCustomers) * 100).toFixed(1);
      }

      // Digital loyalty adoption
      const digitalLoyalCustomers = data.filter(d => 
        ['ADOPTER_DIGITAL_LOYAL', 'DIGITAL_LOYAL_DASAR'].includes(d.DIGITAL_LOYALTY_TYPE)
      ).reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      trends.digital_loyalty_adoption = ((digitalLoyalCustomers / totalCustomers) * 100).toFixed(1);

      return trends;
    },

    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const totalHSIRevenue = data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0);
      const totalCustomerLTV = data.reduce((sum, d) => sum + d.TOTAL_CUSTOMER_LIFETIME_VALUE, 0);
      const avgTenureOverall = data.length > 0 ? 
        (data.reduce((sum, d) => sum + (d.AVG_TENURE_MONTHS * d.CUSTOMER_COUNT), 0) / totalCustomers).toFixed(1) : 0;
      
      const loyaltyTrends = this.analyzeLoyaltyTrends(data);
      const loyaltyOpportunities = this.identifyLoyaltyOpportunities(data);
      const loyaltyTrendPrediction = this.predictLoyaltyTrend(data);
      
      return {
        ringkasan: 'Analisis loyalitas pelanggan HSI berdasarkan masa berlangganan, program loyalitas dan retensi pelanggan',
        total_pelanggan_dianalisis: totalCustomers.toLocaleString('id-ID'),
        rata_rata_masa_berlangganan_keseluruhan: `${avgTenureOverall} bulan`,
        total_kontribusi_pendapatan_hsi: `Rp ${totalHSIRevenue.toLocaleString('id-ID')}`,
        total_nilai_seumur_hidup_pelanggan: `Rp ${totalCustomerLTV.toLocaleString('id-ID')}`,
        
        tren_loyalitas: {
          tingkat_kematangan_loyalitas: `${loyaltyTrendPrediction.loyalty_maturation_rate}%`,
          efektivitas_program: `${loyaltyTrendPrediction.program_effectiveness}%`,
          adopsi_loyalitas_digital: `${loyaltyTrendPrediction.digital_loyalty_adoption}%`
        },

        analisis_tren_loyalitas: loyaltyTrends,
        
        distribusi_kategori_loyalitas: {
          sangat_loyal: data.filter(d => d.LOYALTY_CATEGORY === 'SANGAT_LOYAL')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          loyal: data.filter(d => d.LOYALTY_CATEGORY === 'LOYAL')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          berkomitmen: data.filter(d => d.LOYALTY_CATEGORY === 'BERKOMITMEN')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          mapan: data.filter(d => d.LOYALTY_CATEGORY === 'MAPAN')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          berkembang: data.filter(d => d.LOYALTY_CATEGORY === 'BERKEMBANG')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pelanggan_baru: data.filter(d => d.LOYALTY_CATEGORY === 'PELANGGAN_BARU')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        kategori_risiko_churn: {
          risiko_rendah: data.filter(d => d.CHURN_RISK_CATEGORY === 'RISIKO_RENDAH')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          risiko_menengah_rendah: data.filter(d => d.CHURN_RISK_CATEGORY === 'RISIKO_MENENGAH_RENDAH')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          risiko_menengah: data.filter(d => d.CHURN_RISK_CATEGORY === 'RISIKO_MENENGAH')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          risiko_menengah_tinggi: data.filter(d => d.CHURN_RISK_CATEGORY === 'RISIKO_MENENGAH_TINGGI')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          risiko_tinggi: data.filter(d => d.CHURN_RISK_CATEGORY === 'RISIKO_TINGGI')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          risiko_sangat_tinggi: data.filter(d => d.CHURN_RISK_CATEGORY === 'RISIKO_SANGAT_TINGGI')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        segmen_nilai_loyalitas: {
          pelanggan_loyal_premium: data.filter(d => d.LOYALTY_VALUE_SEGMENT === 'PELANGGAN_LOYAL_PREMIUM')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pelanggan_loyal_tinggi: data.filter(d => d.LOYALTY_VALUE_SEGMENT === 'PELANGGAN_LOYAL_TINGGI')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pelanggan_loyal_sedang: data.filter(d => d.LOYALTY_VALUE_SEGMENT === 'PELANGGAN_LOYAL_SEDANG')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pelanggan_loyal_standar: data.filter(d => d.LOYALTY_VALUE_SEGMENT === 'PELANGGAN_LOYAL_STANDAR')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pelanggan_loyal: data.filter(d => d.LOYALTY_VALUE_SEGMENT === 'PELANGGAN_LOYAL')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pelanggan_berkembang: data.filter(d => d.LOYALTY_VALUE_SEGMENT === 'PELANGGAN_BERKEMBANG')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        pola_evolusi_layanan: {
          ekspansi_layanan: data.filter(d => d.SERVICE_EVOLUTION_PATTERN === 'EKSPANSI_LAYANAN')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          adopsi_layanan: data.filter(d => d.SERVICE_EVOLUTION_PATTERN === 'ADOPSI_LAYANAN')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          eksplorasi_layanan: data.filter(d => d.SERVICE_EVOLUTION_PATTERN === 'EKSPLORASI_LAYANAN')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          konservatif_layanan: data.filter(d => d.SERVICE_EVOLUTION_PATTERN === 'KONSERVATIF_LAYANAN')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          layanan_dasar: data.filter(d => d.SERVICE_EVOLUTION_PATTERN === 'LAYANAN_DASAR')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        tipe_loyalitas_digital: {
          adopter_digital_loyal: data.filter(d => d.DIGITAL_LOYALTY_TYPE === 'ADOPTER_DIGITAL_LOYAL')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          digital_loyal_dasar: data.filter(d => d.DIGITAL_LOYALTY_TYPE === 'DIGITAL_LOYAL_DASAR')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          analog_loyal_lanjut: data.filter(d => d.DIGITAL_LOYALTY_TYPE === 'ANALOG_LOYAL_LANJUT')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          analog_loyal_standar: data.filter(d => d.DIGITAL_LOYALTY_TYPE === 'ANALOG_LOYAL_STANDAR')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          pelanggan_tradisional: data.filter(d => d.DIGITAL_LOYALTY_TYPE === 'PELANGGAN_TRADISIONAL')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },

        peluang_loyalitas: loyaltyOpportunities,
        
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
        
        metrik_perilaku_loyalitas: {
          rata_rata_tingkat_billing_usage_aktif: data.length > 0 ? 
            (data.reduce((sum, d) => sum + d.ACTIVE_BILLING_USAGE_RATE, 0) / data.length).toFixed(2) + '%' : '0%',
          rata_rata_tingkat_adopsi_kecepatan_tinggi: data.length > 0 ? 
            (data.reduce((sum, d) => sum + d.HIGH_SPEED_ADOPTION_RATE, 0) / data.length).toFixed(2) + '%' : '0%',
          rata_rata_tingkat_adopsi_multi_addon: data.length > 0 ? 
            (data.reduce((sum, d) => sum + d.MULTI_ADDON_ADOPTION_RATE, 0) / data.length).toFixed(2) + '%' : '0%',
          rata_rata_tingkat_ekspansi_layanan_loyal: data.length > 0 ?
            (data.reduce((sum, d) => sum + (d.LOYAL_CUST_SVC_EXPANSION_RATE || 0), 0) / data.length).toFixed(2) + '%' : '0%',
          rata_rata_tingkat_nilai_pelanggan_mapan: data.length > 0 ?
            (data.reduce((sum, d) => sum + (d.ESTABLISHED_CUST_VALUE_RATE || 0), 0) / data.length).toFixed(2) + '%' : '0%'
        },
        
        wawasan_bisnis: [
          'Identifikasi pelanggan dengan masa berlangganan tinggi dan kontribusi pendapatan optimal',
          'Analisis efektivitas program loyalitas terhadap retensi pelanggan',
          'Evaluasi pola evolusi layanan pelanggan berdasarkan masa berlangganan',
          'Pemetaan risiko churn pelanggan berdasarkan masa berlangganan dan perilaku pengeluaran',
          'Strategi loyalitas bertingkat untuk maximize customer lifetime value'
        ],
        
        detail_analisis_loyalitas: data.map(loyalty => ({
          kategori_loyalitas: loyalty.LOYALTY_CATEGORY,
          status_program_loyalitas: loyalty.LOYALTY_PROGRAM_STATUS,
          kategori_risiko_churn: loyalty.CHURN_RISK_CATEGORY,
          segmen_nilai_loyalitas: loyalty.LOYALTY_VALUE_SEGMENT,
          pola_evolusi_layanan: loyalty.SERVICE_EVOLUTION_PATTERN,
          tipe_loyalitas_digital: loyalty.DIGITAL_LOYALTY_TYPE,
          tipe_pelanggan: loyalty.CUSTOMER_TYPE,
          regional: loyalty.REGIONAL,
          witel: loyalty.WITEL,
          telda: loyalty.TELDA,
          jumlah_pelanggan: loyalty.CUSTOMER_COUNT.toLocaleString('id-ID'),
          persentase: `${loyalty.PERCENTAGE}%`,
          rata_rata_masa_berlangganan: `${loyalty.AVG_TENURE_MONTHS} bulan`,
          masa_berlangganan_minimum: `${loyalty.MIN_TENURE_MONTHS} bulan`,
          masa_berlangganan_maksimum: `${loyalty.MAX_TENURE_MONTHS} bulan`,
          standar_deviasi_masa_berlangganan: `${loyalty.STDDEV_TENURE_MONTHS} bulan`,
          rata_rata_pendapatan_hsi: `Rp ${loyalty.AVG_HSI_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_pendapatan_total: `Rp ${loyalty.AVG_TOTAL_REVENUE.toLocaleString('id-ID')}`,
          total_kontribusi_hsi: `Rp ${loyalty.TOTAL_HSI_CONTRIBUTION.toLocaleString('id-ID')}`,
          tingkat_pendapatan_bulanan: `Rp ${loyalty.AVG_MONTHLY_REVENUE_RATE.toLocaleString('id-ID')}`,
          rata_rata_kecepatan: `${loyalty.AVG_SPEED_MBPS} Mbps`,
          rata_rata_jumlah_layanan_tambahan: loyalty.AVG_ADDON_COUNT,
          rata_rata_pendapatan_tambahan: `Rp ${loyalty.AVG_ADDON_REVENUE.toLocaleString('id-ID')}`,
          penetrasi_program_loyalitas: `${loyalty.LOYALTY_PROGRAM_PENETRATION}%`,
          penetrasi_program_digital: `${loyalty.DIGITAL_PROGRAM_PENETRATION}%`,
          penetrasi_telepon: `${loyalty.POTS_PENETRATION}%`,
          penetrasi_iptv: `${loyalty.IPTV_PENETRATION}%`,
          penetrasi_triple_play: `${loyalty.TRIPLE_PLAY_PENETRATION}%`,
          rata_rata_nilai_seumur_hidup_pelanggan: `Rp ${loyalty.AVG_CUSTOMER_LIFETIME_VALUE.toLocaleString('id-ID')}`,
          total_nilai_seumur_hidup_pelanggan: `Rp ${loyalty.TOTAL_CUSTOMER_LIFETIME_VALUE.toLocaleString('id-ID')}`,
          tingkat_billing_usage_aktif: `${loyalty.ACTIVE_BILLING_USAGE_RATE}%`,
          tingkat_adopsi_kecepatan_tinggi: `${loyalty.HIGH_SPEED_ADOPTION_RATE}%`,
          tingkat_adopsi_multi_addon: `${loyalty.MULTI_ADDON_ADOPTION_RATE}%`,
          tingkat_ekspansi_layanan_loyal: `${loyalty.LOYAL_CUST_SVC_EXPANSION_RATE || 0}%`,
          tingkat_nilai_pelanggan_mapan: `${loyalty.ESTABLISHED_CUST_VALUE_RATE || 0}%`,
          cakupan_telda: loyalty.TELDA_COVERAGE,
          cakupan_sto: loyalty.STO_COVERAGE,
          skor_loyalitas: this.calculateLoyaltyScore(loyalty),
          strategi_loyalitas: this.generateLoyaltyStrategy(loyalty.LOYALTY_CATEGORY)
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
        focus_area: 'customer_loyalty_analysis'
      };
    },
    
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};