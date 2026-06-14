// ========================================
// RULE ps_001: TOTAL ORDER HSI
// ========================================
const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_001',
    RULE_NAME: 'total_order_hsi',
    DESCRIPTION: 'Menghitung total order HSI (Bisnis & Basic) dengan analisis pertumbuhan dan bundling',
    DATABASE: 'BRIGHTAI_SALES',
    CATEGORY: 'order_analytics',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_SALES"),

  KEYWORD_PATTERNS: {
    required: {
      quantity_keywords: [
        'berapa', 'jumlah', 'total', 'banyak', 'volume', 'angka', 'hitungan',
        'how many', 'total', 'volume', 'amount', 'count', 'number'
      ],
      order_keywords: [
        'order', 'pesanan', 'pemesanan', 'pesan', 'transaksi', 'penjualan', 'pemasangan',
        'order', 'sales', 'transaction', 'booking', 'installation'
      ],
      hsi_keywords: [
        'hsi', 'internet', 'broadband', 'hsi bisnis', 'hsi basic', 'indibiz', 
        'hsie', 'hsief', 'inetf', 'b2b', 'koneksi', 'layanan'
      ]
    },
    optional: {
      time_keywords: [
        'bulan', 'periode', 'sekarang', 'saat ini', 'terkini', 'bulanan',
        'month', 'period', 'current', 'monthly', 'ytd', 'mom', 'yoy'
      ],
      bundling_keywords: [
        'bundling', 'paket', 'bundle', 'package', 'kombinasi',
        'hard bundling', 'ala carte', 'add on', 'modify'
      ],
      digital_keywords: [
        'digital', 'pijar', 'netmonk', 'oca', 'interaction', 'blast',
        'sekolah', 'produk digital', 'layanan digital'
      ],
      growth_keywords: [
        'pertumbuhan', 'growth', 'naik', 'turun', 'trend', 'kenaikan',
        'penurunan', 'perubahan', 'mom', 'yoy', 'vs', 'dibanding'
      ]
    },
    
    calculateConfidence: function(userInput) {
      const input = userInput.toLowerCase().trim();
      
      const hasQuantity = this.required.quantity_keywords.some(keyword => {
        const words = keyword.split(' ');
        return words.every(word => input.includes(word));
      });
      
      const hasOrder = this.required.order_keywords.some(keyword => 
        input.includes(keyword)
      );
      
      const hasHSI = this.required.hsi_keywords.some(keyword => 
        input.includes(keyword)
      );
      
      const matchCount = [hasQuantity, hasOrder, hasHSI].filter(x => x).length;
      if (matchCount < 2) {
        return 0;
      }
      
      let confidence = matchCount === 3 ? 70 : 50;
      
      // Bonus for optional keywords
      this.optional.time_keywords.forEach(keyword => {
        if (input.includes(keyword)) confidence += 5;
      });
      
      this.optional.bundling_keywords.forEach(keyword => {
        if (input.includes(keyword)) confidence += 8;
      });
      
      this.optional.digital_keywords.forEach(keyword => {
        if (input.includes(keyword)) confidence += 7;
      });
      
      // Special phrases
      if (input.includes('total order hsi') || input.includes('jumlah hsi')) {
        confidence += 15;
      }
      
      if (input.includes('hsi bisnis') || input.includes('hsi basic')) {
        confidence += 10;
      }

      // Strong boost when both bisnis and basic are mentioned (comparison context)
      if (input.includes('bisnis') && input.includes('basic')) {
        confidence += 20;
      }

      return Math.min(confidence, 100);
    },
    
    detectInterest: function(input) {
      if (input.includes('bundling') || input.includes('paket')) return 'BUNDLING_FOCUS';
      if (input.includes('digital') || input.includes('pijar') || input.includes('oca')) return 'DIGITAL_FOCUS';
      if (input.includes('bisnis') || input.includes('basic')) return 'PRODUCT_TYPE_FOCUS';
      if (input.includes('growth') || input.includes('pertumbuhan')) return 'GROWTH_FOCUS';
      return 'GENERAL_TOTAL';
    }
  },

  SQL_QUERY: `
    WITH HSI_IDENTIFICATION AS (
        SELECT 
            ORDER_ID,
            NCLI,
            REGIONAL,
            WITEL,
            ORDER_DATE,
            JENISPSB AS JENISPSB_U,
            PACKAGE_NAME,
            PRODUCT AS PRODUK,
            STATUS_RESUME,
            -- HSI Bisnis identification
            CASE 
                WHEN PRODUCT = 'WMS' THEN 0
                WHEN (
                    UPPER(PACKAGE_NAME) LIKE '%HSIE%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%' OR
                    UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %' OR 
                    UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %' OR
                    UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                ) AND NOT (
                    UPPER(PACKAGE_NAME) LIKE '%HSIEF%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%BASIC%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%INETF%'
                ) THEN 1
                ELSE 0
            END as IS_HSI_BISNIS,
            -- HSI Basic identification
            CASE 
                WHEN PRODUCT = 'WMS' THEN 0
                WHEN (
                    UPPER(PACKAGE_NAME) LIKE '%HSIEF%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%BASIC%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%INETF%'
                ) THEN 1
                ELSE 0
            END as IS_HSI_BASIC,
            -- Bundling type identification
            CASE
                WHEN JENISPSB = 'AO' AND (
                    UPPER(PACKAGE_NAME) LIKE '%HSI Bisnis Bundling %' OR 
                    UPPER(PACKAGE_NAME) LIKE '%HSI Bisnis Basic Bundling %' OR
                    UPPER(PACKAGE_NAME) LIKE '%Paket Indibiz 2S %'
                ) AND NOT (UPPER(PACKAGE_NAME) LIKE '%Non%') AND NOT (UPPER(PACKAGE_NAME) LIKE '%Add-on%') 
                THEN 'Hard Bundling'
                WHEN JENISPSB = 'AO' AND NOT (UPPER(PACKAGE_NAME) LIKE '%Non%') AND (
                    UPPER(PACKAGE_NAME) LIKE '%HSIE%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%BUNDLING%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%;%'
                ) THEN 'Bundling A La Carte'
                WHEN (JENISPSB = 'MO' OR JENISPSB = 'AS') AND NOT (UPPER(PACKAGE_NAME) LIKE '%Non%') 
                THEN 'Add or Modify Service'
                ELSE 'Non Bundling'
            END as BUNDLING_TYPE,
            -- Digital product identification
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%SEKOLAH%' THEN 1 ELSE 0 END as IS_PIJAR,
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%NETMONK%' THEN 1 ELSE 0 END as IS_NETMONK,
            CASE 
                WHEN UPPER(PACKAGE_NAME) LIKE '%OCAINT%' OR 
                     UPPER(PACKAGE_NAME) LIKE '%2S OCA%' OR
                     UPPER(PACKAGE_NAME) LIKE '%INTERACTION%' OR 
                     UPPER(PACKAGE_NAME) LIKE '%BUNDLING OCA%' THEN 1
                ELSE 0
            END as IS_OCA_INT,
            CASE 
                WHEN UPPER(PACKAGE_NAME) LIKE '%BLAST%' AND NOT (
                    UPPER(PACKAGE_NAME) LIKE '%OCAINT%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%INTERACTION%'
                ) THEN 1
                ELSE 0
            END as IS_OCA_BLAST
        FROM DWH_MOIS.BRIGHTAI_SALES
        WHERE STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
          AND ORDER_DATE >= DATE '2025-01-01'
    ),
    MONTHLY_METRICS AS (
        SELECT 
            EXTRACT(YEAR FROM ORDER_DATE) as tahun,
            EXTRACT(MONTH FROM ORDER_DATE) as bulan,
            TO_CHAR(ORDER_DATE, 'YYYY-MM') as periode,
            -- Total HSI orders (Bisnis + Basic) - menggunakan ND_HSI untuk akurasi
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ORDER_ID END) as total_order_hsi,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as order_hsi_bisnis,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as order_hsi_basic,
            -- Unique customers per segment
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN NCLI END) as unique_bisnis_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN NCLI END) as unique_basic_customers,
            -- Customer metrics
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN NCLI END) as unique_customers,
            -- Ratio metrics
            ROUND(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ORDER_ID END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN NCLI END), 0), 2) as avg_orders_per_customer,
            -- Bundling analysis
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as hard_bundling,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BUNDLING_TYPE = 'Bundling A La Carte' THEN ORDER_ID END) as ala_carte_bundling,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BUNDLING_TYPE != 'Non Bundling' THEN ORDER_ID END) as total_bundling,
            -- Digital product bundling
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_PIJAR = 1 THEN ORDER_ID END) as bundling_pijar,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_NETMONK = 1 THEN ORDER_ID END) as bundling_netmonk,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_INT = 1 THEN ORDER_ID END) as bundling_oca_int,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND IS_OCA_BLAST = 1 THEN ORDER_ID END) as bundling_oca_blast,
            -- Any digital bundling
            COUNT(DISTINCT CASE 
                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND 
                     (IS_PIJAR = 1 OR IS_NETMONK = 1 OR IS_OCA_INT = 1 OR IS_OCA_BLAST = 1) 
                THEN ORDER_ID 
            END) as any_digital_bundling
        FROM HSI_IDENTIFICATION
        GROUP BY EXTRACT(YEAR FROM ORDER_DATE), 
                 EXTRACT(MONTH FROM ORDER_DATE),
                 TO_CHAR(ORDER_DATE, 'YYYY-MM')
    ),
    GROWTH_ANALYSIS AS (
        SELECT
            tahun,
            bulan,
            periode,
            total_order_hsi,
            order_hsi_bisnis,
            order_hsi_basic,
            unique_bisnis_customers,
            unique_basic_customers,
            unique_customers,
            avg_orders_per_customer,
            hard_bundling,
            ala_carte_bundling,
            total_bundling,
            bundling_pijar,
            bundling_netmonk,
            bundling_oca_int,
            bundling_oca_blast,
            any_digital_bundling,
            -- Growth calculations
            LAG(total_order_hsi) OVER (ORDER BY tahun, bulan) as prev_month_order,
            ROUND((total_order_hsi - LAG(total_order_hsi) OVER (ORDER BY tahun, bulan)) * 100.0 / 
                  NULLIF(LAG(total_order_hsi) OVER (ORDER BY tahun, bulan), 0), 2) as mom_growth,
            LAG(total_order_hsi, 12) OVER (ORDER BY tahun, bulan) as prev_year_order,
            ROUND((total_order_hsi - LAG(total_order_hsi, 12) OVER (ORDER BY tahun, bulan)) * 100.0 / 
                  NULLIF(LAG(total_order_hsi, 12) OVER (ORDER BY tahun, bulan), 0), 2) as yoy_growth,
            -- Product mix percentages
            ROUND(order_hsi_bisnis * 100.0 / NULLIF(total_order_hsi, 0), 2) as pct_hsi_bisnis,
            ROUND(order_hsi_basic * 100.0 / NULLIF(total_order_hsi, 0), 2) as pct_hsi_basic,
            -- Bundling rates
            ROUND(total_bundling * 100.0 / NULLIF(total_order_hsi, 0), 2) as bundling_rate,
            ROUND(any_digital_bundling * 100.0 / NULLIF(total_order_hsi, 0), 2) as digital_bundling_rate
        FROM MONTHLY_METRICS
    )
    SELECT * FROM GROWTH_ANALYSIS
    ORDER BY tahun DESC, bulan DESC
    FETCH FIRST 12 ROWS ONLY
  `,

  BUSINESS_LOGIC: {
    categorizeVolume: function(total) {
      if (total >= 100000) return 'VOLUME_SANGAT_TINGGI';
      if (total >= 50000) return 'VOLUME_TINGGI';
      if (total >= 20000) return 'VOLUME_MENENGAH';
      if (total >= 10000) return 'VOLUME_RENDAH';
      return 'VOLUME_SANGAT_RENDAH';
    },
    
    categorizeGrowth: function(growth_rate) {
      if (growth_rate >= 20) return 'PERTUMBUHAN_EKSPLOSIF';
      if (growth_rate >= 10) return 'PERTUMBUHAN_SANGAT_BAIK';
      if (growth_rate >= 5) return 'PERTUMBUHAN_SEHAT';
      if (growth_rate >= 0) return 'PERTUMBUHAN_LAMBAT';
      if (growth_rate >= -5) return 'PENURUNAN_RINGAN';
      if (growth_rate >= -10) return 'PENURUNAN_MODERAT';
      return 'PENURUNAN_TAJAM';
    },
    
    analyzeBundlingStrategy: function(data) {
      const latest = data[0];
      const insights = [];
      
      if (latest.bundling_rate > 50) {
        insights.push({
          kategori: 'Kesuksesan Bundling',
          nilai: `Tingkat bundling tinggi (${latest.bundling_rate}%) - strategi bundling efektif`
        });
      } else if (latest.bundling_rate < 25) {
        insights.push({
          kategori: 'Peluang Bundling',
          nilai: `Tingkat bundling rendah (${latest.bundling_rate}%) - potensi peningkatan revenue`
        });
      }
      
      if (latest.digital_bundling_rate > 30) {
        insights.push({
          kategori: 'Adopsi Digital',
          nilai: `Adopsi bundling digital baik (${latest.digital_bundling_rate}%) - pelanggan responsif terhadap layanan digital`
        });
      }
      
      // Analisis efisiensi customer
      if (latest.avg_orders_per_customer > 1.5) {
        insights.push({
          kategori: 'Loyalitas Pelanggan',
          nilai: `Rata-rata ${latest.avg_orders_per_customer} order per pelanggan - indikasi pelanggan yang aktif`
        });
      }
      
      // Analyze specific digital products
      const digitalProducts = {
        pijar: latest.bundling_pijar,
        netmonk: latest.bundling_netmonk,
        oca_interaction: latest.bundling_oca_int,
        oca_blast: latest.bundling_oca_blast
      };
      
      const topDigital = Object.entries(digitalProducts)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

      if (topDigital.length > 0) {
        insights.push({
          kategori: 'Produk Digital Terpopuler',
          nilai: `${topDigital.map(([k, v]) =>
            `${k.replace('_', ' ').toUpperCase()} (${v} order)`).join(', ')}`
        });
      } else {
        insights.push({
          kategori: 'Produk Digital',
          nilai: 'Tidak ada bundling produk digital pada periode ini'
        });
      }
      
      return insights;
    },
    
    formatIndonesianResponse: function(data) {
      if (!data || data.length === 0) {
        return { error: 'no_data', message: 'Tidak ada data order HSI yang tersedia untuk scope yang dipilih.' };
      }
      const latest = data[0];
      const volume_category = this.categorizeVolume(latest.total_order_hsi);
      const growth_category = this.categorizeGrowth(latest.mom_growth);
      
      const bulan_indonesia = {
        1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
        5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus', 
        9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember'
      };
      
      const bulan_nama = bulan_indonesia[latest.bulan];
      const hasValidYoY = latest.tahun >= 2026 && latest.prev_year_order !== null && latest.yoy_growth !== null;

      return {
        periode: `${bulan_nama} ${latest.tahun}`,
        
        ringkasan_utama: {
          total_order_hsi: (latest.total_order_hsi || 0).toLocaleString('id-ID'),
          deskripsi: `Total order HSI (Bisnis + Basic) pada ${bulan_nama} ${latest.tahun}`,
          kategori_volume: this.translateVolumeCategory(volume_category)
        },
        
        breakdown_produk: {
          hsi_bisnis: {
            jumlah_order: (latest.order_hsi_bisnis || 0).toLocaleString('id-ID'),
            jumlah_pelanggan: (latest.unique_bisnis_customers || 0).toLocaleString('id-ID'),
            persentase: `${latest.pct_hsi_bisnis || 0}%`
          },
          hsi_basic: {
            jumlah_order: (latest.order_hsi_basic || 0).toLocaleString('id-ID'),
            jumlah_pelanggan: (latest.unique_basic_customers || 0).toLocaleString('id-ID'),
            persentase: `${latest.pct_hsi_basic || 0}%`
          }
        },
        
        analisis_pertumbuhan: {
          order_bulanan: {
            persentase: latest.mom_growth !== null ? `${latest.mom_growth}%` : 'N/A',
            kategori: this.translateGrowthCategory(growth_category),
            selisih_order: latest.prev_month_order !== null ? 
              ((latest.total_order_hsi || 0) - (latest.prev_month_order || 0)).toLocaleString('id-ID') : 'N/A'
          },
          tahunan: hasValidYoY ? {
            persentase: `${latest.yoy_growth || 0}%`,
            selisih_order: ((latest.total_order_hsi || 0) - (latest.prev_year_order || 0)).toLocaleString('id-ID')
          } : {
            persentase: 'Belum tersedia',
            selisih_order: 'Data belum cukup untuk YoY'
          }
        },
        
        analisis_bundling: {
          total_bundling: {
            jumlah: (latest.total_bundling || 0).toLocaleString('id-ID'),
            persentase: `${latest.bundling_rate || 0}%`
          },
          hard_bundling: (latest.hard_bundling || 0).toLocaleString('id-ID'),
          ala_carte_bundling: (latest.ala_carte_bundling || 0).toLocaleString('id-ID'),
          digital_bundling: {
            total: (latest.any_digital_bundling || 0).toLocaleString('id-ID'),
            persentase: `${latest.digital_bundling_rate || 0}%`,
            breakdown: {
              pijar_sekolah: (latest.bundling_pijar || 0).toLocaleString('id-ID'),
              netmonk: (latest.bundling_netmonk || 0).toLocaleString('id-ID'),
              oca_interaction: (latest.bundling_oca_int || 0).toLocaleString('id-ID'),
              oca_blast: (latest.bundling_oca_blast || 0).toLocaleString('id-ID')
            }
          }
        },
        
        metrik_pelanggan: {
          total_pelanggan_unik: (latest.unique_customers || 0).toLocaleString('id-ID'),
          rata_rata_order_per_pelanggan: latest.avg_orders_per_customer
        },
        
        wawasan_bisnis: this.analyzeBundlingStrategy(data),
        
        tren_3_bulan: data.length >= 3 ? this.analyzeTrend(data.slice(0, 3)) : null
      };
    },
    
    translateVolumeCategory: function(category) {
      const translations = {
        'VOLUME_SANGAT_TINGGI': 'Volume Sangat Tinggi - Market Leader',
        'VOLUME_TINGGI': 'Volume Tinggi - Posisi Kuat', 
        'VOLUME_MENENGAH': 'Volume Menengah - Pertumbuhan Stabil',
        'VOLUME_RENDAH': 'Volume Rendah - Perlu Akselerasi',
        'VOLUME_SANGAT_RENDAH': 'Volume Sangat Rendah - Evaluasi Strategi'
      };
      return translations[category] || category;
    },
    
    translateGrowthCategory: function(category) {
      const translations = {
        'PERTUMBUHAN_EKSPLOSIF': 'Pertumbuhan Eksplosif',
        'PERTUMBUHAN_SANGAT_BAIK': 'Pertumbuhan Sangat Baik',
        'PERTUMBUHAN_SEHAT': 'Pertumbuhan Sehat',
        'PERTUMBUHAN_LAMBAT': 'Pertumbuhan Lambat',
        'PENURUNAN_RINGAN': 'Penurunan Ringan',
        'PENURUNAN_MODERAT': 'Penurunan Moderat',
        'PENURUNAN_TAJAM': 'Penurunan Tajam'
      };
      return translations[category] || category;
    },
    
    analyzeTrend: function(last3Months) {
      const growthRates = last3Months.map(d => d.mom_growth).filter(g => g !== null);
      
      if (growthRates.length < 2) return 'Data tren tidak cukup';
      
      const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
      const isAccelerating = growthRates.length >= 3 && 
        (growthRates[0] - growthRates[1]) > (growthRates[1] - growthRates[2]);
      
      if (isAccelerating && avgGrowth > 5) {
        return 'Tren akselerasi positif - pertumbuhan semakin cepat';
      } else if (avgGrowth > 0) {
        return 'Tren pertumbuhan positif';
      } else if (avgGrowth < -5) {
        return 'Tren penurunan yang perlu diwaspadai';
      } else {
        return 'Tren relatif stabil';
      }
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      // Use the custom calculateConfidence from KEYWORD_PATTERNS instead of circular reference
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      const detectedInterest = module.exports.KEYWORD_PATTERNS.detectInterest(userInput);
      
      return {
        matches: confidence >= 50,
        confidence: confidence,
        focus_area: 'total_order_hsi',
        detected_interest: detectedInterest
      };
    }
  },

  CONNECTION_HANDLER: {
    pool_size: 5,
    pool_timeout: 30,
    retry_attempts: 3,
    retry_delay: 1000,
    
    getConnection: function() {
      const config = module.exports.DATABASE_CONFIG;
      return {
        connectionString: config.DB_CONNECT_STRING,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
        poolMin: 2,
        poolMax: 10,
        poolIncrement: 2
      };
    },
    
    executeQuery: async function(query) {
      const config = module.exports.DATABASE_CONFIG;
      const fullQuery = query.replace(/BRIGHTAI_SALES/g, 
        `${config.SCHEMA}.${config.TABLE}`);
      return fullQuery;
    }
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH',
  REQUIRES_TIME_FILTER: true
};