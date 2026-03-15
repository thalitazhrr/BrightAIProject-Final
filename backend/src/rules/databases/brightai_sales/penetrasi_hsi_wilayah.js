// ========================================
// RULE ps_004: PENETRASI HSI WILAYAH
// ========================================
const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_004',
    RULE_NAME: 'penetrasi_hsi_wilayah',
    DESCRIPTION: 'Analisis tingkat penetrasi HSI berdasarkan wilayah geografis dengan kategorisasi produk yang tepat, termasuk customer journey, ecosystem analysis, dan provider performance dalam bahasa Indonesia dengan tracking ORDER_ID, NCLI, dan ND_HSI',
    DATABASE: 'BRIGHTAI_SALES',
    CATEGORY: 'penetration_analytics',
    COMPLEXITY: 'VERY_HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 7200,
    CREATED_BY: 'System',
    VERSION: '2.1'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_SALES"),
  
  KEYWORD_PATTERNS: {
    wajib: {
      // Kata kunci penetrasi - Indonesia dan Inggris familiar
      kata_kunci_penetrasi: [
        'penetrasi', 'adopsi', 'tingkat penggunaan', 'persentase', 'rasio',
        'sebaran', 'penyebaran', 'cakupan', 'coverage', 'proporsi'
      ],
      
      // Kata kunci HSI - yang familiar digunakan
      kata_kunci_hsi: [
        'hsi', 'internet', 'indibiz', 'fiber', 'broadband', 'wifi',
        'internet cepat', 'layanan internet', 'koneksi internet', 'speedy'
      ],
      
      // Kata kunci lokasi - terminologi Telkom yang familiar
      kata_kunci_lokasi: [
        'wilayah', 'area', 'daerah', 'regional', 'witel', 'datel', 'sto',
        'cabang', 'unit', 'divisi', 'tempat', 'lokasi'
      ]
    },
    
    opsional: {
      // Kata kunci analisis
      kata_kunci_analisis: [
        'analisis', 'data', 'laporan', 'statistik', 'informasi', 'detail',
        'lengkap', 'riset', 'kajian', 'evaluasi'
      ],
      
      // Kata kunci pasar
      kata_kunci_pasar: [
        'pasar', 'peluang', 'potensi', 'target', 'pelanggan', 'customer',
        'segmen', 'kesempatan'
      ],
      
      // Kata kunci kinerja
      kata_kunci_kinerja: [
        'kinerja', 'performa', 'hasil', 'capaian', 'tingkat', 'level',
        'posisi', 'ranking'
      ],

      // Customer journey keywords
      kata_kunci_journey: [
        'journey', 'perjalanan', 'siklus', 'lifecycle', 'customer', 'pelanggan',
        'churn', 'upsell', 'cross-sell', 'acquisition', 'retention'
      ],

      // Enhanced granular keywords untuk DATEL dan STO
      kata_kunci_granular: [
        'sto terbaik', 'sto tertinggi', 'peringkat sto', 'ranking sto',
        '3 besar sto', 'top sto', 'sto unggulan', 'sto terdepan',
        'datel terbaik', 'datel tertinggi', 'peringkat datel', 'ranking datel',
        'per regional', 'di regional', 'per witel', 'di witel'
      ]
    },

    calculateConfidence: function(inputPengguna) {
      const input = inputPengguna.toLowerCase().trim();
      
      // Cek kata kunci wajib
      const adaPenetrasi = this.wajib.kata_kunci_penetrasi.some(keyword => 
        input.includes(keyword)
      );
      const adaHSI = this.wajib.kata_kunci_hsi.some(keyword => 
        input.includes(keyword)
      );
      const adaLokasi = this.wajib.kata_kunci_lokasi.some(keyword => 
        input.includes(keyword)
      );
      
      if (!adaPenetrasi || !adaHSI || !adaLokasi) {
        return 0;
      }
      
      let tingkat_kepercayaan = 70; // Base confidence untuk match lengkap
      
      // Tambah confidence untuk kata kunci opsional
      this.opsional.kata_kunci_kinerja.forEach(keyword => {
        if (input.includes(keyword)) tingkat_kepercayaan += 6;
      });

      this.opsional.kata_kunci_journey.forEach(keyword => {
        if (input.includes(keyword)) tingkat_kepercayaan += 7;
      });

      this.opsional.kata_kunci_granular.forEach(keyword => {
        if (input.includes(keyword)) tingkat_kepercayaan += 12;
      });
      
      this.opsional.kata_kunci_analisis.forEach(keyword => {
        if (input.includes(keyword)) tingkat_kepercayaan += 5;
      });

      this.opsional.kata_kunci_pasar.forEach(keyword => {
        if (input.includes(keyword)) tingkat_kepercayaan += 8;
      });
      
      return Math.min(tingkat_kepercayaan, 100);
    }
  },

  SQL_QUERY: `
    WITH HSI_CLASSIFICATION AS (
        SELECT 
            ORDER_ID,  -- Identifier untuk setiap transaksi order
            NCLI,      -- Identifier untuk pelanggan
            ND_HSI,    -- Identifier untuk layanan HSI
            REGIONAL,
            WITEL,
            DATEL,
            STO,
            ORDER_DATE,
            TGL_PS,
            STATUS_RESUME,
            JENISPSB,
            TYPE_TRANS,
            PACKAGE_NAME,
            PRODUCT,
            BW,
            TGL_PSB,
            EKOSISTEM,
            PROVIDER,
            KCONTACT,
            POTS,
            LAST_UPDATED_DATE,
            
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
                THEN 'Tambah atau Ubah Layanan'
                
                WHEN PACKAGE_NAME LIKE '%Non Bundling%'
                THEN 'Non Bundling'
                
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
            
            -- Customer Journey Classification
            CASE 
                WHEN TYPE_TRANS = 'NEW SALES' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'PELANGGAN_BARU_HSI'
                WHEN TYPE_TRANS = 'ADD SERVICE' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'HSI_UPSELL'
                WHEN TYPE_TRANS = 'DO' THEN 'HSI_CHURN'
                WHEN TYPE_TRANS = 'MODIFICATION' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'HSI_MODIFIKASI'
                WHEN TYPE_TRANS = 'PDA' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'HSI_RELOKASI'
                WHEN TYPE_TRANS = 'SO' THEN 'HSI_SUSPEND'
                WHEN TYPE_TRANS = 'RO' THEN 'HSI_RESUME'
                WHEN TYPE_TRANS = 'MIGRASI' THEN 'HSI_MIGRASI'
                ELSE 'LAINNYA'
            END as JENIS_CUSTOMER_JOURNEY,

            -- Customer Lifecycle Analysis
            CASE 
                WHEN TGL_PSB IS NOT NULL AND MONTHS_BETWEEN(ORDER_DATE, TO_DATE(TGL_PSB, 'YYYY-MM-DD')) <= 6 THEN 'PELANGGAN_BARU'
                WHEN TGL_PSB IS NOT NULL AND MONTHS_BETWEEN(ORDER_DATE, TO_DATE(TGL_PSB, 'YYYY-MM-DD')) <= 24 THEN 'PELANGGAN_BERKEMBANG' 
                WHEN TGL_PSB IS NOT NULL AND MONTHS_BETWEEN(ORDER_DATE, TO_DATE(TGL_PSB, 'YYYY-MM-DD')) <= 60 THEN 'PELANGGAN_MATANG'
                WHEN TGL_PSB IS NOT NULL THEN 'PELANGGAN_SENIOR'
                ELSE 'MASA_BERLANGGANAN_TIDAK_DIKETAHUI'
            END as TINGKAT_KEMATANGAN_PELANGGAN,

            -- Ecosystem Standardization
            CASE 
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('EDUCATION', 'SEKOLAH', 'PESANTREN') THEN 'PENDIDIKAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('GOVERNMENT', 'GOV') THEN 'PEMERINTAHAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('HEALTH', 'HEALTY', 'KLINIK') THEN 'KESEHATAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('HOTEL', 'PROPERTY', 'APARTEMEN') THEN 'PERHOTELAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('MEDIA DAN KOMUNIKASI', 'MEDIA & KOMUNIKASI', 'MEDIA AND COMMUNICATION', 'COMMUNICATION', 'MEDIA&COMUNICATION', 'MEDIA DAN COMMUNICATION') THEN 'MEDIA_KOMUNIKASI'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('AGRI', 'AGRICULTURE') THEN 'PERTANIAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('MANUFAKTUR', 'PABRIKASI') THEN 'MANUFAKTUR'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('EKSPEDISI', 'EKPEDISI') THEN 'LOGISTIK'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('MIGAS', 'ENERGI') THEN 'ENERGI'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('MULTIFINANCE') THEN 'KEUANGAN'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('RUKO', 'HOST') THEN 'RUANG_KOMERSIAL'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('PERORANGAN') THEN 'INDIVIDU'
                WHEN UPPER(NVL(EKOSISTEM, 'LAINNYA')) IN ('OTHERS', 'UN ADDRES', 'UNMAPPING') THEN 'LAINNYA'
                ELSE 'LAINNYA'
            END as EKOSISTEM_TERSTANDAR,

            -- Provider/Division Standardization
            CASE 
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%DGS%' THEN 'LAYANAN_PEMERINTAH'
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%DES%' THEN 'LAYANAN_ENTERPRISE'  
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%DBS%' THEN 'LAYANAN_BISNIS'
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%RBS%' THEN 'BISNIS_REGIONAL'
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%DCS%' THEN 'LAYANAN_KORPORAT'
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%DPS%' THEN 'LAYANAN_PRIVAT'
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%DSS%' THEN 'LAYANAN_KHUSUS'
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%REG%' THEN 'REGIONAL'
                WHEN UPPER(NVL(PROVIDER, 'LAINNYA')) LIKE '%PL-%' THEN 'KEMITRAAN'
                ELSE 'LAINNYA'
            END as KATEGORI_PROVIDER,

            -- Churn Risk Assessment
            CASE 
                WHEN LAST_UPDATED_DATE IS NOT NULL 
                     AND MONTHS_BETWEEN(SYSDATE, TO_DATE(LAST_UPDATED_DATE, 'YYYY-MM-DD')) >= 6 THEN 1
                ELSE 0
            END as BERISIKO_CHURN,

            -- Contact Information Quality
            CASE 
                WHEN KCONTACT IS NOT NULL AND LENGTH(TRIM(KCONTACT)) > 10 THEN 1
                ELSE 0
            END as KONTAK_BERKUALITAS,

            -- POTS Integration Status
            CASE 
                WHEN POTS IS NOT NULL AND LENGTH(TRIM(POTS)) >= 8 THEN 1
                ELSE 0
            END as TERINTEGRASI_POTS

        FROM DWH_MOIS.BRIGHTAI_SALES
        WHERE ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
          AND ORDER_ID IS NOT NULL
          AND NCLI IS NOT NULL
          AND ND_HSI IS NOT NULL
    ),
    
    ANALISIS_PENETRASI AS (
        SELECT 
            TO_CHAR(ORDER_DATE, 'YYYY') AS tahun,
            TO_CHAR(ORDER_DATE, 'MM') AS bulan,
            REGIONAL,
            WITEL,
            DATEL,
            STO,
            
            -- Fundamental metrics berdasarkan ketiga identifier
            COUNT(DISTINCT ORDER_ID) as total_pesanan,
            COUNT(DISTINCT NCLI) as total_pelanggan_unik,
            COUNT(DISTINCT ND_HSI) as total_layanan_hsi_unik,
            
            -- Customer-Order-Service relationship metrics
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as rata_rata_order_per_pelanggan,
            ROUND(COUNT(DISTINCT ND_HSI) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as rata_rata_layanan_per_pelanggan,
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT ND_HSI), 0), 2) as rata_rata_order_per_layanan,
            
            -- HSI Orders Breakdown
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as total_pesanan_hsi,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as pesanan_hsi_bisnis,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as pesanan_hsi_basic,
            
            -- HSI Service metrics berdasarkan ND_HSI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) as layanan_hsi_unik,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ND_HSI END) as layanan_hsi_bisnis_unik,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ND_HSI END) as layanan_hsi_basic_unik,
            
            -- HSI Customer metrics berdasarkan NCLI
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) as pelanggan_hsi_unik,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN NCLI END) as pelanggan_hsi_bisnis_unik,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN NCLI END) as pelanggan_hsi_basic_unik,
            
            -- Penetrasi HSI (refined calculations)
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as penetrasi_hsi_order,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) * 100.0 / COUNT(DISTINCT NCLI) as penetrasi_hsi_pelanggan,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) * 100.0 / COUNT(DISTINCT ND_HSI) as penetrasi_hsi_layanan,
            
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as penetrasi_hsi_bisnis,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as penetrasi_hsi_basic,
            
            -- Bundling Analysis
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Hard Bundling' THEN ORDER_ID END) as pesanan_hard_bundling,
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Bundling A La Carte' THEN ORDER_ID END) as pesanan_bundling_alacarte,
            COUNT(DISTINCT CASE WHEN BUNDLING_TYPE = 'Non Bundling' THEN ORDER_ID END) as pesanan_non_bundling,
            
            -- Digital Product Penetration
            COUNT(DISTINCT CASE WHEN IS_PIJAR_SEKOLAH = 1 THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as penetrasi_pijar,
            COUNT(DISTINCT CASE WHEN IS_OCA_INTERACTION = 1 THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as penetrasi_oca_int,
            COUNT(DISTINCT CASE WHEN IS_OCA_BLAST = 1 THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as penetrasi_oca_blast,
            COUNT(DISTINCT CASE WHEN IS_NETMONK = 1 THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as penetrasi_netmonk,

            -- Customer Journey Analysis
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'PELANGGAN_BARU_HSI' THEN ORDER_ID END) as pelanggan_baru_hsi,
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'HSI_UPSELL' THEN ORDER_ID END) as upsell_pelanggan_hsi,
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'HSI_CHURN' THEN ORDER_ID END) as churn_pelanggan_hsi,
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'HSI_MODIFIKASI' THEN ORDER_ID END) as modifikasi_pelanggan_hsi,
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'HSI_RELOKASI' THEN ORDER_ID END) as relokasi_pelanggan_hsi,
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'HSI_SUSPEND' THEN ORDER_ID END) as suspend_pelanggan_hsi,
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'HSI_RESUME' THEN ORDER_ID END) as resume_pelanggan_hsi,

            -- Customer Journey Penetration Rates
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'PELANGGAN_BARU_HSI' THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as tingkat_pelanggan_baru,
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'HSI_UPSELL' THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END), 0) as tingkat_upsell,
            COUNT(DISTINCT CASE WHEN JENIS_CUSTOMER_JOURNEY = 'HSI_CHURN' THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as tingkat_churn,

            -- Ecosystem Analysis
            MODE() WITHIN GROUP (ORDER BY EKOSISTEM_TERSTANDAR) as ekosistem_dominan,
            COUNT(DISTINCT EKOSISTEM_TERSTANDAR) as keragaman_ekosistem,
            COUNT(DISTINCT CASE WHEN EKOSISTEM_TERSTANDAR = 'PENDIDIKAN' THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as penetrasi_pendidikan,
            COUNT(DISTINCT CASE WHEN EKOSISTEM_TERSTANDAR = 'PEMERINTAHAN' THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as penetrasi_pemerintahan,
            COUNT(DISTINCT CASE WHEN EKOSISTEM_TERSTANDAR = 'KESEHATAN' THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as penetrasi_kesehatan,
            COUNT(DISTINCT CASE WHEN EKOSISTEM_TERSTANDAR = 'MEDIA_KOMUNIKASI' THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as penetrasi_media,

            -- Provider/Division Analysis
            MODE() WITHIN GROUP (ORDER BY KATEGORI_PROVIDER) as provider_dominan,
            COUNT(DISTINCT KATEGORI_PROVIDER) as keragaman_provider,
            COUNT(DISTINCT CASE WHEN KATEGORI_PROVIDER = 'LAYANAN_ENTERPRISE' THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as share_layanan_enterprise,
            COUNT(DISTINCT CASE WHEN KATEGORI_PROVIDER = 'LAYANAN_BISNIS' THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as share_layanan_bisnis,

            -- Customer Maturity Analysis
            COUNT(DISTINCT CASE WHEN TINGKAT_KEMATANGAN_PELANGGAN = 'PELANGGAN_BARU' AND (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as hsi_pelanggan_baru,
            COUNT(DISTINCT CASE WHEN TINGKAT_KEMATANGAN_PELANGGAN = 'PELANGGAN_MATANG' AND (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as hsi_pelanggan_matang,
            COUNT(DISTINCT CASE WHEN TINGKAT_KEMATANGAN_PELANGGAN = 'PELANGGAN_BARU' AND (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN TINGKAT_KEMATANGAN_PELANGGAN = 'PELANGGAN_BARU' THEN ORDER_ID END), 0) as penetrasi_pelanggan_baru_hsi,

            -- Risk and Quality Metrics
            COUNT(DISTINCT CASE WHEN BERISIKO_CHURN = 1 THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as persentase_risiko_churn,
            COUNT(DISTINCT CASE WHEN KONTAK_BERKUALITAS = 1 THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as tingkat_kualitas_kontak,
            COUNT(DISTINCT CASE WHEN TERINTEGRASI_POTS = 1 THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as tingkat_integrasi_pots,

            -- Performance Metrics
            AVG(CAST(NULLIF(REGEXP_REPLACE(BW, '[^0-9]', ''), '') AS NUMBER)) as rata_rata_bandwidth,
            COUNT(DISTINCT CASE WHEN STATUS_RESUME IN ('FULFILL BILLING COMPLETED', 'Completed (PS)') THEN ORDER_ID END) * 100.0 / COUNT(DISTINCT ORDER_ID) as tingkat_keberhasilan
            
        FROM HSI_CLASSIFICATION
        WHERE REGIONAL IS NOT NULL
          AND WITEL IS NOT NULL  
          AND DATEL IS NOT NULL
          AND STO IS NOT NULL
        GROUP BY TO_CHAR(ORDER_DATE, 'YYYY'), TO_CHAR(ORDER_DATE, 'MM'), REGIONAL, WITEL, DATEL, STO
        HAVING COUNT(DISTINCT ORDER_ID) >= 3
    ),
    
    PERINGKAT_PENETRASI AS (
        SELECT t.*,
            -- Ranking Nasional & Regional berdasarkan penetrasi order HSI
            RANK() OVER (PARTITION BY tahun, bulan ORDER BY penetrasi_hsi_order DESC) as peringkat_penetrasi_nasional,
            RANK() OVER (PARTITION BY tahun, bulan, REGIONAL ORDER BY penetrasi_hsi_order DESC) as peringkat_penetrasi_regional,
            RANK() OVER (PARTITION BY tahun, bulan, WITEL ORDER BY penetrasi_hsi_order DESC) as peringkat_penetrasi_witel,
            
            -- Rankings berdasarkan penetrasi pelanggan dan layanan
            RANK() OVER (PARTITION BY tahun, bulan ORDER BY penetrasi_hsi_pelanggan DESC) as peringkat_penetrasi_pelanggan_nasional,
            RANK() OVER (PARTITION BY tahun, bulan ORDER BY penetrasi_hsi_layanan DESC) as peringkat_penetrasi_layanan_nasional,
            
            -- Granular Rankings untuk DATEL dan STO
            RANK() OVER (PARTITION BY tahun, bulan, DATEL ORDER BY penetrasi_hsi_order DESC) as peringkat_penetrasi_datel,
            RANK() OVER (PARTITION BY tahun, bulan, REGIONAL ORDER BY penetrasi_hsi_order DESC) as peringkat_sto_regional,
            RANK() OVER (PARTITION BY tahun, bulan, WITEL ORDER BY penetrasi_hsi_order DESC) as peringkat_sto_witel,
            
            -- Cross-level rankings untuk komparasi volume
            DENSE_RANK() OVER (PARTITION BY tahun, bulan, REGIONAL ORDER BY total_pesanan_hsi DESC) as peringkat_volume_regional,
            DENSE_RANK() OVER (PARTITION BY tahun, bulan, WITEL ORDER BY total_pesanan_hsi DESC) as peringkat_volume_witel,
            
            -- Rankings berdasarkan efisiensi customer-order-service
            DENSE_RANK() OVER (PARTITION BY tahun, bulan ORDER BY rata_rata_order_per_layanan DESC) as peringkat_efisiensi_layanan,
            DENSE_RANK() OVER (PARTITION BY tahun, bulan ORDER BY rata_rata_layanan_per_pelanggan DESC) as peringkat_penetrasi_multi_service,
            
            -- Kategori Penetrasi HSI (berdasarkan penetrasi order)
            CASE 
                WHEN penetrasi_hsi_order >= 80 THEN 'DOMINAN'
                WHEN penetrasi_hsi_order >= 60 THEN 'KUAT' 
                WHEN penetrasi_hsi_order >= 40 THEN 'BERKEMBANG'
                WHEN penetrasi_hsi_order >= 20 THEN 'EMERGING'
                ELSE 'POTENSIAL'
            END as kategori_penetrasi,
            
            -- Kategori berdasarkan penetrasi pelanggan dan layanan
            CASE 
                WHEN penetrasi_hsi_pelanggan >= 80 THEN 'DOMINAN_PELANGGAN'
                WHEN penetrasi_hsi_pelanggan >= 60 THEN 'KUAT_PELANGGAN' 
                WHEN penetrasi_hsi_pelanggan >= 40 THEN 'BERKEMBANG_PELANGGAN'
                WHEN penetrasi_hsi_pelanggan >= 20 THEN 'EMERGING_PELANGGAN'
                ELSE 'POTENSIAL_PELANGGAN'
            END as kategori_penetrasi_pelanggan,
            
            -- Enhanced Market Opportunity Score dengan customer-service metrics
            (100 - penetrasi_hsi_order) * (total_pesanan / 100.0) + 
            (100 - penetrasi_hsi_pelanggan) * (total_pelanggan_unik / 100.0) +
            (keragaman_ekosistem * 5) + 
            (CASE WHEN tingkat_churn < 10 THEN 10 ELSE 0 END) +
            (CASE WHEN tingkat_pelanggan_baru > 20 THEN 15 ELSE 0 END) +
            (CASE WHEN rata_rata_layanan_per_pelanggan < 1.5 THEN 10 ELSE 0 END) as skor_peluang_ditingkatkan,

            -- Market Maturity Assessment
            CASE 
                WHEN penetrasi_hsi_order < 20 AND tingkat_pelanggan_baru > 50 THEN 'FASE_PENGENALAN'
                WHEN penetrasi_hsi_order BETWEEN 20 AND 50 AND tingkat_pelanggan_baru > 30 THEN 'FASE_PERTUMBUHAN'
                WHEN penetrasi_hsi_order BETWEEN 50 AND 80 AND tingkat_pelanggan_baru < 30 THEN 'FASE_KEMATANGAN'
                WHEN penetrasi_hsi_order >= 80 OR tingkat_churn > 20 THEN 'FASE_SATURASI'
                ELSE 'FASE_TRANSISI'
            END as kematangan_pasar,

            -- Competitive Positioning
            DENSE_RANK() OVER (PARTITION BY WITEL ORDER BY total_pesanan_hsi DESC) as posisi_kompetitif_witel,
            total_pesanan_hsi * 100.0 / SUM(total_pesanan_hsi) OVER (PARTITION BY WITEL) as pangsa_pasar_dalam_witel,
            
            -- Service efficiency positioning
            DENSE_RANK() OVER (PARTITION BY WITEL ORDER BY rata_rata_order_per_layanan DESC) as posisi_efisiensi_witel,
            pelanggan_hsi_unik * 100.0 / SUM(pelanggan_hsi_unik) OVER (PARTITION BY WITEL) as pangsa_pelanggan_dalam_witel
            
        FROM ANALISIS_PENETRASI t
    )
    SELECT * FROM PERINGKAT_PENETRASI
    ORDER BY tahun DESC, bulan DESC, penetrasi_hsi_order DESC, total_pesanan_hsi DESC
  `,

  BUSINESS_LOGIC: {
    kategorisasiPenetrasi: function(tingkat_penetrasi) {
      if (tingkat_penetrasi >= 80) return 'DOMINAN';
      if (tingkat_penetrasi >= 60) return 'KUAT';
      if (tingkat_penetrasi >= 40) return 'BERKEMBANG';
      if (tingkat_penetrasi >= 20) return 'EMERGING';
      return 'POTENSIAL';
    },

    penilaianPeluangPasar: function(tingkat_penetrasi, total_pesanan, skor_peluang) {
      if (skor_peluang >= 300) return 'SANGAT_MENARIK';
      if (skor_peluang >= 200) return 'MENARIK';
      if (skor_peluang >= 100) return 'MODERAT';
      return 'TERBATAS';
    },

    // Penilaian Customer Journey
    penilaianCustomerJourney: function(tingkat_baru, tingkat_upsell, tingkat_churn) {
      if (tingkat_baru > 40 && tingkat_churn < 5) return 'PERTUMBUHAN_SEHAT';
      if (tingkat_upsell > 25 && tingkat_churn < 10) return 'SIAP_EKSPANSI';
      if (tingkat_churn > 15) return 'RISIKO_RETENSI';
      if (tingkat_baru < 10 && tingkat_upsell < 5) return 'STAGNAN';
      return 'STABIL';
    },

    // Penilaian Peluang Ekosistem
    penilaianPeluangEkosistem: function(ekosistem_dominan, keragaman, penetrasi_ekosistem) {
      let skor = 0;

      // Bonus keragaman
      skor += keragaman * 10;

      // Bonus ekosistem bernilai tinggi
      if (ekosistem_dominan === 'PEMERINTAHAN') skor += 30;
      if (ekosistem_dominan === 'PENDIDIKAN') skor += 25;
      if (ekosistem_dominan === 'KESEHATAN') skor += 25;
      if (ekosistem_dominan === 'LAYANAN_ENTERPRISE') skor += 20;

      // Peluang penetrasi
      Object.values(penetrasi_ekosistem).forEach(penetrasi => {
        if (penetrasi < 30) skor += 15;
      });

      if (skor >= 80) return 'PELUANG_EKOSISTEM_TINGGI';
      if (skor >= 50) return 'PELUANG_EKOSISTEM_MENENGAH';
      return 'PELUANG_EKOSISTEM_TERBATAS';
    },

    // Penilaian Kematangan Pasar
    penilaianKematanganPasar: function(penetrasi, tingkat_pelanggan_baru, tingkat_churn) {
      if (penetrasi < 20 && tingkat_pelanggan_baru > 50) return 'FASE_PENGENALAN';
      if (penetrasi >= 20 && penetrasi < 50 && tingkat_pelanggan_baru > 30) return 'FASE_PERTUMBUHAN';
      if (penetrasi >= 50 && penetrasi < 80 && tingkat_pelanggan_baru < 30) return 'FASE_KEMATANGAN';
      if (penetrasi >= 80 || tingkat_churn > 20) return 'FASE_SATURASI';
      return 'FASE_TRANSISI';
    },

    // Penilaian Performa Provider
    penilaianPerformaProvider: function(share_provider, tingkat_keberhasilan, pangsa_pasar) {
      let skor = 0;

      if (tingkat_keberhasilan > 90) skor += 30;
      else if (tingkat_keberhasilan > 80) skor += 20;
      else if (tingkat_keberhasilan > 70) skor += 10;

      if (pangsa_pasar > 30) skor += 25;
      else if (pangsa_pasar > 20) skor += 15;
      else if (pangsa_pasar > 10) skor += 10;

      if (skor >= 40) return 'PERFORMA_EXCELLENT';
      if (skor >= 25) return 'PERFORMA_BAIK';
      if (skor >= 15) return 'PERFORMA_RATA_RATA';
      return 'PERLU_PERBAIKAN';
    },

    // Enhanced granular analysis functions
    analisisPerformerTingkatGranular: function(data) {
      const analisis = {
        top_performers_nasional: {
          top_5_regional: [],
          insight: ''
        },
        top_performers_per_regional: {},
        top_performers_per_witel: {},
        gap_analysis: {
          regional: [],
          witel: [],
          sto: []
        },
        analisis_efisiensi: {
          top_efisiensi_order_per_pelanggan: [],
          top_efisiensi_layanan_per_pelanggan: [],
          top_efisiensi_order_per_layanan: []
        }
      };

      // Group data by different levels
      const dataByRegional = this.groupByKey(data, 'REGIONAL');
      const dataByWitel = this.groupByKey(data, 'WITEL');

      // Top 5 Regional Nasional dengan metrik yang disesuaikan
      const regionalSummary = Object.keys(dataByRegional).map(regional => {
        const regionalData = dataByRegional[regional];
        const avgPenetrasi = regionalData.reduce((sum, d) => sum + d.penetrasi_hsi_order, 0) / regionalData.length;
        const totalVolume = regionalData.reduce((sum, d) => sum + d.total_pesanan_hsi, 0);
        const totalPelanggan = regionalData.reduce((sum, d) => sum + d.total_pelanggan_unik, 0);
        const totalLayanan = regionalData.reduce((sum, d) => sum + d.total_layanan_hsi_unik, 0);
        const bestSTO = regionalData.reduce((best, current) =>
          current.penetrasi_hsi_order > best.penetrasi_hsi_order ? current : best
        );

        return {
          regional: regional,
          rata_rata_penetrasi: avgPenetrasi.toFixed(1),
          total_volume: totalVolume,
          total_pelanggan_unik: totalPelanggan,
          total_layanan_hsi: totalLayanan,
          sto_terbaik: bestSTO.STO,
          penetrasi_sto_terbaik: bestSTO.penetrasi_hsi_order.toFixed(1),
          efisiensi_layanan_per_pelanggan: (totalLayanan / totalPelanggan).toFixed(2)
        };
      }).sort((a, b) => b.rata_rata_penetrasi - a.rata_rata_penetrasi);

      analisis.top_performers_nasional.top_5_regional = regionalSummary.slice(0, 5);

      // Analisis efisiensi berdasarkan metrik baru
      analisis.analisis_efisiensi.top_efisiensi_order_per_pelanggan = data
        .sort((a, b) => b.rata_rata_order_per_pelanggan - a.rata_rata_order_per_pelanggan)
        .slice(0, 10)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          regional: d.REGIONAL,
          rata_rata_order_per_pelanggan: d.rata_rata_order_per_pelanggan,
          total_pesanan: d.total_pesanan,
          total_pelanggan: d.total_pelanggan_unik
        }));

      analisis.analisis_efisiensi.top_efisiensi_layanan_per_pelanggan = data
        .sort((a, b) => b.rata_rata_layanan_per_pelanggan - a.rata_rata_layanan_per_pelanggan)
        .slice(0, 10)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          regional: d.REGIONAL,
          rata_rata_layanan_per_pelanggan: d.rata_rata_layanan_per_pelanggan,
          total_layanan_hsi: d.total_layanan_hsi_unik,
          total_pelanggan: d.total_pelanggan_unik
        }));

      analisis.analisis_efisiensi.top_efisiensi_order_per_layanan = data
        .sort((a, b) => b.rata_rata_order_per_layanan - a.rata_rata_order_per_layanan)
        .slice(0, 10)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          regional: d.REGIONAL,
          rata_rata_order_per_layanan: d.rata_rata_order_per_layanan,
          total_pesanan: d.total_pesanan,
          total_layanan_hsi: d.total_layanan_hsi_unik
        }));

      return analisis;
    },

    // Helper function untuk grouping
    groupByKey: function(data, key) {
      return data.reduce((groups, item) => {
        const group = item[key];
        if (!groups[group]) groups[group] = [];
        groups[group].push(item);
        return groups;
      }, {});
    },

    formatResponIndonesia: function(data) {
      const hasil = data.map(area => {
        const peluang = this.penilaianPeluangPasar(
          area.penetrasi_hsi_order,
          area.total_pesanan,
          area.skor_peluang_ditingkatkan
        );

        const kesehatan_journey = this.penilaianCustomerJourney(
          area.tingkat_pelanggan_baru || 0,
          area.tingkat_upsell || 0,
          area.tingkat_churn || 0
        );

        const peluang_ekosistem = this.penilaianPeluangEkosistem(
          area.ekosistem_dominan,
          area.keragaman_ekosistem || 1,
          {
            pendidikan: area.penetrasi_pendidikan || 0,
            pemerintahan: area.penetrasi_pemerintahan || 0,
            kesehatan: area.penetrasi_kesehatan || 0,
            media: area.penetrasi_media || 0
          }
        );

        const performa_provider = this.penilaianPerformaProvider(
          area.share_layanan_enterprise || 0,
          area.tingkat_keberhasilan || 0,
          area.pangsa_pasar_dalam_witel || 0
        );

        return {
          identitas_wilayah: {
            tahun: area.tahun,
            bulan: area.bulan,
            sto: area.STO,
            datel: area.DATEL,
            witel: area.WITEL,
            regional: area.REGIONAL
          },
          metrik_fundamental: {
            total_pesanan: area.total_pesanan.toLocaleString('id-ID'),
            total_pelanggan_unik: area.total_pelanggan_unik.toLocaleString('id-ID'),
            total_layanan_hsi_unik: area.total_layanan_hsi_unik.toLocaleString('id-ID'),
            rata_rata_order_per_pelanggan: area.rata_rata_order_per_pelanggan,
            rata_rata_layanan_per_pelanggan: area.rata_rata_layanan_per_pelanggan,
            rata_rata_order_per_layanan: area.rata_rata_order_per_layanan
          },
          metrik_penetrasi: {
            pesanan_hsi_total: area.total_pesanan_hsi.toLocaleString('id-ID'),
            pesanan_hsi_bisnis: area.pesanan_hsi_bisnis.toLocaleString('id-ID'),
            pesanan_hsi_basic: area.pesanan_hsi_basic.toLocaleString('id-ID'),
            layanan_hsi_unik: area.layanan_hsi_unik.toLocaleString('id-ID'),
            pelanggan_hsi_unik: area.pelanggan_hsi_unik.toLocaleString('id-ID'),
            penetrasi_hsi_order: `${area.penetrasi_hsi_order.toFixed(1)}%`,
            penetrasi_hsi_pelanggan: `${area.penetrasi_hsi_pelanggan.toFixed(1)}%`,
            penetrasi_hsi_layanan: `${area.penetrasi_hsi_layanan.toFixed(1)}%`,
            penetrasi_hsi_bisnis: `${area.penetrasi_hsi_bisnis.toFixed(1)}%`,
            penetrasi_hsi_basic: `${area.penetrasi_hsi_basic.toFixed(1)}%`,
            rata_rata_bandwidth: `${Math.round(area.rata_rata_bandwidth || 0)} Kbps`,
            tingkat_keberhasilan: `${area.tingkat_keberhasilan.toFixed(1)}%`
          },
          analisis_bundling: {
            hard_bundling: area.pesanan_hard_bundling,
            bundling_alacarte: area.pesanan_bundling_alacarte,
            non_bundling: area.pesanan_non_bundling,
            preferensi_bundling: this.dapatkanPreferensiBundling(area)
          },
          penetrasi_produk_digital: {
            pijar_sekolah: `${(area.penetrasi_pijar || 0).toFixed(1)}%`,
            oca_interaction: `${(area.penetrasi_oca_int || 0).toFixed(1)}%`,
            oca_blast: `${(area.penetrasi_oca_blast || 0).toFixed(1)}%`,
            netmonk: `${(area.penetrasi_netmonk || 0).toFixed(1)}%`
          },
          analisis_customer_journey: {
            pelanggan_baru_hsi: area.pelanggan_baru_hsi || 0,
            upsell_hsi: area.upsell_pelanggan_hsi || 0,
            churn_hsi: area.churn_pelanggan_hsi || 0,
            modifikasi_hsi: area.modifikasi_pelanggan_hsi || 0,
            relokasi_hsi: area.relokasi_pelanggan_hsi || 0,
            suspend_hsi: area.suspend_pelanggan_hsi || 0,
            resume_hsi: area.resume_pelanggan_hsi || 0,
            tingkat_pelanggan_baru: `${(area.tingkat_pelanggan_baru || 0).toFixed(1)}%`,
            tingkat_upsell: `${(area.tingkat_upsell || 0).toFixed(1)}%`,
            tingkat_churn: `${(area.tingkat_churn || 0).toFixed(1)}%`,
            status_journey: this.terjemahkanKesehatanJourney(kesehatan_journey)
          },
          analisis_ekosistem: {
            ekosistem_dominan: area.ekosistem_dominan || 'LAINNYA',
            keragaman_ekosistem: area.keragaman_ekosistem || 1,
            penetrasi_pendidikan: `${(area.penetrasi_pendidikan || 0).toFixed(1)}%`,
            penetrasi_pemerintahan: `${(area.penetrasi_pemerintahan || 0).toFixed(1)}%`,
            penetrasi_kesehatan: `${(area.penetrasi_kesehatan || 0).toFixed(1)}%`,
            penetrasi_media: `${(area.penetrasi_media || 0).toFixed(1)}%`,
            peluang_ekosistem: this.terjemahkanPeluangEkosistem(peluang_ekosistem)
          },
          analisis_provider: {
            provider_dominan: area.provider_dominan || 'LAINNYA',
            keragaman_provider: area.keragaman_provider || 1,
            share_layanan_enterprise: `${(area.share_layanan_enterprise || 0).toFixed(1)}%`,
            share_layanan_bisnis: `${(area.share_layanan_bisnis || 0).toFixed(1)}%`,
            pangsa_pasar_witel: `${(area.pangsa_pasar_dalam_witel || 0).toFixed(1)}%`,
            pangsa_pelanggan_witel: `${(area.pangsa_pelanggan_dalam_witel || 0).toFixed(1)}%`,
            posisi_kompetitif_witel: area.posisi_kompetitif_witel || 999,
            posisi_efisiensi_witel: area.posisi_efisiensi_witel || 999,
            performa_provider: this.terjemahkanPerformaProvider(performa_provider)
          },
          analisis_kematangan_pelanggan: {
            hsi_pelanggan_baru: area.hsi_pelanggan_baru || 0,
            hsi_pelanggan_matang: area.hsi_pelanggan_matang || 0,
            penetrasi_pelanggan_baru: `${(area.penetrasi_pelanggan_baru_hsi || 0).toFixed(1)}%`,
            tahap_kematangan_pasar: this.terjemahkanKematanganPasar(area.kematangan_pasar)
          },
          metrik_risiko_kualitas: {
            persentase_risiko_churn: `${(area.persentase_risiko_churn || 0).toFixed(1)}%`,
            tingkat_kualitas_kontak: `${(area.tingkat_kualitas_kontak || 0).toFixed(1)}%`,
            tingkat_integrasi_pots: `${(area.tingkat_integrasi_pots || 0).toFixed(1)}%`
          },
          analisis_pasar: {
            kategori_penetrasi: this.terjemahkanKategoriPenetrasi(area.kategori_penetrasi),
            kategori_penetrasi_pelanggan: this.terjemahkanKategoriPenetrasi(area.kategori_penetrasi_pelanggan),
            peluang_pasar: this.terjemahkanPeluang(peluang),
            skor_peluang: Math.round(area.skor_peluang_ditingkatkan || 0),
            posisi_nasional: area.peringkat_penetrasi_nasional,
            posisi_regional: area.peringkat_penetrasi_regional,
            posisi_witel: area.peringkat_penetrasi_witel,
            posisi_datel: area.peringkat_penetrasi_datel,
            posisi_sto_dalam_regional: area.peringkat_sto_regional,
            posisi_sto_dalam_witel: area.peringkat_sto_witel,
            peringkat_penetrasi_pelanggan_nasional: area.peringkat_penetrasi_pelanggan_nasional,
            peringkat_penetrasi_layanan_nasional: area.peringkat_penetrasi_layanan_nasional,
            peringkat_efisiensi_layanan: area.peringkat_efisiensi_layanan,
            peringkat_penetrasi_multi_service: area.peringkat_penetrasi_multi_service
          },
          wawasan_strategis: this.buatWawasanStrategisDitingkatkan(area, kesehatan_journey, peluang_ekosistem, performa_provider)
        };
      });

      // Analisis granular top performers
      const topPerformersAnalysis = this.analisisPerformerTingkatGranular(hasil);

      return {
        ringkasan: 'Analisis komprehensif penetrasi HSI dengan tracking ORDER_ID, NCLI, dan ND_HSI untuk customer journey, ekosistem, dan performa provider periode 2025 dengan dimensi temporal dan ranking granular',
        total_wilayah_analisis: hasil.length,
        periode_analisis: {
          tahun_tersedia: [...new Set(hasil.map(r => r.identitas_wilayah.tahun))].sort(),
          bulan_tersedia: [...new Set(hasil.map(r => r.identitas_wilayah.bulan))].sort(),
          total_titik_data_temporal: hasil.length
        },

        // Enhanced top performers section dengan metrik baru
        top_performers: {
          nasional: topPerformersAnalysis.top_performers_nasional,
          per_regional: topPerformersAnalysis.top_performers_per_regional,
          per_witel: topPerformersAnalysis.top_performers_per_witel,
          analisis_efisiensi: topPerformersAnalysis.analisis_efisiensi
        },

        // Enhanced existing sections
        top_10_penetrasi_terkini: hasil.slice(0, 10),
        wilayah_potensial: hasil.filter(r => r.analisis_pasar.kategori_penetrasi.includes('POTENSIAL')).slice(0, 10),
        wilayah_siap_tumbuh: hasil.filter(r => r.analisis_customer_journey.status_journey.includes('PERTUMBUHAN')).slice(0, 10),
        wilayah_peluang_ekosistem: hasil.filter(r => r.analisis_ekosistem.peluang_ekosistem.includes('TINGGI')).slice(0, 10),

        rekomendasi_strategis: this.buatRekomendasiDitingkatkan(hasil)
      };
    },

    dapatkanPreferensiBundling: function(area) {
      const total_bundling = area.pesanan_hard_bundling + area.pesanan_bundling_alacarte;
      if (total_bundling > area.pesanan_non_bundling) {
        return area.pesanan_hard_bundling > area.pesanan_bundling_alacarte ? 'Hard Bundling' : 'A La Carte';
      }
      return 'Stand Alone';
    },

    terjemahkanKategoriPenetrasi: function(kategori) {
      const terjemahan = {
        'DOMINAN': 'Dominan - Adopsi Sangat Tinggi (≥80%)',
        'DOMINAN_PELANGGAN': 'Dominan Pelanggan - Penetrasi Customer Sangat Tinggi (≥80%)',
        'KUAT': 'Kuat - Adopsi Tinggi (60-79%)',
        'KUAT_PELANGGAN': 'Kuat Pelanggan - Penetrasi Customer Tinggi (60-79%)',
        'BERKEMBANG': 'Berkembang - Adopsi Menengah (40-59%)',
        'BERKEMBANG_PELANGGAN': 'Berkembang Pelanggan - Penetrasi Customer Menengah (40-59%)',
        'EMERGING': 'Emerging - Adopsi Rendah (20-39%)',
        'EMERGING_PELANGGAN': 'Emerging Pelanggan - Penetrasi Customer Rendah (20-39%)',
        'POTENSIAL': 'Potensial - Peluang Besar (<20%)',
        'POTENSIAL_PELANGGAN': 'Potensial Pelanggan - Peluang Customer Besar (<20%)'
      };
      return terjemahan[kategori] || kategori;
    },

    terjemahkanPeluang: function(peluang) {
      const terjemahan = {
        'SANGAT_MENARIK': 'Sangat Menarik - Prioritas Utama',
        'MENARIK': 'Menarik - Fokus Ekspansi',
        'MODERAT': 'Moderat - Selektif',
        'TERBATAS': 'Terbatas - Optimasi'
      };
      return terjemahan[peluang] || peluang;
    },

    terjemahkanKesehatanJourney: function(kesehatan) {
      const terjemahan = {
        'PERTUMBUHAN_SEHAT': 'Pertumbuhan Sehat - Akuisisi Tinggi, Churn Rendah',
        'SIAP_EKSPANSI': 'Siap Ekspansi - Upsell Baik, Retensi Solid',
        'RISIKO_RETENSI': 'Risiko Retensi - Perlu Fokus Customer Success',
        'STAGNAN': 'Stagnan - Perlu Revitalisasi Strategi',
        'STABIL': 'Stabil - Pertahankan Performa'
      };
      return terjemahan[kesehatan] || kesehatan;
    },

    terjemahkanPeluangEkosistem: function(peluang) {
      const terjemahan = {
        'PELUANG_EKOSISTEM_TINGGI': 'Peluang Ekosistem Tinggi - Diversifikasi Aktif',
        'PELUANG_EKOSISTEM_MENENGAH': 'Peluang Ekosistem Menengah - Selektif',
        'PELUANG_EKOSISTEM_TERBATAS': 'Peluang Ekosistem Terbatas - Fokus Existing'
      };
      return terjemahan[peluang] || peluang;
    },

    terjemahkanPerformaProvider: function(performa) {
      const terjemahan = {
        'PERFORMA_EXCELLENT': 'Performa Excellent - Best Practice',
        'PERFORMA_BAIK': 'Performa Baik - Terus Tingkatkan',
        'PERFORMA_RATA_RATA': 'Performa Rata-rata - Butuh Improvement',
        'PERLU_PERBAIKAN': 'Perlu Perbaikan - Action Plan Required'
      };
      return terjemahan[performa] || performa;
    },

    terjemahkanKematanganPasar: function(kematangan) {
      const terjemahan = {
        'FASE_PENGENALAN': 'Fase Pengenalan - Fokus Customer Acquisition',
        'FASE_PERTUMBUHAN': 'Fase Pertumbuhan - Scale Up Strategy',
        'FASE_KEMATANGAN': 'Fase Kematangan - Value Enhancement',
        'FASE_SATURASI': 'Fase Saturasi - Innovation Required',
        'FASE_TRANSISI': 'Fase Transisi - Monitor Closely'
      };
      return terjemahan[kematangan] || kematangan;
    },

    buatWawasanStrategisDitingkatkan: function(area, kesehatan_journey, peluang_ekosistem, performa_provider) {
      const wawasan = [];

      // Wawasan penetrasi order vs pelanggan
      if (area.penetrasi_hsi_order < 20) {
        wawasan.push('Wilayah dengan potensi ekspansi besar untuk HSI');
      }

      if (area.penetrasi_hsi_pelanggan > area.penetrasi_hsi_order) {
        wawasan.push('Penetrasi customer lebih tinggi dari order, menunjukkan efisiensi layanan yang baik');
      }

      // Wawasan efisiensi customer-service
      if (area.rata_rata_layanan_per_pelanggan < 1.5) {
        wawasan.push('Peluang cross-sell tinggi dengan rata-rata layanan per pelanggan rendah');
      } else if (area.rata_rata_layanan_per_pelanggan > 2.5) {
        wawasan.push('Customer loyalty tinggi dengan multiple service adoption');
      }

      // Wawasan segmentasi bisnis vs basic
      if (area.penetrasi_hsi_bisnis > area.penetrasi_hsi_basic) {
        wawasan.push('Segmen bisnis lebih dominan, fokus pada solusi enterprise');
      } else {
        wawasan.push('Segmen basic lebih dominan, peluang untuk upgrade ke bisnis');
      }

      return wawasan.join('. ');
    },

    buatRekomendasiDitingkatkan: function(hasil) {
      const rekomendasi = [];

      const wilayahPotensial = hasil.filter(r => r.analisis_pasar.kategori_penetrasi.includes('POTENSIAL'));
      if (wilayahPotensial.length > 0) {
        rekomendasi.push(`Fokus ekspansi di ${wilayahPotensial.length} wilayah potensial dengan penetrasi rendah`);
      }

      const peluangCrossSell = hasil.filter(r => 
        parseFloat(r.metrik_fundamental.rata_rata_layanan_per_pelanggan) < 1.5 &&
        parseInt(r.metrik_fundamental.total_pelanggan_unik.replace(/,/g, '')) > 50
      );
      if (peluangCrossSell.length > 0) {
        rekomendasi.push(`${peluangCrossSell.length} wilayah memiliki peluang cross-sell tinggi dengan efisiensi layanan per pelanggan yang rendah`);
      }

      return rekomendasi;
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      
      return {
        matches: confidence >= 70,
        confidence: confidence,
        focus_area: 'penetration_analysis'
      };
    },
    
  },

  CACHE_DURATION: 7200,
  COMPLEXITY: 'VERY_HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};