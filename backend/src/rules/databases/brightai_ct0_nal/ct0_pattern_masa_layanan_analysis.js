const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ct0_002',
    RULE_NAME: 'ct0_pattern_masa_layanan_analysis',
    DESCRIPTION: 'Analisis pola CT0 (dinolkan) berdasarkan masa layanan pelanggan untuk identifikasi periode kritis',
    DATABASE: 'BRIGHTAI_CT0_NAL',
    CATEGORY: 'ct0_pattern_analysis',
    COMPLEXITY: 'MEDIUM',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_CT0_NAL"),

  KEYWORD_PATTERNS: {
    primary: [
      'ct0', 'dinolkan', 'pola ct0', 'analisis ct0',
      'masa layanan', 'lama layanan', 'durasi layanan',
      'periode kritis', 'pattern ct0', 'ct0 analysis'
    ],
    
    supporting: [
      'internet', 'broadband', 'hsi', 'layanan internet',
      'pelanggan', 'customer', 'subscriber',
      'analisis', 'analysis', 'pola', 'pattern',
      'trend', 'tren', 'kinerja', 'performance'
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
      } else if (lowerInput.includes('ct0') || 
                (lowerInput.includes('dinol') && lowerInput.includes('layanan'))) {
        score = 75;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH CT0_DURATION_ANALYSIS AS (
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
            
            -- Hitung masa layanan dalam bulan
            CASE 
                WHEN TGL_PSB IS NOT NULL AND TGL_PS IS NOT NULL THEN 
                    MONTHS_BETWEEN(
                        TO_DATE(TGL_PS, 'YYYYMMDD'),
                        TO_DATE(TGL_PSB, 'YYYYMMDD')  
                    )
                ELSE NULL
            END as masa_layanan_bulan,
            
            -- Kategorisasi berdasarkan masa layanan
            CASE 
                WHEN MONTHS_BETWEEN(
                    TO_DATE(TGL_PS, 'YYYYMMDD'),
                    TO_DATE(TGL_PSB, 'YYYYMMDD')
                ) <= 3 THEN 'SANGAT_BARU'
                WHEN MONTHS_BETWEEN(
                    TO_DATE(TGL_PS, 'YYYYMMDD'),
                    TO_DATE(TGL_PSB, 'YYYYMMDD')
                ) <= 12 THEN 'BARU'
                WHEN MONTHS_BETWEEN(
                    TO_DATE(TGL_PS, 'YYYYMMDD'),
                    TO_DATE(TGL_PSB, 'YYYYMMDD')
                ) <= 24 THEN 'MENENGAH'
                WHEN MONTHS_BETWEEN(
                    TO_DATE(TGL_PS, 'YYYYMMDD'),
                    TO_DATE(TGL_PSB, 'YYYYMMDD')
                ) <= 36 THEN 'LAMA'
                ELSE 'SANGAT_LAMA'
            END as kategori_masa_layanan
            
        FROM DWH_MOIS.BRIGHTAI_CT0_NAL
        WHERE UPPER(PRODUK) = 'INTERNET'
          AND (CITEM IS NULL OR NOT UPPER(CITEM) LIKE 'WM%')
          AND PERIODE >= TO_CHAR(ADD_MONTHS(SYSDATE, -6), 'YYYYMM')
          AND TGL_PSB IS NOT NULL 
          AND TGL_PS IS NOT NULL
          AND REGIONAL IS NOT NULL
          AND WITEL IS NOT NULL
    ),
    
    PATTERN_SUMMARY AS (
        SELECT 
            PERIODE,
            REGIONAL,
            WITEL,
            STO,
            DIVISI,
            kategori_masa_layanan,
            
            -- Metrics per kategori
            COUNT(*) as jumlah_ct0,
            COUNT(DISTINCT NCLI) as unique_customers,
            COUNT(DISTINCT SPEEDY) as unique_internet_services,
            AVG(masa_layanan_bulan) as rata_masa_layanan,
            MIN(masa_layanan_bulan) as masa_layanan_minimum,
            MAX(masa_layanan_bulan) as masa_layanan_maksimum,
            STDDEV(masa_layanan_bulan) as standar_deviasi_masa_layanan,
            
            -- Distribusi bandwidth
            STATS_MODE(BW) as bandwidth_ct0_terbanyak,
            COUNT(DISTINCT BW) as variasi_bandwidth,
            
            -- Analisis temporal CT0
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (1,2,3) THEN 1 
            END) as ct0_q1,
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (4,5,6) THEN 1 
            END) as ct0_q2,
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (7,8,9) THEN 1 
            END) as ct0_q3,
            COUNT(CASE 
                WHEN TO_NUMBER(SUBSTR(TGL_PS, 5, 2)) IN (10,11,12) THEN 1 
            END) as ct0_q4
            
        FROM CT0_DURATION_ANALYSIS
        GROUP BY PERIODE, REGIONAL, WITEL, STO, DIVISI, kategori_masa_layanan
    ),
    
    RISK_ASSESSMENT AS (
        SELECT t.PERIODE,
            t.REGIONAL,
            t.WITEL,
            t.STO,
            t.DIVISI,
            t.kategori_masa_layanan,
            t.jumlah_ct0,
            t.unique_customers,
            t.unique_internet_services,
            t.rata_masa_layanan,
            t.masa_layanan_minimum,
            t.masa_layanan_maksimum,
            t.standar_deviasi_masa_layanan,
            t.bandwidth_ct0_terbanyak,
            t.variasi_bandwidth,
            t.ct0_q1,
            t.ct0_q2,
            t.ct0_q3,
            t.ct0_q4,
            -- Risk scoring berdasarkan pola
            CASE 
                WHEN kategori_masa_layanan = 'SANGAT_BARU' AND jumlah_ct0 >= 20 THEN 'RISIKO_TINGGI'
                WHEN kategori_masa_layanan = 'BARU' AND jumlah_ct0 >= 15 THEN 'RISIKO_SEDANG'
                WHEN kategori_masa_layanan IN ('LAMA', 'SANGAT_LAMA') AND jumlah_ct0 >= 10 THEN 'RISIKO_KOMPETITOR'
                ELSE 'RISIKO_RENDAH'
            END as tingkat_risiko,
            
            -- Ranking
            RANK() OVER (
                PARTITION BY PERIODE, kategori_masa_layanan 
                ORDER BY jumlah_ct0 DESC
            ) as ranking_ct0_per_kategori,
            
            -- Percentage contribution
            ROUND(
                (jumlah_ct0 * 100.0 / SUM(jumlah_ct0) OVER (PARTITION BY PERIODE, REGIONAL)), 2
            ) as kontribusi_persen_regional
            
        FROM PATTERN_SUMMARY t
    )
    
    SELECT 
        PERIODE,
        REGIONAL, 
        WITEL,
        STO,
        DIVISI,
        kategori_masa_layanan,
        jumlah_ct0,
        unique_customers,
        unique_internet_services,
        ROUND(rata_masa_layanan, 2) as rata_masa_layanan,
        ROUND(masa_layanan_minimum, 2) as masa_layanan_minimum,
        ROUND(masa_layanan_maksimum, 2) as masa_layanan_maksimum,
        ROUND(standar_deviasi_masa_layanan, 2) as standar_deviasi_masa_layanan,
        bandwidth_ct0_terbanyak,
        variasi_bandwidth,
        tingkat_risiko,
        ranking_ct0_per_kategori,
        kontribusi_persen_regional,
        ct0_q1, ct0_q2, ct0_q3, ct0_q4
        
    FROM RISK_ASSESSMENT
    ORDER BY PERIODE DESC, jumlah_ct0 DESC
  `,

  BUSINESS_LOGIC: {
    assessCT0Risk: function(kategori_masa_layanan, jumlah_ct0, tingkat_risiko) {
      const riskAssessment = {
        'RISIKO_TINGGI': {
          description: 'Tingkat CT0 sangat tinggi pada pelanggan baru menunjukkan masalah onboarding',
          recommendation: 'Perbaikan proses instalasi dan customer onboarding program'
        },
        'RISIKO_SEDANG': {
          description: 'Tingkat CT0 moderat namun perlu perhatian pada retention strategy',
          recommendation: 'Implementasi early warning system dan proactive customer care'
        },
        'RISIKO_KOMPETITOR': {
          description: 'CT0 pada pelanggan lama kemungkinan karena kompetitor atau ketidakpuasan',
          recommendation: 'Competitive analysis dan customer satisfaction improvement'
        },
        'RISIKO_RENDAH': {
          description: 'Tingkat CT0 dalam batas normal untuk kategori masa layanan ini',
          recommendation: 'Maintain service quality dan monitor trend'
        }
      };
      
      return riskAssessment[tingkat_risiko];
    },
    
    identifyPattern: function(kategori_masa_layanan, rata_masa_layanan, standar_deviasi) {
      const patterns = [];
      
      if (kategori_masa_layanan === 'SANGAT_BARU' && rata_masa_layanan < 1) {
        patterns.push('Pola CT0 sangat cepat setelah instalasi - indikasi masalah teknis');
      }
      
      if (kategori_masa_layanan === 'BARU' && standar_deviasi > 3) {
        patterns.push('Variasi tinggi pada masa layanan sebelum CT0 - inkonsistensi layanan');
      }
      
      if (kategori_masa_layanan === 'LAMA' || kategori_masa_layanan === 'SANGAT_LAMA') {
        patterns.push('CT0 pada pelanggan loyal - perlu investigasi mendalam');
      }
      
      if (rata_masa_layanan >= 12 && rata_masa_layanan <= 24) {
        patterns.push('Pola CT0 pada masa kontrak - kemungkinan terkait perpanjangan');
      }
      
      return patterns.length > 0 ? patterns : ['Pola CT0 normal untuk kategori ini'];
    },
    
    generatePreventionStrategy: function(kategori_masa_layanan, tingkat_risiko, bandwidth_terbanyak) {
      const strategies = {
        'SANGAT_BARU': [
          'Jaminan kualitas pada proses instalasi',
          'Program panggilan selamat datang dalam 48 jam setelah instalasi',
          'Dukungan teknis khusus untuk pelanggan baru',
          'Pemantauan kualitas layanan intensif di bulan pertama'
        ],
        'BARU': [
          'Survei kepuasan pelanggan secara berkala',
          'Pemeliharaan proaktif dan pemantauan berkala', 
          'Program loyalitas untuk pelanggan baru',
          'Edukasi tentang optimalisasi penggunaan layanan'
        ],
        'MENENGAH': [
          'Penawaran layanan nilai tambah',
          'Tinjauan harga kompetitif',
          'Rekomendasi peningkatan layanan',
          'Aktivitas keterlibatan pelanggan rutin'
        ],
        'LAMA': [
          'Program perlakuan pelanggan VIP',
          'Penawaran eksklusif dan manfaat khusus',
          'Penugasan manajer akun personal',
          'Dukungan teknis prioritas'
        ],
        'SANGAT_LAMA': [
          'Program penghargaan loyalitas premium',
          'Pengakuan nilai seumur hidup pelanggan',
          'Peluang kemitraan strategis',
          'Peran penasihat dalam pengembangan produk'
        ]
      };
      
      return strategies[kategori_masa_layanan] || ['Kembangkan strategi pencegahan khusus'];
    },
    
    formatIndonesianResponse: function(data) {
      const hasil_analisis = data.map(record => {
        const risk_assessment = this.assessCT0Risk(
          record.KATEGORI_MASA_LAYANAN,
          record.JUMLAH_CT0,
          record.TINGKAT_RISIKO
        );
        
        const patterns = this.identifyPattern(
          record.KATEGORI_MASA_LAYANAN,
          record.RATA_MASA_LAYANAN,
          record.STANDAR_DEVIASI_MASA_LAYANAN
        );
        
        const prevention_strategy = this.generatePreventionStrategy(
          record.KATEGORI_MASA_LAYANAN,
          record.TINGKAT_RISIKO,
          record.BANDWIDTH_CT0_TERBANYAK
        );
        
        return {
          informasi_unit: {
            periode: record.PERIODE,
            regional: record.REGIONAL,
            witel: record.WITEL,
            divisi: record.DIVISI,
            kategori_masa_layanan: record.KATEGORI_MASA_LAYANAN
          },
          metrik_ct0: {
            jumlah_ct0: record.JUMLAH_CT0.toLocaleString('id-ID'),
            rata_masa_layanan: `${record.RATA_MASA_LAYANAN} bulan`,
            masa_layanan_minimum: `${record.MASA_LAYANAN_MINIMUM} bulan`,
            masa_layanan_maksimum: `${record.MASA_LAYANAN_MAKSIMUM} bulan`,
            standar_deviasi: record.STANDAR_DEVIASI_MASA_LAYANAN,
            bandwidth_ct0_terbanyak: record.BANDWIDTH_CT0_TERBANYAK,
            variasi_bandwidth: record.VARIASI_BANDWIDTH
          },
          analisis_risiko: {
            tingkat_risiko: record.TINGKAT_RISIKO,
            ranking_per_kategori: record.RANKING_CT0_PER_KATEGORI,
            kontribusi_persen_regional: `${record.KONTRIBUSI_PERSEN_REGIONAL}%`
          },
          distribusi_kuartalan: {
            q1: record.CT0_Q1,
            q2: record.CT0_Q2,
            q3: record.CT0_Q3,
            q4: record.CT0_Q4
          },
          assessment: {
            deskripsi: risk_assessment.description,
            rekomendasi: risk_assessment.recommendation
          },
          pola_identifikasi: patterns,
          strategi_pencegahan: prevention_strategy
        };
      });
      
      return {
        ringkasan: 'Analisis Pola CT0 Berdasarkan Masa Layanan',
        insight_utama: hasil_analisis,
        periode_kritis: {
          sangat_rawan: '0-3 bulan (pelanggan sangat baru)',
          rawan: '3-12 bulan (pelanggan baru)',
          stabil: '12-24 bulan (pelanggan menengah)',
          mature: '24+ bulan (pelanggan loyal)'
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
        focus_area: 'ct0_pattern_analysis'
      };
    },
    
  },

  CACHE_DURATION: 1800,
  COMPLEXITY: 'MEDIUM',
  EXECUTION_PRIORITY: 'HIGH'
};