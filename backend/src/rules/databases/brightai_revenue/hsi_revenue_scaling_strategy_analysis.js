const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'mart_004',
    RULE_NAME: 'hsi_revenue_scaling_strategy_analysis',
    DESCRIPTION: 'Analisis strategi scaling revenue HSI berdasarkan kategori New, Recurring, dan Sustain dengan geographic distribution',
    DATABASE: 'BRIGHTAI_REVENUE',
    CATEGORY: 'revenue_scaling',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_REVENUE"),

  KEYWORD_PATTERNS: {
    primary: [
      'scaling revenue hsi', 'strategi scaling hsi', 'revenue scaling internet',
      'new recurring sustain hsi', 'kategori revenue hsi', 'tipe revenue scaling',
      'analisis scaling strategy hsi', 'revenue categorization hsi', 'scaling portfolio hsi'
    ],
    supporting: [
      'scaling', 'strategi', 'strategy', 'new', 'recurring', 'sustain', 'kategori',
      'tipe', 'revenue', 'pendapatan', 'hsi', 'internet', 'analisis', 'portfolio',
      'flag', 'monthly', 'classification', 'distribution'
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
      } else if (supportingMatches >= 4) {
        score = 65 + (supportingMatches * 4);
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
        FLAG_SCALING_SUSTAIN_REVENUE,
        FLAG_SCALING_MONTHLY_REVENUE,
        
        -- Customer and Service Metrics
        COUNT(DISTINCT NIP_NAS) as TOTAL_PELANGGAN,
        COUNT(DISTINCT NCLI) as TOTAL_NCLI,
        COUNT(DISTINCT ND) as TOTAL_LAYANAN,
        
        -- Revenue Metrics by Scaling Type
        SUM(REVENUE) as TOTAL_REVENUE,
        ROUND(AVG(REVENUE), 0) as AVG_REVENUE_PER_LAYANAN,
        ROUND(SUM(REVENUE) / NULLIF(COUNT(DISTINCT NIP_NAS), 0), 0) as REVENUE_PER_PELANGGAN,
        ROUND(SUM(REVENUE) / NULLIF(COUNT(DISTINCT NCLI), 0), 0) as REVENUE_PER_NCLI,
        
        -- Scaling Type Distribution
        COUNT(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN 1 END) as NEW_SERVICES_COUNT,
        COUNT(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN 1 END) as RECURRING_SERVICES_COUNT,
        COUNT(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN 1 END) as SUSTAIN_SERVICES_COUNT,
        
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) as NEW_REVENUE_AMOUNT,
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN REVENUE ELSE 0 END) as RECURRING_REVENUE_AMOUNT,
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE ELSE 0 END) as SUSTAIN_REVENUE_AMOUNT,
        
        -- Customer Distribution by Scaling Type
        COUNT(DISTINCT CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN NIP_NAS END) as NEW_CUSTOMERS_COUNT,
        COUNT(DISTINCT CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN NIP_NAS END) as RECURRING_CUSTOMERS_COUNT,
        COUNT(DISTINCT CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN NIP_NAS END) as SUSTAIN_CUSTOMERS_COUNT,
        
        -- NCLI Distribution by Scaling Type
        COUNT(DISTINCT CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN NCLI END) as NEW_NCLI_COUNT,
        COUNT(DISTINCT CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN NCLI END) as RECURRING_NCLI_COUNT,
        COUNT(DISTINCT CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN NCLI END) as SUSTAIN_NCLI_COUNT,
        
        -- Performance Ratios
        ROUND(SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0), 2) as NEW_REVENUE_RATIO,
        ROUND(SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0), 2) as RECURRING_REVENUE_RATIO,
        ROUND(SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0), 2) as SUSTAIN_REVENUE_RATIO,
        
        -- Average Revenue per Scaling Type
        ROUND(AVG(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE END), 0) as AVG_NEW_REVENUE_PER_SERVICE,
        ROUND(AVG(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN REVENUE END), 0) as AVG_REC_REV_PER_SVC,
        ROUND(AVG(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE END), 0) as AVG_SUSTAIN_REV_PER_SVC,
        
        -- Growth Potential Classification
        CASE 
            WHEN SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0) >= 40 THEN 'HIGH_GROWTH_AREA'
            WHEN SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0) >= 20 THEN 'MEDIUM_GROWTH_AREA'
            WHEN SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE ELSE 0 END) * 100.0 / NULLIF(SUM(REVENUE), 0) >= 60 THEN 'MATURE_STABLE_AREA'
            ELSE 'BALANCED_AREA'
        END as GROWTH_POTENTIAL_CATEGORY
        
    FROM DWH_MOIS.BRIGHTAI_REVENUE
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
      AND FLAG_SCALING_MONTHLY_REVENUE IS NOT NULL
    GROUP BY YEAR_ID, MONTH_ID, REGIONAL_BILL, WITEL_BILL, DATEL, CSTO, LSTO, 
             FLAG_SCALING_SUSTAIN_REVENUE, FLAG_SCALING_MONTHLY_REVENUE
    ORDER BY YEAR_ID DESC, MONTH_ID DESC, TOTAL_REVENUE DESC
  `,

  BUSINESS_LOGIC: {
    assessScalingStrategy: function(new_ratio, recurring_ratio, sustain_ratio, growth_category) {
      let strategy_score = 0;
      let strategy_insights = [];
      
      // Optimal scaling balance scoring
      if (new_ratio >= 15 && new_ratio <= 35) {
        strategy_score += 30;
        strategy_insights.push('Porsi new revenue optimal untuk sustainable growth');
      } else if (new_ratio > 35) {
        strategy_score += 20;
        strategy_insights.push('Porsi new revenue tinggi - high growth namun risiko volatilitas');
      } else {
        strategy_score += 15;
        strategy_insights.push('Porsi new revenue rendah - perlu intensifikasi akuisisi');
      }
      
      if (recurring_ratio >= 35 && recurring_ratio <= 55) {
        strategy_score += 35;
        strategy_insights.push('Porsi recurring revenue sehat untuk stabilitas bisnis');
      } else if (recurring_ratio > 55) {
        strategy_score += 25;
        strategy_insights.push('Dominasi recurring revenue - stabil namun growth terbatas');
      } else {
        strategy_score += 20;
        strategy_insights.push('Recurring revenue rendah - perlu penguatan base customer');
      }
      
      if (sustain_ratio <= 35) {
        strategy_score += 35;
        strategy_insights.push('Porsi sustain revenue optimal - portfolio yang dinamis');
      } else if (sustain_ratio <= 50) {
        strategy_score += 25;
        strategy_insights.push('Sustain revenue moderate - ada ruang untuk inovasi');
      } else {
        strategy_score += 15;
        strategy_insights.push('Sustain revenue tinggi - indikasi mature market');
      }
      
      const strategyCategories = {
        'EXCELLENT': {
          description: 'Portfolio scaling strategy sangat baik dengan balance optimal',
          recommendation: 'Maintain excellence dan replicate ke area lain'
        },
        'GOOD': {
          description: 'Portfolio scaling strategy baik dengan minor optimization',
          recommendation: 'Fine-tuning balance dan selective enhancement'
        },
        'FAIR': {
          description: 'Portfolio scaling strategy cukup dengan room for improvement',
          recommendation: 'Strategic rebalancing dan focused intervention'
        },
        'POOR': {
          description: 'Portfolio scaling strategy perlu major restructuring',
          recommendation: 'Comprehensive strategy overhaul dan new approach'
        }
      };
      
      let selectedCategory;
      if (strategy_score >= 85) selectedCategory = strategyCategories['EXCELLENT'];
      else if (strategy_score >= 70) selectedCategory = strategyCategories['GOOD'];
      else if (strategy_score >= 55) selectedCategory = strategyCategories['FAIR'];
      else selectedCategory = strategyCategories['POOR'];
      
      return {
        strategy_score: strategy_score,
        strategy_category: Object.keys(strategyCategories).find(key => strategyCategories[key] === selectedCategory),
        description: selectedCategory.description,
        recommendation: selectedCategory.recommendation,
        insights: strategy_insights,
        growth_alignment: this.assessGrowthAlignment(growth_category, new_ratio)
      };
    },

    assessGrowthAlignment: function(growth_category, new_ratio) {
      const alignmentMatrix = {
        'HIGH_GROWTH_AREA': {
          optimal_new_ratio: { min: 25, max: 45 },
          strategy_focus: 'Aggressive expansion dan market capture'
        },
        'MEDIUM_GROWTH_AREA': {
          optimal_new_ratio: { min: 15, max: 30 },
          strategy_focus: 'Balanced growth dan market development'
        },
        'MATURE_STABLE_AREA': {
          optimal_new_ratio: { min: 5, max: 20 },
          strategy_focus: 'Efficiency optimization dan value maximization'
        },
        'BALANCED_AREA': {
          optimal_new_ratio: { min: 10, max: 25 },
          strategy_focus: 'Diversified approach dan flexible strategy'
        }
      };
      
      const alignment = alignmentMatrix[growth_category];
      if (!alignment) return { aligned: false, message: 'Category not recognized' };
      
      const isAligned = new_ratio >= alignment.optimal_new_ratio.min && 
                       new_ratio <= alignment.optimal_new_ratio.max;
      
      return {
        aligned: isAligned,
        optimal_range: `${alignment.optimal_new_ratio.min}% - ${alignment.optimal_new_ratio.max}%`,
        current_ratio: `${new_ratio}%`,
        strategy_focus: alignment.strategy_focus,
        message: isAligned ? 
          'Strategy alignment optimal dengan growth category' : 
          'Perlu adjustment strategy sesuai growth potential area'
      };
    },

    identifyScalingOpportunities: function(data) {
      const opportunities = [];
      
      // High growth areas with low new revenue ratio
      const underCapitalizedGrowth = data.filter(item => 
        item.GROWTH_POTENTIAL_CATEGORY === 'HIGH_GROWTH_AREA' && 
        item.NEW_REVENUE_RATIO < 25
      ).length;
      
      if (underCapitalizedGrowth > 0) {
        opportunities.push({
          type: 'UNDER_CAPITALIZED_GROWTH',
          count: underCapitalizedGrowth,
          description: 'High growth areas dengan new revenue ratio rendah',
          action: 'Intensifikasi investment untuk maximize growth potential'
        });
      }
      
      // Mature areas with high sustain ratio
      const overMatureAreas = data.filter(item =>
        item.GROWTH_POTENTIAL_CATEGORY === 'MATURE_STABLE_AREA' &&
        item.SUSTAIN_REVENUE_RATIO > 70
      ).length;
      
      if (overMatureAreas > 0) {
        opportunities.push({
          type: 'OVER_MATURE_AREAS',
          count: overMatureAreas,
          description: 'Mature areas dengan sustain revenue sangat tinggi',
          action: 'Innovation strategy untuk revitalisasi market'
        });
      }
      
      // Balanced areas with optimization potential
      const optimizationAreas = data.filter(item =>
        item.GROWTH_POTENTIAL_CATEGORY === 'BALANCED_AREA' &&
        item.RECURRING_REVENUE_RATIO < 40
      ).length;
      
      if (optimizationAreas > 0) {
        opportunities.push({
          type: 'OPTIMIZATION_POTENTIAL',
          count: optimizationAreas,
          description: 'Balanced areas dengan recurring revenue rendah',
          action: 'Strengthen customer base dan loyalty programs'
        });
      }
      
      return opportunities;
    },

    generateRegionalScalingProfile: function(data) {
      const regionalData = {};
      
      data.forEach(item => {
        const regional = item.REGIONAL_BILL;
        if (!regionalData[regional]) {
          regionalData[regional] = {
            total_revenue: 0,
            new_revenue: 0,
            recurring_revenue: 0,
            sustain_revenue: 0,
            sto_count: 0,
            growth_categories: {}
          };
        }
        
        regionalData[regional].total_revenue += item.TOTAL_REVENUE;
        regionalData[regional].new_revenue += item.NEW_REVENUE_AMOUNT;
        regionalData[regional].recurring_revenue += item.RECURRING_REVENUE_AMOUNT;
        regionalData[regional].sustain_revenue += item.SUSTAIN_REVENUE_AMOUNT;
        regionalData[regional].sto_count += 1;
        
        const growth_cat = item.GROWTH_POTENTIAL_CATEGORY;
        if (!regionalData[regional].growth_categories[growth_cat]) {
          regionalData[regional].growth_categories[growth_cat] = 0;
        }
        regionalData[regional].growth_categories[growth_cat] += 1;
      });
      
      return Object.entries(regionalData).map(([regional, data]) => {
        const total = data.total_revenue;
        const dominant_growth_category = Object.entries(data.growth_categories)
          .sort(([,a], [,b]) => b - a)[0][0];
        
        return {
          regional: regional,
          total_revenue: total,
          scaling_profile: {
            new_ratio: ((data.new_revenue / total) * 100).toFixed(2),
            recurring_ratio: ((data.recurring_revenue / total) * 100).toFixed(2),
            sustain_ratio: ((data.sustain_revenue / total) * 100).toFixed(2)
          },
          dominant_growth_category: dominant_growth_category,
          sto_count: data.sto_count,
          diversification_index: Object.keys(data.growth_categories).length
        };
      }).sort((a, b) => b.total_revenue - a.total_revenue);
    },

    formatIndonesianResponse: function(data) {
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_REVENUE, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.TOTAL_PELANGGAN, 0);
      const totalNCLI = data.reduce((sum, d) => sum + d.TOTAL_NCLI, 0);
      const totalServices = data.reduce((sum, d) => sum + d.TOTAL_LAYANAN, 0);
      
      // Revenue distribution by scaling type
      const totalNewRevenue = data.reduce((sum, d) => sum + d.NEW_REVENUE_AMOUNT, 0);
      const totalRecurringRevenue = data.reduce((sum, d) => sum + d.RECURRING_REVENUE_AMOUNT, 0);
      const totalSustainRevenue = data.reduce((sum, d) => sum + d.SUSTAIN_REVENUE_AMOUNT, 0);
      
      // Calculate average ratios
      const avgNewRatio = (totalNewRevenue / totalRevenue) * 100;
      const avgRecurringRatio = (totalRecurringRevenue / totalRevenue) * 100;
      const avgSustainRatio = (totalSustainRevenue / totalRevenue) * 100;
      
      // Advanced analytics
      const scalingStrategyAssessment = this.assessScalingStrategy(
        avgNewRatio, avgRecurringRatio, avgSustainRatio, 'BALANCED_AREA'
      );
      
      const scalingOpportunities = this.identifyScalingOpportunities(data);
      const regionalScalingProfile = this.generateRegionalScalingProfile(data);
      
      // Growth category analysis
      const growthCategoryDistribution = data.reduce((acc, item) => {
        const category = item.GROWTH_POTENTIAL_CATEGORY;
        if (!acc[category]) {
          acc[category] = {
            sto_count: 0,
            revenue: 0,
            customers: 0
          };
        }
        acc[category].sto_count += 1;
        acc[category].revenue += item.TOTAL_REVENUE;
        acc[category].customers += item.TOTAL_PELANGGAN;
        return acc;
      }, {});
      
      return {
        ringkasan: 'Analisis strategi scaling revenue HSI berdasarkan kategori New, Recurring, dan Sustain dengan geographic distribution',
        periode_analisis: data.length > 0 ? `${data[0].YEAR_ID}` : 'Data tidak tersedia',
        
        metrik_nasional: {
          total_revenue: `Rp ${totalRevenue.toLocaleString('id-ID')}`,
          total_pelanggan: totalCustomers.toLocaleString('id-ID'),
          total_ncli: totalNCLI.toLocaleString('id-ID'),
          total_layanan: totalServices.toLocaleString('id-ID'),
          total_sto_analyzed: data.length.toLocaleString('id-ID')
        },
        
        portfolio_scaling_assessment: {
          strategy_score: scalingStrategyAssessment.strategy_score,
          strategy_category: scalingStrategyAssessment.strategy_category,
          deskripsi: scalingStrategyAssessment.description,
          rekomendasi: scalingStrategyAssessment.recommendation,
          strategic_insights: scalingStrategyAssessment.insights,
          growth_alignment: scalingStrategyAssessment.growth_alignment
        },
        
        distribusi_scaling_revenue: {
          new_revenue: {
            amount: `Rp ${totalNewRevenue.toLocaleString('id-ID')}`,
            percentage: `${avgNewRatio.toFixed(2)}%`,
            services: data.reduce((sum, d) => sum + d.NEW_SERVICES_COUNT, 0),
            customers: data.reduce((sum, d) => sum + d.NEW_CUSTOMERS_COUNT, 0),
            ncli: data.reduce((sum, d) => sum + d.NEW_NCLI_COUNT, 0)
          },
          recurring_revenue: {
            amount: `Rp ${totalRecurringRevenue.toLocaleString('id-ID')}`,
            percentage: `${avgRecurringRatio.toFixed(2)}%`,
            services: data.reduce((sum, d) => sum + d.RECURRING_SERVICES_COUNT, 0),
            customers: data.reduce((sum, d) => sum + d.RECURRING_CUSTOMERS_COUNT, 0),
            ncli: data.reduce((sum, d) => sum + d.RECURRING_NCLI_COUNT, 0)
          },
          sustain_revenue: {
            amount: `Rp ${totalSustainRevenue.toLocaleString('id-ID')}`,
            percentage: `${avgSustainRatio.toFixed(2)}%`,
            services: data.reduce((sum, d) => sum + d.SUSTAIN_SERVICES_COUNT, 0),
            customers: data.reduce((sum, d) => sum + d.SUSTAIN_CUSTOMERS_COUNT, 0),
            ncli: data.reduce((sum, d) => sum + d.SUSTAIN_NCLI_COUNT, 0)
          }
        },
        
        kategori_growth_potential: Object.entries(growthCategoryDistribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .map(([category, stats]) => ({
            kategori: category,
            jumlah_sto: stats.sto_count,
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            total_pelanggan: stats.customers.toLocaleString('id-ID'),
            kontribusi_revenue: `${((stats.revenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_sto: `Rp ${Math.round(stats.revenue / stats.sto_count).toLocaleString('id-ID')}`
          })),
        
        peluang_scaling: scalingOpportunities.map(opp => ({
          tipe_peluang: opp.type,
          jumlah_area: opp.count,
          deskripsi: opp.description,
          action_plan: opp.action
        })),
        
        profil_scaling_regional: regionalScalingProfile.slice(0, 10).map(profile => ({
          regional: profile.regional,
          total_revenue: `Rp ${profile.total_revenue.toLocaleString('id-ID')}`,
          profil_scaling: {
            new_ratio: `${profile.scaling_profile.new_ratio}%`,
            recurring_ratio: `${profile.scaling_profile.recurring_ratio}%`,
            sustain_ratio: `${profile.scaling_profile.sustain_ratio}%`
          },
          dominant_growth_category: profile.dominant_growth_category,
          jumlah_sto: profile.sto_count,
          diversification_index: profile.diversification_index
        })),
        
        detail_sto_sample: data.slice(0, 15).map(item => ({
          periode: `${item.YEAR_ID}-${item.MONTH_ID.toString().padStart(2, '0')}`,
          regional: item.REGIONAL_BILL,
          witel: item.WITEL_BILL,
          datel: item.DATEL,
          kode_sto: item.CSTO,
          nama_sto: item.LSTO,
          scaling_sustain_flag: item.FLAG_SCALING_SUSTAIN_REVENUE,
          scaling_monthly_flag: item.FLAG_SCALING_MONTHLY_REVENUE,
          growth_category: item.GROWTH_POTENTIAL_CATEGORY,
          total_revenue: `Rp ${item.TOTAL_REVENUE.toLocaleString('id-ID')}`,
          total_pelanggan: item.TOTAL_PELANGGAN.toLocaleString('id-ID'),
          total_ncli: item.TOTAL_NCLI.toLocaleString('id-ID'),
          total_layanan: item.TOTAL_LAYANAN.toLocaleString('id-ID'),
          new_revenue: `Rp ${item.NEW_REVENUE_AMOUNT.toLocaleString('id-ID')}`,
          recurring_revenue: `Rp ${item.RECURRING_REVENUE_AMOUNT.toLocaleString('id-ID')}`,
          sustain_revenue: `Rp ${item.SUSTAIN_REVENUE_AMOUNT.toLocaleString('id-ID')}`,
          new_revenue_ratio: `${item.NEW_REVENUE_RATIO}%`,
          recurring_revenue_ratio: `${item.RECURRING_REVENUE_RATIO}%`,
          sustain_revenue_ratio: `${item.SUSTAIN_REVENUE_RATIO}%`,
          avg_new_revenue_per_service: `Rp ${item.AVG_NEW_REVENUE_PER_SERVICE?.toLocaleString('id-ID') || '0'}`,
          avg_recurring_revenue_per_service: `Rp ${item.AVG_REC_REV_PER_SVC?.toLocaleString('id-ID') || '0'}`,
          avg_sustain_revenue_per_service: `Rp ${item.AVG_SUSTAIN_REV_PER_SVC?.toLocaleString('id-ID') || '0'}`
        })),
        
        insight_bisnis: [
          'Identifikasi area dengan potensi growth tinggi berdasarkan proporsi new revenue',
          'Analisis balance portfolio revenue scaling strategy per geographic location',
          'Evaluasi efektivitas strategy acquisition vs retention per STO',
          'Monitoring distribusi customer dan NCLI across scaling categories',
          'Assessment mature market vs emerging market berdasarkan revenue composition',
          'Optimization resource allocation untuk maximize scaling revenue potential'
        ],
        
        rekomendasi_strategis: [
          'Focus on high growth areas dengan investment scaling yang tepat',
          'Optimize portfolio balance sesuai growth potential masing-masing area',
          'Implement best practice sharing antar regional untuk scaling excellence',
          'Develop differentiated strategy untuk mature vs emerging markets'
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
        focus_area: userInput.toLowerCase().includes('strategy') || 
                   userInput.toLowerCase().includes('strategi') ? 'scaling_strategy' : 'revenue_scaling'
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};