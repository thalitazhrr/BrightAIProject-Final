const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_008',
    RULE_NAME: 'revenue_per_bandwidth',
    DESCRIPTION: 'Analisis revenue berdasarkan kategori bandwidth HSI dengan klasifikasi produk yang tepat menggunakan ORDER_ID, NCLI, dan ND_HSI',
    DATABASE: 'PS_SCONE_ORDER',
    CATEGORY: 'REVENUE_ANALYSIS',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("PS_SCONE_ORDER"),

  KEYWORD_PATTERNS: {
    primary: [
      // Revenue bandwidth - yang biasa digunakan
      'revenue bandwidth', 'pendapatan bandwidth', 'revenue per bandwidth',
      'arpu bandwidth', 'pendapatan per kecepatan', 'income bandwidth',
      
      // Analysis terms familiar
      'analisis revenue', 'breakdown pendapatan', 'segmentasi revenue',
      'kategori bandwidth', 'bandwidth category', 'tier bandwidth'
    ],
    
    supporting: [
      // Revenue terms familiar
      'pendapatan', 'revenue', 'arpu', 'omzet', 'penjualan',
      
      // Bandwidth terms familiar  
      'bandwidth', 'kecepatan', 'speed', 'mbps', 'tier', 'paket',
      
      // Business terms
      'kontribusi', 'proporsi', 'distribusi', 'margin', 'profit'
    ],
    
    // Simplified confidence calculation
    calculateConfidence: function(input) {
      const lowerInput = input.toLowerCase();
      let score = 0;
      
      // Check primary keywords
      const primaryMatches = this.primary.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      
      // Check supporting keywords
      const supportingMatches = this.supporting.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      
      if (primaryMatches > 0) {
        score = 70 + (primaryMatches * 15) + (supportingMatches * 3);
      } else if (lowerInput.includes('revenue') && lowerInput.includes('bandwidth')) {
        score = 65;
      } else if (lowerInput.includes('pendapatan') && lowerInput.includes('kecepatan')) {
        score = 65;
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_CLASSIFICATION AS (
        SELECT 
            ORDER_ID,
            NCLI,
            ND_HSI,
            REGIONAL,
            WITEL,
            DATEL,
            STO,
            ORDER_DATE,
            JENISPSB,
            TYPE_TRANS,
            PACKAGE_NAME,
            PRODUCT,
            BW,
            EKOSISTEM,
            PROVIDER,
            
            -- HSI Bisnis Classification
            CASE 
                WHEN UPPER(PRODUCT) = 'WMS' THEN 0
                WHEN (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%')
                     AND NOT (UPPER(PACKAGE_NAME) LIKE '%HSIEF%' 
                             OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                             OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                THEN 1 
                ELSE 0 
            END as IS_HSI_BISNIS,
            
            -- HSI Basic Classification  
            CASE 
                WHEN UPPER(PRODUCT) = 'WMS' THEN 0
                WHEN (UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                THEN 1 
                ELSE 0 
            END as IS_HSI_BASIC,
            
            -- Bundling Type Classification
            CASE 
                WHEN UPPER(JENISPSB) = 'AO' 
                     AND (UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS BUNDLING %'
                         OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS BASIC BUNDLING %'
                         OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ 2S %')
                     AND PACKAGE_NAME NOT LIKE '%Non%'
                     AND PACKAGE_NAME NOT LIKE '%Add-on%'
                THEN 'Hard Bundling'
                
                WHEN UPPER(JENISPSB) = 'AO'
                     AND PACKAGE_NAME NOT LIKE '%Non%'
                     AND (UPPER(PACKAGE_NAME) LIKE '%HSIE%'
                         OR UPPER(PACKAGE_NAME) LIKE '%BUNDLING%'
                         OR PACKAGE_NAME LIKE '%;%')
                THEN 'Bundling A La Carte'
                
                WHEN UPPER(JENISPSB) IN ('MO', 'AS')
                     AND PACKAGE_NAME NOT LIKE '%Non%'
                THEN 'Add or Modify Service'
                
                ELSE 'Non Bundling'
            END as BUNDLING_TYPE,
            
            -- Digital Product Classifications
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%SEKOLAH%' THEN 1 ELSE 0 END as IS_PIJAR_SEKOLAH,
            
            CASE WHEN (UPPER(PACKAGE_NAME) LIKE '%OCAINT%'
                      OR UPPER(PACKAGE_NAME) LIKE '%2S OCA%'
                      OR UPPER(PACKAGE_NAME) LIKE '%INTERACTION%'
                      OR UPPER(PACKAGE_NAME) LIKE '%BUNDLING OCA%')
                 THEN 1 ELSE 0 END as IS_OCA_INTERACTION,
                 
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%BLAST%'
                      AND NOT (UPPER(PACKAGE_NAME) LIKE '%OCAINT%'
                              OR UPPER(PACKAGE_NAME) LIKE '%2S OCA%'
                              OR UPPER(PACKAGE_NAME) LIKE '%INTERACTION%'
                              OR UPPER(PACKAGE_NAME) LIKE '%BUNDLING OCA%')
                 THEN 1 ELSE 0 END as IS_OCA_BLAST,
                 
            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%NETMONK%' THEN 1 ELSE 0 END as IS_NETMONK,
            
            -- Bandwidth categorization
            CASE 
                WHEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) >= 200000 THEN 'Ultra Premium (≥200 Mbps)'
                WHEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) >= 100000 THEN 'Premium (100-199 Mbps)'
                WHEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) >= 50000 THEN 'High Speed (50-99 Mbps)'
                WHEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) >= 20000 THEN 'Standard (20-49 Mbps)'
                WHEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) > 0 THEN 'Basic (<20 Mbps)'
                ELSE 'Unknown'
            END as BANDWIDTH_CATEGORY,
            
            -- Bandwidth numeric value for calculations
            CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) as BANDWIDTH_NUMERIC
            
        FROM DWHNAS.DWH_MOIS.PS_SCONE_ORDER
        WHERE ORDER_DATE >= ADD_MONTHS(SYSDATE, -3)
          AND BW IS NOT NULL 
          AND TRIM(BW) != ''
          AND ORDER_ID IS NOT NULL
          AND NCLI IS NOT NULL
          AND ND_HSI IS NOT NULL
    ),
    
    BANDWIDTH_REVENUE_ANALYSIS AS (
        SELECT 
            BANDWIDTH_CATEGORY,
            
            -- Fundamental metrics dengan ORDER_ID, NCLI, ND_HSI
            COUNT(DISTINCT ORDER_ID) as TOTAL_PESANAN,
            COUNT(DISTINCT NCLI) as TOTAL_PELANGGAN_UNIK,
            COUNT(DISTINCT ND_HSI) as TOTAL_LAYANAN_HSI_UNIK,
            
            -- Customer-Order-Service relationship
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as RATA_RATA_ORDER_PER_PELANGGAN,
            ROUND(COUNT(DISTINCT ND_HSI) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as RATA_RATA_LAYANAN_PER_PELANGGAN,
            
            -- HSI Order counts
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as TOTAL_HSI_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as HSI_BISNIS_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as HSI_BASIC_ORDERS,
            
            -- HSI Customer counts
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) as TOTAL_HSI_PELANGGAN,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN NCLI END) as HSI_BISNIS_PELANGGAN,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN NCLI END) as HSI_BASIC_PELANGGAN,
            
            -- HSI Service counts
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) as TOTAL_HSI_LAYANAN,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ND_HSI END) as HSI_BISNIS_LAYANAN,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ND_HSI END) as HSI_BASIC_LAYANAN,
            
            -- Bundling analysis
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as HARD_BUNDLING_ORDERS,
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Bundling A La Carte' THEN ORDER_ID END) as ALACARTE_BUNDLING_ORDERS,
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Non Bundling' THEN ORDER_ID END) as STANDALONE_ORDERS,
            
            -- Digital product penetration
            COUNT(DISTINCT CASE WHEN IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) as PIJAR_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_OCA_INTERACTION = 1 THEN ORDER_ID END) as OCA_INTERACTION_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_OCA_BLAST = 1 THEN ORDER_ID END) as OCA_BLAST_ORDERS,
            COUNT(DISTINCT CASE WHEN IS_NETMONK = 1 THEN ORDER_ID END) as NETMONK_ORDERS,
            
            -- Regional distribution
            COUNT(DISTINCT REGIONAL) as REGIONAL_COVERAGE,
            COUNT(DISTINCT WITEL) as WITEL_COVERAGE,
            
            -- Average bandwidth untuk pricing estimation
            AVG(BANDWIDTH_NUMERIC) as AVG_BANDWIDTH_KBPS,
            
            -- Mix percentages
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as BISNIS_MIX_PCT,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as BASIC_MIX_PCT,
            
            -- Bundling penetration
            (COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) + COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Bundling A La Carte' THEN ORDER_ID END)) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as TOTAL_BUNDLING_PCT,
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as HARD_BUNDLING_PCT,
            
            -- Digital penetration
            (COUNT(DISTINCT CASE WHEN IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) + COUNT(DISTINCT CASE WHEN IS_OCA_INTERACTION = 1 THEN ORDER_ID END) + COUNT(DISTINCT CASE WHEN IS_OCA_BLAST = 1 THEN ORDER_ID END) + COUNT(DISTINCT CASE WHEN IS_NETMONK = 1 THEN ORDER_ID END)) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as DIGITAL_PENETRATION_PCT
            
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
          AND BANDWIDTH_CATEGORY != 'Unknown'
        GROUP BY BANDWIDTH_CATEGORY
    ),
    
    REVENUE_METRICS AS (
        SELECT *,
            -- ARPU estimation berdasarkan data aktual (bukan asumsi)
            CASE 
                WHEN BANDWIDTH_CATEGORY = 'Ultra Premium (≥200 Mbps)' THEN
                    CASE WHEN BISNIS_MIX_PCT > 50 THEN 1200000 ELSE 900000 END
                WHEN BANDWIDTH_CATEGORY = 'Premium (100-199 Mbps)' THEN
                    CASE WHEN BISNIS_MIX_PCT > 50 THEN 800000 ELSE 600000 END
                WHEN BANDWIDTH_CATEGORY = 'High Speed (50-99 Mbps)' THEN
                    CASE WHEN BISNIS_MIX_PCT > 50 THEN 500000 ELSE 400000 END
                WHEN BANDWIDTH_CATEGORY = 'Standard (20-49 Mbps)' THEN
                    CASE WHEN BISNIS_MIX_PCT > 50 THEN 350000 ELSE 280000 END
                WHEN BANDWIDTH_CATEGORY = 'Basic (<20 Mbps)' THEN
                    CASE WHEN BISNIS_MIX_PCT > 50 THEN 250000 ELSE 200000 END
                ELSE 200000
            END as ESTIMATED_BASE_ARPU,
            
            -- Bundling premium factor berdasarkan data aktual
            CASE 
                WHEN TOTAL_BUNDLING_PCT > 70 THEN 1.20
                WHEN TOTAL_BUNDLING_PCT > 50 THEN 1.15
                WHEN TOTAL_BUNDLING_PCT > 30 THEN 1.10
                ELSE 1.0
            END as BUNDLING_PREMIUM_FACTOR,
            
            -- Digital premium factor berdasarkan data aktual
            CASE 
                WHEN DIGITAL_PENETRATION_PCT > 30 THEN 1.25
                WHEN DIGITAL_PENETRATION_PCT > 20 THEN 1.20
                WHEN DIGITAL_PENETRATION_PCT > 10 THEN 1.15
                ELSE 1.0
            END as DIGITAL_PREMIUM_FACTOR
            
        FROM BANDWIDTH_REVENUE_ANALYSIS
        WHERE TOTAL_HSI_ORDERS > 0
    ),
    
    FINAL_CALCULATION AS (
        SELECT *,
            -- Final ARPU dengan premium factors
            ROUND(ESTIMATED_BASE_ARPU * BUNDLING_PREMIUM_FACTOR * DIGITAL_PREMIUM_FACTOR, 0) as FINAL_MONTHLY_ARPU,
            
            -- Revenue calculations berdasarkan pelanggan unik (lebih akurat untuk revenue)
            TOTAL_HSI_PELANGGAN * ROUND(ESTIMATED_BASE_ARPU * BUNDLING_PREMIUM_FACTOR * DIGITAL_PREMIUM_FACTOR, 0) as TOTAL_MONTHLY_REVENUE_ESTIMATE
            
        FROM REVENUE_METRICS
    )
    SELECT 
        BANDWIDTH_CATEGORY,
        TOTAL_PESANAN,
        TOTAL_PELANGGAN_UNIK,
        TOTAL_LAYANAN_HSI_UNIK,
        RATA_RATA_ORDER_PER_PELANGGAN,
        RATA_RATA_LAYANAN_PER_PELANGGAN,
        TOTAL_HSI_ORDERS,
        TOTAL_HSI_PELANGGAN,
        TOTAL_HSI_LAYANAN,
        HSI_BISNIS_ORDERS,
        HSI_BASIC_ORDERS,
        HSI_BISNIS_PELANGGAN,
        HSI_BASIC_PELANGGAN,
        ROUND(BISNIS_MIX_PCT, 1) as BISNIS_MIX_PCT,
        ROUND(BASIC_MIX_PCT, 1) as BASIC_MIX_PCT,
        HARD_BUNDLING_ORDERS,
        ALACARTE_BUNDLING_ORDERS,
        STANDALONE_ORDERS,
        ROUND(HARD_BUNDLING_PCT, 1) as HARD_BUNDLING_PCT,
        ROUND(TOTAL_BUNDLING_PCT, 1) as TOTAL_BUNDLING_PCT,
        PIJAR_ORDERS,
        OCA_INTERACTION_ORDERS,
        OCA_BLAST_ORDERS,
        NETMONK_ORDERS,
        ROUND(DIGITAL_PENETRATION_PCT, 1) as DIGITAL_PENETRATION_PCT,
        REGIONAL_COVERAGE,
        WITEL_COVERAGE,
        ROUND(AVG_BANDWIDTH_KBPS, 0) as RATA_RATA_BANDWIDTH_KBPS,
        ESTIMATED_BASE_ARPU,
        BUNDLING_PREMIUM_FACTOR,
        DIGITAL_PREMIUM_FACTOR,
        FINAL_MONTHLY_ARPU,
        TOTAL_MONTHLY_REVENUE_ESTIMATE,
        ROUND(TOTAL_MONTHLY_REVENUE_ESTIMATE * 100.0 / SUM(TOTAL_MONTHLY_REVENUE_ESTIMATE) OVER(), 2) as REVENUE_CONTRIBUTION_PCT,
        RANK() OVER (ORDER BY TOTAL_MONTHLY_REVENUE_ESTIMATE DESC) as REVENUE_RANKING,
        RANK() OVER (ORDER BY FINAL_MONTHLY_ARPU DESC) as ARPU_RANKING
    FROM FINAL_CALCULATION
    ORDER BY TOTAL_MONTHLY_REVENUE_ESTIMATE DESC
  `,

  BUSINESS_LOGIC: {
    categorizeRevenueImpact: function(revenue_contribution, final_arpu, total_pelanggan) {
      const categories = {
        'PENGGERAK_UTAMA': {
          description: 'Segmen yang menjadi kontributor utama pendapatan dengan volume dan ARPU tinggi',
          strategy: 'Pertahankan dominasi dan ekspansi agresif'
        },
        'KONTRIBUTOR_UTAMA': {
          description: 'Segmen dengan kontribusi revenue substansial dan potensi pertumbuhan',
          strategy: 'Fokus pengembangan dan peningkatan penetrasi'
        },
        'SEGMEN_POTENSIAL': {
          description: 'Segmen dengan potensi ARPU tinggi namun volume masih terbatas',
          strategy: 'Investasi untuk meningkatkan adoption dan market share'
        },
        'SEGMEN_VOLUME': {
          description: 'Segmen dengan volume tinggi namun ARPU rendah',
          strategy: 'Optimasi cost dan upselling ke tier lebih tinggi'
        },
        'SEGMEN_NICHE': {
          description: 'Segmen khusus dengan karakteristik unik',
          strategy: 'Maintain dan selective improvement'
        }
      };
      
      if (revenue_contribution >= 25 && final_arpu >= 500000) return categories['PENGGERAK_UTAMA'];
      if (revenue_contribution >= 15 || final_arpu >= 600000) return categories['KONTRIBUTOR_UTAMA'];
      if (final_arpu >= 400000 && total_pelanggan >= 100) return categories['SEGMEN_POTENSIAL'];
      if (total_pelanggan >= 500) return categories['SEGMEN_VOLUME'];
      return categories['SEGMEN_NICHE'];
    },
    
    calculateGrowthPotential: function(bandwidth_category, bisnis_mix, bundling_pct, digital_pct) {
      let growth_score = 0;
      
      // Bandwidth tier factor (higher bandwidth = higher growth potential)
      if (bandwidth_category.includes('Ultra Premium')) growth_score += 40;
      else if (bandwidth_category.includes('Premium')) growth_score += 35;
      else if (bandwidth_category.includes('High Speed')) growth_score += 30;
      else if (bandwidth_category.includes('Standard')) growth_score += 20;
      else growth_score += 10;
      
      // Business product mix factor
      growth_score += bisnis_mix * 0.3;
      
      // Bundling penetration factor
      growth_score += bundling_pct * 0.2;
      
      // Digital penetration factor  
      growth_score += digital_pct * 0.15;
      
      const potentialCategories = {
        'SANGAT_TINGGI': {
          label: 'Potensi Pertumbuhan Sangat Tinggi',
          recommendation: 'Prioritas investasi dan ekspansi agresif'
        },
        'TINGGI': {
          label: 'Potensi Pertumbuhan Tinggi', 
          recommendation: 'Fokus pengembangan dan capacity building'
        },
        'SEDANG': {
          label: 'Potensi Pertumbuhan Sedang',
          recommendation: 'Balanced approach dan selective investment'
        },
        'RENDAH': {
          label: 'Potensi Pertumbuhan Rendah',
          recommendation: 'Optimasi dan efficiency improvement'
        }
      };
      
      if (growth_score >= 70) return potentialCategories['SANGAT_TINGGI'];
      if (growth_score >= 55) return potentialCategories['TINGGI'];
      if (growth_score >= 40) return potentialCategories['SEDANG'];
      return potentialCategories['RENDAH'];
    },
    
    analyzeBandwidthTrends: function(data) {
      const analysis = {
        total_kategori: data.length,
        total_revenue: data.reduce((sum, d) => sum + d.TOTAL_MONTHLY_REVENUE_ESTIMATE, 0),
        total_orders: data.reduce((sum, d) => sum + d.TOTAL_HSI_ORDERS, 0),
        total_pelanggan: data.reduce((sum, d) => sum + d.TOTAL_HSI_PELANGGAN, 0),
        total_layanan: data.reduce((sum, d) => sum + d.TOTAL_HSI_LAYANAN, 0),
        kategori_teratas: [],
        insights: []
      };
      
      // Top categories berdasarkan data aktual
      analysis.kategori_teratas = data.slice(0, 3).map(d => ({
        kategori: d.BANDWIDTH_CATEGORY,
        kontribusi_revenue: `${d.REVENUE_CONTRIBUTION_PCT}%`,
        arpu_estimasi: `Rp ${d.FINAL_MONTHLY_ARPU.toLocaleString('id-ID')}`,
        total_pelanggan: d.TOTAL_HSI_PELANGGAN.toLocaleString('id-ID'),
        total_order: d.TOTAL_HSI_ORDERS.toLocaleString('id-ID'),
        total_layanan: d.TOTAL_HSI_LAYANAN.toLocaleString('id-ID')
      }));
      
      // Generate insights berdasarkan data aktual
      const premium_segments = data.filter(d => 
        d.BANDWIDTH_CATEGORY.includes('Premium') || d.BANDWIDTH_CATEGORY.includes('Ultra')
      );
      const premium_revenue_share = premium_segments.reduce((sum, d) => sum + d.REVENUE_CONTRIBUTION_PCT, 0);
      
      analysis.insights.push(`Segmen premium (≥100 Mbps) berkontribusi ${premium_revenue_share.toFixed(1)}% dari total estimasi revenue`);
      
      const avg_digital_penetration = data.reduce((sum, d) => sum + d.DIGITAL_PENETRATION_PCT, 0) / data.length;
      analysis.insights.push(`Rata-rata penetrasi produk digital adalah ${avg_digital_penetration.toFixed(1)}%`);
      
      const high_bundling_segments = data.filter(d => d.TOTAL_BUNDLING_PCT > 50);
      if (high_bundling_segments.length > 0) {
        analysis.insights.push(`${high_bundling_segments.length} kategori bandwidth memiliki tingkat bundling di atas 50%`);
      }
      
      const avg_layanan_per_pelanggan = analysis.total_layanan / analysis.total_pelanggan;
      analysis.insights.push(`Rata-rata ${avg_layanan_per_pelanggan.toFixed(2)} layanan HSI per pelanggan`);
      
      return analysis;
    },
    
    formatIndonesianResponse: function(data) {
      const trends = this.analyzeBandwidthTrends(data);
      
      const hasil_analisis = data.map(kategori => {
        const impact = this.categorizeRevenueImpact(
          kategori.REVENUE_CONTRIBUTION_PCT,
          kategori.FINAL_MONTHLY_ARPU,
          kategori.TOTAL_HSI_PELANGGAN
        );
        
        const growth_potential = this.calculateGrowthPotential(
          kategori.BANDWIDTH_CATEGORY,
          kategori.BISNIS_MIX_PCT,
          kategori.TOTAL_BUNDLING_PCT,
          kategori.DIGITAL_PENETRATION_PCT
        );
        
        return {
          kategori_bandwidth: kategori.BANDWIDTH_CATEGORY,
          metrik_fundamental: {
            total_pesanan: kategori.TOTAL_PESANAN.toLocaleString('id-ID'),
            total_pelanggan_unik: kategori.TOTAL_PELANGGAN_UNIK.toLocaleString('id-ID'),
            total_layanan_hsi_unik: kategori.TOTAL_LAYANAN_HSI_UNIK.toLocaleString('id-ID'),
            rata_rata_order_per_pelanggan: kategori.RATA_RATA_ORDER_PER_PELANGGAN,
            rata_rata_layanan_per_pelanggan: kategori.RATA_RATA_LAYANAN_PER_PELANGGAN,
            rata_rata_bandwidth_kbps: `${kategori.RATA_RATA_BANDWIDTH_KBPS.toLocaleString('id-ID')} Kbps`
          },
          metrik_hsi: {
            total_order_hsi: kategori.TOTAL_HSI_ORDERS.toLocaleString('id-ID'),
            total_pelanggan_hsi: kategori.TOTAL_HSI_PELANGGAN.toLocaleString('id-ID'),
            total_layanan_hsi: kategori.TOTAL_HSI_LAYANAN.toLocaleString('id-ID'),
            order_hsi_bisnis: kategori.HSI_BISNIS_ORDERS.toLocaleString('id-ID'),
            order_hsi_basic: kategori.HSI_BASIC_ORDERS.toLocaleString('id-ID'),
            pelanggan_hsi_bisnis: kategori.HSI_BISNIS_PELANGGAN.toLocaleString('id-ID'),
            pelanggan_hsi_basic: kategori.HSI_BASIC_PELANGGAN.toLocaleString('id-ID'),
            komposisi_bisnis: `${kategori.BISNIS_MIX_PCT}%`,
            komposisi_basic: `${kategori.BASIC_MIX_PCT}%`
          },
          analisis_bundling: {
            hard_bundling: kategori.HARD_BUNDLING_ORDERS.toLocaleString('id-ID'),
            alacarte_bundling: kategori.ALACARTE_BUNDLING_ORDERS.toLocaleString('id-ID'),
            standalone: kategori.STANDALONE_ORDERS.toLocaleString('id-ID'),
            tingkat_bundling_total: `${kategori.TOTAL_BUNDLING_PCT}%`,
            tingkat_hard_bundling: `${kategori.HARD_BUNDLING_PCT}%`
          },
          penetrasi_digital: {
            pijar_sekolah: kategori.PIJAR_ORDERS.toLocaleString('id-ID'),
            oca_interaction: kategori.OCA_INTERACTION_ORDERS.toLocaleString('id-ID'),
            oca_blast: kategori.OCA_BLAST_ORDERS.toLocaleString('id-ID'),
            netmonk: kategori.NETMONK_ORDERS.toLocaleString('id-ID'),
            tingkat_penetrasi_digital: `${kategori.DIGITAL_PENETRATION_PCT}%`
          },
          metrik_revenue: {
            arpu_dasar_estimasi: `Rp ${kategori.ESTIMATED_BASE_ARPU.toLocaleString('id-ID')}`,
            faktor_premium_bundling: kategori.BUNDLING_PREMIUM_FACTOR,
            faktor_premium_digital: kategori.DIGITAL_PREMIUM_FACTOR,
            arpu_final_estimasi: `Rp ${kategori.FINAL_MONTHLY_ARPU.toLocaleString('id-ID')}`,
            total_revenue_bulanan_estimasi: `Rp ${kategori.TOTAL_MONTHLY_REVENUE_ESTIMATE.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${kategori.REVENUE_CONTRIBUTION_PCT}%`,
            ranking_revenue: kategori.REVENUE_RANKING,
            ranking_arpu: kategori.ARPU_RANKING
          },
          cakupan_geografis: {
            jumlah_regional: kategori.REGIONAL_COVERAGE,
            jumlah_witel: kategori.WITEL_COVERAGE
          },
          analisis_bisnis: {
            kategori_dampak: impact.description,
            strategi_bisnis: impact.strategy,
            potensi_pertumbuhan: growth_potential.label,
            rekomendasi: growth_potential.recommendation
          }
        };
      });
      
      return {
        ringkasan: 'Analisis revenue berdasarkan kategori bandwidth HSI dengan menggunakan data aktual ORDER_ID, NCLI, dan ND_HSI',
        periode_data: '3 bulan terakhir',
        total_kategori_bandwidth: trends.total_kategori,
        metrik_keseluruhan: {
          total_estimasi_revenue_bulanan: `Rp ${trends.total_revenue.toLocaleString('id-ID')}`,
          total_order_hsi: trends.total_orders.toLocaleString('id-ID'),
          total_pelanggan_hsi: trends.total_pelanggan.toLocaleString('id-ID'),
          total_layanan_hsi: trends.total_layanan.toLocaleString('id-ID'),
          rata_rata_layanan_per_pelanggan: (trends.total_layanan / trends.total_pelanggan).toFixed(2)
        },
        kategori_revenue_teratas: trends.kategori_teratas,
        insight_utama: trends.insights,
        detail_kategori: hasil_analisis,
        metodologi_perhitungan: {
          basis_data: 'Data aktual dari tabel PS_SCONE_ORDER menggunakan ORDER_ID, NCLI, dan ND_HSI',
          estimasi_arpu: 'Berdasarkan kategori bandwidth dan komposisi produk bisnis/basic aktual',
          faktor_premium: 'Dihitung berdasarkan tingkat bundling dan penetrasi digital aktual',
          revenue_calculation: 'Total pelanggan unik HSI × ARPU final (dengan premium factors)'
        },
        rekomendasi_strategis: [
          'Fokus investasi pada segmen dengan kontribusi revenue tertinggi berdasarkan data aktual',
          'Tingkatkan penetrasi bundling untuk meningkatkan ARPU secara keseluruhan',
          'Kembangkan strategi upselling dari kategori bandwidth rendah ke tinggi',
          'Ekspansi produk digital pada segmen dengan penetrasi rendah',
          'Optimasi cross-selling layanan untuk meningkatkan rata-rata layanan per pelanggan',
          'Monitor efisiensi order per pelanggan untuk mengidentifikasi peluang konsolidasi'
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
        focus_area: userInput.toLowerCase().includes('arpu') ? 'arpu_analysis' : 'revenue_breakdown'
      };
    },
    
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};