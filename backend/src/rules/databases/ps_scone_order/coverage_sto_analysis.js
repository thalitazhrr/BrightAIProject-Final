const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_005',
    RULE_NAME: 'coverage_sto_analysis',
    DESCRIPTION: 'Analisis coverage dan performa STO untuk HSI dengan klasifikasi produk yang tepat',
    DATABASE: 'PS_SCONE_ORDER',
    CATEGORY: 'sto_analytics',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'MEDIUM',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("PS_SCONE_ORDER"),

  KEYWORD_PATTERNS: {
    primary: [
      // STO analysis - yang biasa digunakan
      'performa sto', 'kinerja sto', 'analisis sto', 'coverage sto',
      'cakupan sto', 'efisiensi sto', 'produktivitas sto',

      // Performance terms familiar
      'tingkat keberhasilan', 'success rate', 'penetrasi hsi',
      'distribusi order', 'ranking sto', 'evaluasi sto'
    ],

    supporting: [
      // Geographic familiar terms
      'wilayah', 'area', 'regional', 'witel', 'datel', 'cabang',

      // HSI familiar terms
      'internet', 'broadband', 'fiber', 'indihome', 'wifi',

      // Performance indicators
      'tingkat', 'persentase', 'rata-rata', 'total', 'jumlah'
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
        score = 60 + (primaryMatches * 20) + (supportingMatches * 5);
      }

      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_CLASSIFICATION AS (
        SELECT 
            ORDER_ID,  -- ADDED: Identifier untuk setiap transaksi order
            NCLI,      -- ADDED: Identifier untuk pelanggan
            ND_HSI,    -- ADDED: Identifier untuk layanan HSI
            STO,
            DATEL,
            WITEL,
            REGIONAL,
            ORDER_DATE,
            TGL_PS,
            STATUS_RESUME,
            JENISPSB,
            PACKAGE_NAME,
            PRODUCT,
            BW,
            
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

            CASE WHEN UPPER(PACKAGE_NAME) LIKE '%NETMONK%' THEN 1 ELSE 0 END as IS_NETMONK

        FROM DWHNAS.DWH_MOIS.PS_SCONE_ORDER  -- CORRECTED: Added full table name
        WHERE ORDER_DATE >= ADD_MONTHS(SYSDATE, -3)
          AND STO IS NOT NULL
          AND TRIM(STO) != ''
          AND ORDER_ID IS NOT NULL  -- ADDED: Pastikan ada order ID
          AND NCLI IS NOT NULL       -- ADDED: Pastikan ada customer identifier
          AND ND_HSI IS NOT NULL     -- ADDED: Pastikan ada HSI service identifier
    ),

    STO_PERFORMANCE AS (
        SELECT
            STO,
            DATEL,
            WITEL,
            REGIONAL,

            -- ADDED: Fundamental metrics berdasarkan ketiga identifier
            COUNT(DISTINCT ORDER_ID) as total_orders,
            COUNT(DISTINCT NCLI) as total_customers,
            COUNT(DISTINCT ND_HSI) as total_hsi_services,
            
            -- ADDED: Customer-Order-Service relationship metrics
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as avg_orders_per_customer,
            ROUND(COUNT(DISTINCT ND_HSI) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as avg_services_per_customer,
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT ND_HSI), 0), 2) as avg_orders_per_service,

            -- HSI Order counts (refined with ND_HSI consideration)
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as total_hsi_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as hsi_bisnis_orders,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as hsi_basic_orders,
            
            -- ADDED: HSI Service counts berdasarkan ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) as total_hsi_services_active,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ND_HSI END) as hsi_bisnis_services,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ND_HSI END) as hsi_basic_services,
            
            -- ADDED: HSI Customer counts berdasarkan NCLI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) as total_hsi_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN NCLI END) as hsi_bisnis_customers,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN NCLI END) as hsi_basic_customers,

            -- Penetration rates (multi-dimensional)
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as hsi_order_penetration,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) * 100.0 / COUNT(DISTINCT NCLI) as hsi_customer_penetration,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) * 100.0 / COUNT(DISTINCT ND_HSI) as hsi_service_penetration,
            
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as hsi_bisnis_penetration,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as hsi_basic_penetration,

            -- Success rate calculation
            COUNT(DISTINCT CASE WHEN STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)')
                               AND (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) * 100.0 /
            NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as hsi_success_rate,

            -- Bundling performance
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) * 100.0 /
            NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as hard_bundling_rate,

            -- Digital product performance
            COUNT(DISTINCT CASE WHEN IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) * 100.0 /
            NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as pijar_penetration,

            COUNT(DISTINCT CASE WHEN IS_OCA_INTERACTION = 1 THEN ORDER_ID END) * 100.0 /
            NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as oca_int_penetration,

            -- Installation time
            AVG(CASE WHEN TGL_PS IS NOT NULL AND ORDER_DATE IS NOT NULL
                     AND (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
                THEN TGL_PS - ORDER_DATE END) as avg_install_days,

            -- Bandwidth analysis
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
                     AND CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) > 0
                THEN CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER) END) as avg_bandwidth

        FROM HSI_CLASSIFICATION
        GROUP BY STO, DATEL, WITEL, REGIONAL
        HAVING COUNT(DISTINCT ORDER_ID) >= 3 -- Minimal 3 order untuk analisis yang meaningful
    ),

    STO_RANKING AS (
        SELECT *,
            -- ADDED: Service efficiency metrics
            CASE 
                WHEN avg_orders_per_service >= 2.0 THEN 'EFISIENSI_TINGGI'
                WHEN avg_orders_per_service >= 1.5 THEN 'EFISIENSI_BAIK'
                WHEN avg_orders_per_service >= 1.2 THEN 'EFISIENSI_CUKUP'
                ELSE 'EFISIENSI_RENDAH'
            END as kategori_efisiensi_layanan,
            
            -- ADDED: Customer value categorization
            CASE 
                WHEN avg_services_per_customer >= 1.5 THEN 'CUSTOMER_VALUE_TINGGI'
                WHEN avg_services_per_customer >= 1.2 THEN 'CUSTOMER_VALUE_BAIK'
                ELSE 'CUSTOMER_VALUE_STANDAR'
            END as kategori_nilai_customer,
            
            -- Performance category (enhanced with customer metrics)
            CASE
                WHEN hsi_order_penetration >= 70 AND hsi_success_rate >= 85 AND hsi_customer_penetration >= 60 THEN 'SANGAT_BAIK'
                WHEN hsi_order_penetration >= 50 AND hsi_success_rate >= 75 AND hsi_customer_penetration >= 40 THEN 'BAIK'
                WHEN hsi_order_penetration >= 30 AND hsi_success_rate >= 65 AND hsi_customer_penetration >= 25 THEN 'CUKUP'
                ELSE 'PERLU_PERBAIKAN'
            END as kategori_performa,

            -- Rankings berdasarkan order volume
            RANK() OVER (PARTITION BY REGIONAL ORDER BY total_hsi_orders DESC) as ranking_regional,
            RANK() OVER (PARTITION BY WITEL ORDER BY total_hsi_orders DESC) as ranking_witel,
            RANK() OVER (ORDER BY total_hsi_orders DESC) as ranking_nasional,
            
            -- ADDED: Rankings berdasarkan customer dan service metrics
            RANK() OVER (PARTITION BY REGIONAL ORDER BY total_hsi_customers DESC) as ranking_customer_regional,
            RANK() OVER (PARTITION BY WITEL ORDER BY total_hsi_customers DESC) as ranking_customer_witel,
            RANK() OVER (ORDER BY avg_orders_per_service DESC) as ranking_efisiensi_nasional,

            -- Enhanced efficiency score dengan customer-service relationship
            ROUND(
                (hsi_order_penetration * 0.25) +
                (hsi_customer_penetration * 0.25) +
                (hsi_success_rate * 0.25) +
                (CASE WHEN avg_install_days <= 14 THEN 25 ELSE GREATEST(0, 25 - (avg_install_days - 14)) END * 0.15) +
                (CASE WHEN avg_orders_per_service >= 1.5 THEN 10 ELSE avg_orders_per_service * 6.67 END * 0.1)
            , 1) as skor_efisiensi

        FROM STO_PERFORMANCE
    )
    SELECT * FROM STO_RANKING
    ORDER BY REGIONAL, WITEL, total_hsi_orders DESC
  `,

  BUSINESS_LOGIC: {
    assessSTOPerformance: function(order_penetration, customer_penetration, success_rate, install_days, efficiency_score, avg_orders_per_service, avg_services_per_customer) {
      const assessment = {
        kategori: '',
        skor: Math.round(efficiency_score),
        rekomendasi: [],
        prioritas: '',
        strengths: [],
        areas_for_improvement: []
      };

      if (efficiency_score >= 80) {
        assessment.kategori = 'SANGAT_BAIK';
        assessment.rekomendasi.push('Pertahankan standar tinggi yang sudah dicapai');
        assessment.rekomendasi.push('Jadikan benchmark untuk STO lain');
        assessment.prioritas = 'MAINTAIN_EXCELLENCE';
        assessment.strengths.push('Performa operasional excellent');
      } else if (efficiency_score >= 65) {
        assessment.kategori = 'BAIK';
        assessment.rekomendasi.push('Optimasi lebih lanjut untuk mencapai level sangat baik');
        assessment.prioritas = 'OPTIMIZE';
      } else if (efficiency_score >= 50) {
        assessment.kategori = 'CUKUP';
        assessment.rekomendasi.push('Fokus perbaikan pada area dengan performa rendah');
        assessment.prioritas = 'IMPROVE';
      } else {
        assessment.kategori = 'PERLU_PERBAIKAN';
        assessment.rekomendasi.push('Evaluasi menyeluruh proses operasional');
        assessment.rekomendasi.push('Tingkatkan kapasitas dan kualitas layanan');
        assessment.prioritas = 'URGENT_IMPROVEMENT';
      }

      // ADDED: Service efficiency assessment
      if (avg_orders_per_service >= 2.0) {
        assessment.strengths.push('Efisiensi layanan tinggi - setiap layanan HSI sangat aktif digunakan');
      } else if (avg_orders_per_service < 1.2) {
        assessment.areas_for_improvement.push('Efisiensi layanan rendah - potensi konsolidasi atau optimisasi');
        assessment.rekomendasi.push('Evaluasi utilisasi layanan HSI dan pertimbangkan konsolidasi');
      }

      // ADDED: Customer value assessment
      if (avg_services_per_customer >= 1.5) {
        assessment.strengths.push('Customer value tinggi - multi-service adoption baik');
      } else if (avg_services_per_customer < 1.2) {
        assessment.areas_for_improvement.push('Peluang cross-selling - customer masih single-service focused');
        assessment.rekomendasi.push('Implementasi program cross-selling untuk meningkatkan services per customer');
      }

      // Specific recommendations based on metrics
      if (order_penetration < 40) {
        assessment.rekomendasi.push('Tingkatkan aktivitas marketing dan promosi HSI');
        assessment.areas_for_improvement.push('Penetrasi order HSI masih rendah');
      }
      
      if (customer_penetration < 30) {
        assessment.rekomendasi.push('Fokus akuisisi customer baru untuk HSI');
        assessment.areas_for_improvement.push('Penetrasi customer HSI perlu ditingkatkan');
      }
      
      if (success_rate < 70) {
        assessment.rekomendasi.push('Perbaiki proses instalasi dan troubleshooting');
        assessment.areas_for_improvement.push('Tingkat keberhasilan instalasi perlu diperbaiki');
      }
      
      if (install_days > 21) {
        assessment.rekomendasi.push('Optimasi jadwal dan koordinasi tim instalasi');
        assessment.areas_for_improvement.push('Waktu instalasi terlalu lama');
      }

      return assessment;
    },

    analyzeSTOTrends: function(data) {
      const analysis = {
        total_sto: data.length,
        distribusi_performa: {},
        distribusi_efisiensi_layanan: {},  // ADDED
        distribusi_nilai_customer: {},     // ADDED
        top_performers: [],
        bottom_performers: [],
        most_efficient_services: [],       // ADDED
        highest_customer_value: [],        // ADDED
        insights: []
      };

      // Performance distribution
      analysis.distribusi_performa = {
        sangat_baik: data.filter(d => d.kategori_performa === 'SANGAT_BAIK').length,
        baik: data.filter(d => d.kategori_performa === 'BAIK').length,
        cukup: data.filter(d => d.kategori_performa === 'CUKUP').length,
        perlu_perbaikan: data.filter(d => d.kategori_performa === 'PERLU_PERBAIKAN').length
      };
      
      // ADDED: Service efficiency distribution
      analysis.distribusi_efisiensi_layanan = {
        tinggi: data.filter(d => d.kategori_efisiensi_layanan === 'EFISIENSI_TINGGI').length,
        baik: data.filter(d => d.kategori_efisiensi_layanan === 'EFISIENSI_BAIK').length,
        cukup: data.filter(d => d.kategori_efisiensi_layanan === 'EFISIENSI_CUKUP').length,
        rendah: data.filter(d => d.kategori_efisiensi_layanan === 'EFISIENSI_RENDAH').length
      };
      
      // ADDED: Customer value distribution
      analysis.distribusi_nilai_customer = {
        tinggi: data.filter(d => d.kategori_nilai_customer === 'CUSTOMER_VALUE_TINGGI').length,
        baik: data.filter(d => d.kategori_nilai_customer === 'CUSTOMER_VALUE_BAIK').length,
        standar: data.filter(d => d.kategori_nilai_customer === 'CUSTOMER_VALUE_STANDAR').length
      };

      // Top and bottom performers
      analysis.top_performers = data
        .filter(d => d.kategori_performa === 'SANGAT_BAIK')
        .slice(0, 5)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          penetrasi_order_hsi: `${d.hsi_order_penetration.toFixed(1)}%`,
          penetrasi_customer_hsi: `${d.hsi_customer_penetration.toFixed(1)}%`,  // ADDED
          tingkat_keberhasilan: `${d.hsi_success_rate.toFixed(1)}%`,
          skor_efisiensi: d.skor_efisiensi
        }));

      analysis.bottom_performers = data
        .filter(d => d.kategori_performa === 'PERLU_PERBAIKAN')
        .slice(0, 5)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          penetrasi_order_hsi: `${d.hsi_order_penetration.toFixed(1)}%`,
          penetrasi_customer_hsi: `${d.hsi_customer_penetration.toFixed(1)}%`,  // ADDED
          tingkat_keberhasilan: `${d.hsi_success_rate.toFixed(1)}%`,
          skor_efisiensi: d.skor_efisiensi
        }));
        
      // ADDED: Most efficient services
      analysis.most_efficient_services = data
        .sort((a, b) => b.avg_orders_per_service - a.avg_orders_per_service)
        .slice(0, 5)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          efisiensi_layanan: `${d.avg_orders_per_service} order/layanan`,
          total_layanan_hsi: d.total_hsi_services_active,
          kategori: d.kategori_efisiensi_layanan
        }));
        
      // ADDED: Highest customer value
      analysis.highest_customer_value = data
        .sort((a, b) => b.avg_services_per_customer - a.avg_services_per_customer)
        .slice(0, 5)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          layanan_per_customer: `${d.avg_services_per_customer} layanan/customer`,
          total_customer_hsi: d.total_hsi_customers,
          kategori: d.kategori_nilai_customer
        }));

      // Generate insights
      const avg_order_penetration = data.reduce((sum, d) => sum + d.hsi_order_penetration, 0) / data.length;
      const avg_customer_penetration = data.reduce((sum, d) => sum + d.hsi_customer_penetration, 0) / data.length;
      const avg_success = data.reduce((sum, d) => sum + d.hsi_success_rate, 0) / data.length;
      const avg_efficiency = data.reduce((sum, d) => sum + d.avg_orders_per_service, 0) / data.length;

      analysis.insights.push(`Rata-rata penetrasi order HSI di seluruh STO adalah ${avg_order_penetration.toFixed(1)}%`);
      analysis.insights.push(`Rata-rata penetrasi customer HSI di seluruh STO adalah ${avg_customer_penetration.toFixed(1)}%`);
      analysis.insights.push(`Rata-rata tingkat keberhasilan instalasi adalah ${avg_success.toFixed(1)}%`);
      analysis.insights.push(`Rata-rata efisiensi layanan adalah ${avg_efficiency.toFixed(2)} order per layanan HSI`);

      if (analysis.distribusi_performa.perlu_perbaikan > analysis.distribusi_performa.sangat_baik) {
        analysis.insights.push('Lebih banyak STO yang memerlukan perbaikan dibanding yang berkinerja sangat baik');
      }
      
      if (analysis.distribusi_efisiensi_layanan.rendah > analysis.distribusi_efisiensi_layanan.tinggi) {
        analysis.insights.push('Mayoritas STO memiliki efisiensi layanan rendah - peluang optimisasi besar');
      }
      
      if (analysis.distribusi_nilai_customer.standar > (analysis.distribusi_nilai_customer.tinggi + analysis.distribusi_nilai_customer.baik)) {
        analysis.insights.push('Peluang besar untuk meningkatkan customer value melalui cross-selling');
      }

      return analysis;
    },

    formatIndonesianResponse: function(data) {
      const analysis = this.analyzeSTOTrends(data);

      const hasil_analisis = data.map(sto => {
        const assessment = this.assessSTOPerformance(
          sto.hsi_order_penetration,
          sto.hsi_customer_penetration,
          sto.hsi_success_rate,
          sto.avg_install_days,
          sto.skor_efisiensi,
          sto.avg_orders_per_service,
          sto.avg_services_per_customer
        );

        return {
          identitas_sto: {
            nama_sto: sto.STO,
            datel: sto.DATEL,
            witel: sto.WITEL,
            regional: sto.REGIONAL
          },
          
          metrik_volume: {
            total_order: sto.total_orders.toLocaleString('id-ID'),
            total_customer: sto.total_customers.toLocaleString('id-ID'),     // ADDED
            total_layanan_hsi: sto.total_hsi_services.toLocaleString('id-ID'), // ADDED
            order_hsi_total: sto.total_hsi_orders.toLocaleString('id-ID'),
            customer_hsi_total: sto.total_hsi_customers.toLocaleString('id-ID'), // ADDED
            layanan_hsi_aktif: sto.total_hsi_services_active.toLocaleString('id-ID') // ADDED
          },
          
          metrik_performa: {
            penetrasi_order_hsi: `${sto.hsi_order_penetration.toFixed(1)}%`,
            penetrasi_customer_hsi: `${sto.hsi_customer_penetration.toFixed(1)}%`, // ADDED
            penetrasi_layanan_hsi: `${sto.hsi_service_penetration.toFixed(1)}%`,   // ADDED
            tingkat_keberhasilan: `${sto.hsi_success_rate.toFixed(1)}%`,
            rata_rata_instalasi: `${(sto.avg_install_days || 0).toFixed(1)} hari`,
            rata_rata_bandwidth: `${Math.round(sto.avg_bandwidth || 0)} Kbps`
          },
          
          efisiensi_customer_service: {  // ADDED
            order_per_customer: sto.avg_orders_per_customer,
            layanan_per_customer: sto.avg_services_per_customer,
            order_per_layanan: sto.avg_orders_per_service,
            kategori_efisiensi_layanan: this.translateEfficiencyCategory(sto.kategori_efisiensi_layanan),
            kategori_nilai_customer: this.translateCustomerValueCategory(sto.kategori_nilai_customer)
          },
          
          breakdown_produk: {
            hsi_bisnis: {
              order: sto.hsi_bisnis_orders.toLocaleString('id-ID'),
              customer: sto.hsi_bisnis_customers.toLocaleString('id-ID'),  // ADDED
              layanan: sto.hsi_bisnis_services.toLocaleString('id-ID'),   // ADDED
              penetrasi: `${sto.hsi_bisnis_penetration.toFixed(1)}%`
            },
            hsi_basic: {
              order: sto.hsi_basic_orders.toLocaleString('id-ID'),
              customer: sto.hsi_basic_customers.toLocaleString('id-ID'),   // ADDED
              layanan: sto.hsi_basic_services.toLocaleString('id-ID'),    // ADDED
              penetrasi: `${sto.hsi_basic_penetration.toFixed(1)}%`
            }
          },
          
          analisis_bundling: {
            hard_bundling_rate: `${(sto.hard_bundling_rate || 0).toFixed(1)}%`,
            penetrasi_pijar: `${(sto.pijar_penetration || 0).toFixed(1)}%`,
            penetrasi_oca: `${(sto.oca_int_penetration || 0).toFixed(1)}%`
          },
          
          evaluasi_performa: {
            kategori: this.translatePerformanceCategory(assessment.kategori),
            skor_efisiensi: assessment.skor,
            ranking_order_regional: sto.ranking_regional,
            ranking_order_witel: sto.ranking_witel,
            ranking_order_nasional: sto.ranking_nasional,
            ranking_customer_regional: sto.ranking_customer_regional,  // ADDED
            ranking_customer_witel: sto.ranking_customer_witel,        // ADDED
            ranking_efisiensi_nasional: sto.ranking_efisiensi_nasional // ADDED
          },
          
          kekuatan: assessment.strengths,                    // ADDED
          area_perbaikan: assessment.areas_for_improvement,  // ADDED
          rekomendasi: assessment.rekomendasi
        };
      });

      return {
        ringkasan: 'Analisis Coverage dan Performa STO untuk Layanan HSI',
        periode_analisis: '3 bulan terakhir',
        total_sto_dianalisis: analysis.total_sto,
        
        distribusi_performa: {
          kategori_performa: analysis.distribusi_performa,
          kategori_efisiensi_layanan: analysis.distribusi_efisiensi_layanan,  // ADDED
          kategori_nilai_customer: analysis.distribusi_nilai_customer         // ADDED
        },
        
        sto_unggulan: {
          performa_terbaik: analysis.top_performers,
          efisiensi_layanan_tertinggi: analysis.most_efficient_services,      // ADDED
          nilai_customer_tertinggi: analysis.highest_customer_value           // ADDED
        },
        
        sto_perlu_perbaikan: analysis.bottom_performers,
        
        insight_utama: analysis.insights,
        
        analisis_mendalam: {
          gap_penetrasi: this.analyzeGaps(data),
          peluang_optimisasi: this.identifyOptimizationOpportunities(data),
          benchmarking: this.generateBenchmarks(data)
        },
        
        detail_sto: hasil_analisis.slice(0, 20), // Limit untuk performa
        
        rekomendasi_strategis: [
          'Fokus perbaikan pada STO dengan volume tinggi namun performa rendah',
          'Replikasi best practice dari STO berkinerja sangat baik',
          'Optimasi proses instalasi untuk mengurangi lead time',
          'Tingkatkan penetrasi produk digital pada STO potensial',
          'Implementasi program cross-selling untuk meningkatkan services per customer',  // ADDED
          'Evaluasi dan konsolidasi layanan HSI dengan efisiensi rendah'                  // ADDED
        ]
      };
    },
    
    // ADDED: New analysis functions
    analyzeGaps: function(data) {
      const gaps = [];
      
      // Order vs Customer penetration gap
      const order_customer_gap = data.filter(d => 
        Math.abs(d.hsi_order_penetration - d.hsi_customer_penetration) > 20
      );
      
      if (order_customer_gap.length > 0) {
        gaps.push({
          tipe: 'Gap Order-Customer Penetration',
          jumlah_sto: order_customer_gap.length,
          deskripsi: 'STO dengan perbedaan signifikan antara penetrasi order dan customer HSI',
          dampak: 'Indikasi potential customer churn atau loyalty issues'
        });
      }
      
      // Low efficiency high volume
      const low_efficiency_high_volume = data.filter(d => 
        d.total_hsi_orders > 100 && d.avg_orders_per_service < 1.2
      );
      
      if (low_efficiency_high_volume.length > 0) {
        gaps.push({
          tipe: 'Volume Tinggi Efisiensi Rendah',
          jumlah_sto: low_efficiency_high_volume.length,
          deskripsi: 'STO dengan volume order tinggi tapi efisiensi layanan rendah',
          dampak: 'Peluang besar untuk optimisasi operasional dan cost reduction'
        });
      }
      
      return gaps;
    },
    
    identifyOptimizationOpportunities: function(data) {
      const opportunities = [];
      
      // Cross-selling opportunities
      const single_service_customers = data.filter(d => 
        d.avg_services_per_customer < 1.2 && d.total_hsi_customers > 50
      );
      
      if (single_service_customers.length > 0) {
        opportunities.push({
          kategori: 'Cross-Selling',
          target: `${single_service_customers.length} STO`,
          potensi: 'Peningkatan ARPU 20-30% melalui additional services',
          prioritas: 'HIGH'
        });
      }
      
      // Service consolidation opportunities
      const low_utilization_services = data.filter(d => 
        d.avg_orders_per_service < 1.0 && d.total_hsi_services_active > 20
      );
      
      if (low_utilization_services.length > 0) {
        opportunities.push({
          kategori: 'Konsolidasi Layanan',
          target: `${low_utilization_services.length} STO`,
          potensi: 'Cost reduction 15-25% melalui optimisasi resource allocation',
          prioritas: 'MEDIUM'
        });
      }
      
      return opportunities;
    },
    
    generateBenchmarks: function(data) {
      const top_quartile = data.sort((a, b) => b.skor_efisiensi - a.skor_efisiensi).slice(0, Math.ceil(data.length * 0.25));
      
      return {
        penetrasi_order_benchmark: `${(top_quartile.reduce((sum, d) => sum + d.hsi_order_penetration, 0) / top_quartile.length).toFixed(1)}%`,
        penetrasi_customer_benchmark: `${(top_quartile.reduce((sum, d) => sum + d.hsi_customer_penetration, 0) / top_quartile.length).toFixed(1)}%`,
        success_rate_benchmark: `${(top_quartile.reduce((sum, d) => sum + d.hsi_success_rate, 0) / top_quartile.length).toFixed(1)}%`,
        efisiensi_layanan_benchmark: `${(top_quartile.reduce((sum, d) => sum + d.avg_orders_per_service, 0) / top_quartile.length).toFixed(2)} order/layanan`,
        layanan_per_customer_benchmark: `${(top_quartile.reduce((sum, d) => sum + d.avg_services_per_customer, 0) / top_quartile.length).toFixed(2)} layanan/customer`,
        install_time_benchmark: `${(top_quartile.reduce((sum, d) => sum + (d.avg_install_days || 0), 0) / top_quartile.length).toFixed(1)} hari`
      };
    },
    
    translatePerformanceCategory: function(category) {
      const translations = {
        'SANGAT_BAIK': 'Sangat Baik',
        'BAIK': 'Baik',
        'CUKUP': 'Cukup',
        'PERLU_PERBAIKAN': 'Perlu Perbaikan'
      };
      return translations[category] || category;
    },
    
    translateEfficiencyCategory: function(category) {
      const translations = {
        'EFISIENSI_TINGGI': 'Efisiensi Tinggi',
        'EFISIENSI_BAIK': 'Efisiensi Baik',
        'EFISIENSI_CUKUP': 'Efisiensi Cukup',
        'EFISIENSI_RENDAH': 'Efisiensi Rendah'
      };
      return translations[category] || category;
    },
    
    translateCustomerValueCategory: function(category) {
      const translations = {
        'CUSTOMER_VALUE_TINGGI': 'Nilai Customer Tinggi',
        'CUSTOMER_VALUE_BAIK': 'Nilai Customer Baik',
        'CUSTOMER_VALUE_STANDAR': 'Nilai Customer Standar'
      };
      return translations[category] || category;
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = patternMatcher.calculateConfidence(userInput, module.exports.KEYWORD_PATTERNS);
      return {
        matches: confidence >= 60,
        confidence: confidence,
        focus_area: 'sto_coverage_analysis',
        requires_sto_focus: userInput.toLowerCase().includes('sto')
      };
    },
    
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'MEDIUM'
};