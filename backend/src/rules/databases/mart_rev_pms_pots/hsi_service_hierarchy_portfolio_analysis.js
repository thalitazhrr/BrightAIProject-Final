const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'mart_006',
    RULE_NAME: 'hsi_service_hierarchy_portfolio_analysis',
    DESCRIPTION: 'Analisis portfolio hierarki layanan HSI berdasarkan GROUP1-GROUP5 dan DESC2 dengan geographic distribution',
    DATABASE: 'MART_REV_PMS_POTS',
    CATEGORY: 'service_portfolio',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
  },

  DATABASE_CONFIG: loadRuleDatabase("MART_REV_PMS_POTS"),

  KEYWORD_PATTERNS: {
    primary: [
      'hierarki layanan hsi', 'service hierarchy hsi', 'portfolio layanan hsi',
      'group layanan hsi', 'klasifikasi service hsi', 'struktur layanan internet',
      'analisis group hsi', 'hierarchy service internet', 'kategori service hsi'
    ],
    supporting: [
      'hierarki', 'hierarchy', 'portfolio', 'group', 'kategori', 'layanan', 'service',
      'klasifikasi', 'struktur', 'level', 'tingkat', 'hsi', 'internet',
      'group1', 'group2', 'group3', 'group5', 'desc2', 'deskripsi'
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
    SELECT 
        YEAR_ID,
        MONTH_ID,
        REGIONAL_BILL,
        WITEL_BILL,
        DATEL,
        CSTO,
        LSTO,
        GROUP1,
        GROUP2, 
        GROUP3,
        GROUP4, -- Always 'High Speed Internet'
        GROUP5,
        DESC2,
        
        -- Customer and Service Metrics
        COUNT(DISTINCT NIP_NAS) as TOTAL_PELANGGAN,
        COUNT(DISTINCT NCLI) as TOTAL_NCLI,
        COUNT(DISTINCT ND) as TOTAL_LAYANAN,
        
        -- Revenue Metrics
        SUM(REVENUE) as TOTAL_REVENUE,
        ROUND(AVG(REVENUE), 0) as AVG_REVENUE_PER_LAYANAN,
        ROUND(SUM(REVENUE) / NULLIF(COUNT(DISTINCT NIP_NAS), 0), 0) as REVENUE_PER_PELANGGAN,
        ROUND(SUM(REVENUE) / NULLIF(COUNT(DISTINCT NCLI), 0), 0) as REVENUE_PER_NCLI,
        
        -- Service complexity scoring
        CASE 
            WHEN GROUP5 IS NOT NULL AND TRIM(GROUP5) != '' THEN 5
            WHEN GROUP3 IS NOT NULL AND TRIM(GROUP3) != '' THEN 4  
            WHEN GROUP2 IS NOT NULL AND TRIM(GROUP2) != '' THEN 3
            WHEN GROUP1 IS NOT NULL AND TRIM(GROUP1) != '' THEN 2
            ELSE 1
        END as SERVICE_COMPLEXITY_LEVEL,
        
        -- Premium service identification
        CASE 
            WHEN UPPER(COALESCE(GROUP1,'') || COALESCE(GROUP2,'') || COALESCE(GROUP3,'') || COALESCE(GROUP5,'') || COALESCE(DESC2,'')) LIKE '%PREMIUM%' THEN 'PREMIUM_SERVICE'
            WHEN UPPER(COALESCE(GROUP1,'') || COALESCE(GROUP2,'') || COALESCE(GROUP3,'') || COALESCE(GROUP5,'') || COALESCE(DESC2,'')) LIKE '%ENTERPRISE%' THEN 'ENTERPRISE_SERVICE'
            WHEN UPPER(COALESCE(GROUP1,'') || COALESCE(GROUP2,'') || COALESCE(GROUP3,'') || COALESCE(GROUP5,'') || COALESCE(DESC2,'')) LIKE '%BUSINESS%' THEN 'BUSINESS_SERVICE'
            WHEN UPPER(COALESCE(GROUP1,'') || COALESCE(GROUP2,'') || COALESCE(GROUP3,'') || COALESCE(GROUP5,'') || COALESCE(DESC2,'')) LIKE '%CONSUMER%' THEN 'CONSUMER_SERVICE'
            WHEN UPPER(COALESCE(GROUP1,'') || COALESCE(GROUP2,'') || COALESCE(GROUP3,'') || COALESCE(GROUP5,'') || COALESCE(DESC2,'')) LIKE '%DEDICATED%' THEN 'DEDICATED_SERVICE'
            ELSE 'STANDARD_SERVICE'
        END as SERVICE_TYPE,
        
        -- Revenue scaling analysis for this service combination
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) as NEW_REVENUE,
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN REVENUE ELSE 0 END) as RECURRING_REVENUE,
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE ELSE 0 END) as SUSTAIN_REVENUE,
        
        -- Service portfolio metrics
        COUNT(DISTINCT GL_ACC) as GL_ACCOUNT_DIVERSITY,
        
        -- Service adoption metrics
        ROUND(COUNT(DISTINCT ND) / NULLIF(COUNT(DISTINCT NIP_NAS), 0), 2) as SERVICES_PER_CUSTOMER,
        ROUND(COUNT(DISTINCT ND) / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as SERVICES_PER_NCLI,
        
        -- Revenue value distribution
        COUNT(CASE WHEN REVENUE >= 1000000 THEN 1 END) as PREMIUM_VALUE_SERVICES,
        COUNT(CASE WHEN REVENUE BETWEEN 500000 AND 999999 THEN 1 END) as HIGH_VALUE_SERVICES,
        COUNT(CASE WHEN REVENUE BETWEEN 100000 AND 499999 THEN 1 END) as MEDIUM_VALUE_SERVICES,
        COUNT(CASE WHEN REVENUE < 100000 THEN 1 END) as LOW_VALUE_SERVICES,
        
        -- Geographic penetration
        COUNT(DISTINCT WITEL_BILL) as WITEL_PENETRATION,
        COUNT(DISTINCT DATEL) as DATEL_PENETRATION,
        
        -- Service maturity indicator
        CASE 
            WHEN SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0) >= 70 THEN 'MATURE_SERVICE'
            WHEN SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0) >= 40 THEN 'GROWTH_SERVICE'
            WHEN SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0) >= 50 THEN 'STABLE_SERVICE'
            ELSE 'EMERGING_SERVICE'
        END as SERVICE_MATURITY_STAGE
        
    FROM PMSDBS.MART_REV_PMS_POTS
    WHERE GROUP4 = 'High Speed Internet'
      AND REVENUE > 0
      AND REGIONAL_BILL IS NOT NULL
      AND WITEL_BILL IS NOT NULL
      AND DATEL IS NOT NULL
      AND CSTO IS NOT NULL
      AND LSTO IS NOT NULL
      AND NIP_NAS IS NOT NULL
      AND NCLI IS NOT NULL
      AND ND IS NOT NULL
    GROUP BY YEAR_ID, MONTH_ID, REGIONAL_BILL, WITEL_BILL, DATEL, CSTO, LSTO, 
             GROUP1, GROUP2, GROUP3, GROUP4, GROUP5, DESC2
    ORDER BY TOTAL_REVENUE DESC
  `,

  BUSINESS_LOGIC: {
    assessServiceComplexityValue: function(complexity_level, revenue_per_customer, customer_count) {
      let value_score = 0;
      let complexity_insights = [];
      
      // Complexity scoring (40%)
      if (complexity_level >= 5) {
        value_score += 40;
        complexity_insights.push('Service dengan kompleksitas tinggi - full hierarchy utilization');
      } else if (complexity_level >= 4) {
        value_score += 32;
        complexity_insights.push('Service dengan kompleksitas good - multi-level hierarchy');
      } else if (complexity_level >= 3) {
        value_score += 24;
        complexity_insights.push('Service dengan kompleksitas moderate - basic hierarchy');
      } else {
        value_score += 16;
        complexity_insights.push('Service dengan kompleksitas rendah - simplified structure');
      }
      
      // Revenue efficiency component (35%)
      if (revenue_per_customer >= 500000) {
        value_score += 35;
        complexity_insights.push('Revenue efficiency excellent - high value per customer');
      } else if (revenue_per_customer >= 200000) {
        value_score += 28;
        complexity_insights.push('Revenue efficiency good - moderate value per customer');
      } else if (revenue_per_customer >= 100000) {
        value_score += 21;
        complexity_insights.push('Revenue efficiency fair - standard value per customer');
      } else {
        value_score += 14;
        complexity_insights.push('Revenue efficiency low - optimization needed');
      }
      
      // Scale component (25%)
      if (customer_count >= 1000) {
        value_score += 25;
        complexity_insights.push('Customer scale excellent - mass market appeal');
      } else if (customer_count >= 500) {
        value_score += 20;
        complexity_insights.push('Customer scale good - solid market presence');
      } else if (customer_count >= 100) {
        value_score += 15;
        complexity_insights.push('Customer scale moderate - niche market');
      } else {
        value_score += 10;
        complexity_insights.push('Customer scale limited - specialized service');
      }
      
      const valueCategories = {
        'HIGH_VALUE_COMPLEX': {
          description: 'Service portfolio dengan nilai tinggi dan kompleksitas optimal',
          strategy: 'Maximize investment dan expansion strategy'
        },
        'MEDIUM_VALUE_BALANCED': {
          description: 'Service portfolio dengan nilai moderate dan balance complexity',
          strategy: 'Optimization strategy dan selective enhancement'
        },
        'LOW_VALUE_SIMPLE': {
          description: 'Service portfolio dengan nilai rendah dan kompleksitas sederhana',
          strategy: 'Simplification atau bundling strategy'
        },
        'SPECIALIZED_NICHE': {
          description: 'Service portfolio specialized dengan target market khusus',
          strategy: 'Niche market focus dan premium positioning'
        }
      };
      
      let selectedCategory;
      if (value_score >= 85) selectedCategory = valueCategories['HIGH_VALUE_COMPLEX'];
      else if (value_score >= 65) selectedCategory = valueCategories['MEDIUM_VALUE_BALANCED'];
      else if (value_score >= 45) selectedCategory = valueCategories['LOW_VALUE_SIMPLE'];
      else selectedCategory = valueCategories['SPECIALIZED_NICHE'];
      
      return {
        value_score: value_score,
        value_category: Object.keys(valueCategories).find(key => valueCategories[key] === selectedCategory),
        description: selectedCategory.description,
        strategy: selectedCategory.strategy,
        insights: complexity_insights
      };
    },

    analyzeServicePortfolioMix: function(service_type_distribution, total_revenue) {
      const portfolio_analysis = [];
      const total_combinations = Object.values(service_type_distribution).reduce((sum, type) => sum + type.combinations, 0);
      
      Object.entries(service_type_distribution).forEach(([type, data]) => {
        const revenue_share = (data.revenue / total_revenue) * 100;
        const combination_share = (data.combinations / total_combinations) * 100;
        
        let strategic_value;
        let recommendation;
        
        if (type === 'ENTERPRISE_SERVICE' || type === 'PREMIUM_SERVICE') {
          if (revenue_share >= 30) {
            strategic_value = 'STRATEGIC_CORE';
            recommendation = 'Maintain excellence dan expand premium offerings';
          } else if (revenue_share >= 15) {
            strategic_value = 'GROWTH_OPPORTUNITY';
            recommendation = 'Accelerate premium segment development';
          } else {
            strategic_value = 'UNDER_UTILIZED';
            recommendation = 'Intensive development program untuk premium services';
          }
        } else if (type === 'BUSINESS_SERVICE') {
          if (revenue_share >= 25) {
            strategic_value = 'MARKET_LEADER';
            recommendation = 'Leverage leadership untuk adjacent services';
          } else {
            strategic_value = 'OPTIMIZATION_TARGET';
            recommendation = 'Enhance business service value proposition';
          }
        } else if (type === 'CONSUMER_SERVICE') {
          if (revenue_share >= 40) {
            strategic_value = 'MASS_MARKET_DOMINANT';
            recommendation = 'Balance scale efficiency dengan premium migration';
          } else {
            strategic_value = 'VOLUME_BUILDER';
            recommendation = 'Scale optimization dan customer lifecycle management';
          }
        } else {
          strategic_value = 'SUPPORT_SERVICE';
          recommendation = 'Evaluate strategic fit dalam overall portfolio';
        }
        
        portfolio_analysis.push({
          service_type: type,
          revenue_contribution: revenue_share.toFixed(2),
          combination_share: combination_share.toFixed(2),
          strategic_value: strategic_value,
          recommendation: recommendation,
          performance_metrics: data
        });
      });
      
      return portfolio_analysis.sort((a, b) => parseFloat(b.revenue_contribution) - parseFloat(a.revenue_contribution));
    },

    identifyServiceOptimizationOpportunities: function(data) {
      const opportunities = [];
      
      // High complexity, low revenue efficiency
      const over_complex_services = data.filter(item =>
        item.SERVICE_COMPLEXITY_LEVEL >= 4 &&
        item.REVENUE_PER_PELANGGAN < 100000 &&
        item.TOTAL_PELANGGAN > 50
      ).length;
      
      if (over_complex_services > 0) {
        opportunities.push({
          type: 'COMPLEXITY_SIMPLIFICATION',
          count: over_complex_services,
          description: 'Service combinations dengan kompleksitas tinggi namun revenue efficiency rendah',
          action: 'Simplify service hierarchy atau bundle enhancement'
        });
      }
      
      // Low complexity, high revenue - scaling opportunity
      const scaling_opportunities = data.filter(item =>
        item.SERVICE_COMPLEXITY_LEVEL <= 2 &&
        item.REVENUE_PER_PELANGGAN >= 200000 &&
        item.WITEL_PENETRATION < 3
      ).length;
      
      if (scaling_opportunities > 0) {
        opportunities.push({
          type: 'GEOGRAPHIC_SCALING',
          count: scaling_opportunities,
          description: 'Simple services dengan high revenue potential - limited geographic presence',
          action: 'Geographic expansion untuk maximize revenue potential'
        });
      }
      
      // Premium services underutilization
      const premium_underutilized = data.filter(item =>
        item.SERVICE_TYPE === 'PREMIUM_SERVICE' &&
        item.SERVICES_PER_CUSTOMER < 1.5 &&
        item.TOTAL_PELANGGAN >= 100
      ).length;
      
      if (premium_underutilized > 0) {
        opportunities.push({
          type: 'PREMIUM_UPSELLING',
          count: premium_underutilized,
          description: 'Premium services dengan low attachment rate per customer',
          action: 'Cross-selling dan upselling programs untuk premium services'
        });
      }
      
      return opportunities;
    },

    generateServiceMaturityInsights: function(maturity_distribution, total_revenue) {
      const insights = [];
      
      Object.entries(maturity_distribution).forEach(([stage, data]) => {
        const revenue_share = (data.revenue / total_revenue) * 100;
        
        if (stage === 'MATURE_SERVICE' && revenue_share > 50) {
          insights.push({
            type: 'PORTFOLIO_MATURITY_RISK',
            message: `${revenue_share.toFixed(1)}% revenue dari mature services - innovation risk`,
            recommendation: 'Develop emerging services untuk future growth'
          });
        }
        
        if (stage === 'GROWTH_SERVICE' && revenue_share < 15) {
          insights.push({
            type: 'GROWTH_SERVICE_UNDERWEIGHT',
            message: `Growth services hanya ${revenue_share.toFixed(1)}% dari total revenue`,
            recommendation: 'Increase investment pada growth services untuk sustainable future'
          });
        }
        
        if (stage === 'EMERGING_SERVICE' && data.combinations > 20) {
          insights.push({
            type: 'EMERGING_SERVICE_PROLIFERATION',
            message: `${data.combinations} emerging service combinations - potential fragmentation`,
            recommendation: 'Consolidate emerging services atau accelerate development'
          });
        }
      });
      
      return insights;
    },

    formatIndonesianResponse: function(data) {
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_REVENUE, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.TOTAL_PELANGGAN, 0);
      const totalNCLI = data.reduce((sum, d) => sum + d.TOTAL_NCLI, 0);
      const totalServices = data.reduce((sum, d) => sum + d.TOTAL_LAYANAN, 0);
      
      // Service complexity distribution
      const complexityDistribution = data.reduce((acc, item) => {
        const level = item.SERVICE_COMPLEXITY_LEVEL;
        if (!acc[level]) {
          acc[level] = {
            revenue: 0,
            customers: 0,
            services: 0,
            combinations: 0
          };
        }
        acc[level].revenue += item.TOTAL_REVENUE;
        acc[level].customers += item.TOTAL_PELANGGAN;
        acc[level].services += item.TOTAL_LAYANAN;
        acc[level].combinations += 1;
        return acc;
      }, {});
      
      // Service type distribution
      const serviceTypeDistribution = data.reduce((acc, item) => {
        const type = item.SERVICE_TYPE;
        if (!acc[type]) {
          acc[type] = {
            revenue: 0,
            customers: 0,
            ncli: 0,
            combinations: 0
          };
        }
        acc[type].revenue += item.TOTAL_REVENUE;
        acc[type].customers += item.TOTAL_PELANGGAN;
        acc[type].ncli += item.TOTAL_NCLI;
        acc[type].combinations += 1;
        return acc;
      }, {});
      
      // Service maturity distribution
      const maturityDistribution = data.reduce((acc, item) => {
        const stage = item.SERVICE_MATURITY_STAGE;
        if (!acc[stage]) {
          acc[stage] = {
            revenue: 0,
            customers: 0,
            combinations: 0
          };
        }
        acc[stage].revenue += item.TOTAL_REVENUE;
        acc[stage].customers += item.TOTAL_PELANGGAN;
        acc[stage].combinations += 1;
        return acc;
      }, {});
      
      // GROUP1 analysis
      const group1Distribution = data.reduce((acc, item) => {
        const group1 = item.GROUP1 || 'UNDEFINED';
        if (!acc[group1]) {
          acc[group1] = {
            revenue: 0,
            customers: 0,
            unique_group2: new Set(),
            combinations: 0
          };
        }
        acc[group1].revenue += item.TOTAL_REVENUE;
        acc[group1].customers += item.TOTAL_PELANGGAN;
        if (item.GROUP2) acc[group1].unique_group2.add(item.GROUP2);
        acc[group1].combinations += 1;
        return acc;
      }, {});
      
      // Advanced analytics
      const portfolioMixAnalysis = this.analyzeServicePortfolioMix(serviceTypeDistribution, totalRevenue);
      const optimizationOpportunities = this.identifyServiceOptimizationOpportunities(data);
      const maturityInsights = this.generateServiceMaturityInsights(maturityDistribution, totalRevenue);
      
      // Top performing combinations with assessment
      const topServiceCombinations = data.slice(0, 20).map((item, index) => {
        const complexityAssessment = this.assessServiceComplexityValue(
          item.SERVICE_COMPLEXITY_LEVEL,
          item.REVENUE_PER_PELANGGAN,
          item.TOTAL_PELANGGAN
        );
        
        return {
          ranking: index + 1,
          service_details: {
            periode: `${item.YEAR_ID}-${item.MONTH_ID.toString().padStart(2, '0')}`,
            regional: item.REGIONAL_BILL,
            witel: item.WITEL_BILL,
            datel: item.DATEL,
            kode_sto: item.CSTO,
            nama_sto: item.LSTO,
            group1: item.GROUP1 || 'N/A',
            group2: item.GROUP2 || 'N/A', 
            group3: item.GROUP3 || 'N/A',
            group5: item.GROUP5 || 'N/A',
            deskripsi: item.DESC2 || 'N/A'
          },
          service_characteristics: {
            service_type: item.SERVICE_TYPE,
            complexity_level: item.SERVICE_COMPLEXITY_LEVEL,
            maturity_stage: item.SERVICE_MATURITY_STAGE
          },
          performance_metrics: {
            total_revenue: `Rp ${item.TOTAL_REVENUE.toLocaleString('id-ID')}`,
            total_pelanggan: item.TOTAL_PELANGGAN.toLocaleString('id-ID'),
            total_ncli: item.TOTAL_NCLI.toLocaleString('id-ID'),
            total_layanan: item.TOTAL_LAYANAN.toLocaleString('id-ID'),
            revenue_per_pelanggan: `Rp ${item.REVENUE_PER_PELANGGAN.toLocaleString('id-ID')}`,
            revenue_per_ncli: `Rp ${item.REVENUE_PER_NCLI.toLocaleString('id-ID')}`,
            services_per_customer: item.SERVICES_PER_CUSTOMER,
            services_per_ncli: item.SERVICES_PER_NCLI
          },
          geographic_metrics: {
            gl_account_diversity: item.GL_ACCOUNT_DIVERSITY,
            witel_penetration: item.WITEL_PENETRATION,
            datel_penetration: item.DATEL_PENETRATION
          },
          value_assessment: {
            value_score: complexityAssessment.value_score,
            value_category: complexityAssessment.value_category,
            deskripsi: complexityAssessment.description,
            strategi: complexityAssessment.strategy,
            insights: complexityAssessment.insights
          }
        };
      });
      
      return {
        ringkasan: 'Analisis portfolio hierarki layanan HSI berdasarkan GROUP1-GROUP5 dan DESC2 dengan geographic distribution',
        periode_analisis: data.length > 0 ? `${data[0].YEAR_ID}` : 'Data tidak tersedia',
        
        metrik_nasional: {
          total_revenue: `Rp ${totalRevenue.toLocaleString('id-ID')}`,
          total_pelanggan: totalCustomers.toLocaleString('id-ID'),
          total_ncli: totalNCLI.toLocaleString('id-ID'),
          total_layanan: totalServices.toLocaleString('id-ID'),
          total_kombinasi_layanan_unik: data.length,
          rata_revenue_per_kombinasi: `Rp ${Math.round(totalRevenue / data.length).toLocaleString('id-ID')}`
        },
        
        analisis_portfolio_mix: portfolioMixAnalysis.map(mix => ({
          service_type: mix.service_type,
          kontribusi_revenue: `${mix.revenue_contribution}%`,
          share_kombinasi: `${mix.combination_share}%`,
          strategic_value: mix.strategic_value,
          rekomendasi: mix.recommendation,
          performance_metrics: {
            total_revenue: `Rp ${mix.performance_metrics.revenue.toLocaleString('id-ID')}`,
            total_customers: mix.performance_metrics.customers.toLocaleString('id-ID')
          }
        })),
        
        insights_maturity: maturityInsights.map(insight => ({
          tipe_insight: insight.type,
          pesan: insight.message,
          rekomendasi: insight.recommendation
        })),
        
        peluang_optimasi: optimizationOpportunities.map(opp => ({
          tipe_peluang: opp.type,
          jumlah_service: opp.count,
          deskripsi: opp.description,
          action_plan: opp.action
        })),
        
        distribusi_kompleksitas_layanan: Object.entries(complexityDistribution)
          .sort(([a], [b]) => parseInt(b) - parseInt(a))
          .map(([level, stats]) => ({
            level_kompleksitas: `Level ${level}`,
            deskripsi_level: level === '5' ? 'Sangat Kompleks (GROUP1-GROUP5)' :
                           level === '4' ? 'Kompleks (GROUP1-GROUP3)' :
                           level === '3' ? 'Menengah (GROUP1-GROUP2)' :
                           level === '2' ? 'Sederhana (GROUP1 saja)' : 'Basic',
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((stats.revenue / totalRevenue) * 100).toFixed(2)}%`,
            total_pelanggan: stats.customers.toLocaleString('id-ID'),
            total_layanan: stats.services.toLocaleString('id-ID'),
            jumlah_kombinasi: stats.combinations,
            rata_revenue_per_pelanggan: `Rp ${Math.round(stats.revenue / stats.customers).toLocaleString('id-ID')}`
          })),
        
        distribusi_maturity_stage: Object.entries(maturityDistribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .map(([stage, stats]) => ({
            maturity_stage: stage,
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((stats.revenue / totalRevenue) * 100).toFixed(2)}%`,
            total_pelanggan: stats.customers.toLocaleString('id-ID'),
            jumlah_kombinasi: stats.combinations,
            rata_revenue_per_kombinasi: `Rp ${Math.round(stats.revenue / stats.combinations).toLocaleString('id-ID')}`
          })),
        
        top_group1_categories: Object.entries(group1Distribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .slice(0, 10)
          .map(([group1, stats]) => ({
            kategori_group1: group1,
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((stats.revenue / totalRevenue) * 100).toFixed(2)}%`,
            total_pelanggan: stats.customers.toLocaleString('id-ID'),
            variasi_group2: stats.unique_group2.size,
            jumlah_kombinasi: stats.combinations,
            rata_revenue_per_pelanggan: `Rp ${Math.round(stats.revenue / stats.customers).toLocaleString('id-ID')}`
          })),
        
        top_service_combinations: topServiceCombinations,
        
        insight_bisnis: [
          'Identifikasi service portfolio dengan revenue contribution tertinggi per geographic area',
          'Analisis kompleksitas layanan dan dampaknya terhadap revenue efficiency',
          'Evaluasi maturity stage setiap service combination untuk lifecycle management',
          'Monitoring penetrasi geographic dan customer adoption per service hierarchy',
          'Assessment opportunity untuk service simplification atau enhancement',
          'Optimization service portfolio mix berdasarkan revenue dan complexity analysis'
        ],
        
        rekomendasi_strategis: [
          'Focus on high-value complex services untuk maximize revenue efficiency',
          'Implement portfolio rebalancing strategy sesuai maturity insights',
          'Address complexity-revenue misalignment melalui optimization programs',
          'Develop emerging services untuk sustainable future growth'
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
        focus_area: userInput.toLowerCase().includes('hierarchy') || 
                   userInput.toLowerCase().includes('hierarki') ? 'service_hierarchy' : 'portfolio_analysis'
      };
    },
    
  },

  CACHE_DURATION: 3600, // 1 hour
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};