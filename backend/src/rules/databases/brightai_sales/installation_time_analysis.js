const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');

module.exports = {
  RULE_META: {
    RULE_ID: 'ps_007',
    RULE_NAME: 'installation_time_analysis',
    DESCRIPTION: 'Analisis waktu instalasi HSI per wilayah dengan klasifikasi produk',
    DATABASE: 'BRIGHTAI_SALES',
    CATEGORY: 'OPERATIONAL_PERFORMANCE',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_SALES"),

  KEYWORD_PATTERNS: {
    primary: [
      // Waktu instalasi - yang biasa digunakan
      'waktu instalasi', 'installation time', 'lama instalasi', 'durasi instalasi',
      'kecepatan instalasi', 'installation speed', 'lead time instalasi',
      
      // SLA terkait - istilah yang familiar
      'sla instalasi', 'installation sla', 'target instalasi', 'standar instalasi',
      'ketepatan waktu', 'on time installation', 'kepatuhan instalasi'
    ],
    
    supporting: [
      // Istilah waktu yang familiar
      'hari', 'days', 'minggu', 'weeks', 'cepat', 'lambat', 'lama',
      
      // Indikator performa
      'efisiensi', 'performa', 'kinerja', 'produktivitas', 'kualitas',
      
      // Istilah geografis yang familiar
      'wilayah', 'regional', 'witel', 'datel', 'sto', 'area', 'cabang'
    ],
    
    // Kalkulasi confidence yang disederhanakan
    calculateConfidence: function(input) {
      const lowerInput = input.toLowerCase();
      let score = 0;
      
      // Cek kata kunci utama
      const primaryMatches = this.primary.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      
      // Cek kata kunci pendukung
      const supportingMatches = this.supporting.filter(keyword => 
        lowerInput.includes(keyword.toLowerCase())
      ).length;
      
      if (primaryMatches > 0) {
        score = 75 + (primaryMatches * 10) + (supportingMatches * 2);
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
            EKOSISTEM,
            
            -- Klasifikasi HSI Bisnis
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
            
            -- Klasifikasi HSI Basic  
            CASE 
                WHEN UPPER(PRODUCT) = 'WMS' THEN 0
                WHEN (UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                THEN 1 
                ELSE 0 
            END as IS_HSI_BASIC,
            
            -- Klasifikasi Jenis Bundling
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
                
                ELSE 'Non Bundling'
            END as BUNDLING_TYPE,
            
            -- Klasifikasi Produk Digital
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

            -- Klasifikasi Jenis Transaksi (TYPE_TRANS)
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
                ) THEN 'PENJUALAN_BARU'
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
                ) THEN 'TAMBAH_LAYANAN'
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
                ) THEN 'MODIFIKASI'
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
                ) THEN 'PDA'
                WHEN TYPE_TRANS = 'MIGRASI' AND (
                    (UPPER(PACKAGE_NAME) LIKE '%HSIE%' 
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI BISNIS%'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET INDIBIZ %'
                     OR UPPER(PACKAGE_NAME) LIKE '%PAKET HSI B2B %'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSI INDIBIZ B2B%'
                     OR UPPER(PACKAGE_NAME) LIKE '%HSIEF%'
                     OR UPPER(PACKAGE_NAME) LIKE '%BASIC%'
                     OR UPPER(PACKAGE_NAME) LIKE '%INETF%')
                    AND UPPER(PRODUCT) != 'WMS'
                ) THEN 'MIGRASI'
                ELSE 'LAINNYA'
            END as JENIS_TRANSAKSI,

            -- Standarisasi Ekosistem (EKOSISTEM)
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
            END as EKOSISTEM_TERSTANDAR
            
        FROM USR_RPT.BRIGHTAI_SALES  -- CORRECTED: Added full table name
        WHERE ORDER_DATE >= TO_DATE('2025-01-01', 'YYYY-MM-DD')
          AND TGL_PS IS NOT NULL 
          AND ORDER_DATE IS NOT NULL
          AND ORDER_ID IS NOT NULL  -- ADDED: Pastikan ada order ID
          AND NCLI IS NOT NULL       -- ADDED: Pastikan ada customer identifier
          AND ND_HSI IS NOT NULL     -- ADDED: Pastikan ada HSI service identifier
    ),
    
    METRIK_INSTALASI AS (
        SELECT 
            REGIONAL,
            WITEL,
            DATEL,
            STO,
            
            -- ADDED: Fundamental metrics berdasarkan ketiga identifier
            COUNT(DISTINCT ORDER_ID) as TOTAL_ORDERS,
            COUNT(DISTINCT NCLI) as TOTAL_CUSTOMERS,
            COUNT(DISTINCT ND_HSI) as TOTAL_HSI_SERVICES,
            
            -- ADDED: Customer-Order-Service relationship metrics untuk instalasi
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as AVG_ORDERS_PER_CUSTOMER,
            ROUND(COUNT(DISTINCT ND_HSI) * 1.0 / NULLIF(COUNT(DISTINCT NCLI), 0), 2) as AVG_SERVICES_PER_CUSTOMER,
            ROUND(COUNT(DISTINCT ORDER_ID) * 1.0 / NULLIF(COUNT(DISTINCT ND_HSI), 0), 2) as AVG_ORDERS_PER_SERVICE,
            
            -- Total instalasi berdasarkan jenis (order-based)
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) as TOTAL_INSTALASI_HSI,
            COUNT(DISTINCT CASE WHEN IS_HSI_BISNIS = 1 THEN ORDER_ID END) as INSTALASI_HSI_BISNIS,
            COUNT(DISTINCT CASE WHEN IS_HSI_BASIC = 1 THEN ORDER_ID END) as INSTALASI_HSI_BASIC,
            
            -- ADDED: Service dan customer counts untuk instalasi
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ND_HSI END) as TOTAL_HSI_SERVICES_INSTALLED,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN NCLI END) as TOTAL_HSI_CUSTOMERS_INSTALLED,
            
            -- Metrik waktu untuk semua HSI (order-based untuk konsistensi dengan existing logic)
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_INSTALASI_HSI,
            PERCENTILE_CONT(0.5) WITHIN GROUP (
                ORDER BY CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                         THEN TGL_PS - ORDER_DATE END
            ) as MEDIAN_WAKTU_INSTALASI_HSI,
            
            -- ADDED: Service-based installation time metrics
            AVG(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                THEN TGL_PS - ORDER_DATE END) as AVG_SERVICE_INSTALLATION_TIME,
            
            -- Metrik waktu berdasarkan jenis produk
            AVG(CASE WHEN IS_HSI_BISNIS = 1 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_BISNIS,
            AVG(CASE WHEN IS_HSI_BASIC = 1 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_BASIC,
            
            -- Analisis rentang waktu
            MIN(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                THEN TGL_PS - ORDER_DATE END) as INSTALASI_TERCEPAT_HSI,
            MAX(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                THEN TGL_PS - ORDER_DATE END) as INSTALASI_TERLAMBAT_HSI,
            
            -- Kepatuhan SLA (target 7 hari) - berdasarkan order
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                               AND (TGL_PS - ORDER_DATE) <= 7 THEN ORDER_ID END) as SESUAI_SLA_7HARI,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                               AND (TGL_PS - ORDER_DATE) <= 14 THEN ORDER_ID END) as SESUAI_SLA_14HARI,
                               
            -- ADDED: SLA compliance berdasarkan service dan customer
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                               AND (TGL_PS - ORDER_DATE) <= 7 THEN ND_HSI END) as SERVICES_SLA_7HARI,
            COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                               AND (TGL_PS - ORDER_DATE) <= 7 THEN NCLI END) as CUSTOMERS_SLA_7HARI,
            
            -- Analisis waktu instalasi bundling
            AVG(CASE WHEN BUNDLING_TYPE = 'Hard Bundling' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_HARD_BUNDLING,
            AVG(CASE WHEN BUNDLING_TYPE = 'Non Bundling' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_STANDALONE,
            
            -- Waktu instalasi produk digital
            AVG(CASE WHEN IS_PIJAR_SEKOLAH = 1 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_PIJAR,
            AVG(CASE WHEN IS_OCA_INTERACTION = 1 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_OCA,
            
            -- Analisis Waktu Instalasi Berdasarkan Jenis Transaksi
            AVG(CASE WHEN JENIS_TRANSAKSI = 'PENJUALAN_BARU' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_PENJUALAN_BARU,
            AVG(CASE WHEN JENIS_TRANSAKSI = 'TAMBAH_LAYANAN' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_TAMBAH_LAYANAN,
            AVG(CASE WHEN JENIS_TRANSAKSI = 'MODIFIKASI' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_MODIFIKASI,
            AVG(CASE WHEN JENIS_TRANSAKSI = 'PDA' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_PDA,

            -- Kepatuhan SLA Berdasarkan Jenis Transaksi
            COUNT(DISTINCT CASE WHEN JENIS_TRANSAKSI = 'PENJUALAN_BARU' 
                               AND (TGL_PS - ORDER_DATE) <= 7 THEN ORDER_ID END) as SLA_PENJUALAN_BARU_7HARI,
            COUNT(DISTINCT CASE WHEN JENIS_TRANSAKSI = 'PENJUALAN_BARU' THEN ORDER_ID END) as TOTAL_PENJUALAN_BARU,
            COUNT(DISTINCT CASE WHEN JENIS_TRANSAKSI = 'TAMBAH_LAYANAN' 
                               AND (TGL_PS - ORDER_DATE) <= 7 THEN ORDER_ID END) as SLA_TAMBAH_LAYANAN_7HARI,
            COUNT(DISTINCT CASE WHEN JENIS_TRANSAKSI = 'TAMBAH_LAYANAN' THEN ORDER_ID END) as TOTAL_TAMBAH_LAYANAN,

            -- Analisis Waktu Instalasi Berdasarkan Ekosistem
            AVG(CASE WHEN EKOSISTEM_TERSTANDAR = 'PENDIDIKAN' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_PENDIDIKAN,
            AVG(CASE WHEN EKOSISTEM_TERSTANDAR = 'PEMERINTAHAN' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_PEMERINTAHAN,
            AVG(CASE WHEN EKOSISTEM_TERSTANDAR = 'KESEHATAN' 
                THEN TGL_PS - ORDER_DATE END) as RATA_RATA_WAKTU_KESEHATAN,

            -- Kepatuhan SLA Berdasarkan Ekosistem
            COUNT(DISTINCT CASE WHEN EKOSISTEM_TERSTANDAR = 'PENDIDIKAN' 
                               AND (TGL_PS - ORDER_DATE) <= 7 THEN ORDER_ID END) as SLA_PENDIDIKAN_7HARI,
            COUNT(DISTINCT CASE WHEN EKOSISTEM_TERSTANDAR = 'PENDIDIKAN' THEN ORDER_ID END) as TOTAL_PENDIDIKAN,
            COUNT(DISTINCT CASE WHEN EKOSISTEM_TERSTANDAR = 'PEMERINTAHAN' 
                               AND (TGL_PS - ORDER_DATE) <= 7 THEN ORDER_ID END) as SLA_PEMERINTAHAN_7HARI,
            COUNT(DISTINCT CASE WHEN EKOSISTEM_TERSTANDAR = 'PEMERINTAHAN' THEN ORDER_ID END) as TOTAL_PEMERINTAHAN,
            
            -- Pengukuran konsistensi
            STDDEV(CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) 
                   THEN TGL_PS - ORDER_DATE END) as KONSISTENSI_WAKTU_STDDEV
            
        FROM HSI_CLASSIFICATION
        WHERE (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1)
        GROUP BY REGIONAL, WITEL, DATEL, STO
        HAVING COUNT(DISTINCT CASE WHEN (IS_HSI_BISNIS = 1 OR IS_HSI_BASIC = 1) THEN ORDER_ID END) >= 3
    ),
    
    PERFORMA_INSTALASI AS (
        SELECT *,
            -- Persentase kepatuhan SLA (order-based)
            ROUND(SESUAI_SLA_7HARI * 100.0 / NULLIF(TOTAL_INSTALASI_HSI, 0), 1) as KEPATUHAN_SLA_7HARI,
            ROUND(SESUAI_SLA_14HARI * 100.0 / NULLIF(TOTAL_INSTALASI_HSI, 0), 1) as KEPATUHAN_SLA_14HARI,
            
            -- ADDED: Service dan customer SLA compliance rates
            ROUND(SERVICES_SLA_7HARI * 100.0 / NULLIF(TOTAL_HSI_SERVICES_INSTALLED, 0), 1) as SERVICE_SLA_COMPLIANCE_7HARI,
            ROUND(CUSTOMERS_SLA_7HARI * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS_INSTALLED, 0), 1) as CUSTOMER_SLA_COMPLIANCE_7HARI,
            
            -- Persentase Kepatuhan SLA Berdasarkan Jenis Transaksi
            ROUND(SLA_PENJUALAN_BARU_7HARI * 100.0 / NULLIF(TOTAL_PENJUALAN_BARU, 0), 1) as KEPATUHAN_SLA_PENJUALAN_BARU,
            ROUND(SLA_TAMBAH_LAYANAN_7HARI * 100.0 / NULLIF(TOTAL_TAMBAH_LAYANAN, 0), 1) as KEPATUHAN_SLA_TAMBAH_LAYANAN,

            -- Persentase Kepatuhan SLA Berdasarkan Ekosistem
            ROUND(SLA_PENDIDIKAN_7HARI * 100.0 / NULLIF(TOTAL_PENDIDIKAN, 0), 1) as KEPATUHAN_SLA_PENDIDIKAN,
            ROUND(SLA_PEMERINTAHAN_7HARI * 100.0 / NULLIF(TOTAL_PEMERINTAHAN, 0), 1) as KEPATUHAN_SLA_PEMERINTAHAN,
            
            -- ADDED: Enhanced performance categorization dengan customer dan service metrics
            CASE 
                WHEN RATA_RATA_WAKTU_INSTALASI_HSI <= 5 AND 
                     SESUAI_SLA_7HARI * 100.0 / NULLIF(TOTAL_INSTALASI_HSI, 0) >= 85 AND
                     CUSTOMERS_SLA_7HARI * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS_INSTALLED, 0) >= 80 THEN 'SANGAT_BAIK'
                WHEN RATA_RATA_WAKTU_INSTALASI_HSI <= 7 AND 
                     SESUAI_SLA_7HARI * 100.0 / NULLIF(TOTAL_INSTALASI_HSI, 0) >= 75 AND
                     CUSTOMERS_SLA_7HARI * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS_INSTALLED, 0) >= 70 THEN 'BAIK'
                WHEN RATA_RATA_WAKTU_INSTALASI_HSI <= 10 AND 
                     SESUAI_SLA_7HARI * 100.0 / NULLIF(TOTAL_INSTALASI_HSI, 0) >= 60 AND
                     CUSTOMERS_SLA_7HARI * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS_INSTALLED, 0) >= 60 THEN 'CUKUP'
                WHEN RATA_RATA_WAKTU_INSTALASI_HSI <= 14 AND 
                     SESUAI_SLA_14HARI * 100.0 / NULLIF(TOTAL_INSTALASI_HSI, 0) >= 70 THEN 'PERLU_PERBAIKAN'
                ELSE 'KRITIS'
            END as KATEGORI_PERFORMA,
            
            -- ADDED: Enhanced efficiency score dengan customer-service relationship
            ROUND(
                CASE 
                    WHEN RATA_RATA_WAKTU_INSTALASI_HSI <= 5 THEN 40
                    WHEN RATA_RATA_WAKTU_INSTALASI_HSI <= 7 THEN 35
                    WHEN RATA_RATA_WAKTU_INSTALASI_HSI <= 10 THEN 25
                    WHEN RATA_RATA_WAKTU_INSTALASI_HSI <= 14 THEN 15
                    ELSE 5
                END +
                (SESUAI_SLA_7HARI * 100.0 / NULLIF(TOTAL_INSTALASI_HSI, 0) * 0.25) +
                (CUSTOMERS_SLA_7HARI * 100.0 / NULLIF(TOTAL_HSI_CUSTOMERS_INSTALLED, 0) * 0.15) +
                (SERVICES_SLA_7HARI * 100.0 / NULLIF(TOTAL_HSI_SERVICES_INSTALLED, 0) * 0.10) +
                GREATEST(0, (20 - COALESCE(KONSISTENSI_WAKTU_STDDEV, 20)) / 20 * 10)
            , 1) as SKOR_EFISIENSI
            
        FROM METRIK_INSTALASI
    )
    SELECT 
        REGIONAL,
        WITEL,
        DATEL,
        STO,
        TOTAL_ORDERS,
        TOTAL_CUSTOMERS,
        TOTAL_HSI_SERVICES,
        TOTAL_INSTALASI_HSI,
        INSTALASI_HSI_BISNIS,
        INSTALASI_HSI_BASIC,
        TOTAL_HSI_SERVICES_INSTALLED,
        TOTAL_HSI_CUSTOMERS_INSTALLED,
        AVG_ORDERS_PER_CUSTOMER,
        AVG_SERVICES_PER_CUSTOMER,
        AVG_ORDERS_PER_SERVICE,
        ROUND(RATA_RATA_WAKTU_INSTALASI_HSI, 1) as RATA_RATA_WAKTU_HSI_HARI,
        ROUND(MEDIAN_WAKTU_INSTALASI_HSI, 1) as MEDIAN_WAKTU_HSI_HARI,
        ROUND(RATA_RATA_WAKTU_BISNIS, 1) as RATA_RATA_WAKTU_BISNIS_HARI,
        ROUND(RATA_RATA_WAKTU_BASIC, 1) as RATA_RATA_WAKTU_BASIC_HARI,
        INSTALASI_TERCEPAT_HSI,
        INSTALASI_TERLAMBAT_HSI,
        SESUAI_SLA_7HARI,
        SESUAI_SLA_14HARI,
        SERVICES_SLA_7HARI,
        CUSTOMERS_SLA_7HARI,
        KEPATUHAN_SLA_7HARI,
        KEPATUHAN_SLA_14HARI,
        SERVICE_SLA_COMPLIANCE_7HARI,
        CUSTOMER_SLA_COMPLIANCE_7HARI,
        ROUND(RATA_RATA_WAKTU_HARD_BUNDLING, 1) as RATA_RATA_WAKTU_HARD_BUNDLING_HARI,
        ROUND(RATA_RATA_WAKTU_STANDALONE, 1) as RATA_RATA_WAKTU_STANDALONE_HARI,
        ROUND(RATA_RATA_WAKTU_PIJAR, 1) as RATA_RATA_WAKTU_PIJAR_HARI,
        ROUND(RATA_RATA_WAKTU_OCA, 1) as RATA_RATA_WAKTU_OCA_HARI,
        ROUND(RATA_RATA_WAKTU_PENJUALAN_BARU, 1) as RATA_RATA_WAKTU_PENJUALAN_BARU_HARI,
        ROUND(RATA_RATA_WAKTU_TAMBAH_LAYANAN, 1) as RATA_RATA_WAKTU_TAMBAH_LAYANAN_HARI,
        ROUND(RATA_RATA_WAKTU_MODIFIKASI, 1) as RATA_RATA_WAKTU_MODIFIKASI_HARI,
        ROUND(RATA_RATA_WAKTU_PDA, 1) as RATA_RATA_WAKTU_PDA_HARI,
        KEPATUHAN_SLA_PENJUALAN_BARU,
        KEPATUHAN_SLA_TAMBAH_LAYANAN,
        ROUND(RATA_RATA_WAKTU_PENDIDIKAN, 1) as RATA_RATA_WAKTU_PENDIDIKAN_HARI,
        ROUND(RATA_RATA_WAKTU_PEMERINTAHAN, 1) as RATA_RATA_WAKTU_PEMERINTAHAN_HARI,
        ROUND(RATA_RATA_WAKTU_KESEHATAN, 1) as RATA_RATA_WAKTU_KESEHATAN_HARI,
        KEPATUHAN_SLA_PENDIDIKAN,
        KEPATUHAN_SLA_PEMERINTAHAN,
        ROUND(KONSISTENSI_WAKTU_STDDEV, 1) as KONSISTENSI_WAKTU,
        KATEGORI_PERFORMA,
        SKOR_EFISIENSI,
        RANK() OVER (ORDER BY RATA_RATA_WAKTU_INSTALASI_HSI ASC, KEPATUHAN_SLA_7HARI DESC) as PERINGKAT_NASIONAL,
        RANK() OVER (ORDER BY CUSTOMER_SLA_COMPLIANCE_7HARI DESC, RATA_RATA_WAKTU_INSTALASI_HSI ASC) as PERINGKAT_CUSTOMER_EXPERIENCE,
        RANK() OVER (ORDER BY SERVICE_SLA_COMPLIANCE_7HARI DESC, RATA_RATA_WAKTU_INSTALASI_HSI ASC) as PERINGKAT_SERVICE_DELIVERY
    FROM PERFORMA_INSTALASI
    ORDER BY RATA_RATA_WAKTU_INSTALASI_HSI ASC, KEPATUHAN_SLA_7HARI DESC
  `,

  BUSINESS_LOGIC: {
    hitungSkorEfisiensi: function(rata_rata_waktu, kepatuhan_sla, customer_sla, service_sla, konsistensi) {
      let efisiensi = 0;
      
      // Komponen kecepatan (40%)
      if (rata_rata_waktu <= 5) efisiensi += 40;
      else if (rata_rata_waktu <= 7) efisiensi += 35;
      else if (rata_rata_waktu <= 10) efisiensi += 25;
      else if (rata_rata_waktu <= 14) efisiensi += 15;
      else efisiensi += 5;
      
      // Komponen kepatuhan SLA order (25%)
      efisiensi += (kepatuhan_sla * 0.25);
      
      // ADDED: Komponen customer experience (15%)
      efisiensi += (customer_sla * 0.15);
      
      // ADDED: Komponen service delivery (10%)
      efisiensi += (service_sla * 0.10);
      
      // Komponen konsistensi (10%) - variasi lebih rendah lebih baik
      const skor_konsistensi = Math.max(0, (20 - konsistensi) / 20 * 10);
      efisiensi += skor_konsistensi;
      
      return Math.round(efisiensi);
    },
    
    identifikasiAreaPerbaikan: function(kategori_performa, rata_rata_waktu, kepatuhan_sla, customer_sla, service_sla, waktu_bundling) {
      const area = [];
      
      if (rata_rata_waktu > 10) {
        area.push('Optimasi proses instalasi untuk mempercepat waktu tunggu');
      }
      
      if (kepatuhan_sla < 75) {
        area.push('Peningkatan ketepatan waktu instalasi sesuai SLA');
      }
      
      // ADDED: Customer experience improvements
      if (customer_sla < 70) {
        area.push('Perbaikan customer experience dalam proses instalasi');
      }
      
      // ADDED: Service delivery improvements
      if (service_sla < 75) {
        area.push('Optimasi service delivery untuk meningkatkan kualitas layanan');
      }
      
      if (waktu_bundling && waktu_bundling > rata_rata_waktu * 1.5) {
        area.push('Perbaikan koordinasi untuk produk bundling');
      }
      
      if (kategori_performa === 'KRITIS') {
        area.push('Audit menyeluruh proses operasional instalasi multi-dimensional');
      }
      
      return area.length > 0 ? area : ['Pertahankan performa yang sudah baik di semua dimensi'];
    },
    
    analisisPolaPemakaianWaktu: function(data) {
      const analisis = {
        total_sto: data.length,
        distribusi_performa: {},
        sto_tercepat: [],
        sto_terlambat: [],
        sto_customer_excellence: [],
        sto_service_excellence: [],
        wawasan: []
      };
      
      // Distribusi performa
      analisis.distribusi_performa = {
        sangat_baik: data.filter(d => d.KATEGORI_PERFORMA === 'SANGAT_BAIK').length,
        baik: data.filter(d => d.KATEGORI_PERFORMA === 'BAIK').length,
        cukup: data.filter(d => d.KATEGORI_PERFORMA === 'CUKUP').length,
        perlu_perbaikan: data.filter(d => d.KATEGORI_PERFORMA === 'PERLU_PERBAIKAN').length,
        kritis: data.filter(d => d.KATEGORI_PERFORMA === 'KRITIS').length
      };
      
      // STO tercepat
      analisis.sto_tercepat = data
        .filter(d => d.KATEGORI_PERFORMA === 'SANGAT_BAIK')
        .slice(0, 5)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          rata_rata_waktu: `${d.RATA_RATA_WAKTU_HSI_HARI} hari`,
          kepatuhan_sla: `${d.KEPATUHAN_SLA_7HARI}%`,
          customer_sla: `${d.CUSTOMER_SLA_COMPLIANCE_7HARI}%`,
          efisiensi: d.SKOR_EFISIENSI
        }));
        
      // STO terlambat
      analisis.sto_terlambat = data
        .filter(d => d.KATEGORI_PERFORMA === 'KRITIS')
        .slice(0, 5)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          rata_rata_waktu: `${d.RATA_RATA_WAKTU_HSI_HARI} hari`,
          kepatuhan_sla: `${d.KEPATUHAN_SLA_7HARI}%`,
          customer_sla: `${d.CUSTOMER_SLA_COMPLIANCE_7HARI}%`,
          efisiensi: d.SKOR_EFISIENSI
        }));
        
      // ADDED: Customer excellence STO
      analisis.sto_customer_excellence = data
        .sort((a, b) => b.CUSTOMER_SLA_COMPLIANCE_7HARI - a.CUSTOMER_SLA_COMPLIANCE_7HARI)
        .slice(0, 5)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          customer_sla: `${d.CUSTOMER_SLA_COMPLIANCE_7HARI}%`,
          total_customers: d.TOTAL_HSI_CUSTOMERS_INSTALLED,
          ranking: d.PERINGKAT_CUSTOMER_EXPERIENCE
        }));
        
      // ADDED: Service excellence STO
      analisis.sto_service_excellence = data
        .sort((a, b) => b.SERVICE_SLA_COMPLIANCE_7HARI - a.SERVICE_SLA_COMPLIANCE_7HARI)
        .slice(0, 5)
        .map(d => ({
          sto: d.STO,
          witel: d.WITEL,
          service_sla: `${d.SERVICE_SLA_COMPLIANCE_7HARI}%`,
          total_services: d.TOTAL_HSI_SERVICES_INSTALLED,
          ranking: d.PERINGKAT_SERVICE_DELIVERY
        }));
      
      // Menghasilkan wawasan
      const rata_rata_waktu_instalasi = data.reduce((sum, d) => sum + d.RATA_RATA_WAKTU_HSI_HARI, 0) / data.length;
      const rata_rata_kepatuhan_sla = data.reduce((sum, d) => sum + d.KEPATUHAN_SLA_7HARI, 0) / data.length;
      const rata_rata_customer_sla = data.reduce((sum, d) => sum + d.CUSTOMER_SLA_COMPLIANCE_7HARI, 0) / data.length;
      const rata_rata_service_sla = data.reduce((sum, d) => sum + d.SERVICE_SLA_COMPLIANCE_7HARI, 0) / data.length;
      
      analisis.wawasan.push(`Rata-rata waktu instalasi HSI secara keseluruhan adalah ${rata_rata_waktu_instalasi.toFixed(1)} hari`);
      analisis.wawasan.push(`Rata-rata tingkat kepatuhan SLA 7 hari order adalah ${rata_rata_kepatuhan_sla.toFixed(1)}%`);
      analisis.wawasan.push(`Rata-rata customer SLA compliance adalah ${rata_rata_customer_sla.toFixed(1)}%`);
      analisis.wawasan.push(`Rata-rata service SLA compliance adalah ${rata_rata_service_sla.toFixed(1)}%`);
      
      if (analisis.distribusi_performa.kritis > 0) {
        analisis.wawasan.push(`Terdapat ${analisis.distribusi_performa.kritis} STO dengan performa kritis yang memerlukan perbaikan segera`);
      }
      
      // ADDED: Multi-dimensional insights
      const customer_service_gap = data.filter(d => Math.abs(d.CUSTOMER_SLA_COMPLIANCE_7HARI - d.SERVICE_SLA_COMPLIANCE_7HARI) > 15).length;
      if (customer_service_gap > 0) {
        analisis.wawasan.push(`${customer_service_gap} STO memiliki gap signifikan antara customer dan service SLA compliance`);
      }
      
      const efficiency_insights = data.filter(d => d.AVG_ORDERS_PER_SERVICE > 2.0).length;
      if (efficiency_insights > 0) {
        analisis.wawasan.push(`${efficiency_insights} STO menunjukkan efisiensi tinggi dengan >2 order per service`);
      }
      
      const bisnis_vs_basic = data.filter(d => d.RATA_RATA_WAKTU_BISNIS_HARI && d.RATA_RATA_WAKTU_BASIC_HARI);
      if (bisnis_vs_basic.length > 0) {
        const rata_rata_bisnis = bisnis_vs_basic.reduce((sum, d) => sum + d.RATA_RATA_WAKTU_BISNIS_HARI, 0) / bisnis_vs_basic.length;
        const rata_rata_basic = bisnis_vs_basic.reduce((sum, d) => sum + d.RATA_RATA_WAKTU_BASIC_HARI, 0) / bisnis_vs_basic.length;
        
        if (rata_rata_bisnis > rata_rata_basic) {
          analisis.wawasan.push('Instalasi HSI Bisnis memerlukan waktu lebih lama dibanding HSI Basic');
        }
      }
      
      return analisis;
    },
    
    buatRencanaTindakan: function(kategori_performa, rata_rata_waktu, kepatuhan_sla, customer_sla, service_sla) {
      const rencana = {
        'KRITIS': {
          prioritas: 'SANGAT TINGGI',
          timeline: '1-2 minggu',
          tindakan: [
            'Audit proses instalasi secara menyeluruh multi-dimensional',
            'Identifikasi hambatan utama dalam customer experience dan service delivery',
            'Realokasi sumber daya untuk mempercepat proses di semua dimensi',
            'Implementasi pemantauan harian customer dan service metrics'
          ]
        },
        'PERLU_PERBAIKAN': {
          prioritas: 'TINGGI',
          timeline: '2-4 minggu',
          tindakan: [
            'Analisis akar masalah keterlambatan dari perspektif customer dan service',
            'Pelatihan tim instalasi dengan fokus customer experience',
            'Perbaikan koordinasi antar unit untuk service delivery excellence',
            'Pemantauan mingguan kemajuan multi-dimensional'
          ]
        },
        'CUKUP': {
          prioritas: 'SEDANG',
          timeline: '1-2 bulan',
          tindakan: [
            'Optimasi proses untuk efisiensi customer dan service yang lebih baik',
            'Standarisasi praktik terbaik multi-dimensional',
            'Peningkatan perencanaan dan penjadwalan berbasis customer journey',
            'Tinjauan bulanan customer dan service satisfaction'
          ]
        },
        'BAIK': {
          prioritas: 'RENDAH',
          timeline: '2-3 bulan',
          tindakan: [
            'Pertahankan standar saat ini di semua dimensi',
            'Inisiatif perbaikan berkelanjutan customer dan service excellence',
            'Berbagi praktik terbaik multi-dimensional ke unit lain',
            'Tinjauan triwulan dengan fokus innovation'
          ]
        },
        'SANGAT_BAIK': {
          prioritas: 'TOLOK_UKUR',
          timeline: 'Berkelanjutan',
          tindakan: [
            'Dokumentasi praktik terbaik multi-dimensional',
            'Mentoring STO dengan performa rendah di customer dan service excellence',
            'Inovasi untuk peningkatan lebih lanjut di semua dimensi',
            'Pertahankan standar keunggulan sebagai benchmark nasional'
          ]
        }
      };
      
      return rencana[kategori_performa] || {
        prioritas: 'EVALUASI',
        timeline: 'TBD',
        tindakan: ['Diperlukan analisis khusus multi-dimensional']
      };
    },
    
    formatResponIndonesia: function(data) {
      const pola = this.analisisPolaPemakaianWaktu(data);
      
      const hasil_analisis = data.map(sto => {
        const perbaikan = this.identifikasiAreaPerbaikan(
          sto.KATEGORI_PERFORMA,
          sto.RATA_RATA_WAKTU_HSI_HARI,
          sto.KEPATUHAN_SLA_7HARI,
          sto.CUSTOMER_SLA_COMPLIANCE_7HARI,
          sto.SERVICE_SLA_COMPLIANCE_7HARI,
          sto.RATA_RATA_WAKTU_HARD_BUNDLING_HARI
        );
        
        const rencanaTindakan = this.buatRencanaTindakan(
          sto.KATEGORI_PERFORMA,
          sto.RATA_RATA_WAKTU_HSI_HARI,
          sto.KEPATUHAN_SLA_7HARI,
          sto.CUSTOMER_SLA_COMPLIANCE_7HARI,
          sto.SERVICE_SLA_COMPLIANCE_7HARI
        );
        
        return {
          identitas_sto: {
            nama_sto: sto.STO,
            datel: sto.DATEL,
            witel: sto.WITEL,
            regional: sto.REGIONAL
          },
          
          metrik_volume: {
            total_order: sto.TOTAL_ORDERS.toLocaleString('id-ID'),
            total_customer: sto.TOTAL_CUSTOMERS.toLocaleString('id-ID'),
            total_layanan_hsi: sto.TOTAL_HSI_SERVICES.toLocaleString('id-ID'),
            efisiensi_customer: `${sto.AVG_ORDERS_PER_CUSTOMER} order/customer`,
            efisiensi_layanan: `${sto.AVG_ORDERS_PER_SERVICE} order/layanan`,
            penetrasi_multi_service: `${sto.AVG_SERVICES_PER_CUSTOMER} layanan/customer`
          },
          
          metrik_instalasi: {
            total_instalasi_hsi: sto.TOTAL_INSTALASI_HSI.toLocaleString('id-ID'),
            instalasi_hsi_bisnis: sto.INSTALASI_HSI_BISNIS.toLocaleString('id-ID'),
            instalasi_hsi_basic: sto.INSTALASI_HSI_BASIC.toLocaleString('id-ID'),
            layanan_hsi_terinstal: sto.TOTAL_HSI_SERVICES_INSTALLED.toLocaleString('id-ID'),
            customer_hsi_terinstal: sto.TOTAL_HSI_CUSTOMERS_INSTALLED.toLocaleString('id-ID'),
            rata_rata_waktu_hsi: `${sto.RATA_RATA_WAKTU_HSI_HARI} hari`,
            median_waktu_hsi: `${sto.MEDIAN_WAKTU_HSI_HARI} hari`,
            waktu_tercepat: `${sto.INSTALASI_TERCEPAT_HSI} hari`,
            waktu_terlambat: `${sto.INSTALASI_TERLAMBAT_HSI} hari`
          },
          
          analisis_per_produk: {
            rata_rata_bisnis: `${sto.RATA_RATA_WAKTU_BISNIS_HARI || 0} hari`,
            rata_rata_basic: `${sto.RATA_RATA_WAKTU_BASIC_HARI || 0} hari`,
            rata_rata_hard_bundling: `${sto.RATA_RATA_WAKTU_HARD_BUNDLING_HARI || 0} hari`,
            rata_rata_standalone: `${sto.RATA_RATA_WAKTU_STANDALONE_HARI || 0} hari`,
            rata_rata_pijar: `${sto.RATA_RATA_WAKTU_PIJAR_HARI || 0} hari`,
            rata_rata_oca: `${sto.RATA_RATA_WAKTU_OCA_HARI || 0} hari`
          },
          
          analisis_jenis_transaksi: {
            rata_rata_penjualan_baru: `${sto.RATA_RATA_WAKTU_PENJUALAN_BARU_HARI || 0} hari`,
            rata_rata_tambah_layanan: `${sto.RATA_RATA_WAKTU_TAMBAH_LAYANAN_HARI || 0} hari`,
            rata_rata_modifikasi: `${sto.RATA_RATA_WAKTU_MODIFIKASI_HARI || 0} hari`,
            rata_rata_pda: `${sto.RATA_RATA_WAKTU_PDA_HARI || 0} hari`,
            sla_penjualan_baru: `${sto.KEPATUHAN_SLA_PENJUALAN_BARU || 0}%`,
            sla_tambah_layanan: `${sto.KEPATUHAN_SLA_TAMBAH_LAYANAN || 0}%`
          },
          
          analisis_ekosistem: {
            rata_rata_pendidikan: `${sto.RATA_RATA_WAKTU_PENDIDIKAN_HARI || 0} hari`,
            rata_rata_pemerintahan: `${sto.RATA_RATA_WAKTU_PEMERINTAHAN_HARI || 0} hari`,
            rata_rata_kesehatan: `${sto.RATA_RATA_WAKTU_KESEHATAN_HARI || 0} hari`,
            sla_pendidikan: `${sto.KEPATUHAN_SLA_PENDIDIKAN || 0}%`,
            sla_pemerintahan: `${sto.KEPATUHAN_SLA_PEMERINTAHAN || 0}%`
          },
          
          kepatuhan_sla: {
            dalam_sla_7_hari: sto.SESUAI_SLA_7HARI.toLocaleString('id-ID'),
            dalam_sla_14_hari: sto.SESUAI_SLA_14HARI.toLocaleString('id-ID'),
            layanan_sla_7_hari: sto.SERVICES_SLA_7HARI.toLocaleString('id-ID'),
            customer_sla_7_hari: sto.CUSTOMERS_SLA_7HARI.toLocaleString('id-ID'),
            persentase_sla_7_hari: `${sto.KEPATUHAN_SLA_7HARI}%`,
            persentase_sla_14_hari: `${sto.KEPATUHAN_SLA_14HARI}%`,
            customer_sla_compliance: `${sto.CUSTOMER_SLA_COMPLIANCE_7HARI}%`,
            service_sla_compliance: `${sto.SERVICE_SLA_COMPLIANCE_7HARI}%`,
            konsistensi_waktu: `${sto.KONSISTENSI_WAKTU} hari (standar deviasi)`
          },
          
          evaluasi_performa: {
            kategori: sto.KATEGORI_PERFORMA.replace('_', ' '),
            skor_efisiensi: sto.SKOR_EFISIENSI,
            peringkat_nasional: sto.PERINGKAT_NASIONAL,
            peringkat_customer_experience: sto.PERINGKAT_CUSTOMER_EXPERIENCE,
            peringkat_service_delivery: sto.PERINGKAT_SERVICE_DELIVERY
          },
          
          area_perbaikan: perbaikan,
          rencana_tindakan: rencanaTindakan
        };
      });
      
      return {
        ringkasan: 'Analisis Waktu Instalasi HSI Multi-Dimensional per Wilayah untuk Periode 2025',
        total_sto_dianalisis: pola.total_sto,
        
        distribusi_performa: pola.distribusi_performa,
        
        sto_unggulan: {
          sto_tercepat: pola.sto_tercepat,
          customer_excellence: pola.sto_customer_excellence,
          service_excellence: pola.sto_service_excellence
        },
        
        sto_terlambat: pola.sto_terlambat,
        
        wawasan_utama: pola.wawasan,
        
        target_sla: {
          target_order_7_hari: '≥ 75%',
          target_customer_7_hari: '≥ 70%',
          target_service_7_hari: '≥ 75%',
          target_14_hari: '≥ 90%',
          rata_rata_maksimal: '≤ 7 hari',
          kategori_minimal: 'BAIK'
        },
        
        detail_sto: hasil_analisis.slice(0, 20),
        
        rekomendasi_strategis: [
          'Prioritaskan STO dengan kategori kritis untuk perbaikan segera multi-dimensional',
          'Replikasi praktik terbaik dari STO tercepat ke yang terlambat dengan fokus customer experience',
          'Standarisasi proses instalasi untuk mengurangi variabilitas waktu di semua dimensi',
          'Implementasi sistem peringatan dini untuk memantau SLA secara real-time customer dan service',
          'Fokus perbaikan pada produk bundling yang memerlukan waktu lebih lama',
          'Optimasi proses berdasarkan jenis transaksi dengan waktu tunggu terpanjang',
          'Kembangkan strategi khusus untuk ekosistem dengan kompleksitas instalasi tinggi',
          'Implementasi customer journey mapping untuk meningkatkan customer SLA compliance',
          'Optimasi service delivery process untuk meningkatkan service excellence',
          'Focus pada STO dengan gap besar antara customer dan service SLA compliance'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      const lowerInput = userInput.toLowerCase();
      
      // ADDED: Enhanced focus area detection
      let focus_area = 'waktu_instalasi';
      if (lowerInput.includes('sla')) {
        focus_area = 'kepatuhan_sla';
      } else if (lowerInput.includes('customer') || lowerInput.includes('pelanggan')) {
        focus_area = 'customer_experience';
      } else if (lowerInput.includes('service') || lowerInput.includes('layanan')) {
        focus_area = 'service_delivery';
      }
      
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: focus_area,
        requires_customer_analysis: lowerInput.includes('customer') || lowerInput.includes('pelanggan'),
        requires_service_analysis: lowerInput.includes('service') || lowerInput.includes('layanan')
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};