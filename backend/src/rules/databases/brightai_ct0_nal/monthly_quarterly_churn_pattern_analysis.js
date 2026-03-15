const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ct0_005',
    RULE_NAME: 'monthly_quarterly_churn_pattern_analysis',
    DESCRIPTION: 'Analisis pola churn bulanan dan kuartalan untuk identifikasi trend temporal dan strategi berdasarkan historical pattern',
    DATABASE: 'BRIGHTAI_CT0_NAL',
    CATEGORY: 'temporal_pattern_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'MEDIUM',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_CT0_NAL"),

  KEYWORD_PATTERNS: {
    primary: [
      'pola bulanan', 'monthly pattern', 'churn bulanan', 'monthly churn',
      'pola kuartalan', 'trend bulanan', 'pattern bulanan',
      'analisis bulanan', 'kuartalan churn', 'pattern kuartalan'
    ],
    
    supporting: [
      'internet', 'broadband', 'hsi', 'layanan internet',
      'bulanan', 'monthly', 'kuartalan', 'quarterly',
      'trend', 'pola', 'pattern', 'historis', 'temporal',
      'churn', 'cabut', 'ct0', 'dinolkan', 'analisis'
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
      } else if ((lowerInput.includes('pola') || lowerInput.includes('bulanan')) && 
                (lowerInput.includes('churn') || lowerInput.includes('kuartalan'))) {
        score = 75;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH TEMPORAL_BASE_DATA AS (
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
            
            -- Extract temporal components
            TO_NUMBER(SUBSTR(PERIODE, 1, 4)) as tahun,
            TO_NUMBER(SUBSTR(PERIODE, 5, 2)) as bulan,
            TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) as bulan_churn,
            TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) as tanggal_churn,
            
            -- Quarter classification
            CASE 
                WHEN TO_NUMBER(SUBSTR(PERIODE, 5, 2)) IN (1, 2, 3) THEN 'Q1'
                WHEN TO_NUMBER(SUBSTR(PERIODE, 5, 2)) IN (4, 5, 6) THEN 'Q2'
                WHEN TO_NUMBER(SUBSTR(PERIODE, 5, 2)) IN (7, 8, 9) THEN 'Q3'
                WHEN TO_NUMBER(SUBSTR(PERIODE, 5, 2)) IN (10, 11, 12) THEN 'Q4'
            END as kuartal,
            
            -- Day of month classification
            CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) <= 10 THEN 'AWAL_BULAN'
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) <= 20 THEN 'TENGAH_BULAN'
                ELSE 'AKHIR_BULAN'
            END as periode_bulan,
            
            -- Service duration
            CASE 
                WHEN TGL_PSB IS NOT NULL AND TGL_PS IS NOT NULL THEN 
                    MONTHS_BETWEEN(
                        TO_DATE(TGL_PS, 'YYYYMMDD'),
                        TO_DATE(TGL_PSB, 'YYYYMMDD')
                    )
                ELSE NULL
            END as masa_layanan_bulan,
            
            -- Bandwidth category
            CASE 
                WHEN TO_NUMBER(BW) <= 1024 THEN 'LOW_SPEED'
                WHEN TO_NUMBER(BW) <= 5120 THEN 'MEDIUM_SPEED'
                WHEN TO_NUMBER(BW) <= 10240 THEN 'HIGH_SPEED'
                ELSE 'PREMIUM_SPEED'
            END as kategori_bandwidth
            
        FROM DWH_MOIS.BRIGHTAI_CT0_NAL
        WHERE UPPER(PRODUK) = 'INTERNET'
          AND (CITEM IS NULL OR NOT UPPER(CITEM) LIKE 'WM%')
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -18), 'YYYYMM') -- 18 months for temporal analysis
          AND REGIONAL IS NOT NULL
          AND WITEL IS NOT NULL
    ),
    
    TEMPORAL_AGGREGATION AS (
        SELECT 
            tahun,
            bulan,
            kuartal,
            periode_bulan,
            REGIONAL,
            
            -- Volume metrics
            COUNT(*) as total_churn_ct0,
            COUNT(DISTINCT NCLI) as unique_customers_churn,
            COUNT(DISTINCT SPEEDY) as unique_internet_services,
            COUNT(DISTINCT WITEL) as jumlah_witel_terdampak,
            COUNT(DISTINCT STO) as jumlah_sto_terdampak,
            
            -- Service duration analysis per period
            AVG(masa_layanan_bulan) as rata_masa_layanan,
            MIN(masa_layanan_bulan) as masa_layanan_minimum,
            MAX(masa_layanan_bulan) as masa_layanan_maksimum,
            
            -- Early churn temporal pattern
            COUNT(CASE WHEN masa_layanan_bulan <= 6 THEN 1 END) as early_churn_count,
            ROUND(
                (COUNT(CASE WHEN masa_layanan_bulan <= 6 THEN 1 END) * 100.0 / COUNT(*)), 2
            ) as early_churn_rate,
            
            -- Bandwidth distribution by period
            COUNT(CASE WHEN kategori_bandwidth = 'LOW_SPEED' THEN 1 END) as churn_low_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'MEDIUM_SPEED' THEN 1 END) as churn_medium_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'HIGH_SPEED' THEN 1 END) as churn_high_speed,
            COUNT(CASE WHEN kategori_bandwidth = 'PREMIUM_SPEED' THEN 1 END) as churn_premium_speed,
            
            -- Division pattern
            COUNT(CASE WHEN DIVISI = 'DBS' THEN 1 END) as churn_dbs,
            COUNT(CASE WHEN DIVISI = 'RBS' THEN 1 END) as churn_rbs,
            COUNT(CASE WHEN DIVISI = 'DSS' THEN 1 END) as churn_dss,
            COUNT(CASE WHEN DIVISI = 'DES' THEN 1 END) as churn_des
            
        FROM TEMPORAL_BASE_DATA
        WHERE masa_layanan_bulan IS NOT NULL
        GROUP BY tahun, bulan, kuartal, periode_bulan, REGIONAL
    ),
    
    TEMPORAL_ANALYSIS AS (
        SELECT t.*,
            -- Churn intensity classification
            CASE 
                WHEN total_churn_ct0 >= 150 THEN 'PUNCAK_CHURN'
                WHEN total_churn_ct0 >= 100 THEN 'TINGGI_CHURN'
                WHEN total_churn_ct0 >= 50 THEN 'SEDANG_CHURN'
                ELSE 'RENDAH_CHURN'
            END as intensitas_churn,
            
            -- Year-over-year comparison
            LAG(total_churn_ct0) OVER (
                PARTITION BY bulan, REGIONAL 
                ORDER BY tahun
            ) as churn_tahun_sebelumnya,
            
            -- Monthly trend within same year
            LAG(total_churn_ct0) OVER (
                PARTITION BY tahun, REGIONAL 
                ORDER BY bulan
            ) as churn_bulan_sebelumnya,
            
            -- Monthly ranking
            RANK() OVER (PARTITION BY tahun ORDER BY total_churn_ct0 DESC) as ranking_bulanan,
            RANK() OVER (PARTITION BY tahun, kuartal ORDER BY total_churn_ct0 DESC) as ranking_kuartalan,
            
            -- Moving average for trend smoothing
            AVG(total_churn_ct0) OVER (
                PARTITION BY REGIONAL 
                ORDER BY tahun, bulan 
                ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
            ) as moving_avg_3_month
            
        FROM TEMPORAL_AGGREGATION t
    )
    
    SELECT 
        tahun,
        bulan,
        CASE bulan 
            WHEN 1 THEN 'Januari' WHEN 2 THEN 'Februari' WHEN 3 THEN 'Maret'
            WHEN 4 THEN 'April' WHEN 5 THEN 'Mei' WHEN 6 THEN 'Juni'
            WHEN 7 THEN 'Juli' WHEN 8 THEN 'Agustus' WHEN 9 THEN 'September'
            WHEN 10 THEN 'Oktober' WHEN 11 THEN 'November' WHEN 12 THEN 'Desember'
        END as nama_bulan,
        kuartal,
        periode_bulan,
        REGIONAL,
        total_churn_ct0,
        unique_customers_churn,
        unique_internet_services,
        jumlah_witel_terdampak,
        jumlah_sto_terdampak,
        ROUND(rata_masa_layanan, 2) as rata_masa_layanan,
        early_churn_count,
        early_churn_rate,
        intensitas_churn,
        ranking_bulanan,
        ranking_kuartalan,
        ROUND(moving_avg_3_month, 2) as moving_avg_3_month,
        
        -- Bandwidth distribution
        churn_low_speed, churn_medium_speed, churn_high_speed, churn_premium_speed,
        
        -- Division distribution
        churn_dbs, churn_rbs, churn_dss, churn_des,
        
        -- Year-over-year trend
        CASE 
            WHEN churn_tahun_sebelumnya IS NULL THEN 'TAHUN_PERTAMA'
            WHEN total_churn_ct0 > churn_tahun_sebelumnya THEN 'MENINGKAT_YOY'
            WHEN total_churn_ct0 = churn_tahun_sebelumnya THEN 'STABIL_YOY'
            ELSE 'MENURUN_YOY'
        END as trend_year_over_year,
        
        -- Monthly trend
        CASE 
            WHEN churn_bulan_sebelumnya IS NULL THEN 'BULAN_PERTAMA'
            WHEN total_churn_ct0 > churn_bulan_sebelumnya THEN 'MENINGKAT_MOM'
            WHEN total_churn_ct0 = churn_bulan_sebelumnya THEN 'STABIL_MOM'
            ELSE 'MENURUN_MOM'
        END as trend_month_over_month,
        
        -- Change percentages
        CASE 
            WHEN churn_tahun_sebelumnya IS NOT NULL AND churn_tahun_sebelumnya > 0 THEN 
                ROUND(((total_churn_ct0 - churn_tahun_sebelumnya) * 100.0 / churn_tahun_sebelumnya), 2)
            ELSE NULL
        END as perubahan_yoy_pct,
        
        CASE 
            WHEN churn_bulan_sebelumnya IS NOT NULL AND churn_bulan_sebelumnya > 0 THEN 
                ROUND(((total_churn_ct0 - churn_bulan_sebelumnya) * 100.0 / churn_bulan_sebelumnya), 2)
            ELSE NULL
        END as perubahan_mom_pct
        
    FROM TEMPORAL_ANALYSIS
    ORDER BY tahun DESC, bulan DESC, total_churn_ct0 DESC
  `,

  BUSINESS_LOGIC: {
    identifyTemporalPatterns: function(bulan, intensitas_churn, ranking_bulanan) {
      const monthlyInsights = {
        1: { description: 'Januari sering menunjukkan pola churn tinggi karena evaluasi budget awal tahun', factors: ['Perencanaan budget', 'Kontrak berakhir', 'Resolusi tahun baru'] },
        2: { description: 'Februari biasanya lebih stabil dengan churn yang menurun', factors: ['Stabilisasi pasca liburan', 'Kontrak baru dimulai', 'Fokus kerja meningkat'] },
        3: { description: 'Maret menunjukkan variasi churn tergantung siklus bisnis', factors: ['Akhir Q1', 'Tinjauan budget', 'Penyesuaian operasional'] },
        4: { description: 'April sering ada peningkatan aktivitas dan perubahan kebutuhan', factors: ['Awal Q2', 'Inisiatif baru', 'Evaluasi layanan'] },
        5: { description: 'Mei biasanya stabil dengan churn moderat', factors: ['Perencanaan pertengahan tahun', 'Kontinuitas layanan', 'Operasi stabil'] },
        6: { description: 'Juni menunjukkan pola churn karena pertengahan tahun', factors: ['Tinjauan pertengahan tahun', 'Penyesuaian budget', 'Peningkatan layanan'] },
        7: { description: 'Juli sering ada perubahan karena aktivitas liburan', factors: ['Musim liburan', 'Perubahan sementara', 'Aktivitas keluarga'] },
        8: { description: 'Agustus biasanya kelanjutan dari pola Juli', factors: ['Liburan diperpanjang', 'Kembali ke rutinitas', 'Evaluasi layanan'] },
        9: { description: 'September menunjukkan peningkatan aktivitas kembali', factors: ['Kembali bekerja/sekolah', 'Perencanaan Q3', 'Perubahan kebutuhan layanan'] },
        10: { description: 'Oktober stabil dengan fokus pada persiapan akhir tahun', factors: ['Persiapan Q4', 'Perencanaan budget', 'Tinjauan kinerja'] },
        11: { description: 'November menunjukkan pola persiapan akhir tahun', factors: ['Perencanaan akhir tahun', 'Pembaruan kontrak', 'Finalisasi budget'] },
        12: { description: 'Desember sering ada fluktuasi karena akhir tahun', factors: ['Aktivitas akhir tahun', 'Persiapan liburan', 'Penutupan budget'] }
      };
      
      return monthlyInsights[bulan] || { description: 'Pola churn normal untuk bulan ini', factors: ['Operasi standar'] };
    },
    
    generateTemporalStrategy: function(bulan, intensitas_churn, trend_yoy) {
      const strategies = {
        'high_churn_months': [
          'Pemantauan intensif untuk periode churn tinggi',
          'Program retensi khusus dengan penawaran menarik',
          'Keterlibatan pelanggan proaktif sebelum periode kritis',
          'Analisis mendalam penyebab churn pada bulan ini'
        ],
        'moderate_churn_months': [
          'Program pemeliharaan rutin dan jaminan kualitas',
          'Survei kepuasan pelanggan berkala',
          'Optimalisasi layanan berdasarkan umpan balik',
          'Persiapan untuk periode churn tinggi'
        ],
        'low_churn_months': [
          'Fokus pada akuisisi pelanggan dan pertumbuhan',
          'Peningkatan layanan dan inovasi',
          'Dokumentasi praktik terbaik dari periode stabil',
          'Optimalisasi sumber daya untuk efisiensi'
        ],
        'transition_months': [
          'Strategi fleksibel sesuai dengan pola historis',
          'Persiapan untuk perubahan pola churn',
          'Pendekatan layanan pelanggan yang adaptif',
          'Pemantauan indikator utama dengan ketat'
        ]
      };
      
      // Determine strategy type based on intensity
      let strategyType = 'moderate_churn_months';
      if (intensitas_churn === 'PUNCAK_CHURN' || intensitas_churn === 'TINGGI_CHURN') {
        strategyType = 'high_churn_months';
      } else if (intensitas_churn === 'RENDAH_CHURN') {
        strategyType = 'low_churn_months';
      } else if (trend_yoy === 'MENINGKAT_YOY') {
        strategyType = 'transition_months';
      }
      
      return strategies[strategyType];
    },
    
    predictChurnRisk: function(trend_yoy, trend_mom, moving_avg) {
      let riskLevel = 'RENDAH';
      const riskFactors = [];
      
      if (trend_yoy === 'MENINGKAT_YOY') {
        riskLevel = 'TINGGI';
        riskFactors.push('Tren churn year-over-year meningkat');
      }
      
      if (trend_mom === 'MENINGKAT_MOM') {
        riskLevel = riskLevel === 'TINGGI' ? 'SANGAT_TINGGI' : 'SEDANG';
        riskFactors.push('Tren churn month-over-month meningkat');
      }
      
      if (moving_avg > 100) {
        riskLevel = riskLevel === 'RENDAH' ? 'SEDANG' : 'TINGGI';
        riskFactors.push('Moving average churn tinggi dalam 3 bulan terakhir');
      }
      
      return {
        risk_level: riskLevel,
        risk_factors: riskFactors.length > 0 ? riskFactors : ['Tidak ada faktor risiko signifikan']
      };
    },
    
    analyzeHistoricalPattern: function(data) {
      // Analyze historical patterns without forecasting
      const monthlyData = data.reduce((acc, record) => {
        const month = record.BULAN;
        if (!acc[month]) {
          acc[month] = {
            total_records: 0,
            total_churn: 0,
            nama_bulan: record.NAMA_BULAN
          };
        }
        acc[month].total_records++;
        acc[month].total_churn += record.TOTAL_CHURN_CT0;
        return acc;
      }, {});
      
      const historical_pattern = Object.keys(monthlyData).map(month => ({
        bulan: parseInt(month),
        nama_bulan: monthlyData[month].nama_bulan,
        rata_churn_historis: Math.round(monthlyData[month].total_churn / monthlyData[month].total_records),
        kategori_historis: monthlyData[month].total_churn / monthlyData[month].total_records >= 100 ? 'TINGGI' : 'SEDANG'
      })).sort((a, b) => a.bulan - b.bulan);
      
      return historical_pattern;
    },
    
    formatIndonesianResponse: function(data) {
      const hasil_analisis = data.map(record => {
        const temporal_patterns = this.identifyTemporalPatterns(
          record.BULAN,
          record.INTENSITAS_CHURN,
          record.RANKING_BULANAN
        );
        
        const temporal_strategy = this.generateTemporalStrategy(
          record.BULAN,
          record.INTENSITAS_CHURN,
          record.TREND_YEAR_OVER_YEAR
        );
        
        const churn_risk = this.predictChurnRisk(
          record.TREND_YEAR_OVER_YEAR,
          record.TREND_MONTH_OVER_MONTH,
          record.MOVING_AVG_3_MONTH
        );
        
        return {
          informasi_periode: {
            tahun: record.TAHUN,
            bulan: record.BULAN,
            nama_bulan: record.NAMA_BULAN,
            kuartal: record.KUARTAL,
            periode_bulan: record.PERIODE_BULAN,
            regional: record.REGIONAL
          },
          metrik_churn: {
            total_churn_ct0: record.TOTAL_CHURN_CT0.toLocaleString('id-ID'),
            unique_customers_churn: record.UNIQUE_CUSTOMERS_CHURN.toLocaleString('id-ID'),
            unique_internet_services: record.UNIQUE_INTERNET_SERVICES.toLocaleString('id-ID'),
            jumlah_witel_terdampak: record.JUMLAH_WITEL_TERDAMPAK,
            jumlah_sto_terdampak: record.JUMLAH_STO_TERDAMPAK,
            rata_masa_layanan: `${record.RATA_MASA_LAYANAN} bulan`,
            early_churn_count: record.EARLY_CHURN_COUNT,
            early_churn_rate: `${record.EARLY_CHURN_RATE}%`
          },
          analisis_intensitas: {
            intensitas_churn: record.INTENSITAS_CHURN,
            ranking_bulanan: record.RANKING_BULANAN,
            ranking_kuartalan: record.RANKING_KUARTALAN,
            moving_avg_3_month: record.MOVING_AVG_3_MONTH
          },
          analisis_trend: {
            trend_year_over_year: record.TREND_YEAR_OVER_YEAR,
            trend_month_over_month: record.TREND_MONTH_OVER_MONTH,
            perubahan_yoy_pct: record.PERUBAHAN_YOY_PCT ? `${record.PERUBAHAN_YOY_PCT}%` : 'N/A',
            perubahan_mom_pct: record.PERUBAHAN_MOM_PCT ? `${record.PERUBAHAN_MOM_PCT}%` : 'N/A'
          },
          distribusi_bandwidth: {
            low_speed: record.CHURN_LOW_SPEED,
            medium_speed: record.CHURN_MEDIUM_SPEED,
            high_speed: record.CHURN_HIGH_SPEED,
            premium_speed: record.CHURN_PREMIUM_SPEED
          },
          distribusi_divisi: {
            dbs: record.CHURN_DBS,
            rbs: record.CHURN_RBS,
            dss: record.CHURN_DSS,
            des: record.CHURN_DES
          },
          pola_temporal: {
            deskripsi: temporal_patterns.description,
            faktor_penyebab: temporal_patterns.factors
          },
          prediksi_risiko: {
            tingkat_risiko: churn_risk.risk_level,
            faktor_risiko: churn_risk.risk_factors
          },
          strategi_temporal: temporal_strategy
        };
      });
      
      const historical_pattern = this.analyzeHistoricalPattern(data);
      
      return {
        ringkasan: 'Analisis Pola Churn Bulanan dan Kuartalan',
        pola_historis_bulanan: historical_pattern,
        insight_utama: hasil_analisis,
        kategori_kuartal: {
          q1: 'Januari, Februari, Maret',
          q2: 'April, Mei, Juni',
          q3: 'Juli, Agustus, September', 
          q4: 'Oktober, November, Desember'
        },
        intensitas_churn: {
          rendah: '< 50 churn/bulan',
          sedang: '50-99 churn/bulan',
          tinggi: '100-149 churn/bulan',
          puncak: '≥ 150 churn/bulan'
        },
        catatan_forecasting: 'Untuk prediksi akurat menggunakan time series forecasting (Prophet), diperlukan implementasi model machine learning terpisah'
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      return {
        matches: confidence >= 70,
        confidence: confidence,
        focus_area: 'temporal_pattern_analysis'
      };
    },
    
  },

  CACHE_DURATION: 1800,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'MEDIUM'
};