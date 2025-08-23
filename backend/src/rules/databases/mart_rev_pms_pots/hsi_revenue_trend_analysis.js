const { loadRuleDatabase } = require('../../config/databaseLoader');

module.exports = {
  RULE_META: {
    RULE_ID: 'mart_001',
    RULE_NAME: 'hsi_revenue_trend_analysis',
    DESCRIPTION: 'Analisis tren revenue HSI berdasarkan periode waktu dengan breakdown geographic hierarchy lengkap',
    DATABASE: 'MART_REV_PMS_POTS',
    CATEGORY: 'revenue_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("MART_REV_PMS_POTS"),

  KEYWORD_PATTERNS: {
    primary: [
      'tren revenue hsi', 'trend pendapatan internet', 'perkembangan revenue hsi',
      'analisis tren hsi', 'growth revenue internet', 'pertumbuhan pendapatan hsi',
      'tren pendapatan internet cepat', 'analisis pertumbuhan hsi'
    ],
    supporting: [
      'tren', 'trend', 'pertumbuhan', 'growth', 'perkembangan', 'analisis',
      'revenue', 'pendapatan', 'hsi', 'internet', 'cepat', 'high speed',
      'bulanan', 'monthly', 'tahunan', 'yearly', 'periode'
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
    SELECT 
        YEAR_ID,
        MONTH_ID,
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
        
        -- Growth calculation month over month by geographic hierarchy
        LAG(SUM(REVENUE)) OVER (
            PARTITION BY REGIONAL_BILL, WITEL_BILL, DATEL, CSTO
            ORDER BY YEAR_ID, MONTH_ID
        ) as PREV_MONTH_REVENUE,
        
        ROUND(
            (SUM(REVENUE) - LAG(SUM(REVENUE)) OVER (
                PARTITION BY REGIONAL_BILL, WITEL_BILL, DATEL, CSTO
                ORDER BY YEAR_ID, MONTH_ID
            )) * 100.0 / NULLIF(LAG(SUM(REVENUE)) OVER (
                PARTITION BY REGIONAL_BILL, WITEL_BILL, DATEL, CSTO
                ORDER BY YEAR_ID, MONTH_ID
            ), 0), 2
        ) as GROWTH_RATE_PERCENT,
        
        -- Scaling categorization
        FLAG_SCALING_SUSTAIN_REVENUE,
        FLAG_SCALING_MONTHLY_REVENUE,
        
        COUNT(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN 1 END) as NEW_REVENUE_COUNT,
        COUNT(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN 1 END) as RECURRING_REVENUE_COUNT,
        COUNT(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN 1 END) as SUSTAIN_REVENUE_COUNT,
        
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) as NEW_REVENUE_AMOUNT,
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN REVENUE ELSE 0 END) as RECURRING_REVENUE_AMOUNT,
        SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE ELSE 0 END) as SUSTAIN_REVENUE_AMOUNT
        
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
             FLAG_SCALING_SUSTAIN_REVENUE, FLAG_SCALING_MONTHLY_REVENUE
    ORDER BY YEAR_ID DESC, MONTH_ID DESC, REGIONAL_BILL, WITEL_BILL, DATEL, CSTO, TOTAL_REVENUE DESC
  `,

  BUSINESS_LOGIC: {
    assessRevenueGrowthTrend: function(growth_rate, total_revenue, revenue_category) {
      const trendCategories = {
        'SANGAT_POSITIF': {
          description: 'Trend pertumbuhan revenue sangat positif dengan momentum tinggi',
          recommendation: 'Maksimalkan strategi scaling dan ekspansi pasar'
        },
        'POSITIF': {
          description: 'Trend pertumbuhan revenue positif dengan performa baik',
          recommendation: 'Pertahankan momentum dan optimalkan strategi existing'
        },
        'STABIL': {
          description: 'Trend revenue stabil dengan potensi optimasi',
          recommendation: 'Fokus pada efisiensi dan inovasi produk/layanan'
        },
        'MENURUN': {
          description: 'Trend revenue menunjukkan penurunan',
          recommendation: 'Evaluasi strategi dan implementasi tindakan korektif'
        },
        'SANGAT_MENURUN': {
          description: 'Trend revenue menurun signifikan memerlukan intervensi',
          recommendation: 'Tindakan recovery mendesak dan review strategis'
        }
      };
      
      let selectedCategory;
      if (growth_rate >= 15) selectedCategory = trendCategories['SANGAT_POSITIF'];
      else if (growth_rate >= 5) selectedCategory = trendCategories['POSITIF'];
      else if (growth_rate >= -2) selectedCategory = trendCategories['STABIL'];
      else if (growth_rate >= -10) selectedCategory = trendCategories['MENURUN'];
      else selectedCategory = trendCategories['SANGAT_MENURUN'];
      
      return selectedCategory;
    },

    analyzeRevenueComposition: function(new_revenue, recurring_revenue, sustain_revenue) {
      const total = new_revenue + recurring_revenue + sustain_revenue;
      
      if (total === 0) {
        return {
          composition: 'TIDAK_ADA_DATA',
          health_score: 0,
          recommendation: 'Perlu analisis lebih mendalam tentang tidak adanya revenue'
        };
      }
      
      const newPct = (new_revenue / total) * 100;
      const recurringPct = (recurring_revenue / total) * 100;
      const sustainPct = (sustain_revenue / total) * 100;
      
      let health_score = 0;
      let composition_type = '';
      let recommendation = '';
      
      // Scoring based on composition balance
      if (newPct >= 20 && recurringPct >= 40 && sustainPct <= 40) {
        health_score = 90;
        composition_type = 'SEHAT_BALANCED';
        recommendation = 'Komposisi revenue sehat dengan pertumbuhan dan stabilitas';
      } else if (newPct >= 15 && recurringPct >= 30) {
        health_score = 75;
        composition_type = 'BAIK_GROWTH_ORIENTED';
        recommendation = 'Revenue composition baik dengan orientasi pertumbuhan';
      } else if (recurringPct >= 50) {
        health_score = 65;
        composition_type = 'STABIL_RECURRING_HEAVY';
        recommendation = 'Revenue stabil namun perlu lebih banyak new customer';
      } else if (sustainPct >= 60) {
        health_score = 45;
        composition_type = 'SUSTAIN_HEAVY';
        recommendation = 'Terlalu bergantung pada sustain revenue, perlu strategi growth';
      } else {
        health_score = 30;
        composition_type = 'PERLU_OPTIMASI';
        recommendation = 'Komposisi revenue tidak optimal, perlu rebalancing';
      }
      
      return {
        composition: composition_type,
        health_score: health_score,
        percentages: {
          new_pct: newPct.toFixed(1),
          recurring_pct: recurringPct.toFixed(1),
          sustain_pct: sustainPct.toFixed(1)
        },
        recommendation: recommendation
      };
    },

    identifyTopPerformers: function(data, metric = 'TOTAL_REVENUE', limit = 10) {
      return data
        .sort((a, b) => b[metric] - a[metric])
        .slice(0, limit)
        .map((item, index) => ({
          ranking: index + 1,
          regional: item.REGIONAL_BILL,
          witel: item.WITEL_BILL,
          datel: item.DATEL,
          sto: `${item.CSTO} - ${item.LSTO}`,
          value: item[metric],
          growth_rate: item.GROWTH_RATE_PERCENT || 'N/A'
        }));
    },

    generateRegionalInsights: function(data) {
      const regionalData = {};
      
      data.forEach(item => {
        const regional = item.REGIONAL_BILL;
        if (!regionalData[regional]) {
          regionalData[regional] = {
            total_revenue: 0,
            total_customers: 0,
            total_ncli: 0,
            total_services: 0,
            witel_count: new Set(),
            sto_count: new Set(),
            growth_rates: []
          };
        }
        
        regionalData[regional].total_revenue += item.TOTAL_REVENUE;
        regionalData[regional].total_customers += item.TOTAL_PELANGGAN;
        regionalData[regional].total_ncli += item.TOTAL_NCLI;
        regionalData[regional].total_services += item.TOTAL_LAYANAN;
        regionalData[regional].witel_count.add(item.WITEL_BILL);
        regionalData[regional].sto_count.add(item.CSTO);
        
        if (item.GROWTH_RATE_PERCENT !== null) {
          regionalData[regional].growth_rates.push(item.GROWTH_RATE_PERCENT);
        }
      });
      
      return Object.entries(regionalData).map(([regional, data]) => ({
        regional: regional,
        total_revenue: data.total_revenue,
        total_customers: data.total_customers,
        total_ncli: data.total_ncli,
        total_services: data.total_services,
        witel_count: data.witel_count.size,
        sto_count: data.sto_count.size,
        avg_growth_rate: data.growth_rates.length > 0 ? 
          data.growth_rates.reduce((sum, rate) => sum + rate, 0) / data.growth_rates.length : null,
        revenue_per_customer: Math.round(data.total_revenue / data.total_customers),
        revenue_per_sto: Math.round(data.total_revenue / data.sto_count.size)
      })).sort((a, b) => b.total_revenue - a.total_revenue);
    },

    formatIndonesianResponse: function(data) {
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_REVENUE, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.TOTAL_PELANGGAN, 0);
      const totalNCLI = data.reduce((sum, d) => sum + d.TOTAL_NCLI, 0);
      const totalServices = data.reduce((sum, d) => sum + d.TOTAL_LAYANAN, 0);
      
      // Calculate overall growth trend
      const latestMonth = data.filter(d => d.GROWTH_RATE_PERCENT !== null);
      const avgGrowthRate = latestMonth.length > 0 ? 
        latestMonth.reduce((sum, d) => sum + d.GROWTH_RATE_PERCENT, 0) / latestMonth.length : 0;
      
      // Revenue composition analysis
      const totalNewRevenue = data.reduce((sum, d) => sum + d.NEW_REVENUE_AMOUNT, 0);
      const totalRecurringRevenue = data.reduce((sum, d) => sum + d.RECURRING_REVENUE_AMOUNT, 0);
      const totalSustainRevenue = data.reduce((sum, d) => sum + d.SUSTAIN_REVENUE_AMOUNT, 0);
      
      const compositionAnalysis = this.analyzeRevenueComposition(
        totalNewRevenue, totalRecurringRevenue, totalSustainRevenue
      );
      
      const trendAnalysis = this.assessRevenueGrowthTrend(
        avgGrowthRate, totalRevenue, 'HSI'
      );
      
      const topPerformers = this.identifyTopPerformers(data, 'TOTAL_REVENUE', 10);
      const regionalInsights = this.generateRegionalInsights(data);
      
      return {
        ringkasan: 'Analisis tren revenue HSI berdasarkan periode waktu dengan breakdown geographic hierarchy lengkap',
        periode_analisis: `${data[0]?.YEAR_ID} (Bulan ${Math.min(...data.map(d => parseInt(d.MONTH_ID)))} - ${Math.max(...data.map(d => parseInt(d.MONTH_ID)))})`,
        
        metrik_nasional: {
          total_revenue: `Rp ${totalRevenue.toLocaleString('id-ID')}`,
          total_pelanggan_unik: totalCustomers.toLocaleString('id-ID'),
          total_ncli: totalNCLI.toLocaleString('id-ID'),
          total_layanan: totalServices.toLocaleString('id-ID'),
          rata_pertumbuhan_bulanan: `${avgGrowthRate.toFixed(2)}%`,
          revenue_per_pelanggan: `Rp ${Math.round(totalRevenue / totalCustomers).toLocaleString('id-ID')}`,
          revenue_per_ncli: `Rp ${Math.round(totalRevenue / totalNCLI).toLocaleString('id-ID')}`
        },
        
        analisis_tren: {
          kategori_trend: trendAnalysis.description,
          rekomendasi_strategis: trendAnalysis.recommendation,
          tingkat_pertumbuhan: `${avgGrowthRate.toFixed(2)}%`
        },
        
        komposisi_revenue: {
          health_score: compositionAnalysis.health_score,
          kategori_komposisi: compositionAnalysis.composition,
          distribusi: {
            new_revenue: {
              amount: `Rp ${totalNewRevenue.toLocaleString('id-ID')}`,
              percentage: `${compositionAnalysis.percentages.new_pct}%`,
              count: data.reduce((sum, d) => sum + d.NEW_REVENUE_COUNT, 0)
            },
            recurring_revenue: {
              amount: `Rp ${totalRecurringRevenue.toLocaleString('id-ID')}`,
              percentage: `${compositionAnalysis.percentages.recurring_pct}%`,
              count: data.reduce((sum, d) => sum + d.RECURRING_REVENUE_COUNT, 0)
            },
            sustain_revenue: {
              amount: `Rp ${totalSustainRevenue.toLocaleString('id-ID')}`,
              percentage: `${compositionAnalysis.percentages.sustain_pct}%`,
              count: data.reduce((sum, d) => sum + d.SUSTAIN_REVENUE_COUNT, 0)
            }
          },
          rekomendasi_komposisi: compositionAnalysis.recommendation
        },
        
        analisis_regional: regionalInsights.slice(0, 10).map(regional => ({
          regional: regional.regional,
          total_revenue: `Rp ${regional.total_revenue.toLocaleString('id-ID')}`,
          total_pelanggan: regional.total_customers.toLocaleString('id-ID'),
          jumlah_witel: regional.witel_count,
          jumlah_sto: regional.sto_count,
          rata_pertumbuhan: regional.avg_growth_rate ? `${regional.avg_growth_rate.toFixed(2)}%` : 'N/A',
          revenue_per_pelanggan: `Rp ${regional.revenue_per_customer.toLocaleString('id-ID')}`,
          revenue_per_sto: `Rp ${regional.revenue_per_sto.toLocaleString('id-ID')}`
        })),
        
        top_performers: {
          sto_teratas: topPerformers.map(performer => ({
            ranking: performer.ranking,
            regional: performer.regional,
            witel: performer.witel,
            datel: performer.datel,
            sto: performer.sto,
            total_revenue: `Rp ${performer.value.toLocaleString('id-ID')}`,
            growth_rate: typeof performer.growth_rate === 'number' ? `${performer.growth_rate}%` : performer.growth_rate
          }))
        },
        
        detail_sto_sample: data.slice(0, 15).map(item => ({
          periode: `${item.YEAR_ID}-${item.MONTH_ID.toString().padStart(2, '0')}`,
          regional: item.REGIONAL_BILL,
          witel: item.WITEL_BILL,
          datel: item.DATEL,
          kode_sto: item.CSTO,
          nama_sto: item.LSTO,
          total_revenue: `Rp ${item.TOTAL_REVENUE.toLocaleString('id-ID')}`,
          total_pelanggan: item.TOTAL_PELANGGAN.toLocaleString('id-ID'),
          total_ncli: item.TOTAL_NCLI.toLocaleString('id-ID'),
          total_layanan: item.TOTAL_LAYANAN.toLocaleString('id-ID'),
          revenue_per_pelanggan: `Rp ${item.REVENUE_PER_PELANGGAN.toLocaleString('id-ID')}`,
          revenue_per_ncli: `Rp ${item.REVENUE_PER_NCLI.toLocaleString('id-ID')}`,
          pertumbuhan_persen: item.GROWTH_RATE_PERCENT ? `${item.GROWTH_RATE_PERCENT}%` : 'N/A',
          scaling_sustain_flag: item.FLAG_SCALING_SUSTAIN_REVENUE,
          scaling_monthly_flag: item.FLAG_SCALING_MONTHLY_REVENUE
        })),
        
        insight_bisnis: [
          'Identifikasi tren pertumbuhan revenue HSI per STO dengan geographic hierarchy lengkap',
          'Monitoring performa month-over-month growth rate di level STO',
          'Analisis kontribusi new vs recurring vs sustain revenue dalam portfolio HSI',
          'Evaluasi efisiensi revenue per pelanggan dan NCLI di setiap lokasi',
          'Assessment distribution revenue scaling strategy across geographic areas',
          'Baseline untuk forecasting revenue HSI berdasarkan historical trend per STO'
        ],
        
        rekomendasi_aksi: [
          `Fokus pada regional dengan growth rate tinggi untuk maksimalisasi ROI`,
          `Optimasi komposisi revenue melalui ${compositionAnalysis.recommendation}`,
          `Implementasi best practices dari top performing STO ke STO lainnya`,
          `Monitor dan maintain revenue per customer consistency across regions`
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
        focus_area: userInput.toLowerCase().includes('trend') || 
                   userInput.toLowerCase().includes('tren') ? 'trend_analysis' : 'revenue_analysis'
      };
    },
    
    parent: this
  },

  CACHE_DURATION: 3600, // 1 hour
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};