const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_002',
    RULE_NAME: 'order_per_struktur_geografis',
    DESCRIPTION: 'Analisis distribusi order HSI (Bisnis & Basic) berdasarkan hirarki geografis dengan bundling insights',
    DATABASE: 'BRIGHTAI_SALES',
    CATEGORY: 'geographic_analytics',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 1800,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_SALES"),

  KEYWORD_PATTERNS: {
    required: {
      geographic_entity: [
        'regional', 'witel', 'datel', 'sto', 'wilayah', 'area', 'region',
        'cabang', 'kantor', 'unit', 'divisi', 'tempat', 'lokasi', 'daerah',
        'location', 'branch', 'office', 'geographic', 'territorial'
      ],
      
      analysis_keywords: [
        'distribusi', 'sebaran', 'persebaran', 'spread', 'distribution',
        'ranking', 'peringkat', 'urutan', 'posisi', 'rank', 'position',
        'perbandingan', 'komparasi', 'comparison', 'versus', 'vs',
        'performa', 'kinerja', 'performance', 'achievement'
      ],
      
      product_keywords: [
        'hsi', 'internet', 'broadband', 'hsi bisnis', 'hsi basic', 'hsie',
        'hsief', 'inetf', 'indibiz', 'order', 'pesanan', 'penjualan', 'sales'
      ]
    },
    
    optional: {
      hierarchy_keywords: [
        'struktur', 'hirarki', 'tingkatan', 'level', 'layer', 'jenjang',
        'organisasi', 'susunan', 'tatanan', 'hierarchy', 'structure'
      ],
      
      metric_keywords: [
        'jumlah', 'total', 'volume', 'banyak', 'count', 'number',
        'tertinggi', 'terbanyak', 'terbaik', 'top', 'best', 'highest'
      ],
      
      time_keywords: [
        'bulan', 'bulanan', 'tahun', 'tahunan', 'periode', 'monthly', 'yearly',
        'mom', 'yoy', 'growth', 'pertumbuhan', 'trend', 'perubahan'
      ],
      
      bundling_keywords: [
        'bundling', 'paket', 'bundle', 'package', 'hard bundling',
        'ala carte', 'digital', 'pijar', 'netmonk', 'oca'
      ]
    },
    
    calculateConfidence: function(userInput) {
      const input = userInput.toLowerCase().trim();
      
      const hasGeographic = this.required.geographic_entity.some(keyword => 
        input.includes(keyword)
      );
      const hasAnalysis = this.required.analysis_keywords.some(keyword => 
        input.includes(keyword)
      );
      const hasProduct = this.required.product_keywords.some(keyword => 
        input.includes(keyword)
      );
      
      const matchCount = [hasGeographic, hasAnalysis, hasProduct].filter(x => x).length;
      if (matchCount < 2) {
        return 0;
      }
      
      let confidence = matchCount === 3 ? 70 : 50;
      
      // Bonus for specific geographic terms
      const geoTerms = ['regional', 'witel', 'datel', 'sto'];
      const geoMatches = geoTerms.filter(term => input.includes(term)).length;
      confidence += geoMatches * 8;
      
      // Bonus for optional keywords
      this.optional.hierarchy_keywords.forEach(keyword => {
        if (input.includes(keyword)) confidence += 7;
      });
      
      this.optional.time_keywords.forEach(keyword => {
        if (input.includes(keyword)) confidence += 6;
      });
      
      this.optional.bundling_keywords.forEach(keyword => {
        if (input.includes(keyword)) confidence += 5;
      });
      
      // Special phrases
      if (input.includes('struktur geografis') || input.includes('geographic structure')) {
        confidence += 15;
      }
      
      if (input.includes('mom') || input.includes('yoy') || input.includes('pertumbuhan')) {
        confidence += 10;
      }
      
      return Math.min(confidence, 100);
    },
    
    detectQueryFocus: function(input) {
      if (input.includes('sto')) return 'STO_LEVEL';
      if (input.includes('datel')) return 'DATEL_LEVEL';
      if (input.includes('witel')) return 'WITEL_LEVEL';
      if (input.includes('regional')) return 'REGIONAL_LEVEL';
      return 'ALL_LEVELS';
    },
    
    detectTimeAnalysis: function(input) {
      if (input.includes('mom') || input.includes('bulanan') || input.includes('monthly')) return 'MONTHLY';
      if (input.includes('yoy') || input.includes('tahunan') || input.includes('yearly')) return 'YEARLY';
      if (input.includes('trend') || input.includes('pertumbuhan')) return 'TREND';
      return 'CURRENT';
    }
  },

  SQL_QUERY: `
    WITH HSI_IDENTIFICATION AS (
        SELECT 
            ORDER_ID,
            NCLI,
            ND_HSI,  -- ADDED: Identifier untuk layanan HSI
            REGIONAL,
            WITEL,
            DATEL,
            STO,
            ORDER_DATE,
            EXTRACT(YEAR FROM ORDER_DATE) AS TAHUN,
            EXTRACT(MONTH FROM ORDER_DATE) AS BULAN,
            TGL_PS,
            STATUS_RESUME,
            JENISPSB,
            PACKAGE_NAME,
            PRODUCT,
            BW,
            -- HSI Product identification
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
            CASE 
                WHEN PRODUCT = 'WMS' THEN 0
                WHEN (
                    UPPER(PACKAGE_NAME) LIKE '%HSIEF%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%BASIC%' OR 
                    UPPER(PACKAGE_NAME) LIKE '%INETF%'
                ) THEN 1
                ELSE 0
            END as IS_HSI_BASIC,
            -- Bundling identification
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
                ELSE 'Non Bundling'
            END as BUNDLING_TYPE,
            -- Digital products
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%SEKOLAH%' THEN 1 ELSE 0 END as HAS_PIJAR,
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%NETMONK%' THEN 1 ELSE 0 END as HAS_NETMONK,
            CASE 
                WHEN UPPER(PACKAGE_NAME) LIKE '%OCAINT%' OR 
                     UPPER(PACKAGE_NAME) LIKE '%INTERACTION%' THEN 1
                ELSE 0
            END as HAS_OCA_INT,
            CASE 
                WHEN UPPER(PACKAGE_NAME) LIKE '%BLAST%' THEN 1
                ELSE 0
            END as HAS_OCA_BLAST
        FROM DWH_MOIS.BRIGHTAI_SALES
        WHERE STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
          AND REGIONAL IS NOT NULL
          AND WITEL IS NOT NULL  
          AND DATEL IS NOT NULL
          AND STO IS NOT NULL
          AND ND_HSI IS NOT NULL  -- ADDED: Pastikan hanya record dengan HSI yang valid
          AND ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
    ),
    GEOGRAPHIC_METRICS AS (
        SELECT 
            REGIONAL,
            WITEL,
            DATEL,
            STO,
            -- HSI metrics - menggunakan ketiga identifier untuk akurasi
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ORDER_ID END) as total_order_hsi,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as order_hsi_bisnis,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as order_hsi_basic,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN NCLI END) as unique_customers,
            -- ADDED: HSI service metrics berdasarkan ND_HSI
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ND_HSI END) as unique_hsi_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ND_HSI END) as unique_hsi_bisnis_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ND_HSI END) as unique_hsi_basic_services,
            -- ADDED: Efficiency metrics
            ROUND(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ORDER_ID END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ND_HSI END), 0), 2) as avg_orders_per_hsi_service,
            ROUND(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ND_HSI END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN NCLI END), 0), 2) as avg_hsi_services_per_customer,
            -- Bundling metrics
            COUNT(DISTINCT CASE 
                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BUNDLING_TYPE != 'Non Bundling' 
                THEN ORDER_ID END) as bundling_orders,
            COUNT(DISTINCT CASE 
                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BUNDLING_TYPE = 'Hard Bundling' 
                THEN ORDER_ID END) as hard_bundling_orders,
            -- Digital bundling
            COUNT(DISTINCT CASE 
                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND 
                     (HAS_PIJAR = 1 OR HAS_NETMONK = 1 OR HAS_OCA_INT = 1 OR HAS_OCA_BLAST = 1)
                THEN ORDER_ID END) as digital_bundling_orders,
            -- Bandwidth analysis
            AVG(CASE 
                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BW IS NOT NULL AND BW != '0' 
                THEN CAST(BW AS NUMBER)/1024 END) as avg_bandwidth_mbps,
            -- Installation performance
            AVG(CASE 
                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND TGL_PS IS NOT NULL 
                THEN TGL_PS - ORDER_DATE END) as avg_installation_days
        FROM HSI_IDENTIFICATION
        GROUP BY REGIONAL, WITEL, DATEL, STO
        HAVING COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ORDER_ID END) > 0
    ),
    MONTHLY_HSI_AGGREGATION AS (
        SELECT 
            STO,
            REGIONAL,
            WITEL,
            DATEL,
            EXTRACT(YEAR FROM ORDER_DATE) AS TAHUN,
            EXTRACT(MONTH FROM ORDER_DATE) AS BULAN,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ORDER_ID END) AS total_order_hsi,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) AS order_hsi_bisnis,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) AS order_hsi_basic,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BUNDLING_TYPE != 'Non Bundling' THEN ORDER_ID END) AS bundling_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) AS hard_bundling_orders,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND (HAS_PIJAR = 1 OR HAS_NETMONK = 1 OR HAS_OCA_INT = 1 OR HAS_OCA_BLAST = 1) THEN ORDER_ID END) AS digital_bundling_orders,
            COUNT(DISTINCT NCLI) AS unique_customers,
            -- ADDED: Monthly HSI service metrics
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ND_HSI END) AS unique_hsi_services,
            ROUND(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ORDER_ID END) * 1.0 / 
                  NULLIF(COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1 THEN ND_HSI END), 0), 2) AS avg_orders_per_hsi_service,
            AVG(CASE 
                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND BW IS NOT NULL AND BW != '0' 
                THEN CAST(BW AS NUMBER)/1024 END) AS avg_bandwidth_mbps,
            AVG(CASE 
                WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) AND TGL_PS IS NOT NULL 
                THEN TGL_PS - ORDER_DATE END) AS avg_installation_days
        FROM HSI_IDENTIFICATION
        GROUP BY 
            STO, REGIONAL, WITEL, DATEL,
            EXTRACT(YEAR FROM ORDER_DATE),
            EXTRACT(MONTH FROM ORDER_DATE)
    ),
    YOY_COMPARISON AS (
        SELECT 
            curr.STO,
            curr.REGIONAL,
            curr.WITEL,
            curr.DATEL,
            curr.TAHUN,
            curr.BULAN,
            curr.total_order_hsi,
            curr.unique_hsi_services,  -- ADDED
            prev.total_order_hsi AS prev_year_order,
            prev.unique_hsi_services AS prev_year_hsi_services,  -- ADDED
            ROUND(
                (curr.total_order_hsi - prev.total_order_hsi) * 100.0 / NULLIF(prev.total_order_hsi, 0), 2
            ) AS yoy_growth,
            -- ADDED: YoY growth untuk HSI services
            ROUND(
                (curr.unique_hsi_services - prev.unique_hsi_services) * 100.0 / NULLIF(prev.unique_hsi_services, 0), 2
            ) AS yoy_hsi_services_growth
        FROM MONTHLY_HSI_AGGREGATION curr
        LEFT JOIN MONTHLY_HSI_AGGREGATION prev
            ON curr.STO = prev.STO
            AND curr.BULAN = prev.BULAN
            AND curr.TAHUN = prev.TAHUN + 1
    ),
    MOM_COMPARISON AS (
        SELECT 
            curr.STO,
            curr.REGIONAL,
            curr.WITEL,
            curr.DATEL,
            curr.TAHUN,
            curr.BULAN,
            curr.total_order_hsi,
            curr.unique_hsi_services,  -- ADDED
            prev.total_order_hsi AS prev_month_order,
            prev.unique_hsi_services AS prev_month_hsi_services,  -- ADDED
            ROUND(
                (curr.total_order_hsi - prev.total_order_hsi) * 100.0 / NULLIF(prev.total_order_hsi, 0), 2
            ) AS mom_growth,
            -- ADDED: MoM growth untuk HSI services
            ROUND(
                (curr.unique_hsi_services - prev.unique_hsi_services) * 100.0 / NULLIF(prev.unique_hsi_services, 0), 2
            ) AS mom_hsi_services_growth
        FROM MONTHLY_HSI_AGGREGATION curr
        LEFT JOIN MONTHLY_HSI_AGGREGATION prev
            ON curr.STO = prev.STO
            AND (
                (curr.TAHUN = prev.TAHUN AND curr.BULAN = prev.BULAN + 1)
                OR (curr.TAHUN = prev.TAHUN + 1 AND curr.BULAN = 1 AND prev.BULAN = 12)
            )
    ),
    RANKED_METRICS AS (
        SELECT
            m.STO,
            m.REGIONAL,
            m.WITEL,
            m.DATEL,
            m.TAHUN,
            m.BULAN,
            m.total_order_hsi,
            m.order_hsi_bisnis,
            m.order_hsi_basic,
            m.bundling_orders,
            m.hard_bundling_orders,
            m.digital_bundling_orders,
            m.unique_customers,
            m.unique_hsi_services,
            m.avg_orders_per_hsi_service,
            m.avg_bandwidth_mbps,
            m.avg_installation_days,
            yoy.yoy_growth,
            yoy.yoy_hsi_services_growth,
            mom.mom_growth,
            mom.mom_hsi_services_growth,
            ROUND(m.order_hsi_bisnis * 100.0 / NULLIF(m.total_order_hsi, 0), 2) AS pct_hsi_bisnis,
            ROUND(m.order_hsi_basic * 100.0 / NULLIF(m.total_order_hsi, 0), 2) AS pct_hsi_basic,
            ROUND(m.bundling_orders * 100.0 / NULLIF(m.total_order_hsi, 0), 2) AS bundling_rate,
            ROUND(m.hard_bundling_orders * 100.0 / NULLIF(m.bundling_orders, 0), 2) AS hard_bundling_pct,
            ROUND(m.digital_bundling_orders * 100.0 / NULLIF(m.total_order_hsi, 0), 2) AS digital_bundling_rate,
            DENSE_RANK() OVER (PARTITION BY m.TAHUN, m.BULAN ORDER BY m.total_order_hsi DESC) AS rank_nasional,
            DENSE_RANK() OVER (PARTITION BY m.TAHUN, m.BULAN, m.REGIONAL ORDER BY m.total_order_hsi DESC) AS rank_in_regional,
            DENSE_RANK() OVER (PARTITION BY m.TAHUN, m.BULAN, m.WITEL ORDER BY m.total_order_hsi DESC) AS rank_in_witel,
            DENSE_RANK() OVER (PARTITION BY m.TAHUN, m.BULAN, m.DATEL ORDER BY m.total_order_hsi DESC) AS rank_in_datel,
            DENSE_RANK() OVER (PARTITION BY m.TAHUN, m.BULAN, m.DATEL, m.STO ORDER BY m.total_order_hsi DESC) AS rank_in_sto,
            ROUND(m.total_order_hsi * 100.0 / NULLIF(SUM(m.total_order_hsi) OVER(PARTITION BY m.TAHUN, m.BULAN), 0), 2) AS share_nasional,
            ROUND(m.total_order_hsi * 100.0 / NULLIF(SUM(m.total_order_hsi) OVER(PARTITION BY m.TAHUN, m.BULAN, m.REGIONAL), 0), 2) AS share_in_regional,
            ROUND(m.total_order_hsi * 100.0 / NULLIF(SUM(m.total_order_hsi) OVER(PARTITION BY m.TAHUN, m.BULAN, m.WITEL), 0), 2) AS share_in_witel
        FROM MONTHLY_HSI_AGGREGATION m
        LEFT JOIN YOY_COMPARISON yoy ON m.STO = yoy.STO AND m.TAHUN = yoy.TAHUN AND m.BULAN = yoy.BULAN
        LEFT JOIN MOM_COMPARISON mom ON m.STO = mom.STO AND m.TAHUN = mom.TAHUN AND m.BULAN = mom.BULAN
    )
    SELECT * FROM RANKED_METRICS
    ORDER BY 
        TAHUN DESC,
        BULAN DESC,
        CASE 
            WHEN REGIONAL = '1' THEN 1
            WHEN REGIONAL = '2' THEN 2
            WHEN REGIONAL = '3' THEN 3
            WHEN REGIONAL = '4' THEN 4
            WHEN REGIONAL = '5' THEN 5
        END,
        total_order_hsi DESC
  `,

  BUSINESS_LOGIC: {
    categorizeSTOPerformance: function(sto_data) {
      const score = 
        (sto_data.rank_nasional <= 50 ? 20 : 0) +
        (sto_data.rank_in_regional <= 10 ? 20 : 0) +
        (sto_data.bundling_rate >= 40 ? 20 : 0) +
        (sto_data.digital_bundling_rate >= 20 ? 20 : 0) +
        (sto_data.mom_growth > 0 ? 10 : 0) +
        (sto_data.yoy_growth > 10 ? 10 : 0);
      
      if (score >= 80) return 'EXCELLENT';
      if (score >= 60) return 'GOOD';
      if (score >= 40) return 'MODERATE';
      return 'NEEDS_IMPROVEMENT';
    },
    
    analyzeProductMix: function(data) {
      if (data.pct_hsi_bisnis >= 70) return 'BISNIS_DOMINANT';
      if (data.pct_hsi_basic >= 70) return 'BASIC_DOMINANT';
      return 'BALANCED_MIX';
    },
    
    analyzeGrowthTrend: function(mom_growth, yoy_growth) {
      if (yoy_growth > 20 && mom_growth > 5) return 'RAPID_GROWTH';
      if (yoy_growth > 10 && mom_growth >= 0) return 'STEADY_GROWTH';
      if (yoy_growth > 0 || mom_growth > 0) return 'SLOW_GROWTH';
      if (yoy_growth < -10 || mom_growth < -5) return 'DECLINING';
      return 'STAGNANT';
    },
    
    formatIndonesianResponse: function(data) {
      // Group data by current month for main analysis
      // Find the latest (year, month) PAIR — not independent maxes
      const latestPeriod = data.reduce((best, d) => {
        const score = (d.TAHUN || 0) * 12 + (d.BULAN || 0);
        return score > best.score ? { score, tahun: d.TAHUN, bulan: d.BULAN } : best;
      }, { score: -Infinity, tahun: 0, bulan: 0 });
      const currentYear = latestPeriod.tahun;
      const currentMonth = latestPeriod.bulan;
      const currentData = data.filter(d => d.TAHUN === currentYear && d.BULAN === currentMonth);
      
      const top_performers = currentData.slice(0, 10);
      
      // Monthly trend analysis
      const monthlyTrend = this.analyzeMonthlyTrend(data);
      
      return {
        ringkasan_eksekutif: {
          judul: 'Analisis Distribusi Order HSI per Struktur Geografis',
          periode: `${this.getMonthName(currentMonth)} ${currentYear}`,
          total_sto_aktif: currentData.length,
          total_order_hsi: currentData.reduce((sum, d) => sum + d.total_order_hsi, 0).toLocaleString('id-ID'),
          total_layanan_hsi: currentData.reduce((sum, d) => sum + d.unique_hsi_services, 0).toLocaleString('id-ID'), // ADDED
          komposisi_produk: {
            total_hsi_bisnis: currentData.reduce((sum, d) => sum + d.order_hsi_bisnis, 0).toLocaleString('id-ID'),
            total_hsi_basic: currentData.reduce((sum, d) => sum + d.order_hsi_basic, 0).toLocaleString('id-ID')
          }
        },
        
        analisis_pertumbuhan: {
          mom_overview: this.generateMoMOverview(currentData),
          yoy_overview: this.generateYoYOverview(currentData),
          growth_leaders: this.getGrowthLeaders(currentData),
          declining_areas: this.getDecliningAreas(currentData)
        },
        
        struktur_hirarki: {
          regional: this.summarizeByRegional(currentData),
          witel_terbaik: this.getTopWitel(currentData, 5),
          sto_dengan_bundling_tinggi: this.getHighBundlingSTO(currentData, 5),
          sto_pertumbuhan_tercepat: this.getFastestGrowingSTO(currentData, 5)
        },
        
        top_10_sto_nasional: top_performers.map(sto => ({
          ranking: sto.rank_nasional,
          identitas: `${sto.STO} (${sto.DATEL}, ${sto.WITEL}, Regional ${sto.REGIONAL})`,
          
          metrik_order: {
            total_hsi: sto.total_order_hsi.toLocaleString('id-ID'),
            hsi_bisnis: `${sto.order_hsi_bisnis.toLocaleString('id-ID')} (${sto.pct_hsi_bisnis}%)`,
            hsi_basic: `${sto.order_hsi_basic.toLocaleString('id-ID')} (${sto.pct_hsi_basic}%)`,
            unique_customers: sto.unique_customers.toLocaleString('id-ID'),
            unique_hsi_services: sto.unique_hsi_services.toLocaleString('id-ID')  // ADDED
          },
          
          efisiensi_layanan: {  // ADDED
            rata_rata_order_per_layanan: sto.avg_orders_per_hsi_service,
            rata_rata_layanan_per_pelanggan: (sto.unique_hsi_services / sto.unique_customers).toFixed(2)
          },
          
          pertumbuhan: {
            mom_growth: sto.mom_growth !== null ? `${sto.mom_growth}%` : 'N/A',
            yoy_growth: sto.yoy_growth !== null ? `${sto.yoy_growth}%` : 'N/A',
            mom_hsi_services_growth: sto.mom_hsi_services_growth !== null ? `${sto.mom_hsi_services_growth}%` : 'N/A',  // ADDED
            yoy_hsi_services_growth: sto.yoy_hsi_services_growth !== null ? `${sto.yoy_hsi_services_growth}%` : 'N/A',  // ADDED
            trend_kategori: this.translateGrowthTrend(
              this.analyzeGrowthTrend(sto.mom_growth, sto.yoy_growth)
            )
          },
          
          bundling_performance: {
            bundling_rate: `${sto.bundling_rate}%`,
            hard_bundling_dominance: `${sto.hard_bundling_pct || 0}%`,
            digital_bundling_rate: `${sto.digital_bundling_rate}%`
          },
          
          operational_metrics: {
            avg_bandwidth: sto.avg_bandwidth_mbps != null ? `${Math.round(sto.avg_bandwidth_mbps)} Mbps` : '-',
            avg_installation_time: sto.avg_installation_days != null ? `${Math.round(sto.avg_installation_days)} hari` : '-'
          },
          
          market_position: {
            share_nasional: `${sto.share_nasional}%`,
            share_in_regional: `${sto.share_in_regional}%`,
            share_in_witel: `${sto.share_in_witel}%`,
            rank_in_regional: sto.rank_in_regional,
            rank_in_witel: sto.rank_in_witel
          },
          
          kategori_kinerja: this.translatePerformance(
            this.categorizeSTOPerformance(sto)
          ),
          product_mix: this.translateProductMix(
            this.analyzeProductMix(sto)
          )
        })),
        
        trend_bulanan: monthlyTrend,
        insights_bundling: this.generateBundlingInsights(currentData),
        rekomendasi_strategis: this.generateStrategicRecommendations(currentData)
      };
    },
    
    generateMoMOverview: function(data) {
      const positiveGrowth = data.filter(d => d.mom_growth > 0).length;
      const negativeGrowth = data.filter(d => d.mom_growth < 0).length;
      const avgMoM = data.reduce((sum, d) => sum + (d.mom_growth || 0), 0) / data.length;
      
      // ADDED: HSI Services MoM overview
      const positiveHSIGrowth = data.filter(d => d.mom_hsi_services_growth > 0).length;
      const avgMoMHSI = data.reduce((sum, d) => sum + (d.mom_hsi_services_growth || 0), 0) / data.length;
      
      return {
        order_bulanan: {
          sto_pertumbuhan_positif: positiveGrowth,
          sto_pertumbuhan_negatif: negativeGrowth,
          rata_rata_mom: `${avgMoM.toFixed(1)}%`,
          status: avgMoM > 5 ? 'Pertumbuhan Kuat' : 
                  avgMoM > 0 ? 'Pertumbuhan Moderat' : 
                  'Perlu Perhatian'
        },
        layanan_hsi_bulanan: {  // ADDED
          sto_pertumbuhan_positif: positiveHSIGrowth,
          rata_rata_mom_hsi: `${avgMoMHSI.toFixed(1)}%`,
          status: avgMoMHSI > 5 ? 'Ekspansi Layanan Aktif' : 
                  avgMoMHSI > 0 ? 'Pertumbuhan Layanan Moderat' : 
                  'Konsolidasi Layanan'
        }
      };
    },
    
    generateYoYOverview: function(data) {
      const positiveGrowth = data.filter(d => d.yoy_growth > 0).length;
      const negativeGrowth = data.filter(d => d.yoy_growth < 0).length;
      const avgYoY = data.reduce((sum, d) => sum + (d.yoy_growth || 0), 0) / data.length;
      
      // ADDED: HSI Services YoY overview
      const positiveHSIGrowth = data.filter(d => d.yoy_hsi_services_growth > 0).length;
      const avgYoYHSI = data.reduce((sum, d) => sum + (d.yoy_hsi_services_growth || 0), 0) / data.length;
      
      return {
        order_tahunan: {
          sto_pertumbuhan_positif: positiveGrowth,
          sto_pertumbuhan_negatif: negativeGrowth,
          rata_rata_yoy: `${avgYoY.toFixed(1)}%`,
          status: avgYoY > 10 ? 'Pertumbuhan YoY Sangat Baik' : 
                  avgYoY > 0 ? 'Pertumbuhan YoY Positif' : 
                  'YoY Negatif - Evaluasi Diperlukan'
        },
        layanan_hsi_tahunan: {  // ADDED
          sto_pertumbuhan_positif: positiveHSIGrowth,
          rata_rata_yoy_hsi: `${avgYoYHSI.toFixed(1)}%`,
          status: avgYoYHSI > 10 ? 'Ekspansi Layanan YoY Sangat Baik' : 
                  avgYoYHSI > 0 ? 'Pertumbuhan Layanan YoY Positif' : 
                  'Konsolidasi/Optimisasi Layanan'
        }
      };
    },
    
    getGrowthLeaders: function(data) {
      return data
        .filter(d => d.mom_growth > 0 && d.yoy_growth > 0)
        .sort((a, b) => (b.mom_growth + b.yoy_growth) - (a.mom_growth + a.yoy_growth))
        .slice(0, 5)
        .map(d => ({
          sto: `${d.STO} (${d.WITEL})`,
          mom_growth: `${d.mom_growth}%`,
          yoy_growth: `${d.yoy_growth}%`,
          mom_hsi_services_growth: d.mom_hsi_services_growth !== null ? `${d.mom_hsi_services_growth}%` : 'N/A',  // ADDED
          total_order: d.total_order_hsi.toLocaleString('id-ID'),
          total_layanan_hsi: d.unique_hsi_services.toLocaleString('id-ID')  // ADDED
        }));
    },
    
    getDecliningAreas: function(data) {
      return data
        .filter(d => d.mom_growth < -5 || d.yoy_growth < -10)
        .sort((a, b) => (a.mom_growth + a.yoy_growth) - (b.mom_growth + b.yoy_growth))
        .slice(0, 5)
        .map(d => ({
          sto: `${d.STO} (${d.WITEL})`,
          mom_growth: `${d.mom_growth}%`,
          yoy_growth: `${d.yoy_growth}%`,
          mom_hsi_services_growth: d.mom_hsi_services_growth !== null ? `${d.mom_hsi_services_growth}%` : 'N/A',  // ADDED
          total_order: d.total_order_hsi.toLocaleString('id-ID'),
          action_needed: 'Evaluasi dan Program Intervensi'
        }));
    },
    
    getFastestGrowingSTO: function(data, limit) {
      return data
        .filter(d => d.mom_growth !== null && d.yoy_growth !== null)
        .sort((a, b) => (b.mom_growth + b.yoy_growth) - (a.mom_growth + a.yoy_growth))
        .slice(0, limit)
        .map(d => ({
          sto: `${d.STO} (${d.WITEL})`,
          mom_growth: `${d.mom_growth}%`,
          yoy_growth: `${d.yoy_growth}%`,
          efisiensi_layanan: `${d.avg_orders_per_hsi_service} order/layanan`,  // ADDED
          total_order: d.total_order_hsi.toLocaleString('id-ID'),
          growth_category: this.translateGrowthTrend(
            this.analyzeGrowthTrend(d.mom_growth, d.yoy_growth)
          )
        }));
    },
    
    analyzeMonthlyTrend: function(allData) {
      // Group by month and calculate totals
      const monthlyData = {};
      
      allData.forEach(d => {
        const key = `${d.TAHUN}-${String(d.BULAN).padStart(2, '0')}`;
        if (!monthlyData[key]) {
          monthlyData[key] = {
            tahun: d.TAHUN,
            bulan: d.BULAN,
            total_order: 0,
            total_bisnis: 0,
            total_basic: 0,
            total_hsi_services: 0,  // ADDED
            sto_count: 0
          };
        }
        monthlyData[key].total_order += d.total_order_hsi;
        monthlyData[key].total_bisnis += d.order_hsi_bisnis;
        monthlyData[key].total_basic += d.order_hsi_basic;
        monthlyData[key].total_hsi_services += d.unique_hsi_services;  // ADDED
        monthlyData[key].sto_count += 1;
      });
      
      // Convert to array and sort
      const sortedMonths = Object.values(monthlyData)
        .sort((a, b) => (a.tahun * 12 + a.bulan) - (b.tahun * 12 + b.bulan))
        .slice(-6); // Last 6 months
      
      return sortedMonths.map(month => ({
        periode: `${this.getMonthName(month.bulan)} ${month.tahun}`,
        total_order: month.total_order.toLocaleString('id-ID'),
        total_layanan_hsi: month.total_hsi_services.toLocaleString('id-ID'),  // ADDED
        efisiensi_rata_rata: `${(month.total_order/month.total_hsi_services).toFixed(2)} order/layanan`,  // ADDED
        bisnis_basic_ratio: `${((month.total_bisnis / month.total_order) * 100).toFixed(0)}:${((month.total_basic / month.total_order) * 100).toFixed(0)}`,
        active_sto: month.sto_count
      }));
    },
    
    summarizeByRegional: function(data) {
      const regional_summary = {};
      
      ['1', '2', '3', '4', '5'].forEach(reg => {
        const reg_data = data.filter(d => d.REGIONAL === reg);
        if (reg_data.length > 0) {
          const total_hsi = reg_data.reduce((sum, d) => sum + d.total_order_hsi, 0);
          const total_hsi_services = reg_data.reduce((sum, d) => sum + d.unique_hsi_services, 0);  // ADDED
          const avg_mom = reg_data.reduce((sum, d) => sum + (d.mom_growth || 0), 0) / reg_data.length;
          const avg_yoy = reg_data.reduce((sum, d) => sum + (d.yoy_growth || 0), 0) / reg_data.length;
          const avg_bundling_rate = reg_data.reduce((sum, d) => sum + d.bundling_rate, 0) / reg_data.length;
          const avg_efficiency = total_hsi_services > 0 ? (total_hsi / total_hsi_services).toFixed(2) : '0';  // ADDED
          
          regional_summary[`regional_${reg}`] = {
            nama: `Regional ${reg}`,
            jumlah_sto_aktif: reg_data.length,
            total_order_hsi: total_hsi.toLocaleString('id-ID'),
            total_layanan_hsi: total_hsi_services.toLocaleString('id-ID'),  // ADDED
            efisiensi_regional: `${avg_efficiency} order/layanan`,  // ADDED
            pertumbuhan_mom: `${avg_mom.toFixed(1)}%`,
            pertumbuhan_yoy: `${avg_yoy.toFixed(1)}%`,
            rata_rata_bundling: `${avg_bundling_rate.toFixed(1)}%`,
            sto_terbaik: reg_data[0] ? `${reg_data[0].STO} (${reg_data[0].total_order_hsi} order)` : '-',
            kontribusi_nasional: `${(total_hsi * 100 / data.reduce((s, d) => s + d.total_order_hsi, 0)).toFixed(1)}%`
          };
        }
      });
      
      return regional_summary;
    },
    
    getTopWitel: function(data, limit) {
      const witel_agg = {};
      
      data.forEach(d => {
        if (!witel_agg[d.WITEL]) {
          witel_agg[d.WITEL] = {
            witel: d.WITEL,
            regional: d.REGIONAL,
            total_hsi: 0,
            total_bisnis: 0,
            total_basic: 0,
            total_bundling: 0,
            total_hsi_services: 0,  // ADDED
            sto_count: 0,
            sum_mom: 0,
            sum_yoy: 0,
            count_growth: 0
          };
        }
        witel_agg[d.WITEL].total_hsi += d.total_order_hsi;
        witel_agg[d.WITEL].total_bisnis += d.order_hsi_bisnis;
        witel_agg[d.WITEL].total_basic += d.order_hsi_basic;
        witel_agg[d.WITEL].total_bundling += d.bundling_orders;
        witel_agg[d.WITEL].total_hsi_services += d.unique_hsi_services;  // ADDED
        witel_agg[d.WITEL].sto_count += 1;
        if (d.mom_growth !== null) {
          witel_agg[d.WITEL].sum_mom += d.mom_growth;
          witel_agg[d.WITEL].count_growth += 1;
        }
        if (d.yoy_growth !== null) {
          witel_agg[d.WITEL].sum_yoy += d.yoy_growth;
        }
      });
      
      return Object.values(witel_agg)
        .sort((a, b) => b.total_hsi - a.total_hsi)
        .slice(0, limit)
        .map((w, idx) => ({
          ranking: idx + 1,
          nama_witel: w.witel,
          regional: w.regional,
          total_order_hsi: w.total_hsi.toLocaleString('id-ID'),
          total_layanan_hsi: w.total_hsi_services.toLocaleString('id-ID'),  // ADDED
          efisiensi_witel: `${(w.total_hsi/w.total_hsi_services).toFixed(2)} order/layanan`,  // ADDED
          mix_produk: `Bisnis: ${((w.total_bisnis/w.total_hsi)*100).toFixed(0)}% | Basic: ${((w.total_basic/w.total_hsi)*100).toFixed(0)}%`,
          bundling_rate: `${((w.total_bundling/w.total_hsi)*100).toFixed(1)}%`,
          avg_mom_growth: w.count_growth > 0 ? `${(w.sum_mom/w.count_growth).toFixed(1)}%` : 'N/A',
          avg_yoy_growth: w.count_growth > 0 ? `${(w.sum_yoy/w.count_growth).toFixed(1)}%` : 'N/A',
          jumlah_sto: w.sto_count
        }));
    },
    
    getHighBundlingSTO: function(data, limit) {
      return data
        .filter(d => d.bundling_rate > 0)
        .sort((a, b) => b.bundling_rate - a.bundling_rate)
        .slice(0, limit)
        .map(d => ({
          sto: `${d.STO} (${d.WITEL})`,
          bundling_rate: `${d.bundling_rate}%`,
          digital_bundling: `${d.digital_bundling_rate}%`,
          total_order: d.total_order_hsi.toLocaleString('id-ID'),
          efisiensi_layanan: `${d.avg_orders_per_hsi_service} order/layanan`,  // ADDED
          growth_status: d.mom_growth > 0 ? 'Bertumbuh' : 'Menurun'
        }));
    },
    
    generateBundlingInsights: function(data) {
      const avg_bundling = data.reduce((sum, d) => sum + d.bundling_rate, 0) / data.length;
      const high_bundling_sto = data.filter(d => d.bundling_rate > 50).length;
      const digital_adoption = data.filter(d => d.digital_bundling_rate > 20).length;
      
      // ADDED: Service efficiency insights
      const avg_service_efficiency = data.reduce((sum, d) => sum + d.avg_orders_per_hsi_service, 0) / data.length;
      const high_efficiency_sto = data.filter(d => d.avg_orders_per_hsi_service > 1.5).length;
      
      // Bundling vs Growth correlation
      const high_bundling_growing = data.filter(d => d.bundling_rate > 50 && d.mom_growth > 0).length;
      const bundling_growth_correlation = high_bundling_sto > 0 ? 
        (high_bundling_growing / high_bundling_sto) * 100 : 0;
      
      return {
        rata_rata_bundling_nasional: `${avg_bundling.toFixed(1)}%`,
        sto_dengan_bundling_tinggi: `${high_bundling_sto} STO (bundling >50%)`,
        sto_dengan_digital_bundling: `${digital_adoption} STO (digital bundling >20%)`,
        efisiensi_layanan: {  // ADDED
          rata_rata_nasional: `${avg_service_efficiency.toFixed(2)} order/layanan`,
          sto_efisiensi_tinggi: `${high_efficiency_sto} STO (>1.5 order/layanan)`
        },
        korelasi_bundling_growth: `${bundling_growth_correlation.toFixed(0)}% STO high bundling juga bertumbuh`,
        peluang: avg_bundling < 30 ? 
          'Peluang besar untuk meningkatkan bundling secara nasional' : 
          'Bundling sudah cukup baik, fokus pada peningkatan digital bundling dan efisiensi layanan'
      };
    },
    
    translatePerformance: function(category) {
      const translations = {
        'EXCELLENT': 'Sangat Baik',
        'GOOD': 'Baik',
        'MODERATE': 'Cukup',
        'NEEDS_IMPROVEMENT': 'Perlu Peningkatan'
      };
      return translations[category] || category;
    },
    
    translateProductMix: function(mix) {
      const translations = {
        'BISNIS_DOMINANT': 'Dominasi HSI Bisnis',
        'BASIC_DOMINANT': 'Dominasi HSI Basic',
        'BALANCED_MIX': 'Mix Seimbang'
      };
      return translations[mix] || mix;
    },
    
    translateGrowthTrend: function(trend) {
      const translations = {
        'RAPID_GROWTH': 'Pertumbuhan Pesat',
        'STEADY_GROWTH': 'Pertumbuhan Stabil',
        'SLOW_GROWTH': 'Pertumbuhan Lambat',
        'STAGNANT': 'Stagnan',
        'DECLINING': 'Menurun'
      };
      return translations[trend] || trend;
    },
    
    getMonthName: function(month) {
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return months[month - 1] || `Bulan ${month}`;
    },
    
    generateStrategicRecommendations: function(data) {
      const recommendations = [];
      
      // Growth-based recommendations
      const declining_sto = data.filter(d => d.mom_growth < -5 && d.yoy_growth < 0);
      if (declining_sto.length > 10) {
        recommendations.push({
          area: 'Recovery Pertumbuhan',
          rekomendasi: `${declining_sto.length} STO mengalami penurunan MoM dan YoY - perlu program recovery`,
          priority: 'URGENT'
        });
      }
      
      // ADDED: Service efficiency recommendations
      const low_efficiency_sto = data.filter(d => d.avg_orders_per_hsi_service < 1.2);
      if (low_efficiency_sto.length > 20) {
        recommendations.push({
          area: 'Optimisasi Efisiensi Layanan',
          rekomendasi: `${low_efficiency_sto.length} STO memiliki efisiensi rendah (<1.2 order/layanan) - fokus konsolidasi dan optimisasi`,
          priority: 'HIGH'
        });
      }
      
      // Geographic concentration with growth consideration
      const top10_share = data.slice(0, 10).reduce((sum, d) => sum + d.share_nasional, 0);
      const top10_avg_growth = data.slice(0, 10).reduce((sum, d) => sum + (d.mom_growth || 0), 0) / 10;
      if (top10_share > 30 && top10_avg_growth < 5) {
        recommendations.push({
          area: 'Diversifikasi Geografis',
          rekomendasi: `Top 10 STO menguasai ${top10_share.toFixed(1)}% tapi growth rendah - diversifikasi ke STO potensial`,
          priority: 'HIGH'
        });
      }
      
      // Bundling opportunity with growth
      const low_bundling_growing = data.filter(d => d.bundling_rate < 20 && d.mom_growth > 5);
      if (low_bundling_growing.length > 5) {
        recommendations.push({
          area: 'Akselerasi Bundling',
          rekomendasi: `${low_bundling_growing.length} STO bertumbuh tapi bundling rendah - peluang quick win`,
          priority: 'MEDIUM'
        });
      }
      
      // Regional performance
      const regionalPerf = this.summarizeByRegional(data);
      Object.values(regionalPerf).forEach(reg => {
        const mom = parseFloat(reg.pertumbuhan_mom);
        const yoy = parseFloat(reg.pertumbuhan_yoy);
        if (mom < -5 || yoy < -10) {
          recommendations.push({
            area: 'Kinerja Regional',
            rekomendasi: `${reg.nama} menurun (MoM: ${mom}%, YoY: ${yoy}%) - perlu intervensi strategis`,
            priority: 'HIGH'
          });
        }
      });
      
      return recommendations;
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      const detectedInterest = patternMatcher.detectInterest(userInput, module.exports.KEYWORD_PATTERNS);
      
      return {
        matches: confidence >= 50,
        confidence: confidence,
        focus_area: 'geographic_distribution',
        detected_interest: detectedInterest
      };
    },
    
  },

  CACHE_DURATION: 1800,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH',
  REQUIRES_GEOGRAPHIC_FILTER: true,
  SUPPORTS_TIME_ANALYSIS: true
};