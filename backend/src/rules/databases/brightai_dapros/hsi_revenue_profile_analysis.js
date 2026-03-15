const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'dapros_004',
    RULE_NAME: 'hsi_revenue_profile_analysis',
    DESCRIPTION: 'Analisis profil revenue customer HSI berdasarkan kontribusi dan pola pembayaran',
    DATABASE: 'BRIGHTAI_DAPROS',
    CATEGORY: 'revenue_profile_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_DAPROS"),

  KEYWORD_PATTERNS: {
    primary: [
      'revenue profile hsi', 'analisis revenue', 'profil pendapatan',
      'revenue analysis', 'customer revenue', 'arpu analysis',
      'kontribusi revenue', 'revenue contribution', 'revenue pattern hsi', 'analisis pendapatan'
    ],
    
    supporting: [
      'revenue', 'pendapatan', 'arpu', 'kontribusi', 'billing', 'payment',
      'income', 'financial', 'monetisasi', 'value', 'contribution',
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
        score = 85 + (primaryMatches * 8) + (supportingMatches * 2);
      } else if (supportingMatches >= 3) {
        score = 70 + (supportingMatches * 3);
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_REVENUE_BASE AS (
        SELECT 
            NOTEL, NCLI, PLBLCL, REGIONAL, WITEL, STO, TELDA,
            CAST(SPEED AS NUMBER) as SPEED_NUM,
            CAST(LOS AS NUMBER) as LOS_NUM,
            NVL(TREMS_REV_REF, 0) as REV_HSI,
            NVL(TREMS_REV_P, 0) as REV_TOTAL,
            NVL(ADDON_TOTAL, 0) as ADDON_COUNT,
            NVL(ADDON_PRICE, 0) as ADDON_REV,
            IS_POTS, IS_IPTV, IS_DINAS, KW_IH,
            PACK_NAME, ASSET_STATUS,
            
            -- Revenue tier berdasarkan HSI
            CASE 
                WHEN REV_HSI >= 800000 THEN 'ULTRA_HIGH_VALUE'
                WHEN REV_HSI >= 500000 THEN 'HIGH_VALUE'
                WHEN REV_HSI >= 300000 THEN 'MEDIUM_VALUE'
                WHEN REV_HSI >= 150000 THEN 'STANDARD_VALUE'
                WHEN REV_HSI >= 50000 THEN 'ENTRY_VALUE'
                ELSE 'LOW_VALUE'
            END as HSI_REVENUE_TIER,
            
            -- Add-on revenue contribution
            CASE 
                WHEN ADDON_REV >= 200000 THEN 'HIGH_ADDON_REVENUE'
                WHEN ADDON_REV >= 100000 THEN 'MEDIUM_ADDON_REVENUE'
                WHEN ADDON_REV >= 50000 THEN 'LOW_ADDON_REVENUE'
                ELSE 'NO_ADDON_REVENUE'
            END as ADDON_REVENUE_TIER,
            
            -- Total revenue classification
            CASE 
                WHEN REV_TOTAL >= 1000000 THEN 'ENTERPRISE_LEVEL'
                WHEN REV_TOTAL >= 600000 THEN 'PREMIUM_LEVEL'
                WHEN REV_TOTAL >= 300000 THEN 'STANDARD_LEVEL'
                ELSE 'BASIC_LEVEL'
            END as TOTAL_REVENUE_TIER,
            
            -- Revenue efficiency (per Mbps)
            CASE 
                WHEN SPEED_NUM > 0 THEN
                    CASE 
                        WHEN (REV_HSI / (SPEED_NUM/1000)) >= 20000 THEN 'HIGH_EFFICIENCY'
                        WHEN (REV_HSI / (SPEED_NUM/1000)) >= 10000 THEN 'MEDIUM_EFFICIENCY'
                        WHEN (REV_HSI / (SPEED_NUM/1000)) >= 5000 THEN 'STANDARD_EFFICIENCY'
                        ELSE 'LOW_EFFICIENCY'
                    END
                ELSE 'UNDEFINED_EFFICIENCY'
            END as REVENUE_EFFICIENCY,
            
            -- Customer lifetime value indicator
            CASE 
                WHEN LOS_NUM >= 60 AND REV_HSI >= 400000 THEN 'HIGH_LTV'
                WHEN LOS_NUM >= 36 AND REV_HSI >= 250000 THEN 'MEDIUM_LTV'
                WHEN LOS_NUM >= 24 AND REV_HSI >= 150000 THEN 'STANDARD_LTV'
                WHEN LOS_NUM >= 12 THEN 'DEVELOPING_LTV'
                ELSE 'NEW_LTV'
            END as LTV_CATEGORY,
            
            -- Billing activity profile
            CASE 
                WHEN KW_IH = '4' AND REV_HSI >= 300000 THEN 'ACTIVE_HIGH_SPENDER'
                WHEN KW_IH = '4' AND REV_HSI >= 150000 THEN 'ACTIVE_MEDIUM_SPENDER'
                WHEN KW_IH = '4' THEN 'ACTIVE_STANDARD_SPENDER'
                WHEN KW_IH = '3' THEN 'USAGE_ONLY_CUSTOMER'
                WHEN KW_IH = '2' THEN 'BILLING_ONLY_CUSTOMER'
                ELSE 'INACTIVE_CUSTOMER'
            END as BILLING_PROFILE
            
        FROM (
            SELECT * FROM DWH_MOIS.BRIGHTAI_DAPROS
            WHERE PLBLCL IN ('BL', 'CL')
              AND CITEM NOT LIKE '%W/%'
              AND CITEM NOT LIKE '%WM%'
              AND ASSET_STATUS IN ('ACTIVE', 'NORMAL')
        )
    )
    
    SELECT 
        HSI_REVENUE_TIER,
        ADDON_REVENUE_TIER,
        TOTAL_REVENUE_TIER,
        REVENUE_EFFICIENCY,
        LTV_CATEGORY,
        BILLING_PROFILE,
        PLBLCL as CUSTOMER_TYPE,
        REGIONAL,
        WITEL,
        TELDA,
        COUNT(*) as CUSTOMER_COUNT,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as PERCENTAGE,
        
        -- Revenue metrics
        ROUND(AVG(REV_HSI), 0) as AVG_HSI_REVENUE,
        ROUND(AVG(REV_TOTAL), 0) as AVG_TOTAL_REVENUE,
        ROUND(AVG(ADDON_REV), 0) as AVG_ADDON_REVENUE,
        ROUND(SUM(REV_HSI), 0) as TOTAL_HSI_CONTRIBUTION,
        ROUND(SUM(REV_TOTAL), 0) as TOTAL_REVENUE_CONTRIBUTION,
        
        -- Performance metrics
        ROUND(AVG(SPEED_NUM/1000), 0) as AVG_SPEED_MBPS,
        ROUND(AVG(LOS_NUM), 0) as AVG_TENURE_MONTHS,
        ROUND(AVG(ADDON_COUNT), 1) as AVG_ADDON_COUNT,
        
        -- Revenue efficiency
        ROUND(AVG(CASE WHEN SPEED_NUM > 0 THEN REV_HSI / (SPEED_NUM/1000) ELSE 0 END), 0) as AVG_REVENUE_PER_MBPS,
        ROUND(AVG(REV_HSI / NULLIF(LOS_NUM, 0)), 0) as AVG_MONTHLY_REVENUE_RATE,
        
        -- Coverage
        COUNT(DISTINCT TELDA) as TELDA_COVERAGE,
        COUNT(DISTINCT STO) as STO_COVERAGE
        
    FROM HSI_REVENUE_BASE
    GROUP BY HSI_REVENUE_TIER, ADDON_REVENUE_TIER, TOTAL_REVENUE_TIER, 
             REVENUE_EFFICIENCY, LTV_CATEGORY, BILLING_PROFILE, PLBLCL, REGIONAL, WITEL, TELDA
    ORDER BY TOTAL_HSI_CONTRIBUTION DESC
  `,

  BUSINESS_LOGIC: {
    analyzeRevenueDistribution: function(data) {
      const revenueAnalysis = data.reduce((acc, record) => {
        const tier = record.HSI_REVENUE_TIER;
        if (!acc[tier]) {
          acc[tier] = {
            customer_count: 0,
            total_revenue: 0,
            avg_arpu: 0,
            avg_efficiency: 0,
            revenue_contribution_pct: 0
          };
        }
        acc[tier].customer_count += record.CUSTOMER_COUNT;
        acc[tier].total_revenue += record.TOTAL_HSI_CONTRIBUTION;
        return acc;
      }, {});

      const totalRevenue = Object.values(revenueAnalysis).reduce((sum, tier) => sum + tier.total_revenue, 0);
      const totalCustomers = Object.values(revenueAnalysis).reduce((sum, tier) => sum + tier.customer_count, 0);

      // Calculate percentages and averages
      Object.keys(revenueAnalysis).forEach(tier => {
        const t = revenueAnalysis[tier];
        t.avg_arpu = Math.round(t.total_revenue / t.customer_count);
        t.revenue_contribution_pct = ((t.total_revenue / totalRevenue) * 100).toFixed(1);
        t.customer_percentage = ((t.customer_count / totalCustomers) * 100).toFixed(1);
      });

      return revenueAnalysis;
    },

    identifyRevenueOpportunities: function(data) {
      const opportunities = [];
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0);

      // Low value customers with high potential
      const lowValueCustomers = data.filter(d => d.HSI_REVENUE_TIER === 'LOW_VALUE' || d.HSI_REVENUE_TIER === 'ENTRY_VALUE')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (lowValueCustomers / totalCustomers > 0.4) {
        opportunities.push({
          segment: 'Low Value Customers',
          count: lowValueCustomers,
          percentage: ((lowValueCustomers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Revenue upgrade program - migrate ke higher value tiers',
          potential_impact: 'HIGH',
          priority: 'HIGH'
        });
      }

      // No addon revenue customers
      const noAddonCustomers = data.filter(d => d.ADDON_REVENUE_TIER === 'NO_ADDON_REVENUE')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (noAddonCustomers > 0) {
        opportunities.push({
          segment: 'No Addon Revenue Customers',
          count: noAddonCustomers,
          percentage: ((noAddonCustomers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Addon monetization - introduce value-added services',
          potential_impact: 'MEDIUM',
          priority: 'MEDIUM'
        });
      }

      // Low efficiency customers
      const lowEfficiencyCustomers = data.filter(d => d.REVENUE_EFFICIENCY === 'LOW_EFFICIENCY')
        .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      if (lowEfficiencyCustomers > 0) {
        opportunities.push({
          segment: 'Low Revenue Efficiency Customers',
          count: lowEfficiencyCustomers,
          percentage: ((lowEfficiencyCustomers / totalCustomers) * 100).toFixed(1),
          opportunity: 'Price optimization - improve revenue per Mbps ratio',
          potential_impact: 'MEDIUM',
          priority: 'STRATEGIC'
        });
      }

      return opportunities;
    },

    calculateLTVScore: function(record) {
      const ltvScores = {
        'HIGH_LTV': 100,
        'MEDIUM_LTV': 75,
        'STANDARD_LTV': 50,
        'DEVELOPING_LTV': 25,
        'NEW_LTV': 10
      };
      return ltvScores[record.LTV_CATEGORY] || 0;
    },

    generateRevenueTierStrategy: function(tier) {
      const strategies = {
        'ULTRA_HIGH_VALUE': {
          focus: 'Premium retention and expansion',
          actions: [
            'VIP customer treatment dengan dedicated support',
            'Exclusive access ke premium services dan features',
            'Customized solution development',
            'Strategic partnership opportunities'
          ],
          retention_priority: 'CRITICAL'
        },
        'HIGH_VALUE': {
          focus: 'Value preservation and premium upsell',
          actions: [
            'Premium service bundle offerings',
            'Priority technical support',
            'Loyalty rewards program',
            'Advanced service feature access'
          ],
          retention_priority: 'HIGH'
        },
        'MEDIUM_VALUE': {
          focus: 'Revenue growth and service expansion',
          actions: [
            'Targeted upselling campaigns',
            'Bundle optimization programs',
            'Usage-based pricing models',
            'Service enhancement offerings'
          ],
          retention_priority: 'MEDIUM'
        },
        'STANDARD_VALUE': {
          focus: 'Efficiency improvement and value addition',
          actions: [
            'Value-for-money service packages',
            'Addon service introduction',
            'Cost optimization programs',
            'Service quality improvements'
          ],
          retention_priority: 'STANDARD'
        },
        'ENTRY_VALUE': {
          focus: 'Revenue growth and customer development',
          actions: [
            'Growth-oriented pricing plans',
            'Educational content dan service awareness',
            'Gradual service upgrade paths',
            'Loyalty building initiatives'
          ],
          retention_priority: 'DEVELOPMENT'
        },
        'LOW_VALUE': {
          focus: 'Customer development or churn prevention',
          actions: [
            'Basic service reliability assurance',
            'Cost-effective service offerings',
            'Simplified upgrade options',
            'Churn prevention campaigns'
          ],
          retention_priority: 'BASIC'
        }
      };

      return strategies[tier] || {
        focus: 'General revenue optimization',
        actions: ['Develop tier-specific strategy'],
        retention_priority: 'REVIEW'
      };
    },

    calculateRevenueMetrics: function(data) {
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const totalAddonRevenue = data.reduce((sum, d) => sum + (d.AVG_ADDON_REVENUE * d.CUSTOMER_COUNT), 0);

      return {
        overall_arpu: Math.round(totalRevenue / totalCustomers),
        addon_revenue_percentage: ((totalAddonRevenue / totalRevenue) * 100).toFixed(1),
        revenue_concentration: this.calculateRevenueConcentration(data),
        efficiency_score: this.calculateOverallEfficiency(data)
      };
    },

    calculateRevenueConcentration: function(data) {
      const highValueRevenue = data.filter(d => ['ULTRA_HIGH_VALUE', 'HIGH_VALUE'].includes(d.HSI_REVENUE_TIER))
        .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0);
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0);
      
      return ((highValueRevenue / totalRevenue) * 100).toFixed(1);
    },

    calculateOverallEfficiency: function(data) {
      const weightedEfficiency = data.reduce((sum, d) => {
        return sum + (d.AVG_REVENUE_PER_MBPS * d.CUSTOMER_COUNT);
      }, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      
      return Math.round(weightedEfficiency / totalCustomers);
    },

    formatIndonesianResponse: function(data) {
      const totalCustomers = data.reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0);
      const totalHSIRevenue = data.reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0);
      const revenueDistribution = this.analyzeRevenueDistribution(data);
      const revenueOpportunities = this.identifyRevenueOpportunities(data);
      const revenueMetrics = this.calculateRevenueMetrics(data);
      
      return {
        ringkasan: 'Analisis profil revenue customer HSI berdasarkan kontribusi dan pola pembayaran',
        total_pelanggan_dianalisis: totalCustomers.toLocaleString('id-ID'),
        total_kontribusi_revenue_hsi: `Rp ${totalHSIRevenue.toLocaleString('id-ID')}`,
        
        metrik_revenue_keseluruhan: {
          overall_arpu: `Rp ${revenueMetrics.overall_arpu.toLocaleString('id-ID')}`,
          addon_revenue_percentage: `${revenueMetrics.addon_revenue_percentage}%`,
          revenue_concentration_top_tier: `${revenueMetrics.revenue_concentration}%`,
          overall_efficiency_score: `Rp ${revenueMetrics.efficiency_score.toLocaleString('id-ID')}/Mbps`
        },

        analisis_distribusi_revenue: revenueDistribution,
        
        distribusi_hsi_revenue_tier: {
          ultra_high_value: data.filter(d => d.HSI_REVENUE_TIER === 'ULTRA_HIGH_VALUE')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          high_value: data.filter(d => d.HSI_REVENUE_TIER === 'HIGH_VALUE')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          medium_value: data.filter(d => d.HSI_REVENUE_TIER === 'MEDIUM_VALUE')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          standard_value: data.filter(d => d.HSI_REVENUE_TIER === 'STANDARD_VALUE')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          entry_value: data.filter(d => d.HSI_REVENUE_TIER === 'ENTRY_VALUE')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          low_value: data.filter(d => d.HSI_REVENUE_TIER === 'LOW_VALUE')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        kontribusi_addon_revenue: {
          high_addon_revenue: data.filter(d => d.ADDON_REVENUE_TIER === 'HIGH_ADDON_REVENUE')
            .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0),
          medium_addon_revenue: data.filter(d => d.ADDON_REVENUE_TIER === 'MEDIUM_ADDON_REVENUE')
            .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0),
          low_addon_revenue: data.filter(d => d.ADDON_REVENUE_TIER === 'LOW_ADDON_REVENUE')
            .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0),
          no_addon_revenue: data.filter(d => d.ADDON_REVENUE_TIER === 'NO_ADDON_REVENUE')
            .reduce((sum, d) => sum + d.TOTAL_HSI_CONTRIBUTION, 0)
        },
        
        customer_lifetime_value: {
          high_ltv: data.filter(d => d.LTV_CATEGORY === 'HIGH_LTV')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          medium_ltv: data.filter(d => d.LTV_CATEGORY === 'MEDIUM_LTV')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          standard_ltv: data.filter(d => d.LTV_CATEGORY === 'STANDARD_LTV')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          developing_ltv: data.filter(d => d.LTV_CATEGORY === 'DEVELOPING_LTV')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          new_ltv: data.filter(d => d.LTV_CATEGORY === 'NEW_LTV')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },
        
        efisiensi_revenue: {
          high_efficiency: data.filter(d => d.REVENUE_EFFICIENCY === 'HIGH_EFFICIENCY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          medium_efficiency: data.filter(d => d.REVENUE_EFFICIENCY === 'MEDIUM_EFFICIENCY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          standard_efficiency: data.filter(d => d.REVENUE_EFFICIENCY === 'STANDARD_EFFICIENCY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0),
          low_efficiency: data.filter(d => d.REVENUE_EFFICIENCY === 'LOW_EFFICIENCY')
            .reduce((sum, d) => sum + d.CUSTOMER_COUNT, 0)
        },

        peluang_revenue: revenueOpportunities,
        
        insight_bisnis: [
          'Identifikasi customer kontributor revenue tertinggi per segmen',
          'Analisis efisiensi revenue per unit kecepatan internet',
          'Evaluasi customer lifetime value berdasarkan tenure dan spending',
          'Pemetaan potensi revenue dari penetrasi add-on services',
          'Optimasi pricing strategy berdasarkan value tier analysis'
        ],
        
        detail_revenue_analysis: data.map(revenue => ({
          hsi_revenue_tier: revenue.HSI_REVENUE_TIER,
          addon_revenue_tier: revenue.ADDON_REVENUE_TIER,
          total_revenue_tier: revenue.TOTAL_REVENUE_TIER,
          revenue_efficiency: revenue.REVENUE_EFFICIENCY,
          ltv_category: revenue.LTV_CATEGORY,
          billing_profile: revenue.BILLING_PROFILE,
          customer_type: revenue.CUSTOMER_TYPE,
          regional: revenue.REGIONAL,
          witel: revenue.WITEL,
          telda: revenue.TELDA,
          jumlah_customer: revenue.CUSTOMER_COUNT.toLocaleString('id-ID'),
          persentase: `${revenue.PERCENTAGE}%`,
          rata_rata_hsi_revenue: `Rp ${revenue.AVG_HSI_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_total_revenue: `Rp ${revenue.AVG_TOTAL_REVENUE.toLocaleString('id-ID')}`,
          rata_rata_addon_revenue: `Rp ${revenue.AVG_ADDON_REVENUE.toLocaleString('id-ID')}`,
          total_kontribusi_hsi: `Rp ${revenue.TOTAL_HSI_CONTRIBUTION.toLocaleString('id-ID')}`,
          total_kontribusi_revenue: `Rp ${revenue.TOTAL_REVENUE_CONTRIBUTION.toLocaleString('id-ID')}`,
          rata_rata_speed: `${revenue.AVG_SPEED_MBPS} Mbps`,
          rata_rata_tenure: `${revenue.AVG_TENURE_MONTHS} bulan`,
          rata_rata_addon_count: revenue.AVG_ADDON_COUNT,
          revenue_per_mbps: `Rp ${revenue.AVG_REVENUE_PER_MBPS.toLocaleString('id-ID')}`,
          monthly_revenue_rate: `Rp ${revenue.AVG_MONTHLY_REVENUE_RATE.toLocaleString('id-ID')}`,
          cakupan_telda: revenue.TELDA_COVERAGE,
          cakupan_sto: revenue.STO_COVERAGE,
          ltv_score: this.calculateLTVScore(revenue),
          strategi_tier: this.generateRevenueTierStrategy(revenue.HSI_REVENUE_TIER)
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
        focus_area: 'revenue_profile_analysis'
      };
    },
    
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};