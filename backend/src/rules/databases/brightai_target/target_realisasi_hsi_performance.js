const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'target_001',
    RULE_NAME: 'target_realisasi_hsi_performance',
    DESCRIPTION: 'Analisis performa pencapaian target vs realisasi HSI per region, witel, dan segmen dengan implementasi satuan yang jelas',
    DATABASE: 'BRIGHTAI_TARGET',
    CATEGORY: 'target_analysis',
    COMPLEXITY: 'MEDIUM',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_TARGET"),

  KEYWORD_PATTERNS: {
    primary: [
      // Target performance - yang biasa digunakan
      'target hsi', 'realisasi hsi', 'pencapaian target', 'achievement target',
      'kinerja target', 'target performance', 'capaian hsi',
      
      // Performance analysis familiar terms
      'analisis target', 'target analysis', 'evaluasi pencapaian',
      'performance target', 'target vs actual', 'gap analysis'
    ],
    
    supporting: [
      // Target terms familiar
      'penjualan', 'sales', 'target penjualan', 'realisasi penjualan',
      'achievement', 'pencapaian', 'kinerja', 'performance',
      
      // HSI specific
      'internet', 'broadband', 'high speed', 'hsi',
      'koneksi internet', 'layanan internet',
      
      // Business metrics
      'regional', 'witel', 'telda', 'segmen', 'treg'
    ],
    
    // Confidence calculation — stricter to avoid absorbing target_002..005
    calculateConfidence: function(input) {
      const lowerInput = input.toLowerCase();
      let score = 0;

      // Negative signals: queries aimed at sibling target rules
      const hasSiblingSig =
        lowerInput.includes('segmen') || lowerInput.includes('segment') ||
        lowerInput.includes('kompetitif') || lowerInput.includes('competitive') ||
        lowerInput.includes('benchmark') || lowerInput.includes('ranking') ||
        lowerInput.includes('peringkat');
      // Queries about regional breakdown belong to target_003
      const hasRegionalFocus =
        (lowerInput.includes('per regional') || lowerInput.includes('per wilayah') ||
         lowerInput.includes('per witel') || lowerInput.includes('per treg') ||
         lowerInput.includes('setiap regional') || lowerInput.includes('tiap regional') ||
         lowerInput.includes('masing-masing regional'));
      // Queries about trend/growth belong to target_004
      const hasTrendFocus =
        (lowerInput.includes('tren') || lowerInput.includes('trend') ||
         lowerInput.includes('pertumbuhan') || lowerInput.includes('growth')) &&
        !(lowerInput.includes('realisasi') && lowerInput.includes('target'));

      if (hasSiblingSig || hasRegionalFocus || hasTrendFocus) return 0;

      const primaryMatches = this.primary.filter(keyword =>
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      const supportingMatches = this.supporting.filter(keyword =>
        lowerInput.includes(keyword.toLowerCase())
      ).length;

      if (primaryMatches > 0) {
        score = 80 + (primaryMatches * 10) + (supportingMatches * 2);
      } else if (lowerInput.includes('target') &&
                (lowerInput.includes('realisasi') || lowerInput.includes('pencapaian') || lowerInput.includes('achievement'))) {
        score = 70;
      }

      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_TARGET_ANALYSIS AS (
        SELECT 
            PERIODE,
            SEGMEN,
            LLEVEL,
            TREG,
            WITEL,
            TELDA,
            GROUP_PRODUK,
            SATUAN,
            
            -- Target dan Realisasi dengan Satuan
            SUM(TARGET) as TOTAL_TARGET,
            SUM(REALISASI) as TOTAL_REALISASI,
            
            -- Achievement calculation
            CASE 
                WHEN SUM(TARGET) > 0 THEN 
                    ROUND((SUM(REALISASI) * 100.0 / NULLIF(SUM(TARGET), 0)), 2)
                ELSE 0 
            END as ACHIEVEMENT_PCT,
            
            -- Gap analysis
            SUM(REALISASI) - SUM(TARGET) as GAP_ABSOLUTE,
            CASE 
                WHEN SUM(TARGET) > 0 THEN 
                    ROUND(((SUM(REALISASI) - SUM(TARGET)) * 100.0 / NULLIF(SUM(TARGET), 0)), 2)
                ELSE 0 
            END as GAP_PCT,
            
            -- Performance categorization
            CASE 
                WHEN SUM(TARGET) = 0 THEN 'NO_TARGET'
                WHEN (SUM(REALISASI) * 100.0 / NULLIF(SUM(TARGET), 0)) >= 110 THEN 'SANGAT_BAIK'
                WHEN (SUM(REALISASI) * 100.0 / NULLIF(SUM(TARGET), 0)) >= 100 THEN 'BAIK'
                WHEN (SUM(REALISASI) * 100.0 / NULLIF(SUM(TARGET), 0)) >= 90 THEN 'CUKUP'
                WHEN (SUM(REALISASI) * 100.0 / NULLIF(SUM(TARGET), 0)) >= 75 THEN 'KURANG'
                ELSE 'SANGAT_KURANG'
            END as KATEGORI_PERFORMANCE,
            
            COUNT(*) as JUMLAH_UNIT
            
        FROM DWH_MOIS.BRIGHTAI_TARGET
        WHERE UPPER(PRODUK) = 'HSI'
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMM')
          AND TARGET IS NOT NULL 
          AND REALISASI IS NOT NULL
        GROUP BY PERIODE, SEGMEN, LLEVEL, TREG, WITEL, TELDA, GROUP_PRODUK, SATUAN
    ),
    
    PERFORMANCE_METRICS AS (
        SELECT t.PERIODE,
            t.SEGMEN,
            t.LLEVEL,
            t.TREG,
            t.WITEL,
            t.TELDA,
            t.GROUP_PRODUK,
            t.SATUAN,
            t.TOTAL_TARGET,
            t.TOTAL_REALISASI,
            t.ACHIEVEMENT_PCT,
            t.GAP_ABSOLUTE,
            t.GAP_PCT,
            t.KATEGORI_PERFORMANCE,
            t.JUMLAH_UNIT,
            -- Ranking calculations
            RANK() OVER (PARTITION BY PERIODE, LLEVEL ORDER BY ACHIEVEMENT_PCT DESC) as RANKING_ACHIEVEMENT,
            RANK() OVER (PARTITION BY PERIODE, LLEVEL ORDER BY TOTAL_REALISASI DESC) as RANKING_VOLUME,
            RANK() OVER (PARTITION BY PERIODE, LLEVEL ORDER BY GAP_ABSOLUTE DESC) as RANKING_GAP,
            
            -- Trend indicators (comparing with previous period)
            LAG(ACHIEVEMENT_PCT) OVER (
                PARTITION BY SEGMEN, TREG, WITEL, TELDA 
                ORDER BY PERIODE
            ) as PREV_ACHIEVEMENT_PCT,
            
            -- Performance consistency
            CASE 
                WHEN ACHIEVEMENT_PCT >= 100 THEN 1 
                ELSE 0 
            END as IS_TARGET_ACHIEVED
            
        FROM HSI_TARGET_ANALYSIS t
    ),
    
    TREND_ANALYSIS AS (
        SELECT t.PERIODE,
            t.SEGMEN,
            t.LLEVEL,
            t.TREG,
            t.WITEL,
            t.TELDA,
            t.GROUP_PRODUK,
            t.SATUAN,
            t.TOTAL_TARGET,
            t.TOTAL_REALISASI,
            t.ACHIEVEMENT_PCT,
            t.GAP_ABSOLUTE,
            t.GAP_PCT,
            t.KATEGORI_PERFORMANCE,
            t.JUMLAH_UNIT,
            t.RANKING_ACHIEVEMENT,
            t.RANKING_VOLUME,
            t.RANKING_GAP,
            t.PREV_ACHIEVEMENT_PCT,
            t.IS_TARGET_ACHIEVED,
            -- Trend calculation
            CASE 
                WHEN PREV_ACHIEVEMENT_PCT IS NULL THEN 'NEW_PERIOD'
                WHEN ACHIEVEMENT_PCT > PREV_ACHIEVEMENT_PCT THEN 'IMPROVING'
                WHEN ACHIEVEMENT_PCT = PREV_ACHIEVEMENT_PCT THEN 'STABLE'
                ELSE 'DECLINING'
            END as TREND_DIRECTION,
            
            CASE 
                WHEN PREV_ACHIEVEMENT_PCT IS NOT NULL THEN 
                    ROUND(ACHIEVEMENT_PCT - PREV_ACHIEVEMENT_PCT, 2)
                ELSE NULL
            END as TREND_CHANGE_PCT
            
        FROM PERFORMANCE_METRICS t
    )
    
    SELECT 
        PERIODE,
        SEGMEN,
        LLEVEL,
        TREG,
        WITEL,
        TELDA,
        GROUP_PRODUK,
        SATUAN,
        TOTAL_TARGET,
        TOTAL_REALISASI,
        ACHIEVEMENT_PCT,
        GAP_ABSOLUTE,
        GAP_PCT,
        KATEGORI_PERFORMANCE,
        RANKING_ACHIEVEMENT,
        RANKING_VOLUME,
        TREND_DIRECTION,
        TREND_CHANGE_PCT,
        IS_TARGET_ACHIEVED,
        JUMLAH_UNIT
    FROM TREND_ANALYSIS
    ORDER BY PERIODE DESC, ACHIEVEMENT_PCT DESC
  `,

  BUSINESS_LOGIC: {
    getUnitContext: function(satuan) {
      const unitContexts = {
        'SSL': {
          description: '1 Layanan Terpasang (Service Subscriber Line)',
          interpretation: 'Setiap unit target dan realisasi merepresentasikan satu layanan HSI yang terpasang',
          business_meaning: 'Metrik ini mengukur jumlah pelanggan HSI yang berhasil diaktivasi'
        },
        'UNIT': {
          description: 'Unit Layanan',
          interpretation: 'Setiap unit merepresentasikan satu entitas layanan HSI',
          business_meaning: 'Metrik ini mengukur volume layanan HSI yang diberikan'
        },
        'SUBSCRIBER': {
          description: 'Pelanggan HSI',
          interpretation: 'Setiap unit merepresentasikan satu pelanggan HSI',
          business_meaning: 'Metrik ini mengukur jumlah pelanggan HSI yang terlayani'
        },
        'CONNECTION': {
          description: 'Koneksi HSI',
          interpretation: 'Setiap unit merepresentasikan satu koneksi internet berkecepatan tinggi',
          business_meaning: 'Metrik ini mengukur jumlah koneksi HSI yang aktif'
        }
      };
      
      return unitContexts[satuan] || {
        description: satuan || 'Unit tidak terdefinisi',
        interpretation: 'Satuan khusus sesuai definisi bisnis',
        business_meaning: 'Metrik disesuaikan dengan konteks bisnis spesifik'
      };
    },

    assessTargetPerformance: function(achievement_pct, gap_pct, trend_direction, satuan) {
      const performanceAssessment = {
        'SANGAT_BAIK': {
          description: 'Pencapaian target sangat baik dengan realisasi melebihi 110%',
          recommendation: 'Pertahankan momentum dan evaluasi kemungkinan peningkatan target'
        },
        'BAIK': {
          description: 'Target tercapai dengan baik sesuai ekspektasi',
          recommendation: 'Maintenance performa dan identifikasi area untuk peningkatan'
        },
        'CUKUP': {
          description: 'Pencapaian mendekati target namun masih perlu perbaikan',
          recommendation: 'Fokus pada gap closing dan strategi optimasi'
        },
        'KURANG': {
          description: 'Pencapaian di bawah target dengan gap signifikan',
          recommendation: 'Perlu rencana aksi segera dan analisis akar masalah'
        },
        'SANGAT_KURANG': {
          description: 'Pencapaian jauh di bawah target memerlukan intervensi mendesak',
          recommendation: 'Tindakan perbaikan mendesak dan tinjauan strategis'
        }
      };
      
      const category = this.categorizePerformance(achievement_pct);
      const assessment = performanceAssessment[category];
      
      // Add unit context to assessment
      const unitContext = this.getUnitContext(satuan);
      assessment.unit_context = unitContext;
      
      return assessment;
    },
    
    categorizePerformance: function(achievement_pct) {
      if (achievement_pct >= 110) return 'SANGAT_BAIK';
      if (achievement_pct >= 100) return 'BAIK';
      if (achievement_pct >= 90) return 'CUKUP';
      if (achievement_pct >= 75) return 'KURANG';
      return 'SANGAT_KURANG';
    },
    
    identifyImprovementAreas: function(achievement_pct, gap_pct, trend_direction, satuan) {
      const improvements = [];
      
      // Get unit context for tailored recommendations
      const unitContext = this.getUnitContext(satuan);
      
      if (achievement_pct < 90) {
        if (satuan === 'SSL') {
          improvements.push('Intensifikasi aktivitas pemasaran dan percepatan proses instalasi layanan');
        } else {
          improvements.push('Intensifikasi aktivitas penjualan dan pemasaran produk HSI');
        }
      }
      
      if (gap_pct < -20) {
        if (satuan === 'SSL') {
          improvements.push('Evaluasi kapasitas instalasi dan strategi penetrasi pasar untuk meningkatkan jumlah layanan terpasang');
        } else {
          improvements.push('Tinjauan strategi penetrasi pasar dan posisi kompetitif');
        }
      }
      
      if (trend_direction === 'DECLINING') {
        improvements.push('Analisis penyebab penurunan dan implementasi tindakan korektif');
      }
      
      if (achievement_pct < 75) {
        improvements.push('Evaluasi kapasitas dan alokasi sumber daya');
      }
      
      return improvements.length > 0 ? improvements : ['Pertahankan performa yang sudah baik'];
    },
    
    generateActionPlan: function(kategori_performance, trend_direction, gap_pct) {
      const actionPlans = {
        'SANGAT_BAIK': [
          'Dokumentasi praktik terbaik untuk replikasi ke unit lain',
          'Evaluasi peningkatan target untuk periode selanjutnya',
          'Optimasi sumber daya untuk efisiensi maksimal'
        ],
        'BAIK': [
          'Pertahankan strategi dan performa saat ini',
          'Identifikasi peluang untuk melampaui target',
          'Proses peningkatan berkelanjutan'
        ],
        'CUKUP': [
          'Analisis kesenjangan untuk identifikasi akar masalah',
          'Penyesuaian taktis pada pendekatan penjualan',
          'Peningkatan monitoring dan tracking'
        ],
        'KURANG': [
          'Rencana tindakan korektif segera',
          'Evaluasi realokasi sumber daya',
          'Intensifikasi strategi penetrasi pasar'
        ],
        'SANGAT_KURANG': [
          'Tinjauan strategis mendesak dan intervensi',
          'Analisis akar masalah yang komprehensif',
          'Manajemen krisis dan rencana pemulihan'
        ]
      };
      
      return actionPlans[kategori_performance] || ['Kembangkan rencana aksi khusus'];
    },
    
    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const hasil_analisis = data.map(record => {
        const performance_assessment = this.assessTargetPerformance(
          record.ACHIEVEMENT_PCT,
          record.GAP_PCT,
          record.TREND_DIRECTION,
          record.SATUAN
        );
        
        const improvement_areas = this.identifyImprovementAreas(
          record.ACHIEVEMENT_PCT,
          record.GAP_PCT,
          record.TREND_DIRECTION,
          record.SATUAN
        );
        
        const action_plan = this.generateActionPlan(
          record.KATEGORI_PERFORMANCE,
          record.TREND_DIRECTION,
          record.GAP_PCT
        );
        
        return {
          identitas_unit: {
            periode: record.PERIODE,
            segmen: record.SEGMEN,
            level: record.LLEVEL,
            regional: record.TREG,
            witel: record.WITEL,
            telda: record.TELDA,
            group_produk: record.GROUP_PRODUK
          },
          satuan_target: {
            satuan: record.SATUAN,
            deskripsi_satuan: performance_assessment.unit_context.description,
            interpretasi: performance_assessment.unit_context.interpretation,
            makna_bisnis: performance_assessment.unit_context.business_meaning
          },
          metrik_target: {
            target: `${(record.TOTAL_TARGET || 0).toLocaleString('id-ID')} ${record.SATUAN}`,
            realisasi: `${(record.TOTAL_REALISASI || 0).toLocaleString('id-ID')} ${record.SATUAN}`,
            pencapaian_persen: `${record.ACHIEVEMENT_PCT}%`,
            gap_absolut: `${(record.GAP_ABSOLUTE || 0).toLocaleString('id-ID')} ${record.SATUAN}`,
            gap_persen: `${record.GAP_PCT}%`
          },
          evaluasi_performa: {
            kategori: record.KATEGORI_PERFORMANCE,
            ranking_pencapaian: record.RANKING_ACHIEVEMENT,
            ranking_volume: record.RANKING_VOLUME,
            trend_arah: record.TREND_DIRECTION,
            perubahan_trend: record.TREND_CHANGE_PCT ? `${record.TREND_CHANGE_PCT}%` : 'N/A'
          },
          assessment: {
            deskripsi: performance_assessment.description,
            rekomendasi: performance_assessment.recommendation
          },
          area_perbaikan: improvement_areas,
          rencana_aksi: action_plan
        };
      });
      
      // Summary statistics
      const summary = {
        total_unit_analisis: data.length,
        rata_rata_pencapaian: (data.reduce((sum, d) => sum + d.ACHIEVEMENT_PCT, 0) / (data.length || 1)).toFixed(2) + '%',
        unit_capai_target: data.filter(d => d.IS_TARGET_ACHIEVED === 1).length,
        satuan_dominan: data.reduce((prev, current) => 
          (data.filter(d => d.SATUAN === prev.SATUAN).length > 
           data.filter(d => d.SATUAN === current.SATUAN).length) ? prev : current
        ).SATUAN,
        distribusi_kategori: {
          sangat_baik: data.filter(d => d.KATEGORI_PERFORMANCE === 'SANGAT_BAIK').length,
          baik: data.filter(d => d.KATEGORI_PERFORMANCE === 'BAIK').length,
          cukup: data.filter(d => d.KATEGORI_PERFORMANCE === 'CUKUP').length,
          kurang: data.filter(d => d.KATEGORI_PERFORMANCE === 'KURANG').length,
          sangat_kurang: data.filter(d => d.KATEGORI_PERFORMANCE === 'SANGAT_KURANG').length
        }
      };
      
      return {
        ringkasan: 'Analisis performa pencapaian target vs realisasi HSI dengan satuan yang jelas',
        summary_eksekutif: summary,
        benchmark_target: {
          pencapaian_minimum: '≥ 90%',
          pencapaian_baik: '≥ 100%',
          pencapaian_sangat_baik: '≥ 110%'
        },
        detail_analisis: hasil_analisis,
        insight_strategis: [
          'Fokus pada unit dengan tren menurun untuk perhatian segera',
          'Replikasi praktik terbaik dari unit dengan kategori SANGAT_BAIK',
          'Prioritaskan alokasi sumber daya berdasarkan analisis kesenjangan',
          'Implementasikan monitoring berkelanjutan untuk sistem peringatan dini'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      return {
        matches: confidence >= 70,
        confidence: confidence,
        focus_area: userInput.toLowerCase().includes('gap') ? 'gap_analysis' : 'target_performance'
      };
    },
    
  },

  CACHE_DURATION: 1800, // 30 minutes
  COMPLEXITY: 'MEDIUM',
  EXECUTION_PRIORITY: 'HIGH'
};