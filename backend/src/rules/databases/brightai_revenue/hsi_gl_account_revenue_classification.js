const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');
module.exports = {
  RULE_META: {
    RULE_ID: 'mart_005',
    RULE_NAME: 'hsi_gl_account_revenue_classification',
    DESCRIPTION: 'Analisis klasifikasi revenue HSI berdasarkan General Ledger Account dengan geographic breakdown',
    DATABASE: 'BRIGHTAI_REVENUE',
    CATEGORY: 'gl_account_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_REVENUE"),
  
  KEYWORD_PATTERNS: {
    primary: [
      'gl account hsi', 'general ledger hsi', 'akun pendapatan hsi',
      'klasifikasi gl hsi', 'analisis gl account internet', 'revenue gl hsi',
      'akun revenue hsi', 'classification gl hsi', 'kategori gl account hsi'
    ],
    supporting: [
      'gl', 'general', 'ledger', 'akun', 'pendapatan', 'account', 'klasifikasi',
      'classification', 'revenue', 'hsi', 'internet', 'analisis', 'kode',
      'financial', 'keuangan', 'pencatatan', 'kategori'
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
      } else if (supportingMatches >= 4) {
        score = 70 + (supportingMatches * 4);
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH GL_ACCOUNT_CLASSIFICATION AS (
        SELECT 
            GL_ACC,
            -- Enhanced GL Account categorization
            CASE 
                WHEN GL_ACC LIKE '004141%' THEN 'DEDICATED_INTERNET_SERVICES'
                WHEN GL_ACC LIKE '004111%' THEN 'BROADBAND_CONSUMER_SERVICES'  
                WHEN GL_ACC LIKE '004116%' THEN 'BUSINESS_INTERNET_SERVICES'
                WHEN GL_ACC LIKE '004117%' THEN 'PREMIUM_INTERNET_SERVICES'
                WHEN GL_ACC LIKE '004151%' THEN 'ENTERPRISE_INTERNET_SERVICES'
                WHEN GL_ACC LIKE '004171%' THEN 'VALUE_ADDED_SERVICES'
                WHEN GL_ACC LIKE '004162%' THEN 'MANAGED_SERVICES'
                WHEN GL_ACC LIKE '004171%' THEN 'ADDON_SERVICES'
                ELSE 'OTHER_HSI_SERVICES'
            END as GL_CATEGORY,
            
            -- Revenue type classification
            CASE 
                WHEN GL_ACC LIKE '%101' OR GL_ACC LIKE '%105' THEN 'BASIC_SUBSCRIPTION_REVENUE'
                WHEN GL_ACC LIKE '%143' OR GL_ACC LIKE '%139' THEN 'PREMIUM_SUBSCRIPTION_REVENUE'  
                WHEN GL_ACC LIKE '%723' OR GL_ACC LIKE '%722' THEN 'ADDON_REVENUE'
                WHEN GL_ACC LIKE '%694' OR GL_ACC LIKE '%705' THEN 'DEDICATED_SERVICE_REVENUE'
                WHEN GL_ACC LIKE '%625' OR GL_ACC LIKE '%510' THEN 'MANAGED_SERVICE_REVENUE'
                ELSE 'STANDARD_SERVICE_REVENUE'
            END as REVENUE_TYPE,
            
            -- Service tier classification
            CASE 
                WHEN GL_ACC LIKE '004141%' OR GL_ACC LIKE '004151%' THEN 'TIER_1_ENTERPRISE'
                WHEN GL_ACC LIKE '004117%' OR GL_ACC LIKE '004162%' THEN 'TIER_2_PREMIUM'
                WHEN GL_ACC LIKE '004116%' THEN 'TIER_3_BUSINESS'
                WHEN GL_ACC LIKE '004111%' THEN 'TIER_4_CONSUMER'
                ELSE 'TIER_5_OTHERS'
            END as SERVICE_TIER
            
        FROM (SELECT DISTINCT GL_ACC FROM PMSDBS.BRIGHTAI_REVENUE WHERE GROUP4 = 'High Speed Internet') gl_src
    )
    
    SELECT 
        p.YEAR_ID,
        p.MONTH_ID,
        p.REGIONAL_BILL,
        p.WITEL_BILL,
        p.GL_ACC,
        g.GL_CATEGORY,
        g.REVENUE_TYPE,
        g.SERVICE_TIER,
        
        -- Customer and Service Metrics
        COUNT(DISTINCT p.NIP_NAS) as TOTAL_PELANGGAN,
        COUNT(DISTINCT p.NIP_NAS) as TOTAL_NCLI,
        COUNT(DISTINCT p.NIP_NAS) as TOTAL_LAYANAN,
        
        -- Revenue Metrics
        SUM(p.REVENUE) as TOTAL_REVENUE,
        ROUND(AVG(p.REVENUE), 0) as AVG_REVENUE_PER_LAYANAN,
        ROUND(SUM(p.REVENUE) / NULLIF(COUNT(DISTINCT p.NIP_NAS), 0), 0) as REVENUE_PER_PELANGGAN,
        ROUND(SUM(p.REVENUE) / NULLIF(COUNT(DISTINCT p.NIP_NAS), 0), 0) as REVENUE_PER_NCLI,
        
        -- Revenue scaling distribution for this GL Account
        SUM(CASE WHEN p.FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN p.REVENUE ELSE 0 END) as NEW_REVENUE,
        SUM(CASE WHEN p.FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN p.REVENUE ELSE 0 END) as RECURRING_REVENUE,
        SUM(CASE WHEN p.FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN p.REVENUE ELSE 0 END) as SUSTAIN_REVENUE,
        
        -- Service value metrics
        COUNT(CASE WHEN p.REVENUE >= 500000 THEN 1 END) as HIGH_VALUE_SERVICES,
        COUNT(CASE WHEN p.REVENUE BETWEEN 100000 AND 499999 THEN 1 END) as MEDIUM_VALUE_SERVICES,
        COUNT(CASE WHEN p.REVENUE < 100000 THEN 1 END) as LOW_VALUE_SERVICES,
        
        -- Customer concentration per GL Account
        ROUND(COUNT(DISTINCT p.NIP_NAS) / NULLIF(COUNT(DISTINCT p.NIP_NAS), 0), 2) as SERVICES_PER_CUSTOMER,
        ROUND(COUNT(DISTINCT p.NIP_NAS) / NULLIF(COUNT(DISTINCT p.NIP_NAS), 0), 2) as SERVICES_PER_NCLI,
        
        -- Revenue efficiency
        ROUND(SUM(p.REVENUE) / NULLIF(COUNT(DISTINCT p.NIP_NAS), 0), 0) as REVENUE_EFFICIENCY_PER_SERVICE,
        
        -- Geographic coverage for this GL Account
        COUNT(DISTINCT p.WITEL_BILL) as WITEL_COVERAGE,
        COUNT(DISTINCT p.WITEL_BILL) as DATEL_COVERAGE
        
    FROM PMSDBS.BRIGHTAI_REVENUE p
    JOIN GL_ACCOUNT_CLASSIFICATION g ON p.GL_ACC = g.GL_ACC
    WHERE p.GROUP4 = 'High Speed Internet'
      AND p.REVENUE > 0
      AND p.REGIONAL_BILL IS NOT NULL
      AND p.WITEL_BILL IS NOT NULL
      AND p.NIP_NAS IS NOT NULL
    GROUP BY p.YEAR_ID, p.MONTH_ID, p.REGIONAL_BILL, p.WITEL_BILL,
             p.GL_ACC, g.GL_CATEGORY, g.REVENUE_TYPE, g.SERVICE_TIER
    ORDER BY p.YEAR_ID DESC, p.MONTH_ID DESC, TOTAL_REVENUE DESC
  `,

  BUSINESS_LOGIC: {
    assessGLAccountPerformance: function(revenue_amount, customer_count, service_count, tier_level) {
      let performance_score = 0;
      let performance_insights = [];
      
      // Revenue volume component (40%)
      if (revenue_amount >= 50000000) {
        performance_score += 40;
        performance_insights.push('Revenue volume excellent - major contributor');
      } else if (revenue_amount >= 20000000) {
        performance_score += 30;
        performance_insights.push('Revenue volume strong - significant contributor');
      } else if (revenue_amount >= 5000000) {
        performance_score += 20;
        performance_insights.push('Revenue volume moderate - stable contributor');
      } else {
        performance_score += 10;
        performance_insights.push('Revenue volume low - optimization needed');
      }
      
      // Customer base component (30%)
      if (customer_count >= 1000) {
        performance_score += 30;
        performance_insights.push('Customer base sangat solid dengan penetrasi tinggi');
      } else if (customer_count >= 500) {
        performance_score += 25;
        performance_insights.push('Customer base solid dengan growth potential');
      } else if (customer_count >= 100) {
        performance_score += 15;
        performance_insights.push('Customer base moderate perlu expansion');
      } else {
        performance_score += 5;
        performance_insights.push('Customer base kecil perlu strategic focus');
      }
      
      // Service efficiency component (30%)
      const revenue_per_service = service_count > 0 ? revenue_amount / service_count : 0;
      if (revenue_per_service >= 200000) {
        performance_score += 30;
        performance_insights.push('Revenue efficiency per service sangat tinggi');
      } else if (revenue_per_service >= 100000) {
        performance_score += 25;
        performance_insights.push('Revenue efficiency per service baik');
      } else if (revenue_per_service >= 50000) {
        performance_score += 15;
        performance_insights.push('Revenue efficiency per service moderate');
      } else {
        performance_score += 5;
        performance_insights.push('Revenue efficiency per service rendah');
      }
      
      const performanceCategories = {
        'STAR_PERFORMER': {
          description: 'GL Account dengan performa outstanding dan strategic value tinggi',
          strategy: 'Maximize investment dan scale operations'
        },
        'STRONG_PERFORMER': {
          description: 'GL Account dengan performa solid dan growth potential',
          strategy: 'Optimize dan expand market reach'
        },
        'AVERAGE_PERFORMER': {
          description: 'GL Account dengan performa moderate perlu improvement',
          strategy: 'Enhancement strategy dan efficiency optimization'
        },
        'UNDER_PERFORMER': {
          description: 'GL Account dengan performa rendah perlu evaluasi',
          strategy: 'Strategic review dan potential restructuring'
        }
      };
      
      let selectedCategory;
      if (performance_score >= 85) selectedCategory = performanceCategories['STAR_PERFORMER'];
      else if (performance_score >= 70) selectedCategory = performanceCategories['STRONG_PERFORMER'];
      else if (performance_score >= 50) selectedCategory = performanceCategories['AVERAGE_PERFORMER'];
      else selectedCategory = performanceCategories['UNDER_PERFORMER'];
      
      return {
        performance_score: performance_score,
        performance_category: Object.keys(performanceCategories).find(key => performanceCategories[key] === selectedCategory),
        description: selectedCategory.description,
        strategy: selectedCategory.strategy,
        insights: performance_insights
      };
    },

    analyzeServiceTierStrategy: function(tier_data) {
      const tier_strategy_matrix = {
        'TIER_1_ENTERPRISE': {
          focus: 'Premium Enterprise Solutions',
          strategy: 'High-touch relationship management dan customized solutions',
          target_customers: 'Large corporations dan government institutions',
          revenue_expectation: 'Very High ARPU dengan long-term contracts'
        },
        'TIER_2_PREMIUM': {
          focus: 'Premium Business Services',
          strategy: 'Value-added services dan managed solutions',
          target_customers: 'Mid-size enterprises dan premium SMBs',
          revenue_expectation: 'High ARPU dengan enhanced service features'
        },
        'TIER_3_BUSINESS': {
          focus: 'Standard Business Internet',
          strategy: 'Reliable connectivity dengan competitive pricing',
          target_customers: 'SMBs dan business establishments',
          revenue_expectation: 'Moderate ARPU dengan volume scaling'
        },
        'TIER_4_CONSUMER': {
          focus: 'Mass Market Broadband',
          strategy: 'Volume-based approach dengan affordable pricing',
          target_customers: 'Residential customers dan individual users',
          revenue_expectation: 'Lower ARPU dengan high volume compensation'
        },
        'TIER_5_OTHERS': {
          focus: 'Specialized Services',
          strategy: 'Niche market approach dengan specialized offerings',
          target_customers: 'Specific use cases dan vertical markets',
          revenue_expectation: 'Variable ARPU depending on service type'
        }
      };
      
      return Object.entries(tier_data).map(([tier, data]) => ({
        tier: tier,
        strategy_profile: tier_strategy_matrix[tier] || {
          focus: 'Undefined Strategy',
          strategy: 'Requires strategic definition',
          target_customers: 'To be determined',
          revenue_expectation: 'Under evaluation'
        },
        performance_metrics: data
      }));
    },

    identifyGLAccountOpportunities: function(data) {
      const opportunities = [];
      
      // High revenue, low customer base (upselling opportunity)
      const upselling_accounts = data.filter(item => 
        item.TOTAL_REVENUE > 10000000 && 
        item.TOTAL_PELANGGAN < 200 &&
        item.REVENUE_PER_PELANGGAN > 100000
      ).length;
      
      if (upselling_accounts > 0) {
        opportunities.push({
          type: 'UPSELLING_OPPORTUNITY',
          count: upselling_accounts,
          description: 'GL Accounts dengan high revenue per customer - upselling potential',
          action: 'Expand customer base dengan maintained premium pricing'
        });
      }
      
      // High customer base, low revenue (cross-selling opportunity)
      const crossselling_accounts = data.filter(item =>
        item.TOTAL_PELANGGAN > 500 &&
        item.REVENUE_PER_PELANGGAN < 50000
      ).length;
      
      if (crossselling_accounts > 0) {
        opportunities.push({
          type: 'CROSS_SELLING_OPPORTUNITY',
          count: crossselling_accounts,
          description: 'GL Accounts dengan large customer base - cross-selling potential',
          action: 'Increase revenue per customer melalui additional services'
        });
      }
      
      // Geographic expansion opportunity
      const expansion_accounts = data.filter(item =>
        item.REVENUE_EFFICIENCY_PER_SERVICE > 150000 &&
        item.WITEL_COVERAGE < 5
      ).length;
      
      if (expansion_accounts > 0) {
        opportunities.push({
          type: 'GEOGRAPHIC_EXPANSION',
          count: expansion_accounts,
          description: 'High efficiency GL Accounts dengan limited geographic coverage',
          action: 'Expand geographic presence untuk maximize revenue potential'
        });
      }
      
      return opportunities;
    },

    generateGLPortfolioInsights: function(category_distribution) {
      const total_revenue = Object.values(category_distribution).reduce((sum, cat) => sum + cat.revenue, 0);
      const insights = [];
      
      // Portfolio concentration analysis
      const top_category = Object.entries(category_distribution)
        .sort(([,a], [,b]) => b.revenue - a.revenue)[0];
      
      if (top_category && (top_category[1].revenue / (total_revenue || 1)) > 0.6) {
        insights.push({
          type: 'CONCENTRATION_RISK',
          message: `Over-concentration pada ${top_category[0]} (${((top_category[1].revenue / (total_revenue || 1)) * 100).toFixed(1)}%)`,
          recommendation: 'Diversifikasi portfolio untuk risk mitigation'
        });
      }
      
      // Service tier balance analysis
      const enterprise_categories = ['DEDICATED_INTERNET_SERVICES', 'ENTERPRISE_INTERNET_SERVICES', 'MANAGED_SERVICES'];
      const enterprise_revenue = enterprise_categories.reduce((sum, cat) => 
        sum + (category_distribution[cat]?.revenue || 0), 0);
      
      if ((enterprise_revenue / (total_revenue || 1)) < 0.3) {
        insights.push({
          type: 'ENTERPRISE_OPPORTUNITY',
          message: 'Enterprise segment under-represented dalam portfolio',
          recommendation: 'Strengthen enterprise offerings untuk higher margin revenue'
        });
      }
      
      // Consumer vs Business balance
      const consumer_revenue = category_distribution['BROADBAND_CONSUMER_SERVICES']?.revenue || 0;
      const business_revenue = (category_distribution['BUSINESS_INTERNET_SERVICES']?.revenue || 0) +
                              (category_distribution['PREMIUM_INTERNET_SERVICES']?.revenue || 0);
      
      if (consumer_revenue > business_revenue * 2) {
        insights.push({
          type: 'BUSINESS_OPPORTUNITY',
          message: 'Business segment underweight vs consumer segment',
          recommendation: 'Increase focus pada business customer acquisition'
        });
      }
      
      return insights;
    },

    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_REVENUE, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.TOTAL_PELANGGAN, 0);
      const totalNCLI = data.reduce((sum, d) => sum + d.TOTAL_NCLI, 0);
      const totalServices = data.reduce((sum, d) => sum + d.TOTAL_LAYANAN, 0);
      const uniqueGLAccounts = new Set(data.map(d => d.GL_ACC)).size;
      
      // GL Category summary
      const categoryDistribution = data.reduce((acc, item) => {
        const category = item.GL_CATEGORY;
        if (!acc[category]) {
          acc[category] = {
            revenue: 0,
            customers: 0,
            ncli: 0,
            services: 0,
            gl_accounts: new Set(),
            sto_count: new Set()
          };
        }
        acc[category].revenue += item.TOTAL_REVENUE;
        acc[category].customers += item.TOTAL_PELANGGAN;
        acc[category].ncli += item.TOTAL_NCLI;
        acc[category].services += item.TOTAL_LAYANAN;
        acc[category].gl_accounts.add(item.GL_ACC);
        acc[category].sto_count.add(item.WITEL_BILL);
        return acc;
      }, {});
      
      // Service tier distribution
      const tierDistribution = data.reduce((acc, item) => {
        const tier = item.SERVICE_TIER;
        if (!acc[tier]) {
          acc[tier] = {
            revenue: 0,
            customers: 0,
            services: 0
          };
        }
        acc[tier].revenue += item.TOTAL_REVENUE;
        acc[tier].customers += item.TOTAL_PELANGGAN;
        acc[tier].services += item.TOTAL_LAYANAN;
        return acc;
      }, {});
      
      // Advanced analytics
      const glAccountOpportunities = this.identifyGLAccountOpportunities(data);
      const serviceTierAnalysis = this.analyzeServiceTierStrategy(tierDistribution);
      const portfolioInsights = this.generateGLPortfolioInsights(categoryDistribution);
      
      // Top performing GL Accounts with assessment
      const topPerformingAccounts = data.slice(0, 15).map(item => {
        const performanceAssessment = this.assessGLAccountPerformance(
          item.TOTAL_REVENUE,
          item.TOTAL_PELANGGAN,
          item.TOTAL_LAYANAN,
          item.SERVICE_TIER
        );
        
        return {
          ...item,
          performance_assessment: performanceAssessment
        };
      });
      
      return {
        ringkasan: 'Analisis klasifikasi revenue HSI berdasarkan General Ledger Account dengan geographic breakdown',
        periode_analisis: data.length > 0 ? `${data[0].YEAR_ID}` : 'Data tidak tersedia',
        
        metrik_nasional: {
          total_revenue: `Rp ${(totalRevenue || 0).toLocaleString('id-ID')}`,
          total_pelanggan: (totalCustomers || 0).toLocaleString('id-ID'),
          total_ncli: (totalNCLI || 0).toLocaleString('id-ID'),
          total_layanan: (totalServices || 0).toLocaleString('id-ID'),
          jumlah_gl_account_unik: uniqueGLAccounts,
          total_lokasi_analyzed: data.length
        },
        
        portfolio_insights: portfolioInsights.map(insight => ({
          tipe_insight: insight.type,
          pesan: insight.message,
          rekomendasi: insight.recommendation
        })),
        
        distribusi_kategori_gl: Object.entries(categoryDistribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .map(([category, stats]) => ({
            kategori_gl: category,
            total_revenue: `Rp ${(stats.revenue || 0).toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((stats.revenue / (totalRevenue || 1)) * 100).toFixed(2)}%`,
            total_pelanggan: (stats.customers || 0).toLocaleString('id-ID'),
            total_ncli: (stats.ncli || 0).toLocaleString('id-ID'),
            total_layanan: (stats.services || 0).toLocaleString('id-ID'),
            jumlah_gl_account: stats.gl_accounts.size,
            coverage_sto: stats.sto_count.size,
            rata_revenue_per_pelanggan: `Rp ${Math.round(stats.revenue / (stats.customers || 1)).toLocaleString('id-ID')}`
          })),
        
        analisis_service_tier: serviceTierAnalysis.map(tier => ({
          service_tier: tier.tier,
          fokus_strategis: tier.strategy_profile.focus,
          strategi_implementasi: tier.strategy_profile.strategy,
          target_customers: tier.strategy_profile.target_customers,
          ekspektasi_revenue: tier.strategy_profile.revenue_expectation,
          performance_metrics: {
            total_revenue: `Rp ${(tier.performance_metrics.revenue || 0).toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((tier.performance_metrics.revenue / (totalRevenue || 1)) * 100).toFixed(2)}%`,
            total_pelanggan: (tier.performance_metrics.customers || 0).toLocaleString('id-ID'),
            total_layanan: (tier.performance_metrics.services || 0).toLocaleString('id-ID'),
            rata_revenue_per_pelanggan: `Rp ${Math.round(tier.performance_metrics.revenue / tier.performance_metrics.customers).toLocaleString('id-ID')}`
          }
        })),
        
        peluang_gl_account: glAccountOpportunities.map(opp => ({
          tipe_peluang: opp.type,
          jumlah_account: opp.count,
          deskripsi: opp.description,
          action_plan: opp.action
        })),
        
        top_gl_account_performer: topPerformingAccounts.map(item => ({
          periode: `${item.YEAR_ID}-${item.MONTH_ID.toString().padStart(2, '0')}`,
          regional: item.REGIONAL_BILL,
          witel: item.WITEL_BILL,
          datel: item.WITEL_BILL,
          kode_sto: item.WITEL_BILL,
          gl_account: item.GL_ACC,
          kategori_gl: item.GL_CATEGORY,
          revenue_type: item.REVENUE_TYPE,
          service_tier: item.SERVICE_TIER,
          total_revenue: `Rp ${(item.TOTAL_REVENUE || 0).toLocaleString('id-ID')}`,
          total_pelanggan: (item.TOTAL_PELANGGAN || 0).toLocaleString('id-ID'),
          total_ncli: (item.TOTAL_NCLI || 0).toLocaleString('id-ID'),
          total_layanan: (item.TOTAL_LAYANAN || 0).toLocaleString('id-ID'),
          revenue_per_pelanggan: `Rp ${(item.REVENUE_PER_PELANGGAN || 0).toLocaleString('id-ID')}`,
          revenue_per_ncli: `Rp ${(item.REVENUE_PER_NCLI || 0).toLocaleString('id-ID')}`,
          avg_revenue_per_layanan: `Rp ${(item.AVG_REVENUE_PER_LAYANAN || 0).toLocaleString('id-ID')}`,
          services_per_customer: item.SERVICES_PER_CUSTOMER,
          services_per_ncli: item.SERVICES_PER_NCLI,
          revenue_efficiency: `Rp ${(item.REVENUE_EFFICIENCY_PER_SERVICE || 0).toLocaleString('id-ID')}`,
          high_value_services: item.HIGH_VALUE_SERVICES,
          medium_value_services: item.MEDIUM_VALUE_SERVICES,
          low_value_services: item.LOW_VALUE_SERVICES,
          new_revenue: `Rp ${(item.NEW_REVENUE || 0).toLocaleString('id-ID')}`,
          recurring_revenue: `Rp ${(item.RECURRING_REVENUE || 0).toLocaleString('id-ID')}`,
          sustain_revenue: `Rp ${(item.SUSTAIN_REVENUE || 0).toLocaleString('id-ID')}`,
          witel_coverage: item.WITEL_COVERAGE,
          datel_coverage: item.DATEL_COVERAGE,
          performance_assessment: {
            performance_score: item.performance_assessment.performance_score,
            performance_category: item.performance_assessment.performance_category,
            deskripsi: item.performance_assessment.description,
            strategi: item.performance_assessment.strategy,
            insights: item.performance_assessment.insights
          }
        })),
        
        insight_bisnis: [
          'Identifikasi kontribusi setiap kategori GL Account terhadap total revenue HSI per lokasi',
          'Analisis performa revenue berdasarkan service tier dan revenue type classification',
          'Evaluasi efisiensi revenue per customer dan NIP_NAS untuk setiap GL Account category',
          'Monitoring distribusi service value dan customer concentration per GL classification',
          'Assessment geographic coverage dan penetrasi setiap GL Account category',
          'Optimization pricing strategy dan service portfolio berdasarkan GL Account performance'
        ],
        
        rekomendasi_strategis: [
          'Focus on star performing GL Accounts untuk maximize ROI',
          'Develop tier-specific strategies sesuai target customer segments',
          'Address portfolio concentration risks melalui diversification',
          'Capitalize on identified opportunities untuk revenue growth'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: userInput.toLowerCase().includes('classification') || 
                   userInput.toLowerCase().includes('klasifikasi') ? 'gl_classification' : 'gl_analysis'
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};