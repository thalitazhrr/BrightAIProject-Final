const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ct0_006',
    RULE_NAME: 'divisi_churn_comparison_analysis',
    DESCRIPTION: 'Analisis perbandingan tingkat churn antar divisi untuk identifikasi best practice dan area improvement',
    DATABASE: 'BRIGHTAI_CT0_NAL',
    CATEGORY: 'divisi_comparison_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_CT0_NAL"),

  KEYWORD_PATTERNS: {
    primary: [
      'churn divisi', 'divisi churn', 'perbandingan divisi', 'divisi comparison',
      'analisis divisi', 'divisi analysis', 'kinerja divisi',
      'dbs rbs dss', 'divisi performance', 'best practice divisi'
    ],
    
    supporting: [
      'internet', 'broadband', 'hsi', 'layanan internet',
      'dbs', 'rbs', 'dss', 'des', 'dps', 'dgs',
      'churn', 'cabut', 'ct0', 'dinolkan', 'nonaktif',
      'performa', 'performance', 'kinerja', 'comparison'
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
        score = 80 + (primaryMatches * 8) + (supportingMatches * 3);
      } else if (lowerInput.includes('divisi') && 
                (lowerInput.includes('churn') || lowerInput.includes('perbandingan'))) {
        score = 75;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH DIVISI_BASE_ANALYSIS AS (
        SELECT 
            PERIODE,
            REGIONAL,
            WITEL,
            STO,
            DIVISI,
            SPEEDY,
            NCLI,
            PRODUK,
            CITEM,
            BW,
            TGL_PSB,
            TGL_PS,
            
            -- Service duration calculation
            CASE 
                WHEN TGL_PSB IS NOT NULL AND TGL_PS IS NOT NULL THEN 
                    MONTHS_BETWEEN(
                        TO_DATE(TGL_PS, 'YYYYMMDD'),
                        TO_DATE(TGL_PSB, 'YYYYMMDD')
                    )
                ELSE NULL
            END as masa_layanan_bulan,
            
            -- Bandwidth categorization
            CASE 
                WHEN TO_NUMBER(BW) <= 1024 THEN 'LOW_SPEED'
                WHEN TO_NUMBER(BW) <= 5120 THEN 'MEDIUM_SPEED'
                WHEN TO_NUMBER(BW) <= 10240 THEN 'HIGH_SPEED'
                ELSE 'PREMIUM_SPEED'
            END as kategori_bandwidth,
            
            -- Customer segment based on service duration
            CASE 
                WHEN MONTHS_BETWEEN(
                    TO_DATE(TGL_PS, 'YYYYMMDD'),
                    TO_DATE(TGL_PSB, 'YYYYMMDD')
                ) <= 6 THEN 'NEW_CUSTOMER'
                WHEN MONTHS_BETWEEN(
                    TO_DATE(TGL_PS, 'YYYYMMDD'),
                    TO_DATE(TGL_PSB, 'YYYYMMDD')
                ) <= 24 THEN 'REGULAR_CUSTOMER'
                ELSE 'LOYAL_CUSTOMER'
            END as segmen_customer
            
        FROM USR_RPT.BRIGHTAI_CT0_NAL
        WHERE UPPER(PRODUK) = 'INTERNET'
          AND (CITEM IS NULL OR NOT UPPER(CITEM) LIKE 'WM%')
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMM')
          AND DIVISI IS NOT NULL
          AND REGIONAL IS NOT NULL
          AND WITEL IS NOT NULL
    ),
    
    DIVISI_CHURN_METRICS AS (
        SELECT 
            PERIODE,
            REGIONAL,
            DIVISI,
            
            -- Core metrics
            COUNT(*) as total_churn_ct0,
            COUNT(DISTINCT NCLI) as unique_customers_churn,
            COUNT(DISTINCT SPEEDY) as unique_internet_services,
            COUNT(DISTINCT WITEL) as jumlah_witel,
            COUNT(DISTINCT STO) as jumlah_sto,
            
            -- Service duration analysis
            AVG(masa_layanan_bulan) as rata_masa_layanan,
            MIN(masa_layanan_bulan) as masa_layanan_minimum,
            MAX(masa_layanan_bulan) as masa_layanan_maksimum,
            STDDEV(masa_layanan_bulan) as standar_deviasi_masa_layanan,
            
            -- Customer segment analysis
            COUNT(CASE WHEN segmen_customer = 'NEW_CUSTOMER' THEN 1 END) as churn_new_customer,
            COUNT(CASE WHEN segmen_customer = 'REGULAR_CUSTOMER' THEN 1 END) as churn_regular_customer,
            COUNT(CASE WHEN segmen_customer = 'LOYAL_CUSTOMER' THEN 1 END) as churn_loyal_customer,
            
            -- Early churn rate (≤ 6 months)
            ROUND(
                (COUNT(CASE WHEN masa_layanan_bulan <= 6 THEN 1 END) * 100.0 / COUNT(*)), 2
            ) as early_churn_rate,
            
            -- Loyalty churn rate (> 24 months)
            ROUND(
                (COUNT(CASE WHEN masa_layanan_bulan > 24 THEN 1 END) * 100.0 / COUNT(*)), 2
            ) as loyalty_churn_rate,
            
            -- Bandwidth distribution
            COUNT(CASE WHEN kategori_bandwidth = 'LOW_SPEED' THEN 1 END) as churn_low_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'MEDIUM_SPEED' THEN 1 END) as churn_medium_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'HIGH_SPEED' THEN 1 END) as churn_high_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'PREMIUM_SPEED' THEN 1 END) as churn_premium_speed,
            
            -- Temporal patterns
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (1, 2, 3) THEN 1 
            END) as churn_q1,
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (4, 5, 6) THEN 1 
            END) as churn_q2,
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (7, 8, 9) THEN 1 
            END) as churn_q3,
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (10, 11, 12) THEN 1 
            END) as churn_q4
            
        FROM DIVISI_BASE_ANALYSIS
        WHERE masa_layanan_bulan IS NOT NULL
        GROUP BY PERIODE, REGIONAL, DIVISI
    ),
    
    DIVISI_COMPARATIVE_ANALYSIS AS (
        SELECT t.*,
            -- Performance categorization
            CASE 
                WHEN total_churn_ct0 >= 100 THEN 'PERFORMA_BURUK'
                WHEN total_churn_ct0 >= 50 THEN 'PERFORMA_SEDANG'
                WHEN total_churn_ct0 >= 20 THEN 'PERFORMA_BAIK'
                ELSE 'PERFORMA_SANGAT_BAIK'
            END as kategori_performa,
            
            -- Early churn risk assessment
            CASE 
                WHEN early_churn_rate >= 40 THEN 'RISIKO_TINGGI'
                WHEN early_churn_rate >= 25 THEN 'RISIKO_SEDANG'
                WHEN early_churn_rate >= 15 THEN 'RISIKO_RENDAH'
                ELSE 'RISIKO_SANGAT_RENDAH'
            END as tingkat_risiko_early_churn,
            
            -- Customer loyalty assessment
            CASE 
                WHEN loyalty_churn_rate >= 30 THEN 'LOYALITAS_BURUK'
                WHEN loyalty_churn_rate >= 20 THEN 'LOYALITAS_SEDANG'
                WHEN loyalty_churn_rate >= 10 THEN 'LOYALITAS_BAIK'
                ELSE 'LOYALITAS_SANGAT_BAIK'
            END as tingkat_loyalitas,
            
            -- Rankings across divisions
            RANK() OVER (PARTITION BY PERIODE ORDER BY total_churn_ct0 ASC) as ranking_best_performance,
            RANK() OVER (PARTITION BY PERIODE ORDER BY total_churn_ct0 DESC) as ranking_worst_performance,
            RANK() OVER (PARTITION BY PERIODE ORDER BY early_churn_rate ASC) as ranking_best_early_churn,
            RANK() OVER (PARTITION BY PERIODE ORDER BY rata_masa_layanan DESC) as ranking_customer_loyalty,
            
            -- Market share calculation (relative to total churn)
            ROUND(
                (total_churn_ct0 * 100.0 / SUM(total_churn_ct0) OVER (PARTITION BY PERIODE)), 2
            ) as kontribusi_persen_total_churn,
            
            -- Trend analysis
            LAG(total_churn_ct0) OVER (
                PARTITION BY REGIONAL, DIVISI 
                ORDER BY PERIODE
            ) as prev_total_churn,
            
            LAG(early_churn_rate) OVER (
                PARTITION BY REGIONAL, DIVISI 
                ORDER BY PERIODE
            ) as prev_early_churn_rate
            
        FROM DIVISI_CHURN_METRICS t
    )
    
    SELECT 
        PERIODE,
        REGIONAL,
        DIVISI,
        total_churn_ct0,
        unique_customers_churn,
        unique_internet_services,
        jumlah_witel,
        jumlah_sto,
        ROUND(rata_masa_layanan, 2) as rata_masa_layanan,
        ROUND(standar_deviasi_masa_layanan, 2) as standar_deviasi_masa_layanan,
        churn_new_customer,
        churn_regular_customer,
        churn_loyal_customer,
        early_churn_rate,
        loyalty_churn_rate,
        kategori_performa,
        tingkat_risiko_early_churn,
        tingkat_loyalitas,
        ranking_best_performance,
        ranking_worst_performance,
        ranking_best_early_churn,
        ranking_customer_loyalty,
        kontribusi_persen_total_churn,
        
        -- Bandwidth distribution
        churn_low_speed, churn_medium_speed, churn_high_speed, churn_premium_speed,
        
        -- Quarterly distribution
        churn_q1, churn_q2, churn_q3, churn_q4,
        
        -- Trend indicators
        CASE 
            WHEN prev_total_churn IS NULL THEN 'PERIODE_BARU'
            WHEN total_churn_ct0 > prev_total_churn THEN 'MEMBURUK'
            WHEN total_churn_ct0 = prev_total_churn THEN 'STABIL'
            ELSE 'MEMBAIK'
        END as trend_churn,
        
        CASE 
            WHEN prev_early_churn_rate IS NULL THEN 'PERIODE_BARU'
            WHEN early_churn_rate > prev_early_churn_rate THEN 'MEMBURUK'
            WHEN early_churn_rate = prev_early_churn_rate THEN 'STABIL'
            ELSE 'MEMBAIK'
        END as trend_early_churn,
        
        -- Change percentages
        CASE 
            WHEN prev_total_churn IS NOT NULL AND prev_total_churn > 0 THEN 
                ROUND(((total_churn_ct0 - prev_total_churn) * 100.0 / prev_total_churn), 2)
            ELSE NULL
        END as perubahan_churn_pct,
        
        CASE 
            WHEN prev_early_churn_rate IS NOT NULL THEN 
                ROUND(early_churn_rate - prev_early_churn_rate, 2)
            ELSE NULL
        END as perubahan_early_churn_rate
        
    FROM DIVISI_COMPARATIVE_ANALYSIS
    ORDER BY PERIODE DESC, total_churn_ct0 DESC
  `,

  BUSINESS_LOGIC: {
    assessDivisiPerformance: function(divisi, kategori_performa, tingkat_loyalitas, ranking_best) {
      const divisiProfiles = {
        'DBS': 'Divisi Digital Business Services - fokus pada solusi digital enterprise',
        'RBS': 'Regional Business Services - layanan untuk segmen bisnis regional', 
        'DSS': 'Digital Solution Services - solusi teknologi digital terintegrasi',
        'DES': 'Digital Enterprise Services - layanan enterprise dan korporat',
        'DPS': 'Digital Platform Services - platform dan infrastruktur digital',
        'DGS': 'Digital Government Services - layanan untuk sektor pemerintahan'
      };
      
      const performanceAssessment = {
        'PERFORMA_SANGAT_BAIK': {
          description: `${divisi} menunjukkan performa churn excellent dan dapat dijadikan benchmark`,
          recommendation: 'Dokumentasi best practices dan knowledge sharing ke divisi lain'
        },
        'PERFORMA_BAIK': {
          description: `${divisi} memiliki tingkat churn yang dapat diterima dengan ruang untuk improvement`,
          recommendation: 'Maintain performance dan identifikasi opportunity untuk excellence'
        },
        'PERFORMA_SEDANG': {
          description: `${divisi} memiliki tingkat churn moderat yang memerlukan perhatian`,
          recommendation: 'Focus pada customer satisfaction improvement dan retention strategy'
        },
        'PERFORMA_BURUK': {
          description: `${divisi} memiliki tingkat churn tinggi yang memerlukan intervensi segera`,
          recommendation: 'Urgent review terhadap service delivery dan customer experience'
        }
      };
      
      return {
        profile: divisiProfiles[divisi] || `Divisi ${divisi}`,
        assessment: performanceAssessment[kategori_performa]
      };
    },
    
    identifyBestPractices: function(data) {
      const sortedByPerformance = [...data].sort((a, b) => a.TOTAL_CHURN_CT0 - b.TOTAL_CHURN_CT0);
      const bestPerformer = sortedByPerformance[0];
      
      const bestPractices = [];
      
      if (bestPerformer.EARLY_CHURN_RATE < 15) {
        bestPractices.push(`${bestPerformer.DIVISI}: Excellent onboarding process dengan early churn rate hanya ${bestPerformer.EARLY_CHURN_RATE}%`);
      }
      
      if (bestPerformer.RATA_MASA_LAYANAN > 24) {
        bestPractices.push(`${bestPerformer.DIVISI}: Superior customer retention dengan rata-rata masa layanan ${bestPerformer.RATA_MASA_LAYANAN} bulan`);
      }
      
      if (bestPerformer.LOYALTY_CHURN_RATE < 10) {
        bestPractices.push(`${bestPerformer.DIVISI}: Excellent loyalty management dengan churn rate pelanggan loyal hanya ${bestPerformer.LOYALTY_CHURN_RATE}%`);
      }
      
      return bestPractices;
    },
    
    generateDivisiStrategy: function(divisi, kategori_performa, tingkat_loyalitas, ranking_best) {
      const strategies = {
        'PERFORMA_SANGAT_BAIK': [
          'Membangun pusat keunggulan untuk berbagi pengetahuan',
          'Mengembangkan program mentoring untuk divisi lain',
          'Menciptakan laboratorium inovasi untuk peningkatan layanan',
          'Mengimplementasikan program advokasi pelanggan'
        ],
        'PERFORMA_BAIK': [
          'Benchmarking dengan divisi terbaik',
          'Program optimalisasi perjalanan pelanggan',
          'Inisiatif peningkatan kualitas layanan',
          'Program keterlibatan pelanggan proaktif'
        ],
        'PERFORMA_SEDANG': [
          'Analisis kepuasan pelanggan komprehensif',
          'Perbaikan proses penyampaian layanan',
          'Program pengembangan kemampuan staf',
          'Implementasi kampanye retensi pelanggan'
        ],
        'PERFORMA_BURUK': [
          'Tim tanggap darurat untuk manajemen krisis',
          'Audit layanan menyeluruh dan restrukturisasi',
          'Program pemulihan pelanggan intensif',
          'Intervensi kepemimpinan dan manajemen'
        ]
      };
      
      return strategies[kategori_performa] || ['Kembangkan strategi perbaikan khusus'];
    },
    
    compareDivisiMetrics: function(data) {
      const comparison = data.map(record => ({
        divisi: record.DIVISI,
        total_churn: record.TOTAL_CHURN_CT0,
        early_churn_rate: record.EARLY_CHURN_RATE,
        loyalty_churn_rate: record.LOYALTY_CHURN_RATE,
        rata_masa_layanan: record.RATA_MASA_LAYANAN,
        kontribusi_persen: record.KONTRIBUSI_PERSEN_TOTAL_CHURN
      })).sort((a, b) => a.total_churn - b.total_churn);
      
      return comparison;
    },
    
    formatIndonesianResponse: function(data) {
      const hasil_analisis = data.map(record => {
        const divisi_assessment = this.assessDivisiPerformance(
          record.DIVISI,
          record.KATEGORI_PERFORMA,
          record.TINGKAT_LOYALITAS,
          record.RANKING_BEST_PERFORMANCE
        );
        
        const divisi_strategy = this.generateDivisiStrategy(
          record.DIVISI,
          record.KATEGORI_PERFORMA,
          record.TINGKAT_LOYALITAS,
          record.RANKING_BEST_PERFORMANCE
        );
        
        return {
          informasi_divisi: {
            periode: record.PERIODE,
            regional: record.REGIONAL,
            divisi: record.DIVISI,
            profil_divisi: divisi_assessment.profile,
            kategori_performa: record.KATEGORI_PERFORMA
          },
          metrik_churn: {
            total_churn_ct0: record.TOTAL_CHURN_CT0.toLocaleString('id-ID'),
            unique_customers_churn: record.UNIQUE_CUSTOMERS_CHURN.toLocaleString('id-ID'),
            jumlah_witel: record.JUMLAH_WITEL,
            rata_masa_layanan: `${record.RATA_MASA_LAYANAN} bulan`,
            standar_deviasi_masa_layanan: record.STANDAR_DEVIASI_MASA_LAYANAN
          },
          analisis_segmen_customer: {
            churn_new_customer: record.CHURN_NEW_CUSTOMER,
            churn_regular_customer: record.CHURN_REGULAR_CUSTOMER,
            churn_loyal_customer: record.CHURN_LOYAL_CUSTOMER,
            early_churn_rate: `${record.EARLY_CHURN_RATE}%`,
            loyalty_churn_rate: `${record.LOYALTY_CHURN_RATE}%`
          },
          penilaian_kinerja: {
            tingkat_risiko_early_churn: record.TINGKAT_RISIKO_EARLY_CHURN,
            tingkat_loyalitas: record.TINGKAT_LOYALITAS,
            ranking_best_performance: record.RANKING_BEST_PERFORMANCE,
            ranking_worst_performance: record.RANKING_WORST_PERFORMANCE,
            ranking_customer_loyalty: record.RANKING_CUSTOMER_LOYALTY,
            kontribusi_persen_total_churn: `${record.KONTRIBUSI_PERSEN_TOTAL_CHURN}%`
          },
          distribusi_bandwidth: {
            low_speed: record.CHURN_LOW_SPEED,
            medium_speed: record.CHURN_MEDIUM_SPEED,
            high_speed: record.CHURN_HIGH_SPEED,
            premium_speed: record.CHURN_PREMIUM_SPEED
          },
          distribusi_kuartalan: {
            q1: record.CHURN_Q1,
            q2: record.CHURN_Q2,
            q3: record.CHURN_Q3,
            q4: record.CHURN_Q4
          },
          analisis_trend: {
            trend_churn: record.TREND_CHURN,
            trend_early_churn: record.TREND_EARLY_CHURN,
            perubahan_churn_pct: record.PERUBAHAN_CHURN_PCT ? `${record.PERUBAHAN_CHURN_PCT}%` : 'N/A',
            perubahan_early_churn_rate: record.PERUBAHAN_EARLY_CHURN_RATE ? `${record.PERUBAHAN_EARLY_CHURN_RATE}%` : 'N/A'
          },
          assessment: {
            deskripsi: divisi_assessment.assessment.description,
            rekomendasi: divisi_assessment.assessment.recommendation
          },
          strategi_divisi: divisi_strategy
        };
      });
      
      const best_practices = this.identifyBestPractices(data);
      const divisi_comparison = this.compareDivisiMetrics(data);
      
      return {
        ringkasan: 'Analisis Perbandingan Churn antar Divisi',
        perbandingan_divisi: divisi_comparison,
        best_practices: best_practices,
        insight_utama: hasil_analisis,
        kategori_performa: {
          sangat_baik: '< 20 churn/bulan',
          baik: '20-49 churn/bulan', 
          sedang: '50-99 churn/bulan',
          buruk: '≥ 100 churn/bulan'
        },
        divisi_ebis: {
          dbs: 'Digital Business Services',
          rbs: 'Regional Business Services',
          des: 'Digital Enterprise Services',
          dps: 'Digital Platform Services',
          dgs: 'Digital Government Services'
        }
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      return {
        matches: confidence >= 70,
        confidence: confidence,
        focus_area: 'divisi_comparison_analysis'
      };
    },
    
  },

  CACHE_DURATION: 1800,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};