// ========================================
// RULE ps_003: ORDER PER BANDWIDTH
// ========================================
const { loadRuleDatabase } = require('../../config/databaseLoader');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_003',
    RULE_NAME: 'order_per_bandwidth',
    DESCRIPTION: 'Analisis distribusi order HSI (Bisnis & Basic) berdasarkan kategori bandwidth dengan bundling insights',
    DATABASE: 'PS_SCONE_ORDER',
    CATEGORY: 'bandwidth_analytics',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("PS_SCONE_ORDER"),
  
  KEYWORD_PATTERNS: {
    required: {
      bandwidth_keywords: [
        'bandwidth', 'kecepatan', 'speed', 'mbps', 'bw', 'bandwith',
        'cepat', 'lambat', 'fast', 'slow', 'tier', 'kategori', 'kelas'
      ],
      
      analysis_keywords: [
        'distribusi', 'sebaran', 'spread', 'distribution', 'pembagian',
        'breakdown', 'komposisi', 'composition', 'analisis', 'analysis'
      ],
      
      order_product_keywords: [
        'order', 'pesanan', 'penjualan', 'sales', 'hsi', 'internet',
        'hsi bisnis', 'hsi basic', 'hsie', 'hsief', 'broadband'
      ]
    },
    
    optional: {
      specific_bandwidth_keywords: [
        'premium', 'standard', 'basic', 'ultra', 'high', 'medium', 'low',
        'tinggi', 'menengah', 'rendah', 'standar', 'dasar',
        '10', '20', '50', '100', '200', 'mbps', 'mega'
      ],
      
      bundling_keywords: [
        'bundling', 'paket', 'bundle', 'package', 'hard bundling',
        'ala carte', 'digital', 'pijar', 'netmonk', 'oca'
      ],
      
      metric_keywords: [
        'jumlah', 'total', 'volume', 'banyak', 'count', 'berapa',
        'populer', 'popular', 'favorit', 'terbanyak', 'paling'
      ]
    },
    
    calculateConfidence: function(userInput) {
      const input = userInput.toLowerCase().trim();
      
      const hasBandwidth = this.required.bandwidth_keywords.some(keyword => 
        input.includes(keyword)
      );
      const hasAnalysis = this.required.analysis_keywords.some(keyword => 
        input.includes(keyword)
      );
      const hasOrderProduct = this.required.order_product_keywords.some(keyword => 
        input.includes(keyword)
      );
      
      const matchCount = [hasBandwidth, hasAnalysis, hasOrderProduct].filter(x => x).length;
      if (matchCount < 2) {
        return 0;
      }
      
      let confidence = matchCount === 3 ? 70 : 50;
      
      // Strong indicators
      if (hasBandwidth && (input.includes('distribusi') || input.includes('kategori'))) {
        confidence += 15;
      }
      
      // Bonus for specific bandwidth mentions
      this.optional.specific_bandwidth_keywords.forEach(keyword => {
        if (input.includes(keyword)) confidence += 8;
      });
      
      // Bonus for bundling keywords
      this.optional.bundling_keywords.forEach(keyword => {
        if (input.includes(keyword)) confidence += 6;
      });
      
      // Special phrases
      if (input.includes('bandwidth order') || input.includes('kecepatan internet')) {
        confidence += 15;
      }
      if (input.includes('kategori bandwidth') || input.includes('tier kecepatan')) {
        confidence += 12;
      }
      
      return Math.min(confidence, 100);
    },
    
    detectUserInterest: function(input) {
      if (input.includes('premium') || input.includes('high') || input.includes('tinggi')) {
        return 'HIGH_SPEED_FOCUS';
      }
      if (input.includes('bundling') || input.includes('paket')) {
        return 'BUNDLING_FOCUS';
      }
      if (input.includes('bisnis') || input.includes('basic')) {
        return 'PRODUCT_TYPE_FOCUS';
      }
      return 'GENERAL_DISTRIBUTION';
    }
  },

  SQL_QUERY: `
    WITH HSI_BANDWIDTH_ANALYSIS AS (
        SELECT 
            ORDER_ID,
            NCLI,
            ND_HSI,  -- ADDED: Identifier untuk layanan HSI
            REGIONAL,
            WITEL,
            ORDER_DATE,
            TGL_PS,
            STATUS_RESUME,
            JENISPSB,
            PACKAGE_NAME,
            PRODUCT,
            CAST(NULLIF(BW, '0') AS NUMBER) as bandwidth_kbps,
            CAST(NULLIF(BW, '0') AS NUMBER) / 1024 as bandwidth_mbps,
            -- HSI Product identification
            CASE 
                WHEN PRODUCT = 'WMS' THEN 0
                WHEN (
                    CONTAINS(PACKAGE_NAME, 'HSIE') OR 
                    CONTAINS(UPPER(PACKAGE_NAME), 'HSI BISNIS') OR
                    CONTAINS(UPPER(PACKAGE_NAME), 'PAKET INDIBIZ ') OR 
                    CONTAINS(UPPER(PACKAGE_NAME), 'PAKET HSI B2B ') OR
                    CONTAINS(UPPER(PACKAGE_NAME), 'HSI INDIBIZ B2B')
                ) AND NOT (
                    CONTAINS(PACKAGE_NAME, 'HSIEF') OR 
                    CONTAINS(UPPER(PACKAGE_NAME), 'BASIC') OR 
                    CONTAINS(UPPER(PACKAGE_NAME), 'INETF')
                ) THEN 1
                ELSE 0
            END as IS_HSI_BISNIS,
            CASE 
                WHEN PRODUCT = 'WMS' THEN 0
                WHEN (
                    CONTAINS(PACKAGE_NAME, 'HSIEF') OR 
                    CONTAINS(UPPER(PACKAGE_NAME), 'BASIC') OR 
                    CONTAINS(UPPER(PACKAGE_NAME), 'INETF')
                ) THEN 1
                ELSE 0
            END as IS_HSI_BASIC,
            -- Bundling type
            CASE
                WHEN JENISPSB = 'AO' AND (
                    CONTAINS(PACKAGE_NAME, 'HSI Bisnis Bundling ') OR 
                    CONTAINS(PACKAGE_NAME, 'HSI Bisnis Basic Bundling ') OR
                    CONTAINS(PACKAGE_NAME, 'Paket Indibiz 2S ')
                ) AND NOT CONTAINS(PACKAGE_NAME, 'Non') AND NOT CONTAINS(PACKAGE_NAME, 'Add-on') 
                THEN 'Hard Bundling'
                WHEN JENISPSB = 'AO' AND NOT CONTAINS(PACKAGE_NAME, 'Non') AND (
                    CONTAINS(PACKAGE_NAME, 'HSIE') OR 
                    CONTAINS(UPPER(PACKAGE_NAME), 'BUNDLING') OR 
                    CONTAINS(PACKAGE_NAME, ';')
                ) THEN 'Bundling A La Carte'
                ELSE 'Non Bundling'
            END as BUNDLING_TYPE,
            -- Digital products detection
            CASE 
                WHEN CONTAINS(UPPER(PACKAGE_NAME), 'SEKOLAH') OR
                     CONTAINS(UPPER(PACKAGE_NAME), 'NETMONK') OR
                     CONTAINS(UPPER(PACKAGE_NAME), 'OCAINT') OR
                     CONTAINS(UPPER(PACKAGE_NAME), 'INTERACTION') OR
                     CONTAINS(UPPER(PACKAGE_NAME), 'BLAST')
                THEN 1 ELSE 0
            END as HAS_DIGITAL_PRODUCT
        FROM DWHNAS.DWH_MOIS.PS_SCONE_ORDER  -- CORRECTED: Added full table name
        WHERE STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
          AND BW IS NOT NULL 
          AND BW != '0'
          AND REGEXP_LIKE(BW, '^[0-9]+$')
          AND ND_HSI IS NOT NULL  -- ADDED: Pastikan hanya record dengan HSI yang valid
          AND ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
    ),
    BANDWIDTH_CATEGORIZED AS (
        SELECT 
            *,
            CASE 
                WHEN bandwidth_mbps >= 200 THEN '1. Ultra High Speed (200+ Mbps)'
                WHEN bandwidth_mbps >= 100 THEN '2. High Speed (100-199 Mbps)'
                WHEN bandwidth_mbps >= 50 THEN '3. Medium Speed (50-99 Mbps)'
                WHEN bandwidth_mbps >= 20 THEN '4. Standard Speed (20-49 Mbps)'
                WHEN bandwidth_mbps >= 10 THEN '5. Basic Speed (10-19 Mbps)'
                ELSE '6. Entry Level (<10 Mbps)'
            END as bandwidth_tier,
            CASE 
                WHEN bandwidth_mbps >= 100 THEN 'PREMIUM'
                WHEN bandwidth_mbps >= 50 THEN 'STANDARD'
                ELSE 'BASIC'
            END as service_class
        FROM HSI_BANDWIDTH_ANALYSIS
        WHERE IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1
    ),
    BANDWIDTH_METRICS AS (
        SELECT 
            bandwidth_tier,
            service_class,
            -- Order metrics
            COUNT(DISTINCT ORDER_ID) as total_orders_hsi,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as orders_hsi_bisnis,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as orders_hsi_basic,
            COUNT(DISTINCT NCLI) as unique_customers,
            -- ADDED: HSI service metrics berdasarkan ND_HSI
            COUNT(DISTINCT ND_HSI) as unique_hsi_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ND_HSI END) as unique_hsi_bisnis_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ND_HSI END) as unique_hsi_basic_services,
            -- ADDED: Efficiency metrics
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT ND_HSI), 0), 2) as avg_orders_per_hsi_service,
            ROUND(COUNT(DISTINCT ND_HSI) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as avg_hsi_services_per_customer,
            -- Bandwidth statistics
            ROUND(AVG(bandwidth_mbps), 1) as avg_mbps,
            MIN(bandwidth_mbps) as min_mbps,
            MAX(bandwidth_mbps) as max_mbps,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY bandwidth_mbps) as median_mbps,
            -- Product mix
            ROUND(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) * 100.0 / 
                  COUNT(DISTINCT ORDER_ID), 2) as pct_hsi_bisnis,
            ROUND(COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) * 100.0 / 
                  COUNT(DISTINCT ORDER_ID), 2) as pct_hsi_basic,
            -- Bundling analysis
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE != 'Non Bundling' THEN ORDER_ID END) as bundling_orders,
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as hard_bundling_orders,
            COUNT(DISTINCT CASE WHEN HAS_DIGITAL_PRODUCT = 1 THEN ORDER_ID END) as digital_bundling_orders,
            -- Geographic spread
            COUNT(DISTINCT REGIONAL) as regional_coverage,
            COUNT(DISTINCT WITEL) as witel_coverage,
            -- Installation performance
            AVG(TGL_PS - ORDER_DATE) as avg_installation_days
        FROM BANDWIDTH_CATEGORIZED
        GROUP BY bandwidth_tier, service_class
    ),
    FINAL_BANDWIDTH_ANALYSIS AS (
        SELECT 
            bandwidth_tier,
            service_class,
            total_orders_hsi,
            orders_hsi_bisnis,
            orders_hsi_basic,
            unique_customers,
            unique_hsi_services,  -- ADDED
            unique_hsi_bisnis_services,  -- ADDED
            unique_hsi_basic_services,  -- ADDED
            avg_orders_per_hsi_service,  -- ADDED
            avg_hsi_services_per_customer,  -- ADDED
            -- Market share
            ROUND(total_orders_hsi * 100.0 / SUM(total_orders_hsi) OVER(), 2) as market_share_pct,
            ROUND(unique_hsi_services * 100.0 / SUM(unique_hsi_services) OVER(), 2) as service_share_pct,  -- ADDED
            -- Customer metrics
            ROUND(unique_customers * 100.0 / total_orders_hsi, 2) as customer_order_ratio,
            -- Bandwidth stats
            avg_mbps,
            min_mbps,
            max_mbps,
            median_mbps,
            -- Product mix
            pct_hsi_bisnis,
            pct_hsi_basic,
            -- Bundling rates
            ROUND(bundling_orders * 100.0 / NULLIF(total_orders_hsi, 0), 2) as bundling_rate,
            ROUND(hard_bundling_orders * 100.0 / NULLIF(bundling_orders, 0), 2) as hard_bundling_dominance,
            ROUND(digital_bundling_orders * 100.0 / NULLIF(total_orders_hsi, 0), 2) as digital_bundling_rate,
            -- Other metrics
            regional_coverage,
            witel_coverage,
            ROUND(avg_installation_days, 1) as avg_installation_days,
            -- Rankings
            DENSE_RANK() OVER (ORDER BY total_orders_hsi DESC) as popularity_rank,
            DENSE_RANK() OVER (ORDER BY unique_hsi_services DESC) as service_volume_rank,  -- ADDED
            DENSE_RANK() OVER (ORDER BY avg_mbps DESC) as speed_rank,
            DENSE_RANK() OVER (ORDER BY bundling_rate DESC) as bundling_rank,
            DENSE_RANK() OVER (ORDER BY avg_orders_per_hsi_service DESC) as efficiency_rank  -- ADDED
        FROM BANDWIDTH_METRICS
    )
    SELECT * FROM FINAL_BANDWIDTH_ANALYSIS
    ORDER BY 
        CASE 
            WHEN bandwidth_tier LIKE '1.%' THEN 1
            WHEN bandwidth_tier LIKE '2.%' THEN 2
            WHEN bandwidth_tier LIKE '3.%' THEN 3
            WHEN bandwidth_tier LIKE '4.%' THEN 4
            WHEN bandwidth_tier LIKE '5.%' THEN 5
            ELSE 6
        END
  `,

  BUSINESS_LOGIC: {
    analyzeBandwidthTrend: function(data) {
      const total_orders = data.reduce((sum, d) => sum + d.total_orders_hsi, 0);
      const total_services = data.reduce((sum, d) => sum + d.unique_hsi_services, 0);  // ADDED
      
      const weighted_avg_mbps = data.reduce((sum, d) => 
        sum + (d.avg_mbps * d.total_orders_hsi), 0) / total_orders;
      
      const premium_share = data
        .filter(d => d.service_class === 'PREMIUM')
        .reduce((sum, d) => sum + d.market_share_pct, 0);
      
      const bisnis_weighted_avg = data.reduce((sum, d) => 
        sum + (d.pct_hsi_bisnis * d.total_orders_hsi), 0) / total_orders;
      
      // ADDED: Service efficiency analysis
      const overall_efficiency = total_orders / total_services;
      const high_efficiency_tiers = data.filter(d => d.avg_orders_per_hsi_service > 1.5).length;
      
      return {
        rata_rata_tertimbang: Math.round(weighted_avg_mbps),
        arah_pasar: premium_share > 40 ? 'PREMIUM_DRIVEN' : 
                    premium_share > 20 ? 'BALANCED_MARKET' : 'VALUE_DRIVEN',
        premium_penetration: premium_share,
        bisnis_product_dominance: bisnis_weighted_avg,
        efisiensi_layanan_keseluruhan: overall_efficiency,  // ADDED
        tier_efisiensi_tinggi: high_efficiency_tiers  // ADDED
      };
    },
    
    generateBandwidthInsights: function(tier_data) {
      const insights = [];
      
      // Product mix insight
      if (tier_data.pct_hsi_bisnis > 80) {
        insights.push({
          tipe: 'Mix Produk',
          nilai: `HSI Bisnis mendominasi kategori ini (${tier_data.pct_hsi_bisnis}%)`
        });
      } else if (tier_data.pct_hsi_basic > 60) {
        insights.push({
          tipe: 'Mix Produk',
          nilai: `HSI Basic dominan (${tier_data.pct_hsi_basic}%) - peluang upselling ke HSI Bisnis`
        });
      }
      
      // ADDED: Service efficiency insight
      if (tier_data.avg_orders_per_hsi_service > 2.0) {
        insights.push({
          tipe: 'Efisiensi Layanan',
          nilai: `Efisiensi tinggi (${tier_data.avg_orders_per_hsi_service} order/layanan) - layanan aktif digunakan customer`
        });
      } else if (tier_data.avg_orders_per_hsi_service < 1.2) {
        insights.push({
          tipe: 'Optimisasi Layanan',
          nilai: `Efisiensi rendah (${tier_data.avg_orders_per_hsi_service} order/layanan) - peluang konsolidasi`
        });
      }
      
      // ADDED: Service penetration insight
      if (tier_data.avg_hsi_services_per_customer > 1.5) {
        insights.push({
          tipe: 'Penetrasi Layanan',
          nilai: `Multi-service adoption tinggi (${tier_data.avg_hsi_services_per_customer} layanan/customer) - customer value tinggi`
        });
      }
      
      // Bundling performance
      if (tier_data.bundling_rate > 50) {
        insights.push({
          tipe: 'Kesuksesan Bundling',
          nilai: `Bundling rate tinggi (${tier_data.bundling_rate}%) - customer menghargai bundling di tier ini`
        });
      } else if (tier_data.bundling_rate < 25 && tier_data.total_orders_hsi > 100) {
        insights.push({
          tipe: 'Peluang Bundling',
          nilai: `Bundling rate rendah (${tier_data.bundling_rate}%) - fokus program bundling`
        });
      }
      
      // Digital bundling
      if (tier_data.digital_bundling_rate > 30) {
        insights.push({
          tipe: 'Adopsi Digital',
          nilai: `Digital bundling tinggi (${tier_data.digital_bundling_rate}%) - customer terbuka untuk layanan digital`
        });
      }
      
      // Geographic expansion
      if (tier_data.regional_coverage < 3 && tier_data.total_orders_hsi > 500) {
        insights.push({
          tipe: 'Ekspansi Geografis',
          nilai: `Hanya di ${tier_data.regional_coverage} regional - potensi ekspansi ke regional lain`
        });
      }
      
      return insights;
    },
    
    categorizeMarketPosition: function(rank, share) {
      if (rank === 1 && share > 30) return 'MARKET_LEADER';
      if (rank <= 2 && share > 20) return 'STRONG_CHALLENGER';
      if (rank <= 3 && share > 10) return 'KEY_PLAYER';
      if (share > 5) return 'NICHE_PLAYER';
      return 'MINOR_PLAYER';
    },
    
    formatIndonesianResponse: function(data) {
      const trend_analysis = this.analyzeBandwidthTrend(data);
      const total_orders = data.reduce((sum, d) => sum + d.total_orders_hsi, 0);
      const total_services = data.reduce((sum, d) => sum + d.unique_hsi_services, 0);  // ADDED
      
      const detailed_tiers = data.map(tier => ({
        kategori: {
          nama: this.translateBandwidthTier(tier.bandwidth_tier),
          kelas_layanan: this.translateServiceClass(tier.service_class),
          ranking_popularitas: tier.popularity_rank,
          ranking_volume_layanan: tier.service_volume_rank,  // ADDED
          ranking_bundling: tier.bundling_rank,
          ranking_efisiensi: tier.efficiency_rank  // ADDED
        },
        
        metrik_order: {
          total_hsi: tier.total_orders_hsi.toLocaleString('id-ID'),
          hsi_bisnis: `${tier.orders_hsi_bisnis.toLocaleString('id-ID')} (${tier.pct_hsi_bisnis}%)`,
          hsi_basic: `${tier.orders_hsi_basic.toLocaleString('id-ID')} (${tier.pct_hsi_basic}%)`,
          pelanggan_unik: tier.unique_customers.toLocaleString('id-ID'),
          pangsa_pasar: `${tier.market_share_pct}%`
        },
        
        metrik_layanan: {  // ADDED
          total_layanan_hsi: tier.unique_hsi_services.toLocaleString('id-ID'),
          layanan_hsi_bisnis: tier.unique_hsi_bisnis_services.toLocaleString('id-ID'),
          layanan_hsi_basic: tier.unique_hsi_basic_services.toLocaleString('id-ID'),
          pangsa_layanan: `${tier.service_share_pct}%`,
          efisiensi_layanan: `${tier.avg_orders_per_hsi_service} order/layanan`,
          penetrasi_customer: `${tier.avg_hsi_services_per_customer} layanan/customer`
        },
        
        karakteristik_bandwidth: {
          rata_rata: `${tier.avg_mbps} Mbps`,
          median: `${tier.median_mbps} Mbps`,
          minimum: `${tier.min_mbps} Mbps`,
          maksimum: `${tier.max_mbps} Mbps`
        },
        
        bundling_performance: {
          bundling_rate: `${tier.bundling_rate}%`,
          hard_bundling_dominance: `${tier.hard_bundling_dominance || 0}%`,
          digital_bundling_rate: `${tier.digital_bundling_rate}%`
        },
        
        jangkauan_operasional: {
          cakupan_regional: tier.regional_coverage,
          cakupan_witel: tier.witel_coverage,
          rata_rata_instalasi: `${tier.avg_installation_days} hari`
        },
        
        posisi_pasar: this.translateMarketPosition(
          this.categorizeMarketPosition(tier.popularity_rank, tier.market_share_pct)
        ),
        
        insights: this.generateBandwidthInsights(tier)
      }));
      
      // Find key highlights
      const most_popular = data.find(d => d.popularity_rank === 1);
      const best_bundling = data.find(d => d.bundling_rank === 1);
      const most_efficient = data.find(d => d.efficiency_rank === 1);  // ADDED
      const bisnis_dominant = data.filter(d => d.pct_hsi_bisnis > 70);
      const basic_dominant = data.filter(d => d.pct_hsi_basic > 70);
      
      return {
        ringkasan_eksekutif: {
          judul: 'Analisis Distribusi Order HSI Berdasarkan Kategori Bandwidth',
          periode: this.getPeriodFromData(data),  
          total_order_analyzed: total_orders.toLocaleString('id-ID'),
          total_layanan_hsi: total_services.toLocaleString('id-ID'),  // ADDED
          efisiensi_keseluruhan: `${trend_analysis.efisiensi_layanan_keseluruhan.toFixed(2)} order/layanan`,  // ADDED
          total_hsi_bisnis: data.reduce((sum, d) => sum + d.orders_hsi_bisnis, 0).toLocaleString('id-ID'),
          total_hsi_basic: data.reduce((sum, d) => sum + d.orders_hsi_basic, 0).toLocaleString('id-ID'),
          jumlah_kategori: data.length
        },
        
        trend_pasar: {
          bandwidth_rata_rata_tertimbang: `${trend_analysis.rata_rata_tertimbang} Mbps`,
          karakteristik_pasar: this.translateMarketDirection(trend_analysis.arah_pasar),
          penetrasi_premium: `${trend_analysis.premium_penetration.toFixed(1)}%`,
          dominasi_hsi_bisnis: `${trend_analysis.bisnis_product_dominance.toFixed(1)}%`,
          tier_efisiensi_tinggi: `${trend_analysis.tier_efisiensi_tinggi} dari ${data.length} tier`  // ADDED
        },
        
        highlights: {
          kategori_terpopuler: most_popular ? {
            nama: this.translateBandwidthTier(most_popular.bandwidth_tier),
            pangsa_pasar: `${most_popular.market_share_pct}%`,
            total_order: most_popular.total_orders_hsi.toLocaleString('id-ID'),
            total_layanan: most_popular.unique_hsi_services.toLocaleString('id-ID'),  // ADDED
            product_mix: `Bisnis: ${most_popular.pct_hsi_bisnis}% | Basic: ${most_popular.pct_hsi_basic}%`
          } : null,
          
          kategori_bundling_terbaik: best_bundling ? {
            nama: this.translateBandwidthTier(best_bundling.bandwidth_tier),
            bundling_rate: `${best_bundling.bundling_rate}%`,
            digital_bundling: `${best_bundling.digital_bundling_rate}%`
          } : null,
          
          kategori_paling_efisien: most_efficient ? {  // ADDED
            nama: this.translateBandwidthTier(most_efficient.bandwidth_tier),
            efisiensi: `${most_efficient.avg_orders_per_hsi_service} order/layanan`,
            penetrasi: `${most_efficient.avg_hsi_services_per_customer} layanan/customer`
          } : null,
          
          dominasi_produk: {
            tier_bisnis_dominant: bisnis_dominant.length,
            tier_basic_dominant: basic_dominant.length,
            insight: bisnis_dominant.length > basic_dominant.length ? 
              'HSI Bisnis mendominasi mayoritas tier bandwidth' : 
              'Terdapat peluang upselling dari HSI Basic ke Bisnis'
          }
        },
        
        distribusi_detail: detailed_tiers,
        
        rekomendasi_strategis: this.generateStrategicRecommendations(data, trend_analysis)
      };
    },
    
    translateBandwidthTier: function(tier) {
      const translations = {
        '1. Ultra High Speed (200+ Mbps)': 'Ultra Cepat (200+ Mbps)',
        '2. High Speed (100-199 Mbps)': 'Sangat Cepat (100-199 Mbps)',
        '3. Medium Speed (50-99 Mbps)': 'Cepat (50-99 Mbps)',
        '4. Standard Speed (20-49 Mbps)': 'Standar (20-49 Mbps)',
        '5. Basic Speed (10-19 Mbps)': 'Dasar (10-19 Mbps)',
        '6. Entry Level (<10 Mbps)': 'Entry Level (<10 Mbps)'
      };
      return translations[tier] || tier;
    },
    
    translateServiceClass: function(service_class) {
      const translations = {
        'PREMIUM': 'Premium',
        'STANDARD': 'Standar',
        'BASIC': 'Dasar'
      };
      return translations[service_class] || service_class;
    },
    
    translateMarketPosition: function(position) {
      const translations = {
        'MARKET_LEADER': 'Pemimpin Pasar',
        'STRONG_CHALLENGER': 'Penantang Kuat',
        'KEY_PLAYER': 'Pemain Kunci',
        'NICHE_PLAYER': 'Pemain Niche',
        'MINOR_PLAYER': 'Pemain Minor'
      };
      return translations[position] || position;
    },
    
    translateMarketDirection: function(direction) {
      const translations = {
        'PREMIUM_DRIVEN': 'Pasar Berorientasi Premium',
        'BALANCED_MARKET': 'Pasar Seimbang',
        'VALUE_DRIVEN': 'Pasar Berorientasi Value'
      };
      return translations[direction] || direction;
    },
    
    generateStrategicRecommendations: function(data, trend) {
      const recommendations = [];
      
      // Premium market strategy
      if (trend.arah_pasar === 'PREMIUM_DRIVEN') {
        recommendations.push({
          area: 'Strategi Produk',
          rekomendasi: 'Fokus pengembangan fitur premium dan value-added services untuk bandwidth tinggi',
          priority: 'HIGH'
        });
      } else if (trend.arah_pasar === 'VALUE_DRIVEN') {
        recommendations.push({
          area: 'Penetrasi Pasar',
          rekomendasi: 'Optimalkan paket entry-level dengan bundling menarik untuk penetrasi pasar',
          priority: 'MEDIUM'
        });
      }
      
      // ADDED: Service efficiency recommendations
      const low_efficiency_tiers = data.filter(d => d.avg_orders_per_hsi_service < 1.2);
      if (low_efficiency_tiers.length > 0) {
        recommendations.push({
          area: 'Optimisasi Efisiensi Layanan',
          rekomendasi: `${low_efficiency_tiers.length} tier memiliki efisiensi rendah - fokus konsolidasi dan optimisasi layanan`,
          priority: 'HIGH'
        });
      }
      
      const high_efficiency_opportunities = data.filter(d => 
        d.avg_orders_per_hsi_service > 2.0 && d.avg_hsi_services_per_customer < 1.5
      );
      if (high_efficiency_opportunities.length > 0) {
        recommendations.push({
          area: 'Ekspansi Cross-Selling',
          rekomendasi: `${high_efficiency_opportunities.length} tier efisien dengan penetrasi rendah - peluang cross-selling additional services`,
          priority: 'MEDIUM'
        });
      }
      
      // Bundling optimization
      const low_bundling_premium = data.filter(d => 
        d.service_class === 'PREMIUM' && d.bundling_rate < 30
      );
      if (low_bundling_premium.length > 0) {
        recommendations.push({
          area: 'Optimisasi Revenue',
          rekomendasi: `${low_bundling_premium.length} tier premium dengan bundling rendah - tingkatkan bundling untuk maksimalkan ARPU`,
          priority: 'HIGH'
        });
      }
      
      // Product mix strategy
      if (trend.bisnis_product_dominance < 50) {
        recommendations.push({
          area: 'Program Upselling',
          rekomendasi: 'Implementasi program migrasi dari HSI Basic ke HSI Bisnis dengan incentive menarik',
          priority: 'MEDIUM'
        });
      }
      
      // Geographic expansion based on service efficiency
      const concentrated_efficient_tiers = data.filter(d => 
        d.regional_coverage < 3 && d.avg_orders_per_hsi_service > 1.5
      );
      if (concentrated_efficient_tiers.length > 0) {
        recommendations.push({
          area: 'Ekspansi Geografis',
          rekomendasi: `${concentrated_efficient_tiers.length} tier efisien tapi coverage terbatas - perluas ke regional dengan penetrasi rendah`,
          priority: 'MEDIUM'
        });
      }
      
      // Digital bundling opportunity
      const low_digital_high_volume = data.filter(d => 
        d.digital_bundling_rate < 15 && d.total_orders_hsi > 1000
      );
      if (low_digital_high_volume.length > 0) {
        recommendations.push({
          area: 'Adopsi Digital',
          rekomendasi: `${low_digital_high_volume.length} tier volume tinggi dengan digital bundling rendah - akselerasi program digital transformation`,
          priority: 'MEDIUM'
        });
      }
      
      return recommendations;
    },
    
    getPeriodFromData: function(data) {
      // Helper function to extract period from data if available
      // This would be implemented based on how date information is passed
      const currentDate = new Date();
      const bulanIndonesia = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return `${bulanIndonesia[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = this.parent.KEYWORD_PATTERNS.calculateConfidence(userInput);
      const detectedInterest = this.parent.KEYWORD_PATTERNS.detectUserInterest(userInput);
      
      return {
        matches: confidence >= 50,
        confidence: confidence,
        focus_area: 'bandwidth_distribution',
        detected_interest: detectedInterest
      };
    },
    
    parent: this
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH',
  REQUIRES_BANDWIDTH_DATA: true
};