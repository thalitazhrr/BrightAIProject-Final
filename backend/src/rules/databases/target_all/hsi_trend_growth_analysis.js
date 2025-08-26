const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'target_004',
    RULE_NAME: 'hsi_trend_growth_analysis',
    DESCRIPTION: 'Analisis trend dan pola pertumbuhan HSI untuk identifikasi pattern dan momentum dengan implementasi satuan yang jelas',
    DATABASE: 'TARGET_ALL',
    CATEGORY: 'trend_analysis',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("TARGET_ALL"),

  KEYWORD_PATTERNS: {
    primary: [
      // Trend analysis - yang biasa digunakan
      'trend hsi', 'tren hsi', 'pola pertumbuhan', 'growth pattern',
      'analisis trend', 'trend analysis', 'momentum hsi',
      
      // Time series familiar terms
      'perkembangan', 'development', 'evolusi', 'evolution',
      'pergerakan', 'movement', 'dinamika', 'dynamics'
    ],
    
    supporting: [
      // Trend indicators
      'naik', 'turun', 'stabil', 'fluktuasi', 'volatilitas',
      'increasing', 'decreasing', 'stable', 'fluctuation',
      
      // Growth terms
      'pertumbuhan', 'growth', 'ekspansi', 'expansion', 'decline',
      'penurunan', 'peningkatan', 'improvement', 'deterioration',
      
      // Pattern analysis
      'pola', 'pattern', 'siklus', 'cycle', 'seasonality',
      'musiman', 'bulanan', 'quarterly', 'tahunan'
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
        score = 75 + (primaryMatches * 15) + (supportingMatches * 2);
      } else if (lowerInput.includes('trend') && 
                (lowerInput.includes('hsi') || lowerInput.includes('pertumbuhan'))) {
        score = 65;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_MONTHLY_TREND AS (
        SELECT 
            PERIODE,
            TREG,
            SEGMEN,
            LLEVEL,
            GROUP_PRODUK,
            SATUAN,
            
            -- Monthly aggregations
            SUM(TARGET) as MONTHLY_TARGET,
            SUM(REALISASI) as MONTHLY_REALISASI,
            
            CASE 
                WHEN SUM(TARGET) > 0 THEN 
                    ROUND((SUM(REALISASI) * 100.0 / SUM(TARGET)), 2)
                ELSE 0 
            END as MONTHLY_ACHIEVEMENT_PCT,
            
            -- Extract period components
            SUBSTR(PERIODE, 1, 4) as TAHUN,
            SUBSTR(PERIODE, 5, 2) as BULAN,
            
            -- Count units
            COUNT(DISTINCT WITEL) as ACTIVE_WITEL,
            COUNT(DISTINCT TELDA) as ACTIVE_TELDA
            
        FROM TARGET_ALL
        WHERE UPPER(PRODUK) = 'HSI'
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -12), 'YYYYMM')
          AND TARGET IS NOT NULL 
          AND REALISASI IS NOT NULL
        GROUP BY PERIODE, TREG, SEGMEN, LLEVEL, GROUP_PRODUK, SATUAN
    ),
    
    TREND_CALCULATIONS AS (
        SELECT *,
            -- Previous period metrics
            LAG(MONTHLY_REALISASI, 1) OVER (
                PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN 
                ORDER BY PERIODE
            ) as PREV_MONTH_REALISASI,
            
            LAG(MONTHLY_ACHIEVEMENT_PCT, 1) OVER (
                PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN 
                ORDER BY PERIODE
            ) as PREV_MONTH_ACHIEVEMENT,
            
            -- 3-month moving average
            AVG(MONTHLY_REALISASI) OVER (
                PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN 
                ORDER BY PERIODE 
                ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
            ) as MA3_REALISASI,
            
            -- Year-over-year comparison
            LAG(MONTHLY_REALISASI, 12) OVER (
                PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN 
                ORDER BY PERIODE
            ) as YOY_REALISASI,
            
            LAG(MONTHLY_ACHIEVEMENT_PCT, 12) OVER (
                PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN 
                ORDER BY PERIODE
            ) as YOY_ACHIEVEMENT
            
        FROM HSI_MONTHLY_TREND
    ),
    
    GROWTH_METRICS AS (
        SELECT *,
            -- Month-over-month growth
            CASE 
                WHEN PREV_MONTH_REALISASI IS NOT NULL AND PREV_MONTH_REALISASI > 0 THEN 
                    ROUND(((MONTHLY_REALISASI - PREV_MONTH_REALISASI) * 100.0 / PREV_MONTH_REALISASI), 2)
                ELSE NULL
            END as MOM_GROWTH_PCT,
            
            -- Year-over-year growth
            CASE 
                WHEN YOY_REALISASI IS NOT NULL AND YOY_REALISASI > 0 THEN 
                    ROUND(((MONTHLY_REALISASI - YOY_REALISASI) * 100.0 / YOY_REALISASI), 2)
                ELSE NULL
            END as YOY_GROWTH_PCT,
            
            -- Achievement change
            CASE 
                WHEN PREV_MONTH_ACHIEVEMENT IS NOT NULL THEN 
                    ROUND(MONTHLY_ACHIEVEMENT_PCT - PREV_MONTH_ACHIEVEMENT, 2)
                ELSE NULL
            END as ACHIEVEMENT_CHANGE_PCT,
            
            -- Moving average trend
            CASE 
                WHEN MONTHLY_REALISASI > MA3_REALISASI THEN 'ABOVE_TREND'
                WHEN MONTHLY_REALISASI < MA3_REALISASI * 0.95 THEN 'BELOW_TREND'
                ELSE 'ON_TREND'
            END as TREND_POSITION,
            
            -- Volatility indicator (standard deviation of last 3 months)
            STDDEV(MONTHLY_REALISASI) OVER (
                PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN 
                ORDER BY PERIODE 
                ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
            ) as VOLATILITY_INDICATOR
            
        FROM TREND_CALCULATIONS
    ),
    
    PATTERN_ANALYSIS AS (
        SELECT *,
            -- Seasonal pattern detection
            CASE 
                WHEN BULAN IN ('01', '02', '12') THEN 'Q4_Q1_TRANSITION'
                WHEN BULAN IN ('03', '04', '05') THEN 'Q1_GROWTH'
                WHEN BULAN IN ('06', '07', '08') THEN 'MID_YEAR'
                WHEN BULAN IN ('09', '10', '11') THEN 'Q3_Q4_BUILDUP'
            END as SEASONAL_PERIOD,
            
            -- Growth consistency (last 3 months)
            CASE 
                WHEN LAG(MOM_GROWTH_PCT, 2) OVER (PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN ORDER BY PERIODE) > 0
                     AND LAG(MOM_GROWTH_PCT, 1) OVER (PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN ORDER BY PERIODE) > 0
                     AND MOM_GROWTH_PCT > 0 THEN 'CONSISTENT_GROWTH'
                WHEN LAG(MOM_GROWTH_PCT, 2) OVER (PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN ORDER BY PERIODE) < 0
                     AND LAG(MOM_GROWTH_PCT, 1) OVER (PARTITION BY TREG, SEGMEN, LLEVEL, SATUAN ORDER BY PERIODE) < 0
                     AND MOM_GROWTH_PCT < 0 THEN 'CONSISTENT_DECLINE'
                ELSE 'MIXED_PATTERN'
            END as GROWTH_CONSISTENCY,
            
            -- Momentum categorization
            CASE 
                WHEN MOM_GROWTH_PCT >= 15 THEN 'MOMENTUM_SANGAT_TINGGI'
                WHEN MOM_GROWTH_PCT >= 8 THEN 'MOMENTUM_TINGGI'
                WHEN MOM_GROWTH_PCT >= 3 THEN 'MOMENTUM_SEDANG'
                WHEN MOM_GROWTH_PCT >= -3 THEN 'MOMENTUM_STABIL'
                WHEN MOM_GROWTH_PCT >= -10 THEN 'MOMENTUM_MENURUN'
                ELSE 'MOMENTUM_SANGAT_MENURUN'
            END as MOMENTUM_CATEGORY,
            
            -- Performance stability
            CASE 
                WHEN VOLATILITY_INDICATOR IS NULL THEN 'INSUFFICIENT_DATA'
                WHEN VOLATILITY_INDICATOR <= MONTHLY_REALISASI * 0.1 THEN 'SANGAT_STABIL'
                WHEN VOLATILITY_INDICATOR <= MONTHLY_REALISASI * 0.2 THEN 'STABIL'
                WHEN VOLATILITY_INDICATOR <= MONTHLY_REALISASI * 0.3 THEN 'MODERATE_VOLATIL'
                ELSE 'TINGGI_VOLATIL'
            END as STABILITY_CATEGORY,
            
            -- Trend direction (based on 3-month trend)
            CASE 
                WHEN MONTHLY_REALISASI > MA3_REALISASI * 1.05 THEN 'TREND_NAIK_KUAT'
                WHEN MONTHLY_REALISASI > MA3_REALISASI THEN 'TREND_NAIK'
                WHEN MONTHLY_REALISASI > MA3_REALISASI * 0.95 THEN 'TREND_STABIL'
                WHEN MONTHLY_REALISASI > MA3_REALISASI * 0.9 THEN 'TREND_TURUN'
                ELSE 'TREND_TURUN_KUAT'
            END as TREND_DIRECTION
            
        FROM GROWTH_METRICS
    ),
    
    FORECAST_INDICATORS AS (
        SELECT *,
            -- Next month projection (simple linear trend)
            CASE 
                WHEN MOM_GROWTH_PCT IS NOT NULL THEN 
                    ROUND(MONTHLY_REALISASI * (1 + (MOM_GROWTH_PCT / 100)), 0)
                ELSE MONTHLY_REALISASI
            END as PROJECTED_NEXT_MONTH,
            
            -- Risk assessment
            CASE 
                WHEN GROWTH_CONSISTENCY = 'CONSISTENT_DECLINE' 
                     AND MOMENTUM_CATEGORY IN ('MOMENTUM_MENURUN', 'MOMENTUM_SANGAT_MENURUN') THEN 'HIGH_RISK'
                WHEN STABILITY_CATEGORY = 'TINGGI_VOLATIL' 
                     AND TREND_DIRECTION IN ('TREND_TURUN', 'TREND_TURUN_KUAT') THEN 'MEDIUM_RISK'
                WHEN MOMENTUM_CATEGORY IN ('MOMENTUM_STABIL', 'MOMENTUM_SEDANG') 
                     AND STABILITY_CATEGORY IN ('STABIL', 'SANGAT_STABIL') THEN 'LOW_RISK'
                ELSE 'MEDIUM_RISK'
            END as RISK_LEVEL,
            
            -- Opportunity score
            ROUND(
                CASE 
                    WHEN MOMENTUM_CATEGORY = 'MOMENTUM_SANGAT_TINGGI' THEN 90
                    WHEN MOMENTUM_CATEGORY = 'MOMENTUM_TINGGI' THEN 75
                    WHEN MOMENTUM_CATEGORY = 'MOMENTUM_SEDANG' THEN 60
                    WHEN MOMENTUM_CATEGORY = 'MOMENTUM_STABIL' THEN 45
                    WHEN MOMENTUM_CATEGORY = 'MOMENTUM_MENURUN' THEN 25
                    ELSE 10
                END * 
                CASE 
                    WHEN STABILITY_CATEGORY = 'SANGAT_STABIL' THEN 1.2
                    WHEN STABILITY_CATEGORY = 'STABIL' THEN 1.1
                    WHEN STABILITY_CATEGORY = 'MODERATE_VOLATIL' THEN 0.9
                    ELSE 0.7
                END, 2
            ) as OPPORTUNITY_SCORE
            
        FROM PATTERN_ANALYSIS
    )
    
    SELECT 
        PERIODE,
        TREG,
        SEGMEN,
        LLEVEL,
        GROUP_PRODUK,
        SATUAN,
        TAHUN,
        BULAN,
        MONTHLY_TARGET,
        MONTHLY_REALISASI,
        MONTHLY_ACHIEVEMENT_PCT,
        MOM_GROWTH_PCT,
        YOY_GROWTH_PCT,
        ACHIEVEMENT_CHANGE_PCT,
        MA3_REALISASI,
        TREND_POSITION,
        SEASONAL_PERIOD,
        GROWTH_CONSISTENCY,
        MOMENTUM_CATEGORY,
        STABILITY_CATEGORY,
        TREND_DIRECTION,
        PROJECTED_NEXT_MONTH,
        RISK_LEVEL,
        OPPORTUNITY_SCORE,
        VOLATILITY_INDICATOR,
        ACTIVE_WITEL,
        ACTIVE_TELDA
    FROM FORECAST_INDICATORS
    ORDER BY PERIODE DESC, MONTHLY_REALISASI DESC
  `,

  BUSINESS_LOGIC: {
    getUnitContext: function(satuan) {
      const unitContexts = {
        'SSL': {
          description: '1 Layanan Terpasang (Service Subscriber Line)',
          trend_interpretation: 'Trend jumlah layanan HSI yang berhasil diaktivasi dari waktu ke waktu',
          forecasting_focus: 'Fokus pada proyeksi instalasi dan aktivasi layanan baru'
        },
        'UNIT': {
          description: 'Unit Layanan',
          trend_interpretation: 'Trend volume layanan HSI yang diberikan dari waktu ke waktu',
          forecasting_focus: 'Fokus pada proyeksi volume layanan dan kapasitas'
        },
        'SUBSCRIBER': {
          description: 'Pelanggan HSI',
          trend_interpretation: 'Trend jumlah pelanggan HSI yang terlayani dari waktu ke waktu',
          forecasting_focus: 'Fokus pada proyeksi akuisisi dan retensi pelanggan'
        },
        'CONNECTION': {
          description: 'Koneksi HSI',
          trend_interpretation: 'Trend jumlah koneksi internet berkecepatan tinggi dari waktu ke waktu',
          forecasting_focus: 'Fokus pada proyeksi konektivitas dan infrastruktur'
        }
      };
      
      return unitContexts[satuan] || {
        description: satuan || 'Unit tidak terdefinisi',
        trend_interpretation: 'Trend metrik sesuai definisi bisnis dari waktu ke waktu',
        forecasting_focus: 'Fokus proyeksi disesuaikan dengan konteks bisnis spesifik'
      };
    },

    assessTrendStrength: function(momentum_category, growth_consistency, stability_category, satuan) {
      let trend_score = 0;
      
      // Momentum component (50%)
      const momentumScores = {
        'MOMENTUM_SANGAT_TINGGI': 50,
        'MOMENTUM_TINGGI': 40,
        'MOMENTUM_SEDANG': 30,
        'MOMENTUM_STABIL': 20,
        'MOMENTUM_MENURUN': 10,
        'MOMENTUM_SANGAT_MENURUN': 5
      };
      trend_score += momentumScores[momentum_category] || 0;
      
      // Consistency component (30%)
      const consistencyScores = {
        'CONSISTENT_GROWTH': 30,
        'MIXED_PATTERN': 15,
        'CONSISTENT_DECLINE': 5
      };
      trend_score += consistencyScores[growth_consistency] || 0;
      
      // Stability component (20%)
      const stabilityScores = {
        'SANGAT_STABIL': 20,
        'STABIL': 15,
        'MODERATE_VOLATIL': 10,
        'TINGGI_VOLATIL': 5
      };
      trend_score += stabilityScores[stability_category] || 0;
      
      const trendCategories = {
        'TREND_SANGAT_KUAT': {
          description: 'Trend pertumbuhan sangat kuat dengan momentum dan konsistensi tinggi',
          recommendation: 'Ekspansi agresif dan maksimalkan momentum'
        },
        'TREND_KUAT': {
          description: 'Trend pertumbuhan kuat dengan performa solid',
          recommendation: 'Scaling strategis dan pertahankan momentum'
        },
        'TREND_MODERAT': {
          description: 'Trend pertumbuhan moderat dengan potensi perbaikan',
          recommendation: 'Strategi optimasi dan pertumbuhan selektif'
        },
        'TREND_LEMAH': {
          description: 'Trend pertumbuhan lemah memerlukan intervensi',
          recommendation: 'Peningkatan performa dan tinjauan strategis'
        }
      };
      
      // Add unit context to trend assessment
      const unitContext = this.getUnitContext(satuan);
      
      let selectedCategory;
      if (trend_score >= 80) selectedCategory = trendCategories['TREND_SANGAT_KUAT'];
      else if (trend_score >= 60) selectedCategory = trendCategories['TREND_KUAT'];
      else if (trend_score >= 40) selectedCategory = trendCategories['TREND_MODERAT'];
      else selectedCategory = trendCategories['TREND_LEMAH'];
      
      selectedCategory.unit_context = unitContext;
      return selectedCategory;
    },
    
    identifySeasonalPattern: function(seasonal_period, mom_growth, yoy_growth, satuan) {
      const seasonalInsights = {
        'Q4_Q1_TRANSITION': {
          pattern: 'Periode transisi akhir tahun dengan potensi holiday effect',
          expectation: 'Biasanya mengalami perlambatan namun recovery di Q1'
        },
        'Q1_GROWTH': {
          pattern: 'Periode growth awal tahun dengan budget refresh',
          expectation: 'Expected high activity dengan target achievement focus'
        },
        'MID_YEAR': {
          pattern: 'Periode pertengahan tahun dengan momentum steady',
          expectation: 'Consistent performance dengan preparation untuk H2'
        },
        'Q3_Q4_BUILDUP': {
          pattern: 'Periode buildup menuju akhir tahun',
          expectation: 'Acceleration phase untuk year-end target achievement'
        }
      };
      
      // Add unit-specific context to seasonal patterns
      const unitContext = this.getUnitContext(satuan);
      const basePattern = seasonalInsights[seasonal_period] || {
        pattern: 'Pattern tidak teridentifikasi',
        expectation: 'Perlu analisis lebih mendalam'
      };
      
      // Enhance pattern with unit context
      if (satuan === 'SSL' && seasonal_period === 'Q1_GROWTH') {
        basePattern.unit_specific = 'Periode optimal untuk campaign instalasi layanan baru';
      } else if (satuan === 'SUBSCRIBER' && seasonal_period === 'Q3_Q4_BUILDUP') {
        basePattern.unit_specific = 'Periode intensifikasi akuisisi pelanggan untuk target tahunan';
      }
      
      return basePattern;
    },
    
    generateActionItems: function(momentum_category, risk_level, trend_direction, opportunity_score, satuan) {
      const actionItems = [];
      const unitContext = this.getUnitContext(satuan);
      
      // Momentum-based actions with unit context
      if (momentum_category === 'MOMENTUM_SANGAT_TINGGI') {
        if (satuan === 'SSL') {
          actionItems.push('Maksimalkan momentum dengan alokasi sumber daya optimal untuk instalasi');
          actionItems.push('Persiapkan strategi scaling untuk sustain pertumbuhan layanan');
        } else {
          actionItems.push('Maksimalkan momentum dengan alokasi sumber daya optimal');
          actionItems.push('Persiapkan strategi scaling untuk sustain pertumbuhan');
        }
      } else if (momentum_category.includes('MENURUN')) {
        actionItems.push('Tindakan segera untuk membalikkan momentum negatif');
        actionItems.push('Analisis akar masalah untuk identifikasi area problem');
      }
      
      // Risk-based actions
      if (risk_level === 'HIGH_RISK') {
        actionItems.push('Implementasi strategi mitigasi risiko dan rencana kontinjensi');
        actionItems.push('Peningkatan monitoring dan sistem peringatan dini');
      }
      
      // Opportunity-based actions with unit context
      if (opportunity_score >= 70) {
        if (satuan === 'SSL') {
          actionItems.push('Investasi agresif untuk capitalize pada peluang tinggi instalasi layanan');
        } else {
          actionItems.push('Investasi agresif untuk capitalize pada peluang tinggi');
        }
        actionItems.push('Strategi ekspansi pasar dengan keunggulan kompetitif');
      } else if (opportunity_score <= 30) {
        actionItems.push('Tinjauan strategis untuk improve positioning peluang');
      }
      
      return actionItems.length > 0 ? actionItems : ['Pertahankan trajektori saat ini'];
    },
    
    forecastNextPeriod: function(projected_value, current_value, trend_direction, momentum_category, satuan) {
      const growth_probability = {
        'MOMENTUM_SANGAT_TINGGI': 0.85,
        'MOMENTUM_TINGGI': 0.75,
        'MOMENTUM_SEDANG': 0.65,
        'MOMENTUM_STABIL': 0.55,
        'MOMENTUM_MENURUN': 0.35,
        'MOMENTUM_SANGAT_MENURUN': 0.2
      };
      
      const confidence = growth_probability[momentum_category] || 0.5;
      const unitContext = this.getUnitContext(satuan);
      
      return {
        projected_value: projected_value,
        confidence_level: `${Math.round(confidence * 100)}%`,
        growth_expected: projected_value > current_value,
        forecast_category: confidence >= 0.7 ? 'HIGH_CONFIDENCE' : 
                         confidence >= 0.5 ? 'MEDIUM_CONFIDENCE' : 'LOW_CONFIDENCE',
        unit_context: unitContext
      };
    },
    
    formatIndonesianResponse: function(data) {
      const hasil_analisis = data.map(record => {
        const trend_strength = this.assessTrendStrength(
          record.MOMENTUM_CATEGORY,
          record.GROWTH_CONSISTENCY,
          record.STABILITY_CATEGORY,
          record.SATUAN
        );
        
        const seasonal_insight = this.identifySeasonalPattern(
          record.SEASONAL_PERIOD,
          record.MOM_GROWTH_PCT,
          record.YOY_GROWTH_PCT,
          record.SATUAN
        );
        
        const action_items = this.generateActionItems(
          record.MOMENTUM_CATEGORY,
          record.RISK_LEVEL,
          record.TREND_DIRECTION,
          record.OPPORTUNITY_SCORE,
          record.SATUAN
        );
        
        const forecast = this.forecastNextPeriod(
          record.PROJECTED_NEXT_MONTH,
          record.MONTHLY_REALISASI,
          record.TREND_DIRECTION,
          record.MOMENTUM_CATEGORY,
          record.SATUAN
        );
        
        return {
          identitas_periode: {
            periode: record.PERIODE,
            tahun: record.TAHUN,
            bulan: record.BULAN,
            treg: record.TREG,
            segmen: record.SEGMEN,
            level_analisis: record.LLEVEL,
            group_produk: record.GROUP_PRODUK
          },
          satuan_target: {
            satuan: record.SATUAN,
            deskripsi_satuan: trend_strength.unit_context.description,
            interpretasi_trend: trend_strength.unit_context.trend_interpretation,
            fokus_forecasting: trend_strength.unit_context.forecasting_focus
          },
          metrik_bulanan: {
            target: `${record.MONTHLY_TARGET.toLocaleString('id-ID')} ${record.SATUAN}`,
            realisasi: `${record.MONTHLY_REALISASI.toLocaleString('id-ID')} ${record.SATUAN}`,
            pencapaian: `${record.MONTHLY_ACHIEVEMENT_PCT}%`,
            moving_average_3bulan: `${record.MA3_REALISASI.toLocaleString('id-ID')} ${record.SATUAN}`
          },
          analisis_pertumbuhan: {
            pertumbuhan_mom: record.MOM_GROWTH_PCT ? `${record.MOM_GROWTH_PCT}%` : 'N/A',
            pertumbuhan_yoy: record.YOY_GROWTH_PCT ? `${record.YOY_GROWTH_PCT}%` : 'N/A',
            perubahan_pencapaian: record.ACHIEVEMENT_CHANGE_PCT ? `${record.ACHIEVEMENT_CHANGE_PCT}%` : 'N/A',
            konsistensi_pertumbuhan: record.GROWTH_CONSISTENCY
          },
          analisis_momentum: {
            kategori_momentum: record.MOMENTUM_CATEGORY,
            arah_trend: record.TREND_DIRECTION,
            posisi_trend: record.TREND_POSITION,
            stabilitas: record.STABILITY_CATEGORY,
            volatilitas: record.VOLATILITY_INDICATOR ? record.VOLATILITY_INDICATOR.toFixed(2) : 'N/A'
          },
          pola_musiman: {
            periode_musiman: record.SEASONAL_PERIOD,
            pola_karakteristik: seasonal_insight.pattern,
            ekspektasi: seasonal_insight.expectation,
            konteks_spesifik_unit: seasonal_insight.unit_specific || 'Tidak ada konteks khusus'
          },
          proyeksi_periode_depan: {
            nilai_proyeksi: `${forecast.projected_value.toLocaleString('id-ID')} ${record.SATUAN}`,
            tingkat_confidence: forecast.confidence_level,
            ekspektasi_pertumbuhan: forecast.growth_expected ? 'POSITIF' : 'NEGATIF',
            kategori_forecast: forecast.forecast_category
          },
          evaluasi_risiko: {
            level_risiko: record.RISK_LEVEL,
            skor_opportunity: record.OPPORTUNITY_SCORE,
            cakupan_witel: record.ACTIVE_WITEL,
            cakupan_telda: record.ACTIVE_TELDA
          },
          kekuatan_trend: {
            deskripsi: trend_strength.description,
            rekomendasi: trend_strength.recommendation
          },
          action_items: action_items
        };
      });
      
      // Trend summary analysis
      const trend_summary = {
        periode_analisis: `${Math.min(...data.map(d => parseInt(d.PERIODE)))} - ${Math.max(...data.map(d => parseInt(d.PERIODE)))}`,
        total_data_points: data.length,
        distribusi_momentum: {
          sangat_tinggi: data.filter(d => d.MOMENTUM_CATEGORY === 'MOMENTUM_SANGAT_TINGGI').length,
          tinggi: data.filter(d => d.MOMENTUM_CATEGORY === 'MOMENTUM_TINGGI').length,
          sedang: data.filter(d => d.MOMENTUM_CATEGORY === 'MOMENTUM_SEDANG').length,
          stabil: data.filter(d => d.MOMENTUM_CATEGORY === 'MOMENTUM_STABIL').length,
          menurun: data.filter(d => d.MOMENTUM_CATEGORY.includes('MENURUN')).length
        },
        rata_rata_pertumbuhan: data.filter(d => d.MOM_GROWTH_PCT !== null)
                                  .reduce((sum, d) => sum + d.MOM_GROWTH_PCT, 0) / 
                               data.filter(d => d.MOM_GROWTH_PCT !== null).length,
        satuan_dominan: data.reduce((prev, current) => 
          (data.filter(d => d.SATUAN === prev.SATUAN).length > 
           data.filter(d => d.SATUAN === current.SATUAN).length) ? prev : current
        ).SATUAN
      };
      
      return {
        ringkasan: 'Analisis trend dan pola pertumbuhan HSI untuk identifikasi momentum dengan satuan yang jelas',
        summary_trend: trend_summary,
        benchmark_trend: {
          momentum_target: '≥ MOMENTUM_SEDANG',
          tingkat_pertumbuhan_minimum: '≥ 5%',
          stabilitas_target: '≤ MODERATE_VOLATIL'
        },
        detail_analisis: hasil_analisis,
        insight_prediktif: [
          'Monitor perubahan momentum untuk deteksi dini peluang/risiko',
          'Manfaatkan pola musiman untuk perencanaan strategis',
          'Fokus pada area dengan skor peluang tinggi untuk ROI maksimal',
          'Implementasi mitigasi risiko untuk pola trend berisiko tinggi'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      return {
        matches: confidence >= 65,
        confidence: confidence,
        focus_area: userInput.toLowerCase().includes('forecast') || 
                   userInput.toLowerCase().includes('proyeksi') ? 'forecasting' : 'trend_analysis'
      };
    },
    
  },

  CACHE_DURATION: 1800, // 30 minutes
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};