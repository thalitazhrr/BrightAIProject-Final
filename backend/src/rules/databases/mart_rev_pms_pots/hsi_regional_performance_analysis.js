const { loadRuleDatabase } = require('../../config/databaseLoader');

module.exports = {
  RULE_META: {
    RULE_ID: 'mart_002',
    RULE_NAME: 'hsi_regional_performance_analysis',
    DESCRIPTION: 'Analisis performa revenue HSI berdasarkan hierarchy regional, witel, datel, dan STO',
    DATABASE: 'MART_REV_PMS_POTS',
    CATEGORY: 'regional_performance',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("MART_REV_PMS_POTS"),

  KEYWORD_PATTERNS: {
    primary: [
      'performa regional hsi', 'revenue regional internet', 'analisis regional hsi',
      'kinerja regional hsi', 'pendapatan regional internet', 'performance regional hsi',
      'komparasi regional hsi', 'ranking regional internet', 'evaluasi regional hsi'
    ],
    supporting: [
      'regional', 'witel', 'datel', 'sto', 'wilayah', 'area', 'performa', 
      'performance', 'kinerja', 'revenue', 'pendapatan', 'hsi', 'internet', 
      'cepat', 'high speed', 'komparasi', 'ranking', 'evaluasi', 'analisis'
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
    WITH LATEST_MONTH AS (
        SELECT MAX(YEAR_ID || LPAD(MONTH_ID, 2, '0')) as LATEST_PERIOD
        FROM PMSDBS.MART_REV_PMS_POTS 
        WHERE GROUP4 = 'High Speed Internet'
    ),
    
    REGIONAL_PERFORMANCE AS (
        SELECT 
            REGIONAL_BILL,
            WITEL_BILL,
            DATEL,
            CSTO,
            LSTO,
            
            -- Customer and Service Metrics
            COUNT(DISTINCT NIP_NAS) as TOTAL_PELANGGAN,
            COUNT(DISTINCT NCLI) as TOTAL_NCLI,
            COUNT(DISTINCT ND) as TOTAL_LAYANAN,
            
            -- Revenue Metrics
            SUM(REVENUE) as TOTAL_REVENUE,
            ROUND(AVG(REVENUE), 0) as AVG_REVENUE_PER_LAYANAN,
            ROUND(SUM(REVENUE) / NULLIF(COUNT(DISTINCT NIP_NAS), 0), 0) as REVENUE_PER_PELANGGAN,
            ROUND(SUM(REVENUE) / NULLIF(COUNT(DISTINCT NCLI), 0), 0) as REVENUE_PER_NCLI,
            
            -- Revenue distribution by scaling type
            SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) as NEW_REVENUE,
            SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN REVENUE ELSE 0 END) as RECURRING_REVENUE,
            SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE ELSE 0 END) as SUSTAIN_REVENUE,
            
            -- Service diversity metrics
            COUNT(DISTINCT GL_ACC) as GL_ACCOUNT_DIVERSITY,
            COUNT(DISTINCT GROUP1) as GROUP1_DIVERSITY,
            COUNT(DISTINCT GROUP2) as GROUP2_DIVERSITY,
            COUNT(DISTINCT GROUP3) as GROUP3_DIVERSITY,
            COUNT(DISTINCT GROUP5) as GROUP5_DIVERSITY
            
        FROM PMSDBS.MART_REV_PMS_POTS
        CROSS JOIN LATEST_MONTH
        WHERE GROUP4 = 'High Speed Internet'
          AND YEAR_ID || LPAD(MONTH_ID, 2, '0') = LATEST_MONTH.LATEST_PERIOD
          AND REVENUE > 0
          AND REGIONAL_BILL IS NOT NULL
          AND WITEL_BILL IS NOT NULL
          AND DATEL IS NOT NULL
          AND CSTO IS NOT NULL
          AND LSTO IS NOT NULL
          AND NIP_NAS IS NOT NULL
          AND NCLI IS NOT NULL
          AND ND IS NOT NULL
        GROUP BY REGIONAL_BILL, WITEL_BILL, DATEL, CSTO, LSTO
    )
    
    SELECT 
        REGIONAL_BILL,
        WITEL_BILL,
        DATEL,
        CSTO,
        LSTO,
        TOTAL_PELANGGAN,
        TOTAL_NCLI,
        TOTAL_LAYANAN,
        TOTAL_REVENUE,
        AVG_REVENUE_PER_LAYANAN,
        REVENUE_PER_PELANGGAN,
        REVENUE_PER_NCLI,
        NEW_REVENUE,
        RECURRING_REVENUE,
        SUSTAIN_REVENUE,
        GL_ACCOUNT_DIVERSITY,
        GROUP1_DIVERSITY,
        GROUP2_DIVERSITY,
        GROUP3_DIVERSITY,
        GROUP5_DIVERSITY,
        
        -- National ranking
        RANK() OVER (ORDER BY TOTAL_REVENUE DESC) as NATIONAL_REVENUE_RANK,
        
        -- Regional ranking
        RANK() OVER (PARTITION BY REGIONAL_BILL ORDER BY TOTAL_REVENUE DESC) as REGIONAL_REVENUE_RANK,
        
        -- Witel ranking  
        RANK() OVER (PARTITION BY WITEL_BILL ORDER BY TOTAL_REVENUE DESC) as WITEL_REVENUE_RANK,
        
        -- Datel ranking
        RANK() OVER (PARTITION BY DATEL ORDER BY TOTAL_REVENUE DESC) as DATEL_REVENUE_RANK,
        
        -- Revenue contribution
        ROUND(TOTAL_REVENUE * 100.0 / SUM(TOTAL_REVENUE) OVER(), 4) as NATIONAL_REVENUE_CONTRIBUTION,
        ROUND(TOTAL_REVENUE * 100.0 / SUM(TOTAL_REVENUE) OVER(PARTITION BY REGIONAL_BILL), 2) as REGIONAL_REVENUE_CONTRIBUTION,
        ROUND(TOTAL_REVENUE * 100.0 / SUM(TOTAL_REVENUE) OVER(PARTITION BY WITEL_BILL), 2) as WITEL_REVENUE_CONTRIBUTION,
        ROUND(TOTAL_REVENUE * 100.0 / SUM(TOTAL_REVENUE) OVER(PARTITION BY DATEL), 2) as DATEL_REVENUE_CONTRIBUTION,
        
        -- Performance categories
        CASE 
            WHEN TOTAL_REVENUE >= 10000000 THEN 'HIGH_PERFORMER'
            WHEN TOTAL_REVENUE >= 5000000 THEN 'MEDIUM_PERFORMER' 
            WHEN TOTAL_REVENUE >= 1000000 THEN 'STANDARD_PERFORMER'
            ELSE 'LOW_PERFORMER'
        END as PERFORMANCE_CATEGORY,
        
        -- Revenue mix ratios
        ROUND(NEW_REVENUE * 100.0 / NULLIF(TOTAL_REVENUE, 0), 2) as NEW_REVENUE_RATIO,
        ROUND(RECURRING_REVENUE * 100.0 / NULLIF(TOTAL_REVENUE, 0), 2) as RECURRING_REVENUE_RATIO,
        ROUND(SUSTAIN_REVENUE * 100.0 / NULLIF(TOTAL_REVENUE, 0), 2) as SUSTAIN_REVENUE_RATIO
        
    FROM REGIONAL_PERFORMANCE
    ORDER BY TOTAL_REVENUE DESC
  `,

  BUSINESS_LOGIC: {
    assessPerformanceLevel: function(revenue_category, revenue_per_customer, market_share_percentage) {
      const performanceMatrix = {
        'HIGH_PERFORMER': {
          description: 'STO dengan performa revenue HSI sangat tinggi dan market dominance',
          strategic_action: 'Maintain excellence dan ekspansi ke area adjacency',
          investment_priority: 'HIGH - Scaling dan innovation initiatives'
        },
        'MEDIUM_PERFORMER': {
          description: 'STO dengan performa revenue HSI solid dan potensi growth',
          strategic_action: 'Optimize performance dan selective expansion',
          investment_priority: 'MEDIUM - Growth acceleration programs'
        },
        'STANDARD_PERFORMER': {
          description: 'STO dengan performa revenue HSI standard memerlukan improvement',
          strategic_action: 'Performance improvement dan efficiency enhancement',
          investment_priority: 'MEDIUM - Operational excellence initiatives'
        },
        'LOW_PERFORMER': {
          description: 'STO dengan performa revenue HSI rendah perlu intervesi',
          strategic_action: 'Turnaround strategy dan fundamental restructuring',
          investment_priority: 'LOW - Selective intervention only'
        }
      };
      
      return performanceMatrix[revenue_category] || {
        description: 'Kategori performa tidak teridentifikasi',
        strategic_action: 'Evaluasi mendalam diperlukan',
        investment_priority: 'REVIEW - Detailed assessment needed'
      };
    },

    analyzeRevenueComposition: function(new_revenue_ratio, recurring_revenue_ratio, sustain_revenue_ratio) {
      let health_score = 0;
      let composition_insights = [];
      
      // Ideal composition scoring
      if (new_revenue_ratio >= 15 && new_revenue_ratio <= 30) health_score += 35;
      else if (new_revenue_ratio >= 10) health_score += 25;
      else health_score += 15;
      
      if (recurring_revenue_ratio >= 40 && recurring_revenue_ratio <= 60) health_score += 40;
      else if (recurring_revenue_ratio >= 30) health_score += 30;
      else health_score += 20;
      
      if (sustain_revenue_ratio <= 40) health_score += 25;
      else if (sustain_revenue_ratio <= 50) health_score += 15;
      else health_score += 5;
      
      // Composition insights
      if (new_revenue_ratio > 35) {
        composition_insights.push('Porsi new revenue tinggi - indikasi growth agresif namun perlu stabilitas');
      } else if (new_revenue_ratio < 10) {
        composition_insights.push('Porsi new revenue rendah - perlu intensifikasi akuisisi customer baru');
      }
      
      if (recurring_revenue_ratio > 70) {
        composition_insights.push('Dominasi recurring revenue - stabilitas tinggi namun pertumbuhan terbatas');
      } else if (recurring_revenue_ratio < 30) {
        composition_insights.push('Recurring revenue rendah - risiko volatilitas pendapatan');
      }
      
      if (sustain_revenue_ratio > 50) {
        composition_insights.push('Sustain revenue tinggi - mature market dengan limited growth potential');
      }
      
      return {
        health_score: health_score,
        composition_category: health_score >= 80 ? 'EXCELLENT' : 
                            health_score >= 65 ? 'GOOD' : 
                            health_score >= 50 ? 'FAIR' : 'POOR',
        insights: composition_insights
      };
    },

    identifyRegionalLeaders: function(data) {
      const regionalData = {};
      
      // Group data by regional
      data.forEach(item => {
        const regional = item.REGIONAL_BILL;
        if (!regionalData[regional]) {
          regionalData[regional] = [];
        }
        regionalData[regional].push(item);
      });
      
      // Find leaders in each regional
      return Object.entries(regionalData).map(([regional, stos]) => {
        const sortedSTOs = stos.sort((a, b) => b.TOTAL_REVENUE - a.TOTAL_REVENUE);
        const topSTO = sortedSTOs[0];
        const totalRegionalRevenue = stos.reduce((sum, sto) => sum + sto.TOTAL_REVENUE, 0);
        
        return {
          regional: regional,
          leader_sto: {
            kode: topSTO.CSTO,
            nama: topSTO.LSTO,
            witel: topSTO.WITEL_BILL,
            datel: topSTO.DATEL,
            revenue: topSTO.TOTAL_REVENUE,
            market_share: ((topSTO.TOTAL_REVENUE / totalRegionalRevenue) * 100).toFixed(2)
          },
          total_sto_count: stos.length,
          total_regional_revenue: totalRegionalRevenue,
          average_revenue_per_sto: Math.round(totalRegionalRevenue / stos.length)
        };
      }).sort((a, b) => b.total_regional_revenue - a.total_regional_revenue);
    },

    generateEfficiencyMetrics: function(data) {
      // Calculate efficiency benchmarks
      const revenues = data.map(d => d.TOTAL_REVENUE);
      const revenuePerCustomer = data.map(d => d.REVENUE_PER_PELANGGAN);
      const revenuePerNCLI = data.map(d => d.REVENUE_PER_NCLI);
      
      const percentile = (arr, p) => {
        const sorted = arr.sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p / 100) - 1;
        return sorted[index];
      };
      
      return {
        revenue_benchmarks: {
          p90: percentile(revenues, 90),
          p75: percentile(revenues, 75),
          p50: percentile(revenues, 50),
          p25: percentile(revenues, 25),
          p10: percentile(revenues, 10)
        },
        efficiency_benchmarks: {
          revenue_per_customer: {
            top_quartile: percentile(revenuePerCustomer, 75),
            median: percentile(revenuePerCustomer, 50),
            bottom_quartile: percentile(revenuePerCustomer, 25)
          },
          revenue_per_ncli: {
            top_quartile: percentile(revenuePerNCLI, 75),
            median: percentile(revenuePerNCLI, 50),
            bottom_quartile: percentile(revenuePerNCLI, 25)
          }
        }
      };
    },

    formatIndonesianResponse: function(data) {
      const totalNationalRevenue = data.reduce((sum, d) => sum + d.TOTAL_REVENUE, 0);
      const totalNationalCustomers = data.reduce((sum, d) => sum + d.TOTAL_PELANGGAN, 0);
      const totalNationalNCLI = data.reduce((sum, d) => sum + d.TOTAL_NCLI, 0);
      const totalNationalServices = data.reduce((sum, d) => sum + d.TOTAL_LAYANAN, 0);
      
      // Performance category distribution
      const performanceDistribution = data.reduce((acc, item) => {
        const category = item.PERFORMANCE_CATEGORY;
        if (!acc[category]) {
          acc[category] = {
            count: 0,
            revenue: 0,
            customers: 0
          };
        }
        acc[category].count += 1;
        acc[category].revenue += item.TOTAL_REVENUE; 
        acc[category].customers += item.TOTAL_PELANGGAN;
        return acc;
      }, {});
      
      // Analysis functions
      const regionalLeaders = this.identifyRegionalLeaders(data);
      const efficiencyMetrics = this.generateEfficiencyMetrics(data);
      
      // Top 10 STO by revenue
      const topSTO = data.slice(0, 10).map(sto => {
        const performanceAssessment = this.assessPerformanceLevel(
          sto.PERFORMANCE_CATEGORY, 
          sto.REVENUE_PER_PELANGGAN, 
          sto.NATIONAL_REVENUE_CONTRIBUTION
        );
        
        const compositionAnalysis = this.analyzeRevenueComposition(
          sto.NEW_REVENUE_RATIO,
          sto.RECURRING_REVENUE_RATIO, 
          sto.SUSTAIN_REVENUE_RATIO
        );
        
        return {
          ...sto,
          performance_assessment: performanceAssessment,
          composition_analysis: compositionAnalysis
        };
      });
      
      // Regional summary
      const regionalSummary = data.reduce((acc, item) => {
        if (!acc[item.REGIONAL_BILL]) {
          acc[item.REGIONAL_BILL] = {
            sto_count: 0,
            revenue: 0,
            customers: 0,
            ncli: 0,
            witel_count: new Set(),
            datel_count: new Set()
          };
        }
        acc[item.REGIONAL_BILL].sto_count += 1;
        acc[item.REGIONAL_BILL].revenue += item.TOTAL_REVENUE;
        acc[item.REGIONAL_BILL].customers += item.TOTAL_PELANGGAN;
        acc[item.REGIONAL_BILL].ncli += item.TOTAL_NCLI;
        acc[item.REGIONAL_BILL].witel_count.add(item.WITEL_BILL);
        acc[item.REGIONAL_BILL].datel_count.add(item.DATEL);
        return acc;
      }, {});
      
      return {
        ringkasan: 'Analisis performa revenue HSI berdasarkan hierarchy regional, witel, datel, dan STO',
        periode_data: 'Data terbaru tersedia',
        
        metrik_nasional: {
          total_sto_analyzed: data.length.toLocaleString('id-ID'),
          total_revenue: `Rp ${totalNationalRevenue.toLocaleString('id-ID')}`,
          total_pelanggan: totalNationalCustomers.toLocaleString('id-ID'),
          total_ncli: totalNationalNCLI.toLocaleString('id-ID'),
          total_layanan: totalNationalServices.toLocaleString('id-ID'),
          rata_revenue_per_sto: `Rp ${Math.round(totalNationalRevenue / data.length).toLocaleString('id-ID')}`,
          rata_revenue_per_pelanggan: `Rp ${Math.round(totalNationalRevenue / totalNationalCustomers).toLocaleString('id-ID')}`
        },
        
        benchmark_efisiensi: {
          revenue_benchmarks: {
            top_10_percent: `Rp ${efficiencyMetrics.revenue_benchmarks.p90.toLocaleString('id-ID')}`,
            top_quartile: `Rp ${efficiencyMetrics.revenue_benchmarks.p75.toLocaleString('id-ID')}`,
            median: `Rp ${efficiencyMetrics.revenue_benchmarks.p50.toLocaleString('id-ID')}`,
            bottom_quartile: `Rp ${efficiencyMetrics.revenue_benchmarks.p25.toLocaleString('id-ID')}`
          },
          efficiency_benchmarks: {
            revenue_per_customer_top_quartile: `Rp ${efficiencyMetrics.efficiency_benchmarks.revenue_per_customer.top_quartile.toLocaleString('id-ID')}`,
            revenue_per_customer_median: `Rp ${efficiencyMetrics.efficiency_benchmarks.revenue_per_customer.median.toLocaleString('id-ID')}`,
            revenue_per_ncli_top_quartile: `Rp ${efficiencyMetrics.efficiency_benchmarks.revenue_per_ncli.top_quartile.toLocaleString('id-ID')}`,
            revenue_per_ncli_median: `Rp ${efficiencyMetrics.efficiency_benchmarks.revenue_per_ncli.median.toLocaleString('id-ID')}`
          }
        },
        
        distribusi_kategori_performa: Object.entries(performanceDistribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .map(([category, stats]) => ({
            kategori: category,
            jumlah_sto: stats.count,
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            total_pelanggan: stats.customers.toLocaleString('id-ID'),
            kontribusi_revenue: `${((stats.revenue / totalNationalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_sto: `Rp ${Math.round(stats.revenue / stats.count).toLocaleString('id-ID')}`
          })),
        
        regional_leaders: regionalLeaders.slice(0, 7).map(regional => ({
          regional: regional.regional,
          leader_sto: {
            kode_nama: `${regional.leader_sto.kode} - ${regional.leader_sto.nama}`,
            witel: regional.leader_sto.witel,
            datel: regional.leader_sto.datel,
            revenue: `Rp ${regional.leader_sto.revenue.toLocaleString('id-ID')}`,
            market_share_regional: `${regional.leader_sto.market_share}%`
          },
          total_sto: regional.total_sto_count,
          total_revenue_regional: `Rp ${regional.total_regional_revenue.toLocaleString('id-ID')}`,
          rata_revenue_per_sto: `Rp ${regional.average_revenue_per_sto.toLocaleString('id-ID')}`
        })),
        
        top_10_sto_performer: topSTO.map(sto => ({
          ranking_nasional: sto.NATIONAL_REVENUE_RANK,
          regional: sto.REGIONAL_BILL,
          witel: sto.WITEL_BILL,
          datel: sto.DATEL,
          kode_sto: sto.CSTO,
          nama_sto: sto.LSTO,
          total_revenue: `Rp ${sto.TOTAL_REVENUE.toLocaleString('id-ID')}`,
          kontribusi_nasional: `${sto.NATIONAL_REVENUE_CONTRIBUTION}%`,
          total_pelanggan: sto.TOTAL_PELANGGAN.toLocaleString('id-ID'),
          total_ncli: sto.TOTAL_NCLI.toLocaleString('id-ID'),
          total_layanan: sto.TOTAL_LAYANAN.toLocaleString('id-ID'),
          revenue_per_pelanggan: `Rp ${sto.REVENUE_PER_PELANGGAN.toLocaleString('id-ID')}`,
          revenue_per_ncli: `Rp ${sto.REVENUE_PER_NCLI.toLocaleString('id-ID')}`,
          kategori_performa: sto.PERFORMANCE_CATEGORY,
          ranking_regional: sto.REGIONAL_REVENUE_RANK,
          ranking_witel: sto.WITEL_REVENUE_RANK,
          ranking_datel: sto.DATEL_REVENUE_RANK,
          komposisi_revenue: {
            new_revenue: `${sto.NEW_REVENUE_RATIO}%`,
            recurring_revenue: `${sto.RECURRING_REVENUE_RATIO}%`,
            sustain_revenue: `${sto.SUSTAIN_REVENUE_RATIO}%`,
            health_score: sto.composition_analysis.health_score,
            category: sto.composition_analysis.composition_category
          },
          strategic_assessment: {
            description: sto.performance_assessment.description,
            strategic_action: sto.performance_assessment.strategic_action,
            investment_priority: sto.performance_assessment.investment_priority
          }
        })),
        
        ringkasan_per_regional: Object.entries(regionalSummary).map(([regional, data]) => ({
          regional: regional,
          jumlah_sto: data.sto_count,
          jumlah_witel: data.witel_count.size,
          jumlah_datel: data.datel_count.size,
          total_revenue: `Rp ${data.revenue.toLocaleString('id-ID')}`,
          total_pelanggan: data.customers.toLocaleString('id-ID'),
          total_ncli: data.ncli.toLocaleString('id-ID'),
          rata_revenue_per_sto: `Rp ${Math.round(data.revenue / data.sto_count).toLocaleString('id-ID')}`,
          kontribusi_nasional: `${((data.revenue / totalNationalRevenue) * 100).toFixed(2)}%`
        })).sort((a, b) => 
          parseInt(b.total_revenue.replace(/[^\d]/g, '')) - parseInt(a.total_revenue.replace(/[^\d]/g, ''))
        ),
        
        insight_bisnis: [
          'Identifikasi STO dengan performa revenue HSI tertinggi dan terendah dengan hierarchy lengkap',
          'Analisis distribusi coverage HSI berdasarkan geographic footprint regional-witel-datel-STO',
          'Evaluasi efisiensi revenue per pelanggan, NCLI, dan layanan di setiap level hierarchy',
          'Monitoring kontribusi masing-masing STO terhadap revenue witel, datel, regional, dan nasional',
          'Assessment ranking performance across different geographic levels',
          'Benchmark performa STO untuk resource allocation dan investment strategy'
        ],
        
        rekomendasi_strategis: [
          'Focus investment pada HIGH_PERFORMER STOs untuk maximum ROI',
          'Implement best practices sharing dari regional leaders ke underperformers',
          'Optimize revenue composition balance untuk sustainable growth',
          'Develop targeted intervention programs untuk LOW_PERFORMER STOs',
          'Leverage efficiency benchmarks untuk performance standardization'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = this.parent.KEYWORD_PATTERNS.calculateConfidence(userInput);
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: userInput.toLowerCase().includes('ranking') || 
                   userInput.toLowerCase().includes('komparasi') ? 'comparative_analysis' : 'regional_performance'
      };
    },
    
    parent: this
  },

  CACHE_DURATION: 3600, // 1 hour
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};