const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'target_003',
    RULE_NAME: 'hsi_regional_performance',
    DESCRIPTION: 'Analisis performa HSI berdasarkan regional TREG dan distribusi geografis',
    DATABASE: 'BRIGHTAI_TARGET',
    CATEGORY: 'regional_analysis',
    COMPLEXITY: 'MEDIUM',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_TARGET"),

  KEYWORD_PATTERNS: {
    primary: [
      // Target + Regional specific phrases
      'performa target regional', 'target per regional', 'target regional hsi',
      'realisasi per regional', 'pencapaian per regional', 'achievement per regional',
      'target hsi per regional', 'target hsi per treg', 'target hsi per wilayah',
      'realisasi hsi per regional', 'pencapaian hsi regional'
    ],

    supporting: [
      // Target context (required for this rule)
      'target', 'realisasi', 'pencapaian', 'achievement',
      // Regional terms
      'treg', 'regional', 'witel', 'telda',
      // Performance indicators
      'dominasi', 'kontribusi', 'share', 'pangsa'
    ],

    calculateConfidence: function(input) {
      const lowerInput = input.toLowerCase();
      let score = 0;

      // MUST have target/realisasi context to distinguish from ps_002/dapros_005
      const hasTargetCtx =
        lowerInput.includes('target') || lowerInput.includes('realisasi') ||
        lowerInput.includes('pencapaian') || lowerInput.includes('achievement');
      if (!hasTargetCtx) return 0;

      const primaryMatches = this.primary.filter(keyword =>
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      const supportingMatches = this.supporting.filter(keyword =>
        lowerInput.includes(keyword.toLowerCase())
      ).length;

      if (primaryMatches > 0) {
        score = 80 + (primaryMatches * 10) + (supportingMatches * 2);
      } else if (hasTargetCtx &&
                (lowerInput.includes('per regional') || lowerInput.includes('per wilayah') ||
                 lowerInput.includes('per treg') || lowerInput.includes('per witel'))) {
        score = 78;
      } else if (hasTargetCtx &&
                (lowerInput.includes('regional') || lowerInput.includes('wilayah') ||
                 lowerInput.includes('treg') || lowerInput.includes('witel'))) {
        // Broader match: target context + regional mention (e.g. "di setiap regional")
        score = 75 + (supportingMatches * 2);
      }

      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_REGIONAL_BASE AS (
        SELECT 
            PERIODE,
            TREG,
            SEGMEN,
            LLEVEL,
            WITEL,
            GROUP_PRODUK,
            SATUAN,
            
            SUM(TARGET) as REGIONAL_TARGET,
            SUM(REALISASI) as REGIONAL_REALISASI,
            
            -- Regional achievement
            CASE 
                WHEN SUM(TARGET) > 0 THEN 
                    ROUND((SUM(REALISASI) * 100.0 / NULLIF(SUM(TARGET), 0)), 2)
                ELSE 0 
            END as REGIONAL_ACHIEVEMENT_PCT,
            
            -- Unit counts
            COUNT(DISTINCT WITEL) as JUMLAH_WITEL,
            COUNT(DISTINCT TELDA) as JUMLAH_TELDA,
            COUNT(*) as JUMLAH_UNIT_TARGET
            
        FROM DWH_MOIS.BRIGHTAI_TARGET
        WHERE UPPER(PRODUK) = 'HSI'
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMM')
          AND TREG IS NOT NULL
        GROUP BY PERIODE, TREG, SEGMEN, LLEVEL, WITEL, GROUP_PRODUK, SATUAN
    ),
    
    REGIONAL_MARKET_SHARE AS (
        SELECT t.PERIODE,
            t.TREG,
            t.SEGMEN,
            t.LLEVEL,
            t.WITEL,
            t.GROUP_PRODUK,
            t.SATUAN,
            t.REGIONAL_TARGET,
            t.REGIONAL_REALISASI,
            t.REGIONAL_ACHIEVEMENT_PCT,
            t.JUMLAH_WITEL,
            t.JUMLAH_TELDA,
            t.JUMLAH_UNIT_TARGET,
            -- National market share per TREG
            ROUND(REGIONAL_REALISASI * 100.0 /
                NULLIF(SUM(REGIONAL_REALISASI) OVER (PARTITION BY PERIODE, LLEVEL, SEGMEN, SATUAN), 0), 2
            ) as NATIONAL_MARKET_SHARE_PCT,

            -- Target contribution
            ROUND(REGIONAL_TARGET * 100.0 /
                NULLIF(SUM(REGIONAL_TARGET) OVER (PARTITION BY PERIODE, LLEVEL, SEGMEN, SATUAN), 0), 2
            ) as TARGET_CONTRIBUTION_PCT,
            
            -- Performance vs national average
            REGIONAL_ACHIEVEMENT_PCT - 
            AVG(REGIONAL_ACHIEVEMENT_PCT) OVER (PARTITION BY PERIODE, LLEVEL, SEGMEN, SATUAN) as VS_NATIONAL_AVG_PCT,
            
            -- Regional density (realisasi per unit)
            CASE 
                WHEN JUMLAH_UNIT_TARGET > 0 THEN 
                    ROUND(REGIONAL_REALISASI / NULLIF(JUMLAH_UNIT_TARGET, 0), 2)
                ELSE 0
            END as DENSITY_PER_UNIT,
            
            -- Regional categorization
            CASE 
                WHEN REGIONAL_ACHIEVEMENT_PCT >= 110 THEN 'REGIONAL_LEADER'
                WHEN REGIONAL_ACHIEVEMENT_PCT >= 100 THEN 'REGIONAL_STRONG'
                WHEN REGIONAL_ACHIEVEMENT_PCT >= 85 THEN 'REGIONAL_AVERAGE'
                ELSE 'REGIONAL_UNDERPERFORM'
            END as KATEGORI_REGIONAL
            
        FROM HSI_REGIONAL_BASE t
    ),
    
    REGIONAL_PERFORMANCE AS (
        SELECT t.PERIODE,
            t.TREG,
            t.SEGMEN,
            t.LLEVEL,
            t.WITEL,
            t.GROUP_PRODUK,
            t.SATUAN,
            t.REGIONAL_TARGET,
            t.REGIONAL_REALISASI,
            t.REGIONAL_ACHIEVEMENT_PCT,
            t.JUMLAH_WITEL,
            t.JUMLAH_TELDA,
            t.JUMLAH_UNIT_TARGET,
            t.NATIONAL_MARKET_SHARE_PCT,
            t.TARGET_CONTRIBUTION_PCT,
            t.VS_NATIONAL_AVG_PCT,
            t.DENSITY_PER_UNIT,
            t.KATEGORI_REGIONAL,
            -- Rankings
            RANK() OVER (
                PARTITION BY PERIODE, LLEVEL, SEGMEN, SATUAN 
                ORDER BY REGIONAL_ACHIEVEMENT_PCT DESC
            ) as RANKING_ACHIEVEMENT,
            
            RANK() OVER (
                PARTITION BY PERIODE, LLEVEL, SEGMEN, SATUAN 
                ORDER BY REGIONAL_REALISASI DESC
            ) as RANKING_VOLUME,
            
            RANK() OVER (
                PARTITION BY PERIODE, LLEVEL, SEGMEN, SATUAN 
                ORDER BY NATIONAL_MARKET_SHARE_PCT DESC
            ) as RANKING_MARKET_SHARE,
            
            RANK() OVER (
                PARTITION BY PERIODE, LLEVEL, SEGMEN, SATUAN 
                ORDER BY DENSITY_PER_UNIT DESC
            ) as RANKING_DENSITY,
            
            -- Growth vs previous period
            LAG(REGIONAL_REALISASI) OVER (
                PARTITION BY TREG, SEGMEN, LLEVEL, WITEL, SATUAN 
                ORDER BY PERIODE
            ) as PREV_REALISASI,
            
            LAG(REGIONAL_ACHIEVEMENT_PCT) OVER (
                PARTITION BY TREG, SEGMEN, LLEVEL, WITEL, SATUAN 
                ORDER BY PERIODE
            ) as PREV_ACHIEVEMENT_PCT,
            
            -- Market dominance indicator
            CASE 
                WHEN NATIONAL_MARKET_SHARE_PCT >= 25 THEN 'MARKET_DOMINANT'
                WHEN NATIONAL_MARKET_SHARE_PCT >= 20 THEN 'MARKET_LEADER'
                WHEN NATIONAL_MARKET_SHARE_PCT >= 15 THEN 'MARKET_PLAYER'
                ELSE 'MARKET_FOLLOWER'
            END as MARKET_POSITION
            
        FROM REGIONAL_MARKET_SHARE t
    ),
    
    REGIONAL_TRENDS AS (
        SELECT t.PERIODE,
            t.TREG,
            t.SEGMEN,
            t.LLEVEL,
            t.WITEL,
            t.GROUP_PRODUK,
            t.SATUAN,
            t.REGIONAL_TARGET,
            t.REGIONAL_REALISASI,
            t.REGIONAL_ACHIEVEMENT_PCT,
            t.JUMLAH_WITEL,
            t.JUMLAH_TELDA,
            t.JUMLAH_UNIT_TARGET,
            t.NATIONAL_MARKET_SHARE_PCT,
            t.TARGET_CONTRIBUTION_PCT,
            t.VS_NATIONAL_AVG_PCT,
            t.DENSITY_PER_UNIT,
            t.KATEGORI_REGIONAL,
            t.RANKING_ACHIEVEMENT,
            t.RANKING_VOLUME,
            t.RANKING_MARKET_SHARE,
            t.RANKING_DENSITY,
            t.PREV_REALISASI,
            t.PREV_ACHIEVEMENT_PCT,
            t.MARKET_POSITION,
            -- Growth calculations
            CASE 
                WHEN PREV_REALISASI IS NOT NULL AND PREV_REALISASI > 0 THEN 
                    ROUND(((REGIONAL_REALISASI - PREV_REALISASI) * 100.0 / NULLIF(PREV_REALISASI, 0)), 2)
                ELSE NULL
            END as GROWTH_RATE_PCT,
            
            CASE 
                WHEN PREV_ACHIEVEMENT_PCT IS NOT NULL THEN 
                    ROUND(REGIONAL_ACHIEVEMENT_PCT - PREV_ACHIEVEMENT_PCT, 2)
                ELSE NULL
            END as ACHIEVEMENT_CHANGE_PCT,
            
            -- Momentum assessment
            CASE 
                WHEN PREV_REALISASI IS NULL THEN 'NEW_DATA'
                WHEN ((REGIONAL_REALISASI - PREV_REALISASI) * 100.0 / NULLIF(PREV_REALISASI, 0)) >= 15 THEN 'MOMENTUM_TINGGI'
                WHEN ((REGIONAL_REALISASI - PREV_REALISASI) * 100.0 / NULLIF(PREV_REALISASI, 0)) >= 5 THEN 'MOMENTUM_SEDANG'
                WHEN ((REGIONAL_REALISASI - PREV_REALISASI) * 100.0 / NULLIF(PREV_REALISASI, 0)) >= -5 THEN 'MOMENTUM_STABIL'
                ELSE 'MOMENTUM_MENURUN'
            END as MOMENTUM_CATEGORY,
            
            -- Efficiency score (achievement vs resource utilization)
            ROUND(
                (REGIONAL_ACHIEVEMENT_PCT * 0.6) + 
                (DENSITY_PER_UNIT / NULLIF(AVG(DENSITY_PER_UNIT) OVER (PARTITION BY PERIODE, LLEVEL, SEGMEN, SATUAN), 0) * 40),
                2
            ) as EFFICIENCY_SCORE
            
        FROM REGIONAL_PERFORMANCE t
    )
    
    SELECT 
        PERIODE,
        TREG,
        SEGMEN,
        LLEVEL,
        WITEL,
        GROUP_PRODUK,
        SATUAN,
        REGIONAL_TARGET,
        REGIONAL_REALISASI,
        REGIONAL_ACHIEVEMENT_PCT,
        NATIONAL_MARKET_SHARE_PCT,
        TARGET_CONTRIBUTION_PCT,
        VS_NATIONAL_AVG_PCT,
        DENSITY_PER_UNIT,
        KATEGORI_REGIONAL,
        MARKET_POSITION,
        RANKING_ACHIEVEMENT,
        RANKING_VOLUME,
        RANKING_MARKET_SHARE,
        RANKING_DENSITY,
        GROWTH_RATE_PCT,
        ACHIEVEMENT_CHANGE_PCT,
        MOMENTUM_CATEGORY,
        EFFICIENCY_SCORE,
        JUMLAH_WITEL,
        JUMLAH_TELDA,
        JUMLAH_UNIT_TARGET
    FROM REGIONAL_TRENDS
    ORDER BY PERIODE DESC, REGIONAL_REALISASI DESC
  `,

  BUSINESS_LOGIC: {
    getUnitContext: function(satuan) {
      const unitContexts = {
        'SSL': {
          description: '1 Layanan Terpasang (Service Subscriber Line)',
          regional_interpretation: 'Jumlah layanan HSI yang berhasil diaktivasi per regional',
          geographic_focus: 'Fokus pada coverage geografis dan penetrasi instalasi'
        },
        'UNIT': {
          description: 'Unit Layanan',
          regional_interpretation: 'Volume layanan HSI yang diberikan per regional',
          geographic_focus: 'Fokus pada distribusi layanan dan jangkauan wilayah'
        },
        'SUBSCRIBER': {
          description: 'Pelanggan HSI',
          regional_interpretation: 'Jumlah pelanggan HSI yang terlayani per regional',
          geographic_focus: 'Fokus pada penetrasi pelanggan dan market share regional'
        },
        'CONNECTION': {
          description: 'Koneksi HSI',
          regional_interpretation: 'Jumlah koneksi internet berkecepatan tinggi per regional',
          geographic_focus: 'Fokus pada infrastruktur koneksi dan kualitas layanan regional'
        }
      };
      
      return unitContexts[satuan] || {
        description: satuan || 'Unit tidak terdefinisi',
        regional_interpretation: 'Metrik regional sesuai definisi bisnis',
        geographic_focus: 'Fokus disesuaikan dengan konteks geografis spesifik'
      };
    },

    assessRegionalStrength: function(market_share, achievement_pct, efficiency_score, momentum, satuan) {
      let strength_score = 0;
      
      // Market share component (35%)
      if (market_share >= 25) strength_score += 35;
      else if (market_share >= 20) strength_score += 28;
      else if (market_share >= 15) strength_score += 21;
      else strength_score += (market_share * 1.4);
      
      // Achievement component (35%)
      if (achievement_pct >= 110) strength_score += 35;
      else if (achievement_pct >= 100) strength_score += 30;
      else if (achievement_pct >= 85) strength_score += 20;
      else strength_score += (achievement_pct * 0.25);
      
      // Efficiency component (20%)
      if (efficiency_score >= 90) strength_score += 20;
      else if (efficiency_score >= 70) strength_score += 15;
      else strength_score += (efficiency_score * 0.2);
      
      // Momentum component (10%)
      const momentumScore = {
        'MOMENTUM_TINGGI': 10,
        'MOMENTUM_SEDANG': 7,
        'MOMENTUM_STABIL': 5,
        'MOMENTUM_MENURUN': 2
      };
      strength_score += momentumScore[momentum] || 0;
      
      const strengthCategories = {
        'SANGAT_KUAT': {
          description: 'Regional dengan kekuatan market sangat dominan',
          strategy: 'Pertahankan kepemimpinan dan perluas pengaruh'
        },
        'KUAT': {
          description: 'Regional dengan posisi market yang solid',
          strategy: 'Perkuat posisi dan ekspansi selektif'
        },
        'SEDANG': {
          description: 'Regional dengan performa moderate',
          strategy: 'Peningkatan performa dan fokus efisiensi'
        },
        'LEMAH': {
          description: 'Regional dengan performa di bawah ekspektasi',
          strategy: 'Restrukturisasi strategis dan pengembangan kapabilitas'
        }
      };
      
      // Add unit context to strategy
      const unitContext = this.getUnitContext(satuan);
      
      let selectedCategory;
      if (strength_score >= 85) selectedCategory = strengthCategories['SANGAT_KUAT'];
      else if (strength_score >= 70) selectedCategory = strengthCategories['KUAT'];
      else if (strength_score >= 50) selectedCategory = strengthCategories['SEDANG'];
      else selectedCategory = strengthCategories['LEMAH'];
      
      selectedCategory.unit_context = unitContext;
      return selectedCategory;
    },
    
    identifyRegionalOpportunities: function(treg, market_position, vs_national_avg, momentum_category, satuan) {
      const opportunities = [];
      const unitContext = this.getUnitContext(satuan);
      
      // TREG-specific opportunities with unit context
      const tregInsights = {
        'REG-1': 'Metro area advantage dengan density population tinggi',
        'REG-2': 'Industrial zone potential dengan corporate customer base',
        'REG-3': 'Tourism dan agriculture market opportunity',
        'REG-4': 'Emerging market dengan growth potential tinggi',
        'REG-5': 'Strategic location dengan connectivity advantage'
      };
      
      if (tregInsights[treg]) {
        if (satuan === 'SSL') {
          opportunities.push(`Manfaatkan ${tregInsights[treg]} untuk percepatan instalasi dan aktivasi layanan`);
        } else {
          opportunities.push(`Manfaatkan ${tregInsights[treg]}`);
        }
      }
      
      // Position-based opportunities with unit context
      if (market_position === 'MARKET_FOLLOWER' && vs_national_avg > 0) {
        if (satuan === 'SSL') {
          opportunities.push('Peluang ekspansi pangsa pasar dengan keunggulan kompetitif dalam instalasi layanan');
        } else {
          opportunities.push('Peluang ekspansi pangsa pasar dengan keunggulan kompetitif');
        }
      }
      
      if (momentum_category === 'MOMENTUM_TINGGI') {
        opportunities.push('Manfaatkan momentum positif untuk pertumbuhan agresif');
      }
      
      if (vs_national_avg < -10) {
        opportunities.push('Peningkatan performa melalui adopsi praktik terbaik');
      }
      
      return opportunities.length > 0 ? opportunities : ['Pertahankan posisi regional saat ini'];
    },
    
    generateRegionalStrategy: function(kategori_regional, market_position, momentum_category) {
      const strategies = {
        'REGIONAL_LEADER': {
          focus: 'Dominasi Pasar',
          initiatives: [
            'Pertahankan kepemimpinan kompetitif',
            'Perencanaan ekspansi lintas regional',
            'Posisi layanan premium',
            'Pengembangan hub inovasi'
          ]
        },
        'REGIONAL_STRONG': {
          focus: 'Akselerasi Pertumbuhan',
          initiatives: [
            'Ekspansi pangsa pasar',
            'Program keunggulan operasional',
            'Peningkatan loyalitas pelanggan',
            'Pengembangan kemitraan strategis'
          ]
        },
        'REGIONAL_AVERAGE': {
          focus: 'Peningkatan Performa',
          initiatives: [
            'Program peningkatan efisiensi',
            'Tinjauan posisi kompetitif',
            'Peningkatan kapabilitas penjualan',
            'Strategi penetrasi pasar'
          ]
        },
        'REGIONAL_UNDERPERFORM': {
          focus: 'Strategi Pemulihan',
          initiatives: [
            'Tinjauan performa komprehensif',
            'Realokasi sumber daya',
            'Program pengembangan kapabilitas',
            'Evaluasi kemitraan strategis'
          ]
        }
      };
      
      return strategies[kategori_regional] || {
        focus: 'Strategi Regional Khusus',
        initiatives: ['Kembangkan pendekatan spesifik regional']
      };
    },
    
    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data yang tersedia untuk scope yang dipilih.' };
      }
      const hasil_analisis = data.map(record => {
        const regional_strength = this.assessRegionalStrength(
          record.NATIONAL_MARKET_SHARE_PCT,
          record.REGIONAL_ACHIEVEMENT_PCT,
          record.EFFICIENCY_SCORE,
          record.MOMENTUM_CATEGORY,
          record.SATUAN
        );
        
        const opportunities = this.identifyRegionalOpportunities(
          record.TREG,
          record.MARKET_POSITION,
          record.VS_NATIONAL_AVG_PCT,
          record.MOMENTUM_CATEGORY,
          record.SATUAN
        );
        
        const strategy = this.generateRegionalStrategy(
          record.KATEGORI_REGIONAL,
          record.MARKET_POSITION,
          record.MOMENTUM_CATEGORY
        );
        
        return {
          identitas_regional: {
            periode: record.PERIODE,
            treg: record.TREG,
            segmen: record.SEGMEN,
            level_analisis: record.LLEVEL,
            witel: record.WITEL,
            group_produk: record.GROUP_PRODUK
          },
          satuan_target: {
            satuan: record.SATUAN,
            deskripsi_satuan: regional_strength.unit_context.description,
            interpretasi_regional: regional_strength.unit_context.regional_interpretation,
            fokus_geografis: regional_strength.unit_context.geographic_focus
          },
          metrik_performa: {
            target: `${(record.REGIONAL_TARGET || 0).toLocaleString('id-ID')} ${record.SATUAN}`,
            realisasi: `${(record.REGIONAL_REALISASI || 0).toLocaleString('id-ID')} ${record.SATUAN}`,
            pencapaian: `${record.REGIONAL_ACHIEVEMENT_PCT}%`,
            pangsa_pasar_nasional: `${record.NATIONAL_MARKET_SHARE_PCT}%`,
            kontribusi_target: `${record.TARGET_CONTRIBUTION_PCT}%`,
            vs_rata_rata_nasional: `${record.VS_NATIONAL_AVG_PCT > 0 ? '+' : ''}${record.VS_NATIONAL_AVG_PCT}%`
          },
          analisis_efisiensi: {
            density_per_unit: (record.DENSITY_PER_UNIT || 0).toLocaleString('id-ID'),
            skor_efisiensi: record.EFFICIENCY_SCORE,
            kategori_regional: record.KATEGORI_REGIONAL,
            posisi_pasar: record.MARKET_POSITION
          },
          analisis_pertumbuhan: {
            tingkat_pertumbuhan: record.GROWTH_RATE_PCT ? `${record.GROWTH_RATE_PCT}%` : 'N/A',
            perubahan_pencapaian: record.ACHIEVEMENT_CHANGE_PCT ? `${record.ACHIEVEMENT_CHANGE_PCT}%` : 'N/A',
            kategori_momentum: record.MOMENTUM_CATEGORY
          },
          evaluasi_posisi: {
            ranking_pencapaian: record.RANKING_ACHIEVEMENT,
            ranking_volume: record.RANKING_VOLUME,
            ranking_pangsa_pasar: record.RANKING_MARKET_SHARE,
            ranking_density: record.RANKING_DENSITY
          },
          cakupan_geografis: {
            jumlah_witel: record.JUMLAH_WITEL,
            jumlah_telda: record.JUMLAH_TELDA,
            jumlah_unit_target: record.JUMLAH_UNIT_TARGET
          },
          kekuatan_regional: {
            deskripsi: regional_strength.description,
            strategi_utama: regional_strength.strategy
          },
          peluang_regional: opportunities,
          rencana_strategis: {
            fokus_utama: strategy.focus,
            inisiatif_kunci: strategy.initiatives
          }
        };
      });
      
      // Regional landscape analysis
      const regional_summary = {
        total_treg_aktif: [...new Set(data.map(d => d.TREG))].length,
        distribusi_kategori: {
          leader: data.filter(d => d.KATEGORI_REGIONAL === 'REGIONAL_LEADER').length,
          strong: data.filter(d => d.KATEGORI_REGIONAL === 'REGIONAL_STRONG').length,
          average: data.filter(d => d.KATEGORI_REGIONAL === 'REGIONAL_AVERAGE').length,
          underperform: data.filter(d => d.KATEGORI_REGIONAL === 'REGIONAL_UNDERPERFORM').length
        },
        treg_dominan: data.reduce((prev, current) => 
          (prev.NATIONAL_MARKET_SHARE_PCT > current.NATIONAL_MARKET_SHARE_PCT) ? prev : current
        ).TREG,
        satuan_dominan: data.reduce((prev, current) => 
          (data.filter(d => d.SATUAN === prev.SATUAN).length > 
           data.filter(d => d.SATUAN === current.SATUAN).length) ? prev : current
        ).SATUAN
      };
      
      return {
        ringkasan: 'Analisis performa HSI berdasarkan distribusi regional TREG dengan satuan yang jelas',
        summary_regional: regional_summary,
        benchmark_regional: {
          pangsa_pasar_target: '≥ 20%',
          pencapaian_minimum: '≥ 90%',
          skor_efisiensi_target: '≥ 75'
        },
        detail_analisis: hasil_analisis,
        insight_geografis: [
          'Identifikasi TREG dengan momentum tinggi untuk investasi agresif',
          'Manfaatkan praktik terbaik dari regional leader ke regional underperform',
          'Seimbangkan alokasi sumber daya berdasarkan potensi pasar dan efisiensi',
          'Kembangkan strategi spesifik regional sesuai karakteristik geografis'
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
        focus_area: userInput.toLowerCase().includes('treg') ? 'treg_analysis' : 'regional_general'
      };
    },
    
  },

  CACHE_DURATION: 1800, // 30 minutes
  COMPLEXITY: 'MEDIUM',
  EXECUTION_PRIORITY: 'HIGH'
};