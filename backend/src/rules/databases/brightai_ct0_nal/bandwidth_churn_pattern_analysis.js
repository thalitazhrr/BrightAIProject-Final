const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: "ct0_ebis_003",
    RULE_NAME: "bandwidth_churn_pattern_analysis",
    DESCRIPTION: "Analisis pola churn berdasarkan kategori bandwidth untuk optimalisasi portofolio produk",
    DATABASE: "BRIGHTAI_CT0_NAL",
    CATEGORY: "churn_analysis",
    COMPLEXITY: "MEDIUM",
    EXECUTION_PRIORITY: "HIGH",
    CACHE_DURATION: 1800,
    CREATED_BY: "System",
    VERSION: "1.0"
  },
  
  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_CT0_NAL"),

  KEYWORD_PATTERNS: {
    primary: [
      "bandwidth churn", "churn bandwidth", "bandwidth cabut",
      "analisis bandwidth", "bandwidth analysis", "churn per bandwidth",
      "paket internet", "kecepatan internet", "speed internet"
    ],
    
    supporting: [
      "internet", "broadband", "hsi", "koneksi",
      "mbps", "kbps", "speed", "kecepatan",
      "paket", "package", "produk", "layanan",
      "churn", "cabut", "ct0", "dinolkan"
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
      } else if ((lowerInput.includes("bandwidth") || lowerInput.includes("speed")) && 
                (lowerInput.includes("churn") || lowerInput.includes("cabut"))) {
        score = 75;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH BANDWIDTH_CATEGORIZATION AS (
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
            
            -- Kategorisasi bandwidth
            CASE 
                WHEN TO_NUMBER(BW) <= 1024 THEN 'LOW_SPEED'      -- <= 1 Mbps
                WHEN TO_NUMBER(BW) <= 5120 THEN 'MEDIUM_SPEED'   -- 1-5 Mbps  
                WHEN TO_NUMBER(BW) <= 10240 THEN 'HIGH_SPEED'    -- 5-10 Mbps
                WHEN TO_NUMBER(BW) <= 51200 THEN 'VERY_HIGH_SPEED' -- 10-50 Mbps
                WHEN TO_NUMBER(BW) > 51200 THEN 'ULTRA_HIGH_SPEED'  -- > 50 Mbps
                ELSE 'UNKNOWN_SPEED'
            END as kategori_bandwidth,
            
            -- Konversi bandwidth ke Mbps untuk analisis
            CASE 
                WHEN TO_NUMBER(BW) >= 1024 THEN ROUND(TO_NUMBER(BW)/1024, 2)
                ELSE TO_NUMBER(BW)
            END as bandwidth_mbps,
            
            -- Hitung masa layanan
            CASE 
                WHEN TGL_PSB IS NOT NULL AND TGL_PS IS NOT NULL THEN 
                    MONTHS_BETWEEN(
                        TO_DATE(TGL_PS, 'YYYYMMDD'),
                        TO_DATE(TGL_PSB, 'YYYYMMDD')
                    )
                ELSE NULL
            END as masa_layanan_bulan
            
        FROM USR_RPT.BRIGHTAI_CT0_NAL
        WHERE UPPER(PRODUK) = 'INTERNET'
          AND (CITEM IS NULL OR NOT UPPER(CITEM) LIKE 'WM%')
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMM')
          AND BW IS NOT NULL
          AND TO_NUMBER(BW) > 0
          AND REGIONAL IS NOT NULL
          AND WITEL IS NOT NULL
    ),
    
    BANDWIDTH_CHURN_SUMMARY AS (
        SELECT 
            PERIODE,
            REGIONAL,
            WITEL,
            STO,
            DIVISI,
            kategori_bandwidth,
            
            -- Metrics churn per kategori bandwidth
            COUNT(*) as total_churn_ct0,
            COUNT(DISTINCT NCLI) as unique_customers_churn,
            COUNT(DISTINCT SPEEDY) as unique_internet_services,
            AVG(bandwidth_mbps) as rata_bandwidth_mbps,
            MIN(bandwidth_mbps) as min_bandwidth_mbps,
            MAX(bandwidth_mbps) as max_bandwidth_mbps,
            MODE() WITHIN GROUP (ORDER BY bandwidth_mbps) as bandwidth_mode_mbps,
            
            -- Analisis masa layanan per kategori bandwidth
            AVG(masa_layanan_bulan) as rata_masa_layanan,
            MIN(masa_layanan_bulan) as masa_layanan_minimum,
            MAX(masa_layanan_bulan) as masa_layanan_maksimum,
            
            -- Distribusi masa layanan
            COUNT(CASE WHEN masa_layanan_bulan <= 3 THEN 1 END) as churn_0_3_bulan,
            COUNT(CASE WHEN masa_layanan_bulan > 3 AND masa_layanan_bulan <= 12 THEN 1 END) as churn_3_12_bulan,
            COUNT(CASE WHEN masa_layanan_bulan > 12 AND masa_layanan_bulan <= 24 THEN 1 END) as churn_12_24_bulan,
            COUNT(CASE WHEN masa_layanan_bulan > 24 THEN 1 END) as churn_24plus_bulan,
            
            -- Analisis temporal
            COUNT(CASE WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (1,2,3) THEN 1 END) as churn_q1,
            COUNT(CASE WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (4,5,6) THEN 1 END) as churn_q2,
            COUNT(CASE WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (7,8,9) THEN 1 END) as churn_q3,
            COUNT(CASE WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (10,11,12) THEN 1 END) as churn_q4
            
        FROM BANDWIDTH_CATEGORIZATION
        WHERE masa_layanan_bulan IS NOT NULL
        GROUP BY PERIODE, REGIONAL, WITEL, STO, DIVISI, kategori_bandwidth
    ),
    
    CHURN_ANALYSIS AS (
        SELECT t.*,
            -- Ranking berdasarkan volume churn
            RANK() OVER (PARTITION BY PERIODE ORDER BY total_churn_ct0 DESC) as ranking_churn_volume,
            RANK() OVER (PARTITION BY PERIODE, kategori_bandwidth ORDER BY total_churn_ct0 DESC) as ranking_dalam_kategori,
            
            -- Percentage contribution
            ROUND(
                (total_churn_ct0 * 100.0 / SUM(total_churn_ct0) OVER (PARTITION BY PERIODE)), 2
            ) as kontribusi_persen_total,
            
            -- Risk categorization berdasarkan churn rate per kategori
            CASE 
                WHEN kategori_bandwidth = 'LOW_SPEED' AND total_churn_ct0 >= 50 THEN 'RISIKO_TINGGI'
                WHEN kategori_bandwidth = 'MEDIUM_SPEED' AND total_churn_ct0 >= 40 THEN 'RISIKO_TINGGI' 
                WHEN kategori_bandwidth = 'HIGH_SPEED' AND total_churn_ct0 >= 30 THEN 'RISIKO_TINGGI'
                WHEN kategori_bandwidth IN ('VERY_HIGH_SPEED', 'ULTRA_HIGH_SPEED') AND total_churn_ct0 >= 20 THEN 'RISIKO_TINGGI'
                WHEN total_churn_ct0 >= 10 THEN 'RISIKO_SEDANG'
                ELSE 'RISIKO_RENDAH'
            END as tingkat_risiko_churn,
            
            -- Trend calculation (compare with previous period)
            LAG(total_churn_ct0) OVER (
                PARTITION BY REGIONAL, WITEL, DIVISI, kategori_bandwidth 
                ORDER BY PERIODE
            ) as prev_churn_count
            
        FROM BANDWIDTH_CHURN_SUMMARY t
    )
    
    SELECT 
        PERIODE,
        REGIONAL,
        WITEL,
        STO,
        DIVISI,
        kategori_bandwidth,
        total_churn_ct0,
        unique_customers_churn,
        unique_internet_services,
        ROUND(rata_bandwidth_mbps, 2) as rata_bandwidth_mbps,
        ROUND(min_bandwidth_mbps, 2) as min_bandwidth_mbps,
        ROUND(max_bandwidth_mbps, 2) as max_bandwidth_mbps,
        ROUND(bandwidth_mode_mbps, 2) as bandwidth_mode_mbps,
        ROUND(rata_masa_layanan, 2) as rata_masa_layanan,
        tingkat_risiko_churn,
        ranking_churn_volume,
        ranking_dalam_kategori,
        kontribusi_persen_total,
        churn_0_3_bulan, churn_3_12_bulan, churn_12_24_bulan, churn_24plus_bulan,
        churn_q1, churn_q2, churn_q3, churn_q4,
        
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
                ROUND(((total_churn_ct0 - prev_churn_count) * 100.0 / prev_churn_count), 2)
            ELSE NULL
        END as perubahan_churn_pct
        
    FROM CHURN_ANALYSIS
    ORDER BY PERIODE DESC, total_churn_ct0 DESC
  `,

  BUSINESS_LOGIC: {
    assessBandwidthChurnRisk: function(kategori_bandwidth, total_churn, tingkat_risiko) {
      const riskAssessment = {
        "RISIKO_TINGGI": {
          description: `Tingkat churn sangat tinggi pada kategori ${kategori_bandwidth} memerlukan intervensi segera`,
          recommendation: "Review pricing strategy dan competitive positioning untuk kategori ini"
        },
        "RISIKO_SEDANG": {
          description: `Tingkat churn moderat pada kategori ${kategori_bandwidth} perlu monitoring`,
          recommendation: "Evaluasi value proposition dan customer satisfaction"
        },
        "RISIKO_RENDAH": {
          description: `Tingkat churn rendah pada kategori ${kategori_bandwidth} menunjukkan stabilitas`,
          recommendation: "Pertahankan kualitas layanan dan eksplorasi up-selling opportunities"
        }
      };
      
      return riskAssessment[tingkat_risiko];
    },
    
    identifyBandwidthInsights: function(kategori_bandwidth, rata_masa_layanan, kontribusi_persen) {
      const insights = [];
      
      if (kategori_bandwidth === 'LOW_SPEED' && rata_masa_layanan < 12) {
        insights.push("Pelanggan low speed cenderung churn cepat - kemungkinan tidak sesuai kebutuhan");
      }
      
      if (kategori_bandwidth === 'ULTRA_HIGH_SPEED' && rata_masa_layanan < 6) {
        insights.push("Churn pada paket premium menunjukkan gap ekspektasi vs realitas layanan");
      }
      
      if (kontribusi_persen > 30) {
        insights.push(`Kategori ${kategori_bandwidth} berkontribusi besar terhadap total churn`);
      }
      
      if (kategori_bandwidth === 'MEDIUM_SPEED' && rata_masa_layanan > 24) {
        insights.push("Pelanggan medium speed yang loyal tapi akhirnya churn - kemungkinan karena kompetitor");
      }
      
      return insights.length > 0 ? insights : ["Pola churn normal untuk kategori bandwidth ini"];
    },
    
    generateBandwidthStrategy: function(kategori_bandwidth, tingkat_risiko, trend_churn) {
      const strategies = {
        'LOW_SPEED': [
          "Evaluasi migrasi ke paket yang lebih sesuai kebutuhan pelanggan",
          "Program peningkatan paket dengan insentif khusus",
          "Survei kebutuhan bandwidth untuk penyesuaian paket yang tepat",
          "Analisis harga kompetitif untuk paket tingkat pemula"
        ],
        'MEDIUM_SPEED': [
          "Program peningkatan nilai tanpa menaikkan harga",
          "Paket bundling layanan untuk meningkatkan kelekatan pelanggan",
          "Edukasi pelanggan tentang optimalisasi penggunaan bandwidth",
          "Program loyalitas untuk segmen pelanggan ini"
        ],
        'HIGH_SPEED': [
          "Program pengalaman pelanggan premium",
          "Pemantauan jaringan proaktif dan pemeliharaan berkala",
          "Peluang kemitraan konten eksklusif",
          "Layanan dukungan teknis lanjutan"
        ],
        'VERY_HIGH_SPEED': [
          "Komitmen tingkat layanan kelas enterprise",
          "Manajemen akun yang didedikasikan",
          "Pengembangan solusi khusus",
          "Peluang kemitraan strategis"
        ],
        'ULTRA_HIGH_SPEED': [
          "Layanan pelanggan dengan perlakuan istimewa",
          "Jaminan SLA dengan klausul penalti",
          "Akses awal ke teknologi dan fitur terbaru",
          "Program konsultasi pelanggan VIP"
        ]
      };
      
      return strategies[kategori_bandwidth] || ["Kembangkan strategi retensi khusus untuk kategori bandwidth"];
    },
    
    formatIndonesianResponse: function(data) {
      const hasil_analisis = data.map(record => {
        const risk_assessment = this.assessBandwidthChurnRisk(
          record.KATEGORI_BANDWIDTH,
          record.TOTAL_CHURN_CT0,
          record.TINGKAT_RISIKO_CHURN
        );
        
        const bandwidth_insights = this.identifyBandwidthInsights(
          record.KATEGORI_BANDWIDTH,
          record.RATA_MASA_LAYANAN,
          record.KONTRIBUSI_PERSEN_TOTAL
        );
        
        const bandwidth_strategy = this.generateBandwidthStrategy(
          record.KATEGORI_BANDWIDTH,
          record.TINGKAT_RISIKO_CHURN,
          record.TREND_CHURN
        );
        
        return {
          informasi_unit: {
            periode: record.PERIODE,
            regional: record.REGIONAL,
            witel: record.WITEL,
            divisi: record.DIVISI,
            kategori_bandwidth: record.KATEGORI_BANDWIDTH
          },
          metrik_bandwidth: {
            total_churn_ct0: record.TOTAL_CHURN_CT0.toLocaleString('id-ID'),
            unique_customers_churn: record.UNIQUE_CUSTOMERS_CHURN.toLocaleString('id-ID'),
            rata_bandwidth_mbps: `${record.RATA_BANDWIDTH_MBPS} Mbps`,
            range_bandwidth: `${record.MIN_BANDWIDTH_MBPS} - ${record.MAX_BANDWIDTH_MBPS} Mbps`,
            bandwidth_terpopuler: `${record.BANDWIDTH_MODE_MBPS} Mbps`,
            rata_masa_layanan: `${record.RATA_MASA_LAYANAN} bulan`
          },
          analisis_risiko: {
            tingkat_risiko: record.TINGKAT_RISIKO_CHURN,
            ranking_volume_churn: record.RANKING_CHURN_VOLUME,
            ranking_dalam_kategori: record.RANKING_DALAM_KATEGORI,
            kontribusi_persen_total: `${record.KONTRIBUSI_PERSEN_TOTAL}%`,
            trend_churn: record.TREND_CHURN,
            perubahan_persen: record.PERUBAHAN_CHURN_PCT ? `${record.PERUBAHAN_CHURN_PCT}%` : 'N/A'
          },
          distribusi_masa_layanan: {
            churn_0_3_bulan: record.CHURN_0_3_BULAN,
            churn_3_12_bulan: record.CHURN_3_12_BULAN,
            churn_12_24_bulan: record.CHURN_12_24_BULAN,
            churn_24plus_bulan: record.CHURN_24PLUS_BULAN
          },
          distribusi_kuartalan: {
            q1: record.CHURN_Q1,
            q2: record.CHURN_Q2,
            q3: record.CHURN_Q3,
            q4: record.CHURN_Q4
          },
          assessment: {
            deskripsi: risk_assessment.description,
            rekomendasi: risk_assessment.recommendation
          },
          insight_bandwidth: bandwidth_insights,
          strategi_bandwidth: bandwidth_strategy
        };
      });
      
      return {
        ringkasan: "Analisis Churn berdasarkan Kategori Bandwidth",
        insight_utama: hasil_analisis,
        kategori_bandwidth: {
          low_speed: "≤ 1 Mbps",
          medium_speed: "1-5 Mbps",
          high_speed: "5-10 Mbps", 
          very_high_speed: "10-50 Mbps",
          ultra_high_speed: "> 50 Mbps"
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
        focus_area: 'bandwidth_churn_analysis'
      };
    },
    
  },

  CACHE_DURATION: 1800,
  COMPLEXITY: "MEDIUM",
  EXECUTION_PRIORITY: "HIGH"
};