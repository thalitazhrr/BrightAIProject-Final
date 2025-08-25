const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'target_005',
    RULE_NAME: 'hsi_competitive_performance',
    DESCRIPTION: 'Analisis performa kompetitif HSI untuk identifikasi positioning dan benchmark internal',
    DATABASE: 'TARGET_ALL',
    CATEGORY: 'competitive_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'MEDIUM',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("TARGET_ALL"),

  KEYWORD_PATTERNS: {
    primary: [
      // Competitive analysis - yang biasa digunakan
      'kompetitif hsi', 'competitive hsi', 'benchmark hsi', 'perbandingan hsi',
      'analisis kompetitif', 'competitive analysis', 'positioning hsi',
      
      // Performance comparison familiar terms
      'benchmark', 'comparison', 'perbandingan', 'versus', 'vs',
      'ranking', 'peringkat', 'posisi kompetitif', 'competitive position'
    ],
    
    supporting: [
      // Competitive terms
      'leader', 'pemimpin', 'dominasi', 'dominance', 'market leader',
      'follower', 'challenger', 'outperform', 'underperform',
      
      // Performance indicators
      'unggul', 'superior', 'kalah', 'tertinggal', 'leading',
      'lagging', 'average', 'rata-rata', 'above average', 'below average',
      
      // Benchmarking
      'best practice', 'top performer', 'bottom performer',
      'peer comparison', 'internal benchmark'
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
        score = 80 + (primaryMatches * 10) + (supportingMatches * 3);
      } else if (lowerInput.includes('benchmark') && 
                (lowerInput.includes('hsi') || lowerInput.includes('kompetitif'))) {
        score = 70;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_PERFORMANCE_BASE AS (
        SELECT 
            PERIODE,
            TREG,
            WITEL,
            SEGMEN,
            LLEVEL,
            GROUP_PRODUK,
            SATUAN,
            
            SUM(TARGET) as UNIT_TARGET,
            SUM(REALISASI) as UNIT_REALISASI,
            
            CASE 
                WHEN SUM(TARGET) > 0 THEN 
                    ROUND((SUM(REALISASI) * 100.0 / SUM(TARGET)), 2)
                ELSE 0 
            END as UNIT_ACHIEVEMENT_PCT,
            
            -- Unit identifier for comparison
            CASE 
                WHEN LLEVEL = 'WITEL' THEN TREG || '-' || WITEL
                WHEN LLEVEL = 'TELDA' THEN TREG || '-' || WITEL
                ELSE TREG
            END as UNIT_IDENTIFIER,
            
            COUNT(DISTINCT TELDA) as TELDA_COVERAGE
            
        FROM TARGET_ALL
        WHERE UPPER(PRODUK) = 'HSI'
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -3), 'YYYYMM')
          AND TARGET IS NOT NULL 
          AND REALISASI IS NOT NULL
        GROUP BY PERIODE, TREG, WITEL, SEGMEN, LLEVEL, GROUP_PRODUK, SATUAN
    ),
    
    PEER_BENCHMARKS AS (
        SELECT *,
            -- Peer group statistics
            AVG(UNIT_ACHIEVEMENT_PCT) OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN
            ) as PEER_AVG_ACHIEVEMENT,
            
            MEDIAN(UNIT_ACHIEVEMENT_PCT) OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN
            ) as PEER_MEDIAN_ACHIEVEMENT,
            
            STDDEV(UNIT_ACHIEVEMENT_PCT) OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN
            ) as PEER_STDDEV_ACHIEVEMENT,
            
            MAX(UNIT_ACHIEVEMENT_PCT) OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN
            ) as PEER_MAX_ACHIEVEMENT,
            
            MIN(UNIT_ACHIEVEMENT_PCT) OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN
            ) as PEER_MIN_ACHIEVEMENT,
            
            -- Volume benchmarks
            AVG(UNIT_REALISASI) OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN
            ) as PEER_AVG_VOLUME,
            
            MAX(UNIT_REALISASI) OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN
            ) as PEER_MAX_VOLUME,
            
            -- Percentile rankings
            PERCENT_RANK() OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN 
                ORDER BY UNIT_ACHIEVEMENT_PCT
            ) as ACHIEVEMENT_PERCENTILE,
            
            PERCENT_RANK() OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL, SATUAN 
                ORDER BY UNIT_REALISASI
            ) as VOLUME_PERCENTILE
            
        FROM HSI_PERFORMANCE_BASE
    ),
    
    COMPETITIVE_METRICS AS (
        SELECT *,
            -- Performance vs peers
            ROUND(UNIT_ACHIEVEMENT_PCT - PEER_AVG_ACHIEVEMENT, 2) as VS_PEER_AVG,
            ROUND(UNIT_ACHIEVEMENT_PCT - PEER_MEDIAN_ACHIEVEMENT, 2) as VS_PEER_MEDIAN,
            
            -- Volume vs peers
            ROUND((UNIT_REALISASI - PEER_AVG_VOLUME) * 100.0 / NULLIF(PEER_AVG_VOLUME, 0), 2) as VOLUME_VS_PEER_AVG_PCT,
            
            -- Standard score (Z-score)
            CASE 
                WHEN PEER_STDDEV_ACHIEVEMENT > 0 THEN 
                    ROUND((UNIT_ACHIEVEMENT_PCT - PEER_AVG_ACHIEVEMENT) / PEER_STDDEV_ACHIEVEMENT, 2)
                ELSE 0
            END as ACHIEVEMENT_ZSCORE,
            
            -- Competitive position
            CASE 
                WHEN ACHIEVEMENT_PERCENTILE >= 0.9 THEN 'TOP_PERFORMER'
                WHEN ACHIEVEMENT_PERCENTILE >= 0.75 THEN 'HIGH_PERFORMER'
                WHEN ACHIEVEMENT_PERCENTILE >= 0.5 THEN 'AVERAGE_PERFORMER'
                WHEN ACHIEVEMENT_PERCENTILE >= 0.25 THEN 'BELOW_AVERAGE'
                ELSE 'BOTTOM_PERFORMER'
            END as COMPETITIVE_POSITION,
            
            -- Market leadership indicator
            CASE 
                WHEN UNIT_ACHIEVEMENT_PCT = PEER_MAX_ACHIEVEMENT THEN 'MARKET_LEADER'
                WHEN UNIT_ACHIEVEMENT_PCT >= PEER_MAX_ACHIEVEMENT * 0.95 THEN 'NEAR_LEADER'
                WHEN UNIT_ACHIEVEMENT_PCT >= PEER_AVG_ACHIEVEMENT THEN 'ABOVE_AVERAGE'
                WHEN UNIT_ACHIEVEMENT_PCT >= PEER_MEDIAN_ACHIEVEMENT THEN 'MEDIAN_PERFORMER'
                ELSE 'BELOW_MEDIAN'
            END as MARKET_POSITION,
            
            -- Rankings
            RANK() OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL 
                ORDER BY UNIT_ACHIEVEMENT_PCT DESC
            ) as ACHIEVEMENT_RANK,
            
            RANK() OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL 
                ORDER BY UNIT_REALISASI DESC
            ) as VOLUME_RANK,
            
            COUNT(*) OVER (
                PARTITION BY PERIODE, SEGMEN, LLEVEL
            ) as TOTAL_PEERS
            
        FROM PEER_BENCHMARKS
    ),
    
    COMPETITIVE_GAPS AS (
        SELECT *,
            -- Gap to leader
            ROUND(PEER_MAX_ACHIEVEMENT - UNIT_ACHIEVEMENT_PCT, 2) as GAP_TO_LEADER_PCT,
            ROUND((PEER_MAX_VOLUME - UNIT_REALISASI) * 100.0 / NULLIF(PEER_MAX_VOLUME, 0), 2) as VOLUME_GAP_TO_LEADER_PCT,
            
            -- Gap to average
            ROUND(PEER_AVG_ACHIEVEMENT - UNIT_ACHIEVEMENT_PCT, 2) as GAP_TO_AVERAGE_PCT,
            
            -- Opportunity assessment
            CASE 
                WHEN UNIT_ACHIEVEMENT_PCT >= PEER_MAX_ACHIEVEMENT * 0.98 THEN 'MAINTAIN_LEADERSHIP'
                WHEN UNIT_ACHIEVEMENT_PCT >= PEER_AVG_ACHIEVEMENT * 1.1 THEN 'OPTIMIZE_ADVANTAGE'
                WHEN UNIT_ACHIEVEMENT_PCT >= PEER_AVG_ACHIEVEMENT THEN 'INCREMENTAL_IMPROVEMENT'
                WHEN UNIT_ACHIEVEMENT_PCT >= PEER_MEDIAN_ACHIEVEMENT THEN 'SIGNIFICANT_OPPORTUNITY'
                ELSE 'URGENT_IMPROVEMENT_NEEDED'
            END as IMPROVEMENT_OPPORTUNITY,
            
            -- Competitive strength score
            ROUND(
                (ACHIEVEMENT_PERCENTILE * 40) + 
                (VOLUME_PERCENTILE * 30) + 
                (CASE WHEN VS_PEER_AVG > 0 THEN 20 ELSE 0 END) +
                (CASE WHEN GAP_TO_LEADER_PCT <= 5 THEN 10 ELSE 0 END), 2
            ) as COMPETITIVE_STRENGTH_SCORE,
            
            -- Performance consistency (vs historical)
            LAG(UNIT_ACHIEVEMENT_PCT) OVER (
                PARTITION BY UNIT_IDENTIFIER, SEGMEN 
                ORDER BY PERIODE
            ) as PREV_ACHIEVEMENT_PCT,
            
            LAG(ACHIEVEMENT_RANK) OVER (
                PARTITION BY UNIT_IDENTIFIER, SEGMEN 
                ORDER BY PERIODE
            ) as PREV_ACHIEVEMENT_RANK
            
        FROM COMPETITIVE_METRICS
    ),
    
    COMPETITIVE_TRENDS AS (
        SELECT *,
            -- Performance momentum
            CASE 
                WHEN PREV_ACHIEVEMENT_PCT IS NOT NULL THEN 
                    ROUND(UNIT_ACHIEVEMENT_PCT - PREV_ACHIEVEMENT_PCT, 2)
                ELSE NULL
            END as ACHIEVEMENT_MOMENTUM,
            
            -- Ranking movement
            CASE 
                WHEN PREV_ACHIEVEMENT_RANK IS NOT NULL THEN 
                    PREV_ACHIEVEMENT_RANK - ACHIEVEMENT_RANK
                ELSE NULL
            END as RANKING_MOVEMENT,
            
            -- Momentum category
            CASE 
                WHEN PREV_ACHIEVEMENT_PCT IS NULL THEN 'NEW_ENTRY'
                WHEN (UNIT_ACHIEVEMENT_PCT - PREV_ACHIEVEMENT_PCT) >= 5 THEN 'STRONG_IMPROVEMENT'
                WHEN (UNIT_ACHIEVEMENT_PCT - PREV_ACHIEVEMENT_PCT) >= 2 THEN 'IMPROVING'
                WHEN (UNIT_ACHIEVEMENT_PCT - PREV_ACHIEVEMENT_PCT) >= -2 THEN 'STABLE'
                WHEN (UNIT_ACHIEVEMENT_PCT - PREV_ACHIEVEMENT_PCT) >= -5 THEN 'DECLINING'
                ELSE 'SIGNIFICANT_DECLINE'
            END as MOMENTUM_CATEGORY
            
        FROM COMPETITIVE_GAPS
    )
    
    SELECT 
        PERIODE,
        TREG,
        WITEL,
        SEGMEN,
        LLEVEL,
        GROUP_PRODUK,
        SATUAN,
        UNIT_IDENTIFIER,
        UNIT_TARGET,
        UNIT_REALISASI,
        UNIT_ACHIEVEMENT_PCT,
        PEER_AVG_ACHIEVEMENT,
        PEER_MEDIAN_ACHIEVEMENT,
        PEER_MAX_ACHIEVEMENT,
        VS_PEER_AVG,
        VS_PEER_MEDIAN,
        ACHIEVEMENT_PERCENTILE,
        VOLUME_PERCENTILE,
        COMPETITIVE_POSITION,
        MARKET_POSITION,
        ACHIEVEMENT_RANK,
        VOLUME_RANK,
        TOTAL_PEERS,
        GAP_TO_LEADER_PCT,
        GAP_TO_AVERAGE_PCT,
        IMPROVEMENT_OPPORTUNITY,
        COMPETITIVE_STRENGTH_SCORE,
        ACHIEVEMENT_MOMENTUM,
        RANKING_MOVEMENT,
        MOMENTUM_CATEGORY,
        TELDA_COVERAGE
    FROM COMPETITIVE_TRENDS
    ORDER BY PERIODE DESC, COMPETITIVE_STRENGTH_SCORE DESC
  `,

  BUSINESS_LOGIC: {
    getUnitContext: function(satuan) {
      const unitContexts = {
        'SSL': {
          description: '1 Layanan Terpasang (Service Subscriber Line)',
          competitive_interpretation: 'Perbandingan jumlah layanan HSI yang berhasil diaktivasi antar unit',
          benchmarking_focus: 'Fokus pada efektivitas instalasi dan aktivasi layanan'
        },
        'UNIT': {
          description: 'Unit Layanan',
          competitive_interpretation: 'Perbandingan volume layanan HSI yang diberikan antar unit',
          benchmarking_focus: 'Fokus pada produktivitas dan volume layanan'
        },
        'SUBSCRIBER': {
          description: 'Pelanggan HSI',
          competitive_interpretation: 'Perbandingan jumlah pelanggan HSI yang terlayani antar unit',
          benchmarking_focus: 'Fokus pada akuisisi dan retensi pelanggan'
        },
        'CONNECTION': {
          description: 'Koneksi HSI',
          competitive_interpretation: 'Perbandingan jumlah koneksi internet berkecepatan tinggi antar unit',
          benchmarking_focus: 'Fokus pada infrastruktur dan kualitas koneksi'
        }
      };
      
      return unitContexts[satuan] || {
        description: satuan || 'Unit tidak terdefinisi',
        competitive_interpretation: 'Perbandingan metrik antar unit sesuai definisi bisnis',
        benchmarking_focus: 'Fokus benchmarking disesuaikan dengan konteks bisnis spesifik'
      };
    },

    assessCompetitiveAdvantage: function(competitive_position, market_position, strength_score, momentum, satuan) {
      let advantage_score = 0;
      
      // Position component (40%)
      const positionScores = {
        'TOP_PERFORMER': 40,
        'HIGH_PERFORMER': 32,
        'AVERAGE_PERFORMER': 24,
        'BELOW_AVERAGE': 16,
        'BOTTOM_PERFORMER': 8
      };
      advantage_score += positionScores[competitive_position] || 0;
      
      // Market position component (30%)
      const marketScores = {
        'MARKET_LEADER': 30,
        'NEAR_LEADER': 24,
        'ABOVE_AVERAGE': 18,
        'MEDIAN_PERFORMER': 12,
        'BELOW_MEDIAN': 6
      };
      advantage_score += marketScores[market_position] || 0;
      
      // Strength score component (20%)
      advantage_score += (strength_score * 0.2);
      
      // Momentum component (10%)
      const momentumScores = {
        'STRONG_IMPROVEMENT': 10,
        'IMPROVING': 7,
        'STABLE': 5,
        'DECLINING': 3,
        'SIGNIFICANT_DECLINE': 1
      };
      advantage_score += momentumScores[momentum] || 0;
      
      const advantageCategories = {
        'DOMINAN': {
          description: 'Posisi dominan dengan keunggulan kompetitif yang sangat kuat',
          strategy: 'Pertahankan posisi kepemimpinan dan perluas pengaruh pasar'
        },
        'UNGGUL': {
          description: 'Posisi unggul dengan keunggulan kompetitif yang solid',
          strategy: 'Perkuat posisi dan ekspansi pasar selektif'
        },
        'KOMPETITIF': {
          description: 'Posisi kompetitif dengan potensi untuk meningkat',
          strategy: 'Fokus pada diferensiasi dan peningkatan performa'
        },
        'TERTANTANG': {
          description: 'Posisi tertantang memerlukan reposisi strategis',
          strategy: 'Program peningkatan mendesak dan pemulihan kompetitif'
        }
      };
      
      // Add unit context to advantage assessment
      const unitContext = this.getUnitContext(satuan);
      
      let selectedCategory;
      if (advantage_score >= 85) selectedCategory = advantageCategories['DOMINAN'];
      else if (advantage_score >= 70) selectedCategory = advantageCategories['UNGGUL'];
      else if (advantage_score >= 50) selectedCategory = advantageCategories['KOMPETITIF'];
      else selectedCategory = advantageCategories['TERTANTANG'];
      
      selectedCategory.unit_context = unitContext;
      return selectedCategory;
    },
    
    identifyCompetitiveThreats: function(ranking_movement, gap_to_leader, momentum_category, vs_peer_avg, satuan) {
      const threats = [];
      const unitContext = this.getUnitContext(satuan);
      
      // Ranking threats with unit context
      if (ranking_movement < -2) {
        if (satuan === 'SSL') {
          threats.push('Penurunan ranking signifikan - risiko kehilangan posisi kompetitif dalam instalasi layanan');
        } else {
          threats.push('Penurunan ranking signifikan - risiko kehilangan posisi kompetitif');
        }
      }
      
      // Performance gap threats
      if (gap_to_leader > 20) {
        threats.push('Gap besar dengan market leader - risiko kelemahan kompetitif');
      }
      
      // Momentum threats
      if (momentum_category === 'SIGNIFICANT_DECLINE') {
        threats.push('Momentum menurun drastis - intervensi mendesak diperlukan');
      }
      
      // Below average performance with unit context
      if (vs_peer_avg < -10) {
        if (satuan === 'SSL') {
          threats.push('Performa di bawah rata-rata peer - kelemahan kompetitif dalam aktivasi layanan');
        } else {
          threats.push('Performa di bawah rata-rata peer - kelemahan kompetitif');
        }
      }
      
      return threats.length > 0 ? threats : ['Tidak ada ancaman kompetitif yang signifikan'];
    },
    
    generateCompetitiveStrategy: function(competitive_position, improvement_opportunity, gap_to_leader) {
      const strategies = {
        'TOP_PERFORMER': {
          focus: 'Pertahanan Kepemimpinan',
          tactics: [
            'Pertahankan keunggulan kompetitif dan barrier to entry',
            'Inovasi berkelanjutan untuk tetap unggul',
            'Ekspansi pasar ke segmen yang berdekatan',
            'Posisi thought leadership'
          ]
        },
        'HIGH_PERFORMER': {
          focus: 'Tantangan Kepemimpinan',
          tactics: [
            'Tutup gap dengan market leader',
            'Pengembangan strategi diferensiasi',
            'Langkah agresif selektif',
            'Program peningkatan kapabilitas'
          ]
        },
        'AVERAGE_PERFORMER': {
          focus: 'Peningkatan Kompetitif',
          tactics: [
            'Program optimasi performa',
            'Adopsi praktik terbaik dari leaders',
            'Inisiatif peningkatan terfokus',
            'Penguatan competitive intelligence'
          ]
        },
        'BELOW_AVERAGE': {
          focus: 'Pemulihan Performa',
          tactics: [
            'Tinjauan performa fundamental',
            'Identifikasi quick wins',
            'Realokasi sumber daya',
            'Reposisi kompetitif'
          ]
        },
        'BOTTOM_PERFORMER': {
          focus: 'Strategi Turnaround',
          tactics: [
            'Overhaul strategis komprehensif',
            'Pendekatan manajemen krisis',
            'Pengembangan kapabilitas mendesak',
            'Pertimbangan alternatif strategis'
          ]
        }
      };
      
      return strategies[competitive_position] || {
        focus: 'Strategi Kompetitif Khusus',
        tactics: ['Kembangkan pendekatan spesifik posisi']
      };
    },
    
    identifyBenchmarkOpportunities: function(peer_max_achievement, unit_achievement, gap_to_leader, vs_peer_avg, satuan) {
      const opportunities = [];
      const unitContext = this.getUnitContext(satuan);
      
      // Leader benchmarking with unit context
      if (gap_to_leader <= 10 && gap_to_leader > 0) {
        if (satuan === 'SSL') {
          opportunities.push('Posisi near-leader - peluang untuk menantang kepemimpinan dalam instalasi layanan');
        } else {
          opportunities.push('Posisi near-leader - peluang untuk menantang kepemimpinan');
        }
      } else if (gap_to_leader > 10) {
        opportunities.push('Gap signifikan dengan leader - program peningkatan sistematis diperlukan');
      }
      
      // Peer comparison opportunities
      if (vs_peer_avg > 5) {
        opportunities.push('Di atas rata-rata peer - manfaatkan keunggulan untuk ekspansi pasar');
      } else if (vs_peer_avg < -5) {
        opportunities.push('Di bawah rata-rata peer - pelajari dari praktik terbaik peer');
      }
      
      // Performance level opportunities with unit context
      if (unit_achievement >= 100 && gap_to_leader > 0) {
        opportunities.push('Target tercapai namun masih ada ruang untuk kepemimpinan - peluang optimasi');
      } else if (unit_achievement < 90) {
        opportunities.push('Performa di bawah target - peningkatan fundamental diperlukan');
      }
      
      return opportunities.length > 0 ? opportunities : ['Pertahankan keseimbangan kompetitif'];
    },
    
    formatIndonesianResponse: function(data) {
      const hasil_analisis = data.map(record => {
        const competitive_advantage = this.assessCompetitiveAdvantage(
          record.COMPETITIVE_POSITION,
          record.MARKET_POSITION,
          record.COMPETITIVE_STRENGTH_SCORE,
          record.MOMENTUM_CATEGORY,
          record.SATUAN
        );
        
        const threats = this.identifyCompetitiveThreats(
          record.RANKING_MOVEMENT || 0,
          record.GAP_TO_LEADER_PCT,
          record.MOMENTUM_CATEGORY,
          record.VS_PEER_AVG,
          record.SATUAN
        );
        
        const strategy = this.generateCompetitiveStrategy(
          record.COMPETITIVE_POSITION,
          record.IMPROVEMENT_OPPORTUNITY,
          record.GAP_TO_LEADER_PCT
        );
        
        const benchmark_opportunities = this.identifyBenchmarkOpportunities(
          record.PEER_MAX_ACHIEVEMENT,
          record.UNIT_ACHIEVEMENT_PCT,
          record.GAP_TO_LEADER_PCT,
          record.VS_PEER_AVG,
          record.SATUAN
        );
        
        return {
          identitas_unit: {
            periode: record.PERIODE,
            unit_identifier: record.UNIT_IDENTIFIER,
            treg: record.TREG,
            witel: record.WITEL,
            segmen: record.SEGMEN,
            level_analisis: record.LLEVEL,
            group_produk: record.GROUP_PRODUK
          },
          satuan_target: {
            satuan: record.SATUAN,
            deskripsi_satuan: competitive_advantage.unit_context.description,
            interpretasi_kompetitif: competitive_advantage.unit_context.competitive_interpretation,
            fokus_benchmarking: competitive_advantage.unit_context.benchmarking_focus
          },
          metrik_performa: {
            target: `${record.UNIT_TARGET.toLocaleString('id-ID')} ${record.SATUAN}`,
            realisasi: `${record.UNIT_REALISASI.toLocaleString('id-ID')} ${record.SATUAN}`,
            pencapaian: `${record.UNIT_ACHIEVEMENT_PCT}%`,
            cakupan_telda: record.TELDA_COVERAGE
          },
          benchmark_peer: {
            rata_rata_peer: `${record.PEER_AVG_ACHIEVEMENT}%`,
            median_peer: `${record.PEER_MEDIAN_ACHIEVEMENT}%`,
            maksimal_peer: `${record.PEER_MAX_ACHIEVEMENT}%`,
            vs_rata_rata: `${record.VS_PEER_AVG > 0 ? '+' : ''}${record.VS_PEER_AVG}%`,
            vs_median: `${record.VS_PEER_MEDIAN > 0 ? '+' : ''}${record.VS_PEER_MEDIAN}%`
          },
          posisi_kompetitif: {
            posisi_kompetitif: record.COMPETITIVE_POSITION,
            posisi_pasar: record.MARKET_POSITION,
            percentile_pencapaian: `${Math.round(record.ACHIEVEMENT_PERCENTILE * 100)}%`,
            percentile_volume: `${Math.round(record.VOLUME_PERCENTILE * 100)}%`,
            skor_kekuatan_kompetitif: record.COMPETITIVE_STRENGTH_SCORE
          },
          analisis_ranking: {
            ranking_pencapaian: `${record.ACHIEVEMENT_RANK} dari ${record.TOTAL_PEERS}`,
            ranking_volume: `${record.VOLUME_RANK} dari ${record.TOTAL_PEERS}`,
            pergerakan_ranking: record.RANKING_MOVEMENT ? 
              (record.RANKING_MOVEMENT > 0 ? `Naik ${record.RANKING_MOVEMENT} posisi` : 
               record.RANKING_MOVEMENT < 0 ? `Turun ${Math.abs(record.RANKING_MOVEMENT)} posisi` : 'Stabil') : 'N/A'
          },
          analisis_gap: {
            gap_ke_leader: `${record.GAP_TO_LEADER_PCT}%`,
            gap_ke_rata_rata: `${record.GAP_TO_AVERAGE_PCT}%`,
            opportunity_level: record.IMPROVEMENT_OPPORTUNITY
          },
          momentum_kompetitif: {
            perubahan_pencapaian: record.ACHIEVEMENT_MOMENTUM ? `${record.ACHIEVEMENT_MOMENTUM > 0 ? '+' : ''}${record.ACHIEVEMENT_MOMENTUM}%` : 'N/A',
            kategori_momentum: record.MOMENTUM_CATEGORY
          },
          keunggulan_kompetitif: {
            deskripsi: competitive_advantage.description,
            strategi_utama: competitive_advantage.strategy
          },
          ancaman_kompetitif: threats,
          peluang_benchmark: benchmark_opportunities,
          rencana_kompetitif: {
            fokus_strategis: strategy.focus,
            taktik_eksekusi: strategy.tactics
          }
        };
      });
      
      // Competitive landscape summary
      const competitive_summary = {
        total_unit_analisis: data.length,
        distribusi_posisi_kompetitif: {
          top_performer: data.filter(d => d.COMPETITIVE_POSITION === 'TOP_PERFORMER').length,
          high_performer: data.filter(d => d.COMPETITIVE_POSITION === 'HIGH_PERFORMER').length,
          average_performer: data.filter(d => d.COMPETITIVE_POSITION === 'AVERAGE_PERFORMER').length,
          below_average: data.filter(d => d.COMPETITIVE_POSITION === 'BELOW_AVERAGE').length,
          bottom_performer: data.filter(d => d.COMPETITIVE_POSITION === 'BOTTOM_PERFORMER').length
        },
        market_leader: data.find(d => d.MARKET_POSITION === 'MARKET_LEADER')?.UNIT_IDENTIFIER || 'Tidak teridentifikasi',
        rata_rata_competitive_strength: (data.reduce((sum, d) => sum + d.COMPETITIVE_STRENGTH_SCORE, 0) / data.length).toFixed(2),
        satuan_dominan: data.reduce((prev, current) => 
          (data.filter(d => d.SATUAN === prev.SATUAN).length > 
           data.filter(d => d.SATUAN === current.SATUAN).length) ? prev : current
        ).SATUAN
      };
      
      return {
        ringkasan: 'Analisis performa kompetitif HSI untuk positioning dan benchmarking internal dengan satuan yang jelas',
        summary_kompetitif: competitive_summary,
        benchmark_industri: {
          top_quartile_threshold: '≥ 75th percentile',
          competitive_strength_target: '≥ 70',
          leadership_gap_maximum: '≤ 5%'
        },
        detail_analisis: hasil_analisis,
        rekomendasi_kompetitif: [
          'Fokus pada penutupan gap dengan market leader untuk unit dengan potensi tinggi',
          'Implementasi sharing praktik terbaik dari top performers ke bottom performers',
          'Kembangkan sistem competitive intelligence untuk monitor pergerakan peer',
          'Prioritaskan alokasi sumber daya berdasarkan potensi keunggulan kompetitif'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = patternMatcher.calculateConfidence(userInput, module.exports.KEYWORD_PATTERNS);
      return {
        matches: confidence >= 70,
        confidence: confidence,
        focus_area: userInput.toLowerCase().includes('ranking') || 
                   userInput.toLowerCase().includes('benchmark') ? 'benchmarking' : 'competitive_analysis'
      };
    },
    
  },

  CACHE_DURATION: 1800, // 30 minutes
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'MEDIUM'
};