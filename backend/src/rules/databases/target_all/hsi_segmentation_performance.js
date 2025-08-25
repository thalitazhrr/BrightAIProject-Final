const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'target_002',
    RULE_NAME: 'hsi_segmentation_performance',
    DESCRIPTION: 'Analisis performa HSI berdasarkan segmentasi pelanggan dan potensi market',
    DATABASE: 'TARGET_ALL',
    CATEGORY: 'segmentation_analysis',
    COMPLEXITY: 'MEDIUM',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("TARGET_ALL"),

  KEYWORD_PATTERNS: {
    primary: [
      // Segmentation analysis - yang biasa digunakan
      'segmen hsi', 'segmentasi hsi', 'analisis segmen', 'segment analysis',
      'performa segmen', 'segment performance', 'consumer enterprise',
      
      // Customer segment familiar terms
      'pelanggan hsi', 'customer segment', 'market segment',
      'segmen pasar', 'target market', 'customer analysis'
    ],
    
    supporting: [
      // Segment types
      'consumer', 'enterprise', 'dinas', 'residential', 'business',
      'corporate', 'soho', 'smb', 'large enterprise',
      
      // Market analysis
      'pasar', 'market', 'penetrasi', 'penetration', 'potensi',
      'opportunity', 'peluang', 'share', 'dominasi',
      
      // Performance indicators
      'kontribusi', 'contribution', 'revenue', 'pendapatan'
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
        score = 75 + (primaryMatches * 12) + (supportingMatches * 3);
      } else if (lowerInput.includes('segmen') && 
                (lowerInput.includes('hsi') || lowerInput.includes('internet'))) {
        score = 65;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_SEGMENT_BASE AS (
        SELECT 
            PERIODE,
            SEGMEN,
            LLEVEL,
            TREG,
            WITEL,
            GROUP_PRODUK,
            SATUAN,
            
            SUM(TARGET) as SEGMENT_TARGET,
            SUM(REALISASI) as SEGMENT_REALISASI,
            
            -- Achievement per segment
            CASE 
                WHEN SUM(TARGET) > 0 THEN 
                    ROUND((SUM(REALISASI) * 100.0 / SUM(TARGET)), 2)
                ELSE 0 
            END as SEGMENT_ACHIEVEMENT_PCT,
            
            COUNT(DISTINCT CASE WHEN LLEVEL = 'WITEL' THEN WITEL END) as JUMLAH_WITEL,
            COUNT(DISTINCT CASE WHEN LLEVEL = 'TELDA' THEN TELDA END) as JUMLAH_TELDA
            
        FROM TARGET_ALL
        WHERE UPPER(PRODUK) = 'HSI'
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMM')
          AND SEGMEN IS NOT NULL
        GROUP BY PERIODE, SEGMEN, LLEVEL, TREG, WITEL, GROUP_PRODUK, SATUAN
    ),
    
    SEGMENT_CONTRIBUTION AS (
        SELECT *,
            -- Market share calculation per segment
            ROUND(SEGMENT_REALISASI * 100.0 / 
                SUM(SEGMENT_REALISASI) OVER (PARTITION BY PERIODE, LLEVEL, SATUAN), 2
            ) as MARKET_SHARE_PCT,
            
            -- Target vs realisasi contribution
            ROUND(SEGMENT_TARGET * 100.0 / 
                SUM(SEGMENT_TARGET) OVER (PARTITION BY PERIODE, LLEVEL, SATUAN), 2
            ) as TARGET_CONTRIBUTION_PCT,
            
            -- Performance vs market average
            SEGMENT_ACHIEVEMENT_PCT - 
            AVG(SEGMENT_ACHIEVEMENT_PCT) OVER (PARTITION BY PERIODE, LLEVEL, SATUAN) as VS_AVERAGE_PCT,
            
            -- Segment categorization
            CASE 
                WHEN SEGMENT_ACHIEVEMENT_PCT >= 110 THEN 'SEGMENT_UNGGUL'
                WHEN SEGMENT_ACHIEVEMENT_PCT >= 100 THEN 'SEGMENT_STABIL'
                WHEN SEGMENT_ACHIEVEMENT_PCT >= 85 THEN 'SEGMENT_BERKEMBANG'
                ELSE 'SEGMENT_PERLU_PERHATIAN'
            END as KATEGORI_SEGMENT
            
        FROM HSI_SEGMENT_BASE
    ),
    
    SEGMENT_PERFORMANCE AS (
        SELECT *,
            -- Rankings
            RANK() OVER (
                PARTITION BY PERIODE, LLEVEL, SATUAN 
                ORDER BY SEGMENT_ACHIEVEMENT_PCT DESC
            ) as RANKING_ACHIEVEMENT,
            
            RANK() OVER (
                PARTITION BY PERIODE, LLEVEL, SATUAN 
                ORDER BY SEGMENT_REALISASI DESC
            ) as RANKING_VOLUME,
            
            RANK() OVER (
                PARTITION BY PERIODE, LLEVEL, SATUAN 
                ORDER BY MARKET_SHARE_PCT DESC
            ) as RANKING_MARKET_SHARE,
            
            -- Growth calculation (vs previous period)
            LAG(SEGMENT_REALISASI) OVER (
                PARTITION BY SEGMEN, LLEVEL, TREG, WITEL, SATUAN 
                ORDER BY PERIODE
            ) as PREV_REALISASI,
            
            LAG(SEGMENT_ACHIEVEMENT_PCT) OVER (
                PARTITION BY SEGMEN, LLEVEL, TREG, WITEL, SATUAN 
                ORDER BY PERIODE
            ) as PREV_ACHIEVEMENT_PCT
            
        FROM SEGMENT_CONTRIBUTION
    ),
    
    SEGMENT_GROWTH AS (
        SELECT *,
            -- Growth calculations
            CASE 
                WHEN PREV_REALISASI IS NOT NULL AND PREV_REALISASI > 0 THEN 
                    ROUND(((SEGMENT_REALISASI - PREV_REALISASI) * 100.0 / PREV_REALISASI), 2)
                ELSE NULL
            END as GROWTH_RATE_PCT,
            
            CASE 
                WHEN PREV_ACHIEVEMENT_PCT IS NOT NULL THEN 
                    ROUND(SEGMENT_ACHIEVEMENT_PCT - PREV_ACHIEVEMENT_PCT, 2)
                ELSE NULL
            END as ACHIEVEMENT_IMPROVEMENT_PCT,
            
            -- Growth categorization
            CASE 
                WHEN PREV_REALISASI IS NULL THEN 'NEW_SEGMENT'
                WHEN ((SEGMENT_REALISASI - PREV_REALISASI) * 100.0 / PREV_REALISASI) >= 15 THEN 'HIGH_GROWTH'
                WHEN ((SEGMENT_REALISASI - PREV_REALISASI) * 100.0 / PREV_REALISASI) >= 5 THEN 'MODERATE_GROWTH'
                WHEN ((SEGMENT_REALISASI - PREV_REALISASI) * 100.0 / PREV_REALISASI) >= -5 THEN 'STABLE'
                ELSE 'DECLINING'
            END as GROWTH_CATEGORY
            
        FROM SEGMENT_PERFORMANCE
    )
    
    SELECT 
        PERIODE,
        SEGMEN,
        LLEVEL,
        TREG,
        WITEL,
        GROUP_PRODUK,
        SATUAN,
        SEGMENT_TARGET,
        SEGMENT_REALISASI,
        SEGMENT_ACHIEVEMENT_PCT,
        MARKET_SHARE_PCT,
        TARGET_CONTRIBUTION_PCT,
        VS_AVERAGE_PCT,
        KATEGORI_SEGMENT,
        RANKING_ACHIEVEMENT,
        RANKING_VOLUME,
        RANKING_MARKET_SHARE,
        GROWTH_RATE_PCT,
        ACHIEVEMENT_IMPROVEMENT_PCT,
        GROWTH_CATEGORY,
        JUMLAH_WITEL,
        JUMLAH_TELDA
    FROM SEGMENT_GROWTH
    ORDER BY PERIODE DESC, SEGMENT_REALISASI DESC
  `,

  BUSINESS_LOGIC: {
    assessSegmentPotential: function(market_share, achievement_pct, growth_rate, satuan) {
      let potential_score = 0;
      
      // Market share component (30%)
      if (market_share >= 40) potential_score += 30;
      else if (market_share >= 25) potential_score += 20;
      else if (market_share >= 15) potential_score += 15;
      else potential_score += (market_share * 0.5);
      
      // Achievement component (40%)
      if (achievement_pct >= 110) potential_score += 40;
      else if (achievement_pct >= 100) potential_score += 35;
      else if (achievement_pct >= 85) potential_score += 25;
      else potential_score += (achievement_pct * 0.3);
      
      // Growth component (30%)
      if (growth_rate >= 15) potential_score += 30;
      else if (growth_rate >= 5) potential_score += 20;
      else if (growth_rate >= 0) potential_score += 10;
      else potential_score += Math.max(0, 10 + growth_rate);
      
      const potentialCategories = {
        'SANGAT_TINGGI': {
          description: 'Segmen dengan potensi sangat tinggi dan performa unggul',
          strategy: 'Investasi agresif dan ekspansi pasar'
        },
        'TINGGI': {
          description: 'Segmen potensial dengan performa solid',
          strategy: 'Investasi strategis dan optimasi'
        },
        'SEDANG': {
          description: 'Segmen dengan potensi moderat',
          strategy: 'Perbaikan selektif dan fokus efisiensi'
        },
        'RENDAH': {
          description: 'Segmen dengan potensi terbatas',
          strategy: 'Mode maintenance atau tinjauan strategis'
        }
      };
      
      // Add unit context to strategy
      const unitContext = this.getUnitContext(satuan);
      
      let selectedCategory;
      if (potential_score >= 80) selectedCategory = potentialCategories['SANGAT_TINGGI'];
      else if (potential_score >= 65) selectedCategory = potentialCategories['TINGGI'];
      else if (potential_score >= 45) selectedCategory = potentialCategories['SEDANG'];
      else selectedCategory = potentialCategories['RENDAH'];
      
      selectedCategory.unit_context = unitContext;
      return selectedCategory;
    },
    
    getUnitContext: function(satuan) {
      const unitContexts = {
        'SSL': {
          description: '1 Layanan Terpasang (Service Subscriber Line)',
          segment_interpretation: 'Jumlah layanan HSI yang berhasil diaktivasi per segmen',
          business_focus: 'Fokus pada instalasi dan aktivasi layanan baru'
        },
        'UNIT': {
          description: 'Unit Layanan',
          segment_interpretation: 'Volume layanan HSI yang diberikan per segmen',
          business_focus: 'Fokus pada volume layanan dan jangkauan segmen'
        },
        'SUBSCRIBER': {
          description: 'Pelanggan HSI',
          segment_interpretation: 'Jumlah pelanggan HSI yang terlayani per segmen',
          business_focus: 'Fokus pada akuisisi dan retensi pelanggan'
        },
        'CONNECTION': {
          description: 'Koneksi HSI',
          segment_interpretation: 'Jumlah koneksi internet berkecepatan tinggi per segmen',
          business_focus: 'Fokus pada konektivitas dan kualitas layanan'
        }
      };
      
      return unitContexts[satuan] || {
        description: satuan || 'Unit tidak terdefinisi',
        segment_interpretation: 'Metrik segmen sesuai definisi bisnis',
        business_focus: 'Fokus disesuaikan dengan konteks bisnis spesifik'
      };
    },
    
    identifySegmentOpportunities: function(segmen, market_share, vs_average, growth_category, satuan) {
      const opportunities = [];
      const unitContext = this.getUnitContext(satuan);
      
      // Segment-specific opportunities based on unit type
      if (segmen === 'Consumer' && market_share < 30) {
        if (satuan === 'SSL') {
          opportunities.push('Ekspansi penetrasi pasar residential melalui program bundling dan percepatan instalasi');
        } else {
          opportunities.push('Ekspansi penetrasi pasar residential melalui program bundling package');
        }
      }
      
      if (segmen === 'Enterprise' && vs_average > 5) {
        if (satuan === 'SSL') {
          opportunities.push('Leverage kesuksesan corporate untuk ekspansi ke large enterprise dengan fokus layanan premium');
        } else {
          opportunities.push('Leverage kesuksesan corporate untuk ekspansi ke large enterprise');
        }
      }
      
      if (segmen === 'Dinas' && growth_category === 'HIGH_GROWTH') {
        opportunities.push('Manfaatkan momentum digitalisasi pemerintah untuk pertumbuhan berkelanjutan');
      }
      
      // General opportunities based on unit context
      if (market_share < 20) {
        if (satuan === 'SSL') {
          opportunities.push('Peluang ekspansi market share melalui competitive pricing dan percepatan proses instalasi');
        } else {
          opportunities.push('Peluang ekspansi market share melalui competitive pricing');
        }
      }
      
      if (vs_average < -10) {
        opportunities.push('Peningkatan performa melalui adopsi praktik terbaik dari segmen lain');
      }
      
      return opportunities.length > 0 ? opportunities : ['Pertahankan posisi pasar saat ini'];
    },
    
    generateSegmentStrategy: function(kategori_segment, growth_category, market_share) {
      const strategies = {
        'SEGMENT_UNGGUL': {
          focus: 'Kepemimpinan Pasar',
          tactics: [
            'Pertahankan keunggulan kompetitif',
            'Ekspansi ke segmen yang berdekatan',
            'Diferensiasi layanan premium',
            'Posisi thought leadership'
          ]
        },
        'SEGMENT_STABIL': {
          focus: 'Akselerasi Pertumbuhan',
          tactics: [
            'Ekspansi pangsa pasar',
            'Optimasi retensi pelanggan',
            'Peningkatan value proposition',
            'Perbaikan efisiensi operasional'
          ]
        },
        'SEGMENT_BERKEMBANG': {
          focus: 'Optimasi Performa',
          tactics: [
            'Peningkatan conversion rate',
            'Optimasi proses penjualan',
            'Tinjauan posisi kompetitif',
            'Penyesuaian alokasi sumber daya'
          ]
        },
        'SEGMENT_PERLU_PERHATIAN': {
          focus: 'Strategi Pemulihan',
          tactics: [
            'Analisis akar masalah',
            'Reposisi strategis',
            'Realokasi sumber daya',
            'Rencana pemulihan performa'
          ]
        }
      };
      
      return strategies[kategori_segment] || {
        focus: 'Strategi Khusus',
        tactics: ['Kembangkan pendekatan spesifik segmen']
      };
    },
    
    formatIndonesianResponse: function(data) {
      const hasil_analisis = data.map(record => {
        const segment_potential = this.assessSegmentPotential(
          record.MARKET_SHARE_PCT,
          record.SEGMENT_ACHIEVEMENT_PCT,
          record.GROWTH_RATE_PCT || 0,
          record.SATUAN
        );
        
        const opportunities = this.identifySegmentOpportunities(
          record.SEGMEN,
          record.MARKET_SHARE_PCT,
          record.VS_AVERAGE_PCT,
          record.GROWTH_CATEGORY,
          record.SATUAN
        );
        
        const strategy = this.generateSegmentStrategy(
          record.KATEGORI_SEGMENT,
          record.GROWTH_CATEGORY,
          record.MARKET_SHARE_PCT
        );
        
        return {
          identitas_segmen: {
            periode: record.PERIODE,
            nama_segmen: record.SEGMEN,
            level_analisis: record.LLEVEL,
            regional: record.TREG,
            witel: record.WITEL,
            group_produk: record.GROUP_PRODUK
          },
          satuan_target: {
            satuan: record.SATUAN,
            deskripsi_satuan: segment_potential.unit_context.description,
            interpretasi_segmen: segment_potential.unit_context.segment_interpretation,
            fokus_bisnis: segment_potential.unit_context.business_focus
          },
          metrik_performa: {
            target: `${record.SEGMENT_TARGET.toLocaleString('id-ID')} ${record.SATUAN}`,
            realisasi: `${record.SEGMENT_REALISASI.toLocaleString('id-ID')} ${record.SATUAN}`,
            pencapaian: `${record.SEGMENT_ACHIEVEMENT_PCT}%`,
            pangsa_pasar: `${record.MARKET_SHARE_PCT}%`,
            kontribusi_target: `${record.TARGET_CONTRIBUTION_PCT}%`,
            vs_rata_rata: `${record.VS_AVERAGE_PCT > 0 ? '+' : ''}${record.VS_AVERAGE_PCT}%`
          },
          analisis_pertumbuhan: {
            tingkat_pertumbuhan: record.GROWTH_RATE_PCT ? `${record.GROWTH_RATE_PCT}%` : 'N/A',
            peningkatan_pencapaian: record.ACHIEVEMENT_IMPROVEMENT_PCT ? `${record.ACHIEVEMENT_IMPROVEMENT_PCT}%` : 'N/A',
            kategori_pertumbuhan: record.GROWTH_CATEGORY,
            kategori_segmen: record.KATEGORI_SEGMENT
          },
          evaluasi_posisi: {
            ranking_pencapaian: record.RANKING_ACHIEVEMENT,
            ranking_volume: record.RANKING_VOLUME,
            ranking_pangsa_pasar: record.RANKING_MARKET_SHARE,
            cakupan_witel: record.JUMLAH_WITEL,
            cakupan_telda: record.JUMLAH_TELDA
          },
          potensi_segmen: {
            deskripsi: segment_potential.description,
            strategi_utama: segment_potential.strategy
          },
          peluang_bisnis: opportunities,
          rencana_strategis: {
            fokus_utama: strategy.focus,
            taktik_eksekusi: strategy.tactics
          }
        };
      });
      
      // Segment summary analysis
      const segment_summary = {
        total_segmen_aktif: [...new Set(data.map(d => d.SEGMEN))].length,
        distribusi_kategori: {
          unggul: data.filter(d => d.KATEGORI_SEGMENT === 'SEGMENT_UNGGUL').length,
          stabil: data.filter(d => d.KATEGORI_SEGMENT === 'SEGMENT_STABIL').length,
          berkembang: data.filter(d => d.KATEGORI_SEGMENT === 'SEGMENT_BERKEMBANG').length,
          perlu_perhatian: data.filter(d => d.KATEGORI_SEGMENT === 'SEGMENT_PERLU_PERHATIAN').length
        },
        segmen_dominan: data.reduce((prev, current) => 
          (prev.MARKET_SHARE_PCT > current.MARKET_SHARE_PCT) ? prev : current
        ).SEGMEN,
        satuan_dominan: data.reduce((prev, current) => 
          (data.filter(d => d.SATUAN === prev.SATUAN).length > 
           data.filter(d => d.SATUAN === current.SATUAN).length) ? prev : current
        ).SATUAN
      };
      
      return {
        ringkasan: 'Analisis performa HSI berdasarkan segmentasi pelanggan dengan satuan yang jelas',
        summary_segmen: segment_summary,
        benchmark_segmen: {
          pangsa_pasar_target: '≥ 25%',
          pencapaian_minimum: '≥ 90%',
          tingkat_pertumbuhan_target: '≥ 10%'
        },
        detail_analisis: hasil_analisis,
        rekomendasi_strategis: [
          'Prioritaskan investasi pada segmen dengan potensi tinggi',
          'Replikasi praktik terbaik dari segmen unggul ke segmen berkembang',
          'Fokus pada ekspansi pangsa pasar di segmen dengan pertumbuhan tinggi',
          'Kembangkan value proposition spesifik segmen untuk diferensiasi'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = patternMatcher.calculateConfidence(userInput, module.exports.KEYWORD_PATTERNS);
      return {
        matches: confidence >= 65,
        confidence: confidence,
        focus_area: userInput.toLowerCase().includes('consumer') || 
                   userInput.toLowerCase().includes('enterprise') ? 'specific_segment' : 'general_segment'
      };
    },
    
  },

  CACHE_DURATION: 1800, // 30 minutes
  COMPLEXITY: 'MEDIUM',
  EXECUTION_PRIORITY: 'HIGH'
};