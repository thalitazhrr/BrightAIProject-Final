const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ct0_004',
    RULE_NAME: 'witel_churn_performance_analysis',
    DESCRIPTION: 'Analisis performa churn dan CT0 per witel untuk identifikasi area dengan performance terbaik dan terburuk',
    DATABASE: 'BRIGHTAI_CT0_NAL',
    CATEGORY: 'witel_performance_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_CT0_NAL"),

  KEYWORD_PATTERNS: {
    primary: [
      'churn witel', 'witel churn', 'performa witel', 'witel performance',
      'analisis witel', 'witel analysis', 'kinerja witel',
      'churn per witel', 'witel terbaik', 'witel terburuk'
    ],
    
    supporting: [
      'internet', 'broadband', 'hsi', 'layanan internet',
      'wilayah telkom', 'area', 'regional', 'daerah',
      'churn', 'cabut', 'ct0', 'dinolkan', 'nonaktif',
      'performa', 'performance', 'kinerja', 'achievement'
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
      } else if (lowerInput.includes('witel') && lowerInput.includes('churn') &&
                (lowerInput.includes('performa') || lowerInput.includes('kinerja'))) {
        score = 85;
      } else if (lowerInput.includes('churn') && lowerInput.includes('per witel')) {
        score = 82;
      } else if (lowerInput.includes('witel') &&
                (lowerInput.includes('churn') || lowerInput.includes('performa') || lowerInput.includes('kinerja'))) {
        score = 78;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH WITEL_BASE_DATA AS (
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
            
            -- Calculate service duration
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
                WHEN TO_NUMBER(BW) <= 51200 THEN 'VERY_HIGH_SPEED'
                WHEN TO_NUMBER(BW) > 51200 THEN 'ULTRA_HIGH_SPEED'
                ELSE 'UNKNOWN_SPEED'
            END as kategori_bandwidth
            
        FROM DWH_MOIS.BRIGHTAI_CT0_NAL
        WHERE UPPER(PRODUK) = 'INTERNET'
          AND (CITEM IS NULL OR NOT UPPER(CITEM) LIKE 'WM%')
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMM')
          AND WITEL IS NOT NULL
          AND REGIONAL IS NOT NULL
    ),
    
    WITEL_CHURN_METRICS AS (
        SELECT 
            PERIODE,
            REGIONAL,
            WITEL,
            
            -- Volume metrics
            COUNT(*) as total_churn_ct0,
            COUNT(DISTINCT NCLI) as unique_customers_churn,
            COUNT(DISTINCT SPEEDY) as unique_internet_services,
            COUNT(DISTINCT STO) as jumlah_sto_terdampak,
            COUNT(DISTINCT DIVISI) as jumlah_divisi_terdampak,
            
            -- Service duration analysis
            AVG(masa_layanan_bulan) as rata_masa_layanan,
            MIN(masa_layanan_bulan) as masa_layanan_minimum,
            MAX(masa_layanan_bulan) as masa_layanan_maksimum,
            STDDEV(masa_layanan_bulan) as standar_deviasi_masa_layanan,
            
            -- Early churn analysis (< 6 months)
            COUNT(CASE WHEN masa_layanan_bulan <= 6 THEN 1 END) as early_churn_count,
            ROUND(
                (COUNT(CASE WHEN masa_layanan_bulan <= 6 THEN 1 END) * 100.0 / COUNT(*)), 2
            ) as early_churn_rate,
            
            -- Bandwidth distribution
            COUNT(CASE WHEN kategori_bandwidth = 'LOW_SPEED' THEN 1 END) as churn_low_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'MEDIUM_SPEED' THEN 1 END) as churn_medium_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'HIGH_SPEED' THEN 1 END) as churn_high_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'VERY_HIGH_SPEED' THEN 1 END) as churn_very_high_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'ULTRA_HIGH_SPEED' THEN 1 END) as churn_ultra_high_speed,
            
            -- Division distribution
            COUNT(CASE WHEN DIVISI = 'DBS' THEN 1 END) as churn_dbs,
            COUNT(CASE WHEN DIVISI = 'RBS' THEN 1 END) as churn_rbs,
            COUNT(CASE WHEN DIVISI = 'DSS' THEN 1 END) as churn_dss,
            COUNT(CASE WHEN DIVISI = 'DES' THEN 1 END) as churn_des,
            COUNT(CASE WHEN DIVISI = 'DPS' THEN 1 END) as churn_dps,
            COUNT(CASE WHEN DIVISI = 'DGS' THEN 1 END) as churn_dgs,
            
            -- Temporal analysis
            COUNT(CASE WHEN TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) <= 10 THEN 1 END) as churn_awal_bulan,
            COUNT(CASE WHEN TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) BETWEEN 11 AND 20 THEN 1 END) as churn_tengah_bulan,
            COUNT(CASE WHEN TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) > 20 THEN 1 END) as churn_akhir_bulan
            
        FROM WITEL_BASE_DATA
        WHERE masa_layanan_bulan IS NOT NULL
        GROUP BY PERIODE, REGIONAL, WITEL
    ),
    
    WITEL_PERFORMANCE_ANALYSIS AS (
        SELECT t.PERIODE,
            t.REGIONAL,
            t.WITEL,
            t.total_churn_ct0,
            t.unique_customers_churn,
            t.unique_internet_services,
            t.jumlah_sto_terdampak,
            t.jumlah_divisi_terdampak,
            t.rata_masa_layanan,
            t.masa_layanan_minimum,
            t.masa_layanan_maksimum,
            t.standar_deviasi_masa_layanan,
            t.early_churn_count,
            t.early_churn_rate,
            t.churn_low_speed,
            t.churn_medium_speed,
            t.churn_high_speed,
            t.churn_very_high_speed,
            t.churn_ultra_high_speed,
            t.churn_dbs,
            t.churn_rbs,
            t.churn_dss,
            t.churn_des,
            t.churn_dps,
            t.churn_dgs,
            t.churn_awal_bulan,
            t.churn_tengah_bulan,
            t.churn_akhir_bulan,
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
            
            -- Rankings
            RANK() OVER (PARTITION BY PERIODE ORDER BY total_churn_ct0 DESC) as ranking_worst_churn,
            RANK() OVER (PARTITION BY PERIODE ORDER BY total_churn_ct0 ASC) as ranking_best_churn,
            RANK() OVER (PARTITION BY PERIODE ORDER BY early_churn_rate DESC) as ranking_worst_early_churn,
            RANK() OVER (PARTITION BY PERIODE ORDER BY rata_masa_layanan DESC) as ranking_customer_loyalty,
            
            -- Percentage contribution to regional churn
            ROUND(
                (total_churn_ct0 * 100.0 / NULLIF(SUM(total_churn_ct0) OVER (PARTITION BY PERIODE, REGIONAL), 0)), 2
            ) as kontribusi_persen_regional,
            
            -- Trend calculation
            LAG(total_churn_ct0) OVER (
                PARTITION BY REGIONAL, WITEL 
                ORDER BY PERIODE
            ) as prev_churn_count,
            
            LAG(early_churn_rate) OVER (
                PARTITION BY REGIONAL, WITEL 
                ORDER BY PERIODE
            ) as prev_early_churn_rate
            
        FROM WITEL_CHURN_METRICS t
    )
    
    SELECT 
        PERIODE,
        REGIONAL,
        WITEL,
        total_churn_ct0,
        unique_customers_churn,
        unique_internet_services,
        jumlah_sto_terdampak,
        jumlah_divisi_terdampak,
        ROUND(rata_masa_layanan, 2) as rata_masa_layanan,
        early_churn_count,
        early_churn_rate,
        kategori_performa,
        tingkat_risiko_early_churn,
        ranking_worst_churn,
        ranking_best_churn,
        ranking_worst_early_churn,
        ranking_customer_loyalty,
        kontribusi_persen_regional,
        
        -- Bandwidth distribution
        churn_low_speed, churn_medium_speed, churn_high_speed, 
        churn_very_high_speed, churn_ultra_high_speed,
        
        -- Division distribution
        churn_dbs, churn_rbs, churn_dss, churn_des, churn_dps, churn_dgs,
        
        -- Temporal distribution
        churn_awal_bulan, churn_tengah_bulan, churn_akhir_bulan,
        
        -- Trend indicators
        CASE 
            WHEN prev_churn_count IS NULL THEN 'PERIODE_BARU'
            WHEN total_churn_ct0 > prev_churn_count THEN 'MEMBURUK'
            WHEN total_churn_ct0 = prev_churn_count THEN 'STABIL'
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
            WHEN prev_churn_count IS NOT NULL AND prev_churn_count > 0 THEN 
                ROUND(((total_churn_ct0 - prev_churn_count) * 100.0 / prev_churn_count), 2)
            ELSE NULL
        END as perubahan_churn_pct,
        
        CASE 
            WHEN prev_early_churn_rate IS NOT NULL AND prev_early_churn_rate > 0 THEN 
                ROUND(early_churn_rate - prev_early_churn_rate, 2)
            ELSE NULL
        END as perubahan_early_churn_rate
        
    FROM WITEL_PERFORMANCE_ANALYSIS
    ORDER BY PERIODE DESC, total_churn_ct0 DESC
  `,

  BUSINESS_LOGIC: {
    assessWitelPerformance: function(kategori_performa, tingkat_risiko, trend_churn) {
      const performanceAssessment = {
        'PERFORMA_BURUK': {
          description: 'Witel memiliki tingkat churn sangat tinggi dan memerlukan intervensi segera',
          recommendation: 'Audit menyeluruh operasional, kualitas layanan, dan strategi customer retention'
        },
        'PERFORMA_SEDANG': {
          description: 'Witel memiliki tingkat churn moderat namun masih perlu perbaikan',
          recommendation: 'Focus pada root cause analysis dan implementasi improvement program'
        },
        'PERFORMA_BAIK': {
          description: 'Witel menunjukkan performa churn yang dapat diterima',
          recommendation: 'Maintain current performance dan identifikasi best practices'
        },
        'PERFORMA_SANGAT_BAIK': {
          description: 'Witel menunjukkan performa churn excellent dan dapat dijadikan benchmark',
          recommendation: 'Dokumentasi best practices untuk replikasi ke witel lain'
        }
      };
      
      return performanceAssessment[kategori_performa];
    },
    
    identifyWitelIssues: function(early_churn_rate, rata_masa_layanan, kontribusi_persen) {
      const issues = [];
      
      if (early_churn_rate > 30) {
        issues.push('Tingkat early churn tinggi menunjukkan masalah onboarding atau kualitas instalasi');
      }
      
      if (rata_masa_layanan < 12) {
        issues.push('Rata-rata masa layanan rendah mengindikasikan customer loyalty yang lemah');
      }
      
      if (kontribusi_persen > 40) {
        issues.push('Witel berkontribusi besar terhadap churn regional - perlu prioritas penanganan');
      }
      
      if (early_churn_rate > 25 && rata_masa_layanan < 18) {
        issues.push('Kombinasi high early churn dan low retention menunjukkan masalah sistemik');
      }
      
      return issues.length > 0 ? issues : ['Tidak ada masalah kritis yang teridentifikasi'];
    },
    
    generateWitelActionPlan: function(kategori_performa, tingkat_risiko, ranking_worst) {
      const actionPlans = {
        'PERFORMA_BURUK': [
          'Penugasan tim khusus segera untuk manajemen krisis',
          'Survei kepuasan pelanggan komprehensif dan analisis umpan balik',
          'Audit teknis infrastruktur dan kualitas layanan',
          'Pelatihan intensif staf untuk layanan pelanggan dan dukungan teknis',
          'Program retensi darurat dengan penawaran khusus'
        ],
        'PERFORMA_SEDANG': [
          'Analisis akar masalah detail untuk identifikasi kesenjangan',
          'Pemetaan perjalanan pelanggan untuk peluang perbaikan',
          'Benchmarking kompetitif dengan witel terbaik',
          'Inisiatif perbaikan proses dan standardisasi SOP',
          'Program keterlibatan pelanggan proaktif'
        ],
        'PERFORMA_BAIK': [
          'Implementasi program perbaikan berkelanjutan',
          'Peningkatan sistem pemantauan umpan balik pelanggan',
          'Optimalisasi program penjualan silang dan peningkatan produk',
          'Penguatan program pemeliharaan preventif',
          'Implementasi dashboard pemantauan kinerja'
        ],
        'PERFORMA_SANGAT_BAIK': [
          'Dokumentasi praktik terbaik dan berbagi pengetahuan',
          'Program mentoring untuk witel dengan performa rendah',
          'Program percontohan inovasi untuk peningkatan layanan',
          'Pengembangan program advokasi pelanggan',
          'Program pengakuan keunggulan dan insentif'
        ]
      };
      
      return actionPlans[kategori_performa] || ['Kembangkan strategi perbaikan khusus'];
    },
    
    generateBenchmarkComparison: function(data) {
      const sortedByChurn = [...data].sort((a, b) => a.TOTAL_CHURN_CT0 - b.TOTAL_CHURN_CT0);
      const best_performers = sortedByChurn.slice(0, 3);
      const worst_performers = sortedByChurn.slice(-3).reverse();
      
      return {
        best_performers: best_performers.map(w => ({
          witel: w.WITEL,
          regional: w.REGIONAL,
          total_churn: w.TOTAL_CHURN_CT0,
          early_churn_rate: w.EARLY_CHURN_RATE,
          rata_masa_layanan: w.RATA_MASA_LAYANAN
        })),
        worst_performers: worst_performers.map(w => ({
          witel: w.WITEL,
          regional: w.REGIONAL,  
          total_churn: w.TOTAL_CHURN_CT0,
          early_churn_rate: w.EARLY_CHURN_RATE,
          rata_masa_layanan: w.RATA_MASA_LAYANAN
        }))
      };
    },
    
    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const hasil_analisis = data.map(record => {
        const performance_assessment = this.assessWitelPerformance(
          record.KATEGORI_PERFORMA,
          record.TINGKAT_RISIKO_EARLY_CHURN,
          record.TREND_CHURN
        );
        
        const witel_issues = this.identifyWitelIssues(
          record.EARLY_CHURN_RATE,
          record.RATA_MASA_LAYANAN,
          record.KONTRIBUSI_PERSEN_REGIONAL
        );
        
        const action_plan = this.generateWitelActionPlan(
          record.KATEGORI_PERFORMA,
          record.TINGKAT_RISIKO_EARLY_CHURN,
          record.RANKING_WORST_CHURN
        );
        
        return {
          informasi_witel: {
            periode: record.PERIODE,
            regional: record.REGIONAL,
            witel: record.WITEL,
            kategori_performa: record.KATEGORI_PERFORMA
          },
          metrik_churn: {
            total_churn_ct0: record.TOTAL_CHURN_CT0.toLocaleString('id-ID'),
            unique_customers_churn: record.UNIQUE_CUSTOMERS_CHURN.toLocaleString('id-ID'),
            jumlah_sto_terdampak: record.JUMLAH_STO_TERDAMPAK,
            jumlah_divisi_terdampak: record.JUMLAH_DIVISI_TERDAMPAK,
            rata_masa_layanan: `${record.RATA_MASA_LAYANAN} bulan`
          },
          analisis_early_churn: {
            early_churn_count: record.EARLY_CHURN_COUNT,
            early_churn_rate: `${record.EARLY_CHURN_RATE}%`,
            tingkat_risiko: record.TINGKAT_RISIKO_EARLY_CHURN
          },
          ranking_performance: {
            ranking_worst_churn: record.RANKING_WORST_CHURN,
            ranking_best_churn: record.RANKING_BEST_CHURN,
            ranking_worst_early_churn: record.RANKING_WORST_EARLY_CHURN,
            ranking_customer_loyalty: record.RANKING_CUSTOMER_LOYALTY,
            kontribusi_persen_regional: `${record.KONTRIBUSI_PERSEN_REGIONAL}%`
          },
          distribusi_bandwidth: {
            low_speed: record.CHURN_LOW_SPEED,
            medium_speed: record.CHURN_MEDIUM_SPEED,
            high_speed: record.CHURN_HIGH_SPEED,
            very_high_speed: record.CHURN_VERY_HIGH_SPEED,
            ultra_high_speed: record.CHURN_ULTRA_HIGH_SPEED
          },
          distribusi_divisi: {
            dbs: record.CHURN_DBS,
            rbs: record.CHURN_RBS,
            dss: record.CHURN_DSS,
            des: record.CHURN_DES,
            dps: record.CHURN_DPS,
            dgs: record.CHURN_DGS
          },
          pola_temporal: {
            churn_awal_bulan: record.CHURN_AWAL_BULAN,
            churn_tengah_bulan: record.CHURN_TENGAH_BULAN,
            churn_akhir_bulan: record.CHURN_AKHIR_BULAN
          },
          analisis_trend: {
            trend_churn: record.TREND_CHURN,
            trend_early_churn: record.TREND_EARLY_CHURN,
            perubahan_churn_pct: record.PERUBAHAN_CHURN_PCT ? `${record.PERUBAHAN_CHURN_PCT}%` : 'N/A',
            perubahan_early_churn_rate: record.PERUBAHAN_EARLY_CHURN_RATE ? `${record.PERUBAHAN_EARLY_CHURN_RATE}%` : 'N/A'
          },
          assessment: {
            deskripsi: performance_assessment.description,
            rekomendasi: performance_assessment.recommendation
          },
          masalah_teridentifikasi: witel_issues,
          rencana_aksi: action_plan
        };
      });
      
      const benchmark = this.generateBenchmarkComparison(data);
      
      return {
        ringkasan: 'Analisis Performa Churn per Witel',
        benchmark_comparison: benchmark,
        insight_utama: hasil_analisis,
        kategori_performa: {
          sangat_baik: '< 20 churn/bulan',
          baik: '20-49 churn/bulan',
          sedang: '50-99 churn/bulan',
          buruk: '≥ 100 churn/bulan'
        },
        early_churn_threshold: {
          sangat_rendah: '< 15%',
          rendah: '15-24%',
          sedang: '25-39%',
          tinggi: '≥ 40%'
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
        focus_area: 'witel_performance_analysis'
      };
    },
    
  },

  CACHE_DURATION: 1800,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};