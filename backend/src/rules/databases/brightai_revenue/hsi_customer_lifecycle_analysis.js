const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');
module.exports = {
  RULE_META: {
    RULE_ID: 'mart_003',
    RULE_NAME: 'hsi_customer_lifecycle_analysis',
    DESCRIPTION: 'Analisis siklus hidup pelanggan HSI berdasarkan pemasangan dan pencabutan layanan dengan geographic hierarchy',
    DATABASE: 'BRIGHTAI_REVENUE',
    CATEGORY: 'customer_lifecycle',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_REVENUE"),

  KEYWORD_PATTERNS: {
    primary: [
      'lifecycle pelanggan hsi', 'siklus hidup customer hsi', 'analisis customer lifecycle',
      'churn analysis hsi', 'customer retention hsi', 'pemasangan pencabutan hsi',
      'analisis churn internet', 'lifecycle analysis hsi', 'customer journey hsi'
    ],
    supporting: [
      'lifecycle', 'siklus', 'hidup', 'churn', 'retention', 'pemasangan', 'pencabutan',
      'customer', 'pelanggan', 'hsi', 'internet', 'journey', 'cabut', 'pasang',
      'tgl_ps', 'tgl_ca', 'install', 'disconnect', 'analisis'
    ],
    
    calculateConfidence: function(input) {
      const lowerInput = input.toLowerCase();
      let score = 0;

      // Defer to CT0 rules for specific churn analysis patterns
      const hasChurnSpecific = lowerInput.includes('churn') || lowerInput.includes('cabut') || lowerInput.includes('ct0');
      const hasBandwidthCtx = lowerInput.includes('bandwidth') || lowerInput.includes('kecepatan') || lowerInput.includes('speed');
      const hasRegionalCtx = lowerInput.includes('regional') || lowerInput.includes('witel');
      const hasDivisiCtx = lowerInput.includes('divisi') || lowerInput.includes('bisnis dan consumer');
      if (hasChurnSpecific && (hasBandwidthCtx || hasRegionalCtx || hasDivisiCtx)) return 0;

      const primaryMatches = this.primary.filter(keyword =>
        lowerInput.includes(keyword.toLowerCase())
      ).length;

      const supportingMatches = this.supporting.filter(keyword =>
        lowerInput.includes(keyword.toLowerCase())
      ).length;

      if (primaryMatches > 0) {
        score = 85 + (primaryMatches * 8) + (supportingMatches * 2);
      } else if (supportingMatches >= 3) {
        score = 70 + (supportingMatches * 4);
      }

      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH CUSTOMER_LIFECYCLE AS (
        SELECT 
            YEAR_ID,
            MONTH_ID,
            REGIONAL_BILL,
            WITEL_BILL,
            DATEL,
            CSTO,
            NIP_NAS,
            NCLI,
            ND,
            TGL_PS,
            TGL_CA,
            REVENUE,
            
            -- Install analysis
            CASE 
                WHEN TGL_PS IS NOT NULL 
                AND SUBSTR(TGL_PS, 1, 4) = YEAR_ID 
                AND SUBSTR(TGL_PS, 5, 2) = MONTH_ID 
                THEN 'NEW_INSTALL'
                ELSE 'EXISTING'
            END as INSTALL_STATUS,
            
            -- Disconnect analysis  
            CASE 
                WHEN TGL_CA IS NOT NULL 
                AND SUBSTR(TGL_CA, 1, 4) = YEAR_ID 
                AND SUBSTR(TGL_CA, 5, 2) = MONTH_ID
                THEN 'DISCONNECTED'
                ELSE 'ACTIVE'
            END as DISCONNECT_STATUS,
            
            -- Customer tenure calculation (months)
            CASE 
                WHEN TGL_PS IS NOT NULL AND LENGTH(TGL_PS) >= 6
                THEN ROUND(
                    MONTHS_BETWEEN(
                        TO_DATE(YEAR_ID || LPAD(MONTH_ID, 2, '0'), 'YYYYMM'),
                        TO_DATE(SUBSTR(TGL_PS, 1, 6), 'YYYYMM')
                    ), 0
                )
                ELSE 0
            END as CUSTOMER_TENURE_MONTHS
            
        FROM DWH_MOIS.BRIGHTAI_REVENUE
        WHERE GROUP4 = 'High Speed Internet'
          AND REVENUE > 0
          AND REGIONAL_BILL IS NOT NULL
          AND WITEL_BILL IS NOT NULL
          AND DATEL IS NOT NULL
          AND CSTO IS NOT NULL
          AND NIP_NAS IS NOT NULL
          AND NCLI IS NOT NULL
          AND ND IS NOT NULL
    )
    
    SELECT 
        YEAR_ID,
        MONTH_ID,
        REGIONAL_BILL,
        WITEL_BILL,
        DATEL,
        CSTO,

        -- Customer metrics
        COUNT(DISTINCT NIP_NAS) as TOTAL_PELANGGAN,
        COUNT(DISTINCT NCLI) as TOTAL_NCLI,
        COUNT(DISTINCT ND) as TOTAL_LAYANAN,
        
        -- Installation metrics
        COUNT(CASE WHEN INSTALL_STATUS = 'NEW_INSTALL' THEN 1 END) as NEW_INSTALLATIONS,
        COUNT(CASE WHEN INSTALL_STATUS = 'EXISTING' THEN 1 END) as EXISTING_CUSTOMERS,
        COUNT(DISTINCT CASE WHEN INSTALL_STATUS = 'NEW_INSTALL' THEN NIP_NAS END) as NEW_CUSTOMERS_INSTALLED,
        COUNT(DISTINCT CASE WHEN INSTALL_STATUS = 'NEW_INSTALL' THEN NCLI END) as NEW_NCLI_INSTALLED,
        
        -- Disconnection metrics
        COUNT(CASE WHEN DISCONNECT_STATUS = 'DISCONNECTED' THEN 1 END) as DISCONNECTIONS,
        COUNT(CASE WHEN DISCONNECT_STATUS = 'ACTIVE' THEN 1 END) as ACTIVE_SERVICES,
        COUNT(DISTINCT CASE WHEN DISCONNECT_STATUS = 'DISCONNECTED' THEN NIP_NAS END) as CUSTOMERS_DISCONNECTED,
        COUNT(DISTINCT CASE WHEN DISCONNECT_STATUS = 'DISCONNECTED' THEN NCLI END) as NCLI_DISCONNECTED,
        
        -- Net customer change
        COUNT(CASE WHEN INSTALL_STATUS = 'NEW_INSTALL' THEN 1 END) - 
        COUNT(CASE WHEN DISCONNECT_STATUS = 'DISCONNECTED' THEN 1 END) as NET_SERVICE_CHANGE,
        
        COUNT(DISTINCT CASE WHEN INSTALL_STATUS = 'NEW_INSTALL' THEN NIP_NAS END) - 
        COUNT(DISTINCT CASE WHEN DISCONNECT_STATUS = 'DISCONNECTED' THEN NIP_NAS END) as NET_CUSTOMER_CHANGE,
        
        -- Revenue impact
        SUM(CASE WHEN INSTALL_STATUS = 'NEW_INSTALL' THEN REVENUE ELSE 0 END) as NEW_INSTALL_REVENUE,
        SUM(CASE WHEN DISCONNECT_STATUS = 'DISCONNECTED' THEN REVENUE ELSE 0 END) as LOST_REVENUE,
        SUM(CASE WHEN DISCONNECT_STATUS = 'ACTIVE' THEN REVENUE ELSE 0 END) as RETAINED_REVENUE,
        SUM(REVENUE) as TOTAL_REVENUE,
        
        -- Revenue per metrics
        ROUND(SUM(REVENUE) / NULLIF(COUNT(DISTINCT NIP_NAS), 0), 0) as REVENUE_PER_CUSTOMER,
        ROUND(SUM(REVENUE) / NULLIF(COUNT(DISTINCT NCLI), 0), 0) as REVENUE_PER_NCLI,
        
        -- Customer tenure analysis
        ROUND(AVG(CASE WHEN CUSTOMER_TENURE_MONTHS > 0 THEN CUSTOMER_TENURE_MONTHS END), 1) as AVG_CUSTOMER_TENURE,
        COUNT(CASE WHEN CUSTOMER_TENURE_MONTHS BETWEEN 0 AND 12 THEN 1 END) as CUSTOMERS_0_12_MONTHS,
        COUNT(CASE WHEN CUSTOMER_TENURE_MONTHS BETWEEN 13 AND 24 THEN 1 END) as CUSTOMERS_13_24_MONTHS,
        COUNT(CASE WHEN CUSTOMER_TENURE_MONTHS BETWEEN 25 AND 36 THEN 1 END) as CUSTOMERS_25_36_MONTHS,
        COUNT(CASE WHEN CUSTOMER_TENURE_MONTHS > 36 THEN 1 END) as CUSTOMERS_36_PLUS_MONTHS,
        
        -- Churn rate calculation
        ROUND(
            COUNT(CASE WHEN DISCONNECT_STATUS = 'DISCONNECTED' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
        ) as CHURN_RATE_PERCENT,
        
        -- Retention rate
        ROUND(
            COUNT(CASE WHEN DISCONNECT_STATUS = 'ACTIVE' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
        ) as RETENTION_RATE_PERCENT
        
    FROM CUSTOMER_LIFECYCLE
    GROUP BY YEAR_ID, MONTH_ID, REGIONAL_BILL, WITEL_BILL, DATEL, CSTO
    ORDER BY YEAR_ID DESC, MONTH_ID DESC, REGIONAL_BILL, WITEL_BILL, DATEL, CSTO
  `,

  BUSINESS_LOGIC: {
    assessLifecycleHealth: function(churn_rate, retention_rate, net_customer_change, avg_tenure) {
      let health_score = 0;
      
      // Churn rate assessment (40% weight)
      if (churn_rate <= 2) health_score += 40;
      else if (churn_rate <= 5) health_score += 30;
      else if (churn_rate <= 10) health_score += 20;
      else if (churn_rate <= 15) health_score += 10;
      else health_score += 0;
      
      // Retention rate assessment (30% weight)
      if (retention_rate >= 95) health_score += 30;
      else if (retention_rate >= 90) health_score += 25;
      else if (retention_rate >= 85) health_score += 20;
      else if (retention_rate >= 80) health_score += 15;
      else health_score += 10;
      
      // Net customer change assessment (20% weight)
      if (net_customer_change > 10) health_score += 20;
      else if (net_customer_change > 5) health_score += 15;
      else if (net_customer_change > 0) health_score += 10;
      else if (net_customer_change >= -5) health_score += 5;
      else health_score += 0;
      
      // Average tenure assessment (10% weight)
      if (avg_tenure >= 36) health_score += 10;
      else if (avg_tenure >= 24) health_score += 8;
      else if (avg_tenure >= 12) health_score += 6;
      else health_score += 3;
      
      const healthCategories = {
        'EXCELLENT': {
          description: 'Lifecycle kesehatan customer sangat baik dengan churn rendah dan retention tinggi',
          recommendation: 'Pertahankan best practices dan replicate ke area lain'
        },
        'GOOD': {
          description: 'Lifecycle kesehatan customer baik dengan room for improvement',
          recommendation: 'Optimasi customer experience dan loyalty programs'
        },
        'FAIR': {
          description: 'Lifecycle kesehatan customer cukup dengan beberapa area concern',
          recommendation: 'Focus pada retention initiatives dan churn prevention'
        },
        'POOR': {
          description: 'Lifecycle kesehatan customer memerlukan intervensi segera',
          recommendation: 'Comprehensive turnaround strategy dan customer recovery programs'
        }
      };
      
      let category;
      if (health_score >= 85) category = 'EXCELLENT';
      else if (health_score >= 70) category = 'GOOD';
      else if (health_score >= 50) category = 'FAIR';
      else category = 'POOR';
      
      return {
        health_score: health_score,
        category: category,
        description: healthCategories[category].description,
        recommendation: healthCategories[category].recommendation
      };
    },

    analyzeTenureDistribution: function(tenure_0_12, tenure_13_24, tenure_25_36, tenure_36_plus) {
      const total = tenure_0_12 + tenure_13_24 + tenure_25_36 + tenure_36_plus;
      
      if (total === 0) {
        return {
          distribution_type: 'NO_DATA',
          maturity_level: 'UNKNOWN',
          strategic_focus: 'Data collection required'
        };
      }
      
      const pct_0_12 = (tenure_0_12 / total) * 100;
      const pct_13_24 = (tenure_13_24 / total) * 100;
      const pct_25_36 = (tenure_25_36 / total) * 100;
      const pct_36_plus = (tenure_36_plus / total) * 100;
      
      let distribution_type = '';
      let maturity_level = '';
      let strategic_focus = '';
      
      if (pct_0_12 > 50) {
        distribution_type = 'NEW_CUSTOMER_HEAVY';
        maturity_level = 'GROWTH_PHASE';
        strategic_focus = 'Focus on customer onboarding dan early retention';
      } else if (pct_36_plus > 40) {
        distribution_type = 'MATURE_CUSTOMER_BASE';
        maturity_level = 'MATURE_PHASE';
        strategic_focus = 'Customer loyalty programs dan value-added services';
      } else if (pct_13_24 + pct_25_36 > 50) {
        distribution_type = 'BALANCED_PORTFOLIO';
        maturity_level = 'STABLE_PHASE';
        strategic_focus = 'Balanced retention dan acquisition strategy';
      } else {
        distribution_type = 'FRAGMENTED_BASE';
        maturity_level = 'TRANSITION_PHASE';
        strategic_focus = 'Unified customer lifecycle management approach';
      }
      
      return {
        distribution_type: distribution_type,
        maturity_level: maturity_level,
        strategic_focus: strategic_focus,
        percentages: {
          pct_0_12: pct_0_12.toFixed(1),
          pct_13_24: pct_13_24.toFixed(1),
          pct_25_36: pct_25_36.toFixed(1),
          pct_36_plus: pct_36_plus.toFixed(1)
        }
      };
    },

    calculateCustomerLifetimeValue: function(revenue_per_customer, avg_tenure_months, churn_rate) {
      if (churn_rate === 0 || avg_tenure_months === 0) {
        return {
          clv_estimated: 0,
          clv_category: 'INSUFFICIENT_DATA',
          clv_interpretation: 'Data tidak cukup untuk estimasi CLV'
        };
      }
      
      // Simple CLV calculation: (Revenue per customer * Average tenure) / (1 + (churn_rate/100))
      const monthly_revenue = revenue_per_customer / Math.max(1, avg_tenure_months);
      const churn_adjustment = 1 + (churn_rate / 100);
      const estimated_clv = (revenue_per_customer * avg_tenure_months) / churn_adjustment;
      
      let clv_category = '';
      let clv_interpretation = '';
      
      if (estimated_clv >= 5000000) {
        clv_category = 'HIGH_VALUE';
        clv_interpretation = 'Customer dengan lifetime value tinggi - prioritas retention maksimal';
      } else if (estimated_clv >= 2000000) {
        clv_category = 'MEDIUM_VALUE';
        clv_interpretation = 'Customer dengan lifetime value sedang - balanced retention strategy';
      } else if (estimated_clv >= 500000) {
        clv_category = 'STANDARD_VALUE';
        clv_interpretation = 'Customer dengan lifetime value standard - cost-effective retention';
      } else {
        clv_category = 'LOW_VALUE';
        clv_interpretation = 'Customer dengan lifetime value rendah - selective retention approach';
      }
      
      return {
        clv_estimated: Math.round(estimated_clv),
        clv_category: clv_category,
        clv_interpretation: clv_interpretation
      };
    },

    identifyLifecycleRisks: function(churn_rate, net_customer_change, new_installs, disconnections) {
      const risks = [];
      
      if (churn_rate > 15) {
        risks.push({
          risk_type: 'HIGH_CHURN_RATE',
          severity: 'HIGH',
          description: 'Tingkat churn sangat tinggi mengancam sustainability base customer',
          mitigation: 'Immediate churn prevention programs dan customer satisfaction initiatives'
        });
      } else if (churn_rate > 10) {
        risks.push({
          risk_type: 'ELEVATED_CHURN',
          severity: 'MEDIUM',
          description: 'Tingkat churn di atas normal memerlukan perhatian',
          mitigation: 'Enhanced customer experience dan retention campaigns'
        });
      }
      
      if (net_customer_change < -10) {
        risks.push({
          risk_type: 'CUSTOMER_BASE_DECLINE',
          severity: 'HIGH',
          description: 'Customer base mengalami penurunan signifikan',
          mitigation: 'Aggressive acquisition campaigns dan competitive strategy review'
        });
      } else if (net_customer_change < 0) {
        risks.push({
          risk_type: 'NEGATIVE_GROWTH',
          severity: 'MEDIUM',
          description: 'Pertumbuhan customer negatif',
          mitigation: 'Market penetration improvement dan value proposition enhancement'
        });
      }
      
      if (disconnections > new_installs * 1.5) {
        risks.push({
          risk_type: 'DISCONNECTION_SURGE',
          severity: 'HIGH',
          description: 'Tingkat disconnection jauh melebihi new installations',
          mitigation: 'Root cause analysis disconnections dan emergency retention measures'
        });
      }
      
      if (new_installs === 0) {
        risks.push({
          risk_type: 'ZERO_GROWTH',
          severity: 'MEDIUM',
          description: 'Tidak ada customer acquisition dalam periode ini',
          mitigation: 'Marketing campaign intensification dan market opportunity analysis'
        });
      }
      
      return risks.length > 0 ? risks : [{
        risk_type: 'LOW_RISK',
        severity: 'LOW',
        description: 'Customer lifecycle dalam kondisi relatif sehat',
        mitigation: 'Continue monitoring dan maintain current strategies'
      }];
    },

    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const totalNewInstalls = data.reduce((sum, d) => sum + d.NEW_INSTALLATIONS, 0);
      const totalDisconnections = data.reduce((sum, d) => sum + d.DISCONNECTIONS, 0);
      const totalNetServiceChange = data.reduce((sum, d) => sum + d.NET_SERVICE_CHANGE, 0);
      const totalNetCustomerChange = data.reduce((sum, d) => sum + d.NET_CUSTOMER_CHANGE, 0);
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_REVENUE, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.TOTAL_PELANGGAN, 0);
      const totalNCLI = data.reduce((sum, d) => sum + d.TOTAL_NCLI, 0);
      
      const avgChurnRate = data.length > 0 ? 
        data.reduce((sum, d) => sum + d.CHURN_RATE_PERCENT, 0) / data.length : 0;
      const avgRetentionRate = data.length > 0 ?
        data.reduce((sum, d) => sum + d.RETENTION_RATE_PERCENT, 0) / data.length : 0;
      const avgTenure = data.length > 0 ?
        data.filter(d => d.AVG_CUSTOMER_TENURE).reduce((sum, d) => sum + d.AVG_CUSTOMER_TENURE, 0) / 
        data.filter(d => d.AVG_CUSTOMER_TENURE).length : 0;
      
      // Advanced analytics
      const lifecycleHealth = this.assessLifecycleHealth(
        avgChurnRate, avgRetentionRate, totalNetCustomerChange, avgTenure
      );
      
      const tenureDistribution = this.analyzeTenureDistribution(
        data.reduce((sum, d) => sum + d.CUSTOMERS_0_12_MONTHS, 0),
        data.reduce((sum, d) => sum + d.CUSTOMERS_13_24_MONTHS, 0),
        data.reduce((sum, d) => sum + d.CUSTOMERS_25_36_MONTHS, 0),
        data.reduce((sum, d) => sum + d.CUSTOMERS_36_PLUS_MONTHS, 0)
      );
      
      const clvAnalysis = this.calculateCustomerLifetimeValue(
        totalRevenue / totalCustomers, avgTenure, avgChurnRate
      );
      
      const lifecycleRisks = this.identifyLifecycleRisks(
        avgChurnRate, totalNetCustomerChange, totalNewInstalls, totalDisconnections
      );
      
      return {
        ringkasan: 'Analisis siklus hidup pelanggan HSI berdasarkan pemasangan dan pencabutan layanan dengan geographic hierarchy',
        periode_analisis: data.length > 0 ? `${data[0].YEAR_ID}` : 'Data tidak tersedia',
        
        metrik_nasional: {
          total_revenue: `Rp ${totalRevenue.toLocaleString('id-ID')}`,
          total_pelanggan: totalCustomers.toLocaleString('id-ID'),
          total_ncli: totalNCLI.toLocaleString('id-ID'),
          total_pemasangan_baru: totalNewInstalls.toLocaleString('id-ID'),
          total_pencabutan: totalDisconnections.toLocaleString('id-ID'),
          net_service_change: totalNetServiceChange.toLocaleString('id-ID'),
          net_customer_change: totalNetCustomerChange.toLocaleString('id-ID'),
          rata_churn_rate: `${avgChurnRate.toFixed(2)}%`,
          rata_retention_rate: `${avgRetentionRate.toFixed(2)}%`,
          rata_customer_tenure: `${avgTenure.toFixed(1)} bulan`,
          revenue_per_pelanggan: `Rp ${Math.round(totalRevenue / totalCustomers).toLocaleString('id-ID')}`,
          revenue_per_ncli: `Rp ${Math.round(totalRevenue / totalNCLI).toLocaleString('id-ID')}`
        },
        
        analisis_kesehatan_lifecycle: {
          health_score: lifecycleHealth.health_score,
          kategori_kesehatan: lifecycleHealth.category,
          deskripsi: lifecycleHealth.description,
          rekomendasi: lifecycleHealth.recommendation
        },
        
        analisis_distribusi_tenure: {
          tipe_distribusi: tenureDistribution.distribution_type,
          tingkat_maturitas: tenureDistribution.maturity_level,
          fokus_strategis: tenureDistribution.strategic_focus,
          persentase_distribusi: {
            '0-12_bulan': `${tenureDistribution.percentages.pct_0_12}%`,
            '13-24_bulan': `${tenureDistribution.percentages.pct_13_24}%`,
            '25-36_bulan': `${tenureDistribution.percentages.pct_25_36}%`,
            '36_plus_bulan': `${tenureDistribution.percentages.pct_36_plus}%`
          }
        },
        
        customer_lifetime_value: {
          estimasi_clv: `Rp ${clvAnalysis.clv_estimated.toLocaleString('id-ID')}`,
          kategori_clv: clvAnalysis.clv_category,
          interpretasi: clvAnalysis.clv_interpretation
        },
        
        identifikasi_risiko_lifecycle: lifecycleRisks.map(risk => ({
          tipe_risiko: risk.risk_type,
          tingkat_severity: risk.severity,
          deskripsi: risk.description,
          mitigasi: risk.mitigation
        })),
        
        distribusi_tenure_pelanggan: {
          pelanggan_0_12_bulan: data.reduce((sum, d) => sum + d.CUSTOMERS_0_12_MONTHS, 0),
          pelanggan_13_24_bulan: data.reduce((sum, d) => sum + d.CUSTOMERS_13_24_MONTHS, 0),
          pelanggan_25_36_bulan: data.reduce((sum, d) => sum + d.CUSTOMERS_25_36_MONTHS, 0), 
          pelanggan_36_plus_bulan: data.reduce((sum, d) => sum + d.CUSTOMERS_36_PLUS_MONTHS, 0)
        },
        
        revenue_impact: {
          new_install_revenue: `Rp ${data.reduce((sum, d) => sum + d.NEW_INSTALL_REVENUE, 0).toLocaleString('id-ID')}`,
          lost_revenue: `Rp ${data.reduce((sum, d) => sum + d.LOST_REVENUE, 0).toLocaleString('id-ID')}`,
          retained_revenue: `Rp ${data.reduce((sum, d) => sum + d.RETAINED_REVENUE, 0).toLocaleString('id-ID')}`
        },
        
        detail_sto_sample: data.slice(0, 15).map(item => {
          const stoLifecycleHealth = this.assessLifecycleHealth(
            item.CHURN_RATE_PERCENT, 
            item.RETENTION_RATE_PERCENT, 
            item.NET_CUSTOMER_CHANGE, 
            item.AVG_CUSTOMER_TENURE || 0
          );
          
          return {
            periode: `${item.YEAR_ID}-${item.MONTH_ID.toString().padStart(2, '0')}`,
            regional: item.REGIONAL_BILL,
            witel: item.WITEL_BILL,
            datel: item.DATEL,
            kode_sto: item.CSTO,
            total_pelanggan: item.TOTAL_PELANGGAN.toLocaleString('id-ID'),
            total_ncli: item.TOTAL_NCLI.toLocaleString('id-ID'),
            total_layanan: item.TOTAL_LAYANAN.toLocaleString('id-ID'),
            pemasangan_baru: item.NEW_INSTALLATIONS.toLocaleString('id-ID'),
            pelanggan_baru: item.NEW_CUSTOMERS_INSTALLED.toLocaleString('id-ID'),
            ncli_baru: item.NEW_NCLI_INSTALLED.toLocaleString('id-ID'),
            pencabutan: item.DISCONNECTIONS.toLocaleString('id-ID'),
            pelanggan_disconnect: item.CUSTOMERS_DISCONNECTED.toLocaleString('id-ID'),
            ncli_disconnect: item.NCLI_DISCONNECTED.toLocaleString('id-ID'),
            net_service_change: item.NET_SERVICE_CHANGE.toLocaleString('id-ID'),
            net_customer_change: item.NET_CUSTOMER_CHANGE.toLocaleString('id-ID'),
            churn_rate: `${item.CHURN_RATE_PERCENT}%`,
            retention_rate: `${item.RETENTION_RATE_PERCENT}%`,
            rata_tenure_bulan: item.AVG_CUSTOMER_TENURE || 'N/A',
            lifecycle_health_score: stoLifecycleHealth.health_score,
            lifecycle_category: stoLifecycleHealth.category,
            total_revenue: `Rp ${item.TOTAL_REVENUE.toLocaleString('id-ID')}`,
            revenue_per_pelanggan: `Rp ${item.REVENUE_PER_CUSTOMER.toLocaleString('id-ID')}`,
            revenue_per_ncli: `Rp ${item.REVENUE_PER_NCLI.toLocaleString('id-ID')}`,
            new_install_revenue: `Rp ${item.NEW_INSTALL_REVENUE.toLocaleString('id-ID')}`,
            lost_revenue: `Rp ${item.LOST_REVENUE.toLocaleString('id-ID')}`,
            retained_revenue: `Rp ${item.RETAINED_REVENUE.toLocaleString('id-ID')}`
          };
        }),
        
        insight_bisnis: [
          'Monitoring tingkat churn rate dan retention rate pelanggan HSI per STO dengan geographic hierarchy',
          'Analisis net customer dan service growth serta dampaknya terhadap revenue di setiap lokasi',
          'Evaluasi distribusi tenure pelanggan untuk customer lifetime value analysis per area',
          'Identifikasi STO dengan performance lifecycle terbaik berdasarkan churn dan acquisition',
          'Assessment revenue impact dari customer acquisition vs churn di level geographic detail',
          'Tracking customer journey dari pemasangan hingga pencabutan dengan revenue correlation'
        ],
        
        rekomendasi_aksi: [
          `Implementasi ${lifecycleHealth.recommendation}`,
          `Focus pada ${tenureDistribution.strategic_focus}`,
          `Prioritize ${clvAnalysis.clv_category} customer segments`,
          'Develop predictive churn model untuk early intervention',
          'Optimize customer onboarding process untuk meningkatkan early retention'
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
        focus_area: userInput.toLowerCase().includes('churn') || 
                   userInput.toLowerCase().includes('retention') ? 'churn_retention' : 'lifecycle_analysis'
      };
    },
    
  },

  CACHE_DURATION: 3600, // 1 hour
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
}