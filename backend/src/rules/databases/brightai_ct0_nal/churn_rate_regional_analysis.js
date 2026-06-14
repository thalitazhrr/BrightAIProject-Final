const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ct0_ebis_001',
    RULE_NAME: 'churn_rate_regional_analysis',
    DESCRIPTION: 'Analisis tingkat churn internet per regional untuk identifikasi area dengan risiko kehilangan pelanggan tertinggi',
    DATABASE: 'BRIGHTAI_CT0_NAL',
    CATEGORY: 'churn_analysis',
    COMPLEXITY: 'MEDIUM',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_CT0_NAL"),

    KEYWORD_PATTERNS: {
    primary: [
      'churn rate', 'tingkat churn', 'cabut pelanggan', 'pelanggan cabut',
      'churn regional', 'churn per regional', 'analisis churn',
      'kehilangan pelanggan', 'pelanggan hilang', 'customer churn'
    ],

    supporting: [
      'internet', 'broadband', 'hsi', 'koneksi internet',
      'regional', 'wilayah', 'area', 'daerah',
      'analisis', 'analysis', 'performa', 'kinerja',
      'ct0', 'dinolkan', 'nonaktif'
    ],

    calculateConfidence: function(inputPengguna) {
      const input = inputPengguna.toLowerCase().trim();
      let score = 0;

      // Negative signals: defer to sibling CT0 rules when specific context present
      const hasDurasiCtx = input.includes('durasi') || input.includes('masa layanan') || input.includes('lama layanan') || input.includes('berlangganan');
      const hasBandwidthCtx = input.includes('bandwidth') || input.includes('kecepatan') || input.includes('speed');
      const hasDivisiCtx = (input.includes('bandingkan') || input.includes('perbandingan') || input.includes('banding')) &&
        (input.includes('bisnis') || input.includes('consumer') || input.includes('divisi'));
      const hasWitelCtx = input.includes('witel') && !input.includes('regional');
      const hasMonthlyCtx = input.includes('bulanan') || input.includes('kuartal') || input.includes('per bulan');

      if (hasDurasiCtx) return 0;      // ct0_002 territory
      if (hasBandwidthCtx) return 0;    // ct0_ebis_003 territory
      if (hasDivisiCtx) return 0;       // ct0_006 territory
      if (hasWitelCtx) return 0;        // ct0_004 territory
      if (hasMonthlyCtx) return 0;      // ct0_005 territory

      const primaryMatches = this.primary.filter(keyword =>
        input.includes(keyword.toLowerCase())
      ).length;

      const supportingMatches = this.supporting.filter(keyword =>
        input.includes(keyword.toLowerCase())
      ).length;

      if (primaryMatches > 0) {
        score = 80 + (primaryMatches * 8) + (supportingMatches * 3);
      } else if (
        (input.includes('churn') || input.includes('cabut')) &&
        (input.includes('regional') || input.includes('internet') || input.includes('hsi'))
      ) {
        score = 75;
      }

      return Math.min(score, 100);
    }
  },


  SQL_QUERY: `
    WITH CHURN_ANALYSIS AS (
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
            
            -- Jumlah pelanggan churn/CT0
            COUNT(*) as total_churn_ct0,
            COUNT(DISTINCT NCLI) as unique_customer_churn,
            COUNT(DISTINCT SPEEDY) as unique_internet_services,
            COUNT(DISTINCT STO) as jumlah_sto_terdampak,
            
            -- Analisis berdasarkan masa layanan
            AVG(
                CASE 
                    WHEN TGL_PSB IS NOT NULL AND TGL_PS IS NOT NULL THEN 
                        MONTHS_BETWEEN(
                            TO_DATE(TGL_PS, 'YYYYMMDD'),
                            TO_DATE(TGL_PSB, 'YYYYMMDD')
                        )
                    ELSE NULL
                END
            ) as rata_rata_masa_layanan_bulan,
            
            -- Distribusi bandwidth yang churn
            STATS_MODE(BW) as bandwidth_churn_terbanyak,
            
            -- Churn berdasarkan divisi
            COUNT(CASE WHEN DIVISI = 'DBS' THEN 1 END) as churn_dbs,
            COUNT(CASE WHEN DIVISI = 'RBS' THEN 1 END) as churn_rbs,
            COUNT(CASE WHEN DIVISI = 'DSS' THEN 1 END) as churn_dss,
            COUNT(CASE WHEN DIVISI = 'DES' THEN 1 END) as churn_des,
            COUNT(CASE WHEN DIVISI = 'DPS' THEN 1 END) as churn_dps,
            COUNT(CASE WHEN DIVISI = 'DGS' THEN 1 END) as churn_dgs,
            
            -- Analisis temporal
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) <= 10 THEN 1 
            END) as churn_awal_bulan,
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) BETWEEN 11 AND 20 THEN 1 
            END) as churn_tengah_bulan,
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 7, 2)) > 20 THEN 1 
            END) as churn_akhir_bulan
            
        FROM DWH_MOIS.BRIGHTAI_CT0_NAL
        WHERE UPPER(PRODUK) = 'INTERNET'
          AND (CITEM IS NULL OR NOT UPPER(CITEM) LIKE 'W%')
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMM')
          AND REGIONAL IS NOT NULL
          AND WITEL IS NOT NULL
        GROUP BY PERIODE, REGIONAL, WITEL, STO, DIVISI, SPEEDY, NCLI, PRODUK, CITEM, BW, TGL_PSB, TGL_PS
    ),
    
    REGIONAL_RANKING AS (
        SELECT t.PERIODE,
            t.REGIONAL,
            t.WITEL,
            t.STO,
            t.DIVISI,
            t.SPEEDY,
            t.NCLI,
            t.PRODUK,
            t.CITEM,
            t.BW,
            t.TGL_PSB,
            t.TGL_PS,
            t.total_churn_ct0,
            t.unique_customer_churn,
            t.unique_internet_services,
            t.jumlah_sto_terdampak,
            t.rata_rata_masa_layanan_bulan,
            t.bandwidth_churn_terbanyak,
            t.churn_dbs,
            t.churn_rbs,
            t.churn_dss,
            t.churn_des,
            t.churn_dps,
            t.churn_dgs,
            t.churn_awal_bulan,
            t.churn_tengah_bulan,
            t.churn_akhir_bulan,
            RANK() OVER (PARTITION BY PERIODE ORDER BY total_churn_ct0 DESC) as ranking_churn_volume,
            RANK() OVER (PARTITION BY PERIODE ORDER BY rata_rata_masa_layanan_bulan ASC) as ranking_churn_cepat,
            
            -- Trend calculation
            LAG(total_churn_ct0) OVER (
                PARTITION BY REGIONAL, WITEL, DIVISI 
                ORDER BY PERIODE
            ) as prev_churn_count,
            
            -- Categorization
            CASE 
                WHEN total_churn_ct0 >= 100 THEN 'TINGGI'
                WHEN total_churn_ct0 >= 50 THEN 'SEDANG'
                WHEN total_churn_ct0 >= 20 THEN 'RENDAH'
                ELSE 'SANGAT_RENDAH'
            END as kategori_churn
            
        FROM CHURN_ANALYSIS t
    )
    
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
        total_churn_ct0,
        unique_customer_churn,
        unique_internet_services,
        jumlah_sto_terdampak,
        ROUND(rata_rata_masa_layanan_bulan, 2) as rata_rata_masa_layanan_bulan,
        bandwidth_churn_terbanyak,
        kategori_churn,
        ranking_churn_volume,
        ranking_churn_cepat,
        churn_dbs, churn_rbs, churn_dss, churn_des, churn_dps, churn_dgs,
        churn_awal_bulan, churn_tengah_bulan, churn_akhir_bulan,
        
        -- Trend indicator
        CASE 
            WHEN prev_churn_count IS NULL THEN 'PERIODE_BARU'
            WHEN total_churn_ct0 > prev_churn_count THEN 'MENINGKAT'
            WHEN total_churn_ct0 = prev_churn_count THEN 'STABIL'
            ELSE 'MENURUN'
        END as trend_churn,
        
        -- Change percentage
        CASE 
            WHEN prev_churn_count IS NOT NULL AND prev_churn_count > 0 THEN 
                ROUND(((total_churn_ct0 - prev_churn_count) * 100.0 / NULLIF(prev_churn_count, 0)), 2)
            ELSE NULL
        END as perubahan_churn_pct
        
    FROM REGIONAL_RANKING
    ORDER BY PERIODE DESC, total_churn_ct0 DESC
  `,

  BUSINESS_LOGIC: {
    assessChurnLevel: function(total_churn, kategori_churn, trend_churn) {
      const churnAssessment = {
        'TINGGI': {
          description: 'Tingkat churn sangat tinggi memerlukan perhatian segera',
          recommendation: 'Implementasi program retensi pelanggan dan analisis root cause'
        },
        'SEDANG': {
          description: 'Tingkat churn moderat namun perlu monitoring ketat',
          recommendation: 'Evaluasi kepuasan pelanggan dan perbaikan layanan'
        },
        'RENDAH': {
          description: 'Tingkat churn dalam batas wajar namun tetap perlu dipantau',
          recommendation: 'Pertahankan kualitas layanan dan tingkatkan engagement'
        },
        'SANGAT_RENDAH': {
          description: 'Tingkat churn sangat rendah menunjukkan loyalitas tinggi',
          recommendation: 'Maintain excellence dan gunakan sebagai best practice'
        }
      };
      
      return churnAssessment[kategori_churn];
    },
    
    identifyChurnFactors: function(rata_masa_layanan, bandwidth_terbanyak, trend_churn) {
      const factors = [];
      
      if (rata_masa_layanan < 12) {
        factors.push('Pelanggan baru cenderung mudah churn - perlu program onboarding yang lebih baik');
      }
      
      if (rata_masa_layanan > 36) {
        factors.push('Pelanggan lama yang churn mungkin karena kompetitor - perlu analisis kompetitif');
      }
      
      if (trend_churn === 'MENINGKAT') {
        factors.push('Tren churn meningkat memerlukan investigasi segera');
      }
      
      factors.push(`Bandwidth ${bandwidth_terbanyak} paling banyak churn - evaluasi paket dan pricing`);
      
      return factors;
    },
    
    generateActionPlan: function(kategori_churn, trend_churn, ranking_volume) {
      const actionPlans = {
        'TINGGI': [
          'Urgent customer retention program dengan personal approach',
          'Root cause analysis untuk identifikasi masalah utama', 
          'Implementasi win-back campaign untuk ex-customers',
          'Review pricing dan value proposition'
        ],
        'SEDANG': [
          'Proactive customer satisfaction survey',
          'Perbaikan kualitas layanan di area bermasalah',
          'Customer loyalty program implementation',
          'Competitive analysis dan benchmarking'
        ],
        'RENDAH': [
          'Maintain service quality standards',
          'Customer feedback monitoring system',
          'Preventive maintenance program',
          'Cross-selling dan up-selling opportunities'
        ],
        'SANGAT_RENDAH': [
          'Document best practices untuk replikasi',
          'Customer advocacy program development',
          'Innovation dalam service delivery',
          'Ekspansi basis pelanggan di area tersebut'
        ]
      };
      
      return actionPlans[kategori_churn] || ['Develop custom retention strategy'];
    },
    
    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const hasil_analisis = data.map(record => {
        const churn_assessment = this.assessChurnLevel(
          record.TOTAL_CHURN_CT0,
          record.KATEGORI_CHURN, 
          record.TREND_CHURN
        );
        
        const churn_factors = this.identifyChurnFactors(
          record.RATA_RATA_MASA_LAYANAN_BULAN,
          record.BANDWIDTH_CHURN_TERBANYAK,
          record.TREND_CHURN
        );
        
        const action_plan = this.generateActionPlan(
          record.KATEGORI_CHURN,
          record.TREND_CHURN,
          record.RANKING_CHURN_VOLUME
        );
        
        return {
          informasi_unit: {
            periode: record.PERIODE,
            regional: record.REGIONAL,
            witel: record.WITEL,
            divisi: record.DIVISI
          },
          metrik_churn: {
            total_churn_ct0: (record.TOTAL_CHURN_CT0 || 0).toLocaleString('id-ID'),
            pelanggan_unik_churn: (record.UNIQUE_CUSTOMER_CHURN || 0).toLocaleString('id-ID'),
            rata_masa_layanan: `${record.RATA_RATA_MASA_LAYANAN_BULAN} bulan`,
            bandwidth_churn_terbanyak: record.BANDWIDTH_CHURN_TERBANYAK,
            kategori_tingkat_churn: record.KATEGORI_CHURN
          },
          analisis_trend: {
            ranking_volume_churn: record.RANKING_CHURN_VOLUME,
            ranking_churn_cepat: record.RANKING_CHURN_CEPAT,
            arah_trend: record.TREND_CHURN,
            perubahan_persen: record.PERUBAHAN_CHURN_PCT ? `${record.PERUBAHAN_CHURN_PCT}%` : 'N/A'
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
          assessment: {
            deskripsi: churn_assessment.description,
            rekomendasi: churn_assessment.recommendation
          },
          faktor_churn: churn_factors,
          rencana_aksi: action_plan
        };
      });
      
      return {
        ringkasan: 'Analisis Tingkat Churn Internet per Regional',
        insight_utama: hasil_analisis,
        benchmark_churn: {
          tingkat_rendah: '< 20 churn/bulan',
          tingkat_sedang: '20-49 churn/bulan', 
          tingkat_tinggi: '50-99 churn/bulan',
          tingkat_kritis: '≥ 100 churn/bulan'
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
        focus_area: 'churn_analysis'
      };
    },
    
  },

  CACHE_DURATION: 1800,
  COMPLEXITY: 'MEDIUM',
  EXECUTION_PRIORITY: 'HIGH'
};