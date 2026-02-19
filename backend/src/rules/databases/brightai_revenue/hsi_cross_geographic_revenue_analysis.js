// ========================================
// RULE mart_008: HSI CROSS-GEOGRAPHIC REVENUE ANALYSIS
// ========================================
const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');
module.exports = {
  RULE_META: {
    RULE_ID: 'mart_008',
    RULE_NAME: 'hsi_cross_geographic_revenue_analysis',
    DESCRIPTION: 'Analisis revenue HSI lintas geografis untuk mengidentifikasi pelanggan multi-lokasi dan opportunity expansion',
    DATABASE: 'BRIGHTAI_REVENUE',
    CATEGORY: 'geographic_analytics',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("BRIGHTAI_REVENUE"),

  KEYWORD_PATTERNS: {
    primary: [
      'cross geographic hsi', 'multi lokasi hsi', 'lintas wilayah hsi',
      'expansion geographic hsi', 'multi regional hsi', 'cross location hsi',
      'geographic expansion hsi', 'multi area hsi', 'lintas geographic internet'
    ],
    supporting: [
      'cross', 'lintas', 'multi', 'expansion', 'geographic', 'geografis',
      'lokasi', 'wilayah', 'area', 'regional', 'witel', 'datel', 'sto',
      'hsi', 'internet', 'opportunity', 'penetrasi', 'coverage'
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
        score = 85 + (primaryMatches * 8) + (supportingMatches * 2);
      } else if (supportingMatches >= 4) {
        score = 70 + (supportingMatches * 4);
      }
      
      return Math.min(score, 100);
    }
  },

  SQL_QUERY: `
    WITH CUSTOMER_GEOGRAPHIC_FOOTPRINT AS (
        SELECT 
            NIP_NAS,
            NCLI,
            COUNT(DISTINCT REGIONAL_BILL) as REGIONAL_COUNT,
            COUNT(DISTINCT WITEL_BILL) as WITEL_COUNT,
            COUNT(DISTINCT DATEL) as DATEL_COUNT,
            COUNT(DISTINCT CSTO) as STO_COUNT,
            COUNT(DISTINCT ND) as TOTAL_SERVICES,
            SUM(REVENUE) as TOTAL_CUSTOMER_REVENUE,
            
            -- Geographic presence classification
            CASE 
                WHEN COUNT(DISTINCT REGIONAL_BILL) > 1 THEN 'MULTI_REGIONAL_CUSTOMER'
                WHEN COUNT(DISTINCT WITEL_BILL) > 1 THEN 'MULTI_WITEL_CUSTOMER'
                WHEN COUNT(DISTINCT DATEL) > 1 THEN 'MULTI_DATEL_CUSTOMER'
                WHEN COUNT(DISTINCT CSTO) > 1 THEN 'MULTI_STO_CUSTOMER'
                ELSE 'SINGLE_LOCATION_CUSTOMER'
            END as GEOGRAPHIC_PRESENCE_TYPE,
            
            -- Collect geographic details
            LISTAGG(DISTINCT REGIONAL_BILL, ',') WITHIN GROUP (ORDER BY REGIONAL_BILL) as REGIONAL_LIST,
            LISTAGG(DISTINCT WITEL_BILL, ',') WITHIN GROUP (ORDER BY WITEL_BILL) as WITEL_LIST,
            LISTAGG(DISTINCT DATEL, ',') WITHIN GROUP (ORDER BY DATEL) as DATEL_LIST,
            LISTAGG(DISTINCT CSTO, ',') WITHIN GROUP (ORDER BY CSTO) as STO_LIST
            
        FROM USR_RPT.BRIGHTAI_REVENUE
        WHERE GROUP4 = 'High Speed Internet'
          AND REVENUE > 0
          AND REGIONAL_BILL IS NOT NULL
          AND WITEL_BILL IS NOT NULL
          AND DATEL IS NOT NULL
          AND CSTO IS NOT NULL
          AND LSTO IS NOT NULL
          AND NIP_NAS IS NOT NULL
          AND NCLI IS NOT NULL
          AND ND IS NOT NULL
        GROUP BY NIP_NAS, NCLI
    ),
    
    GEOGRAPHIC_REVENUE_MATRIX AS (
        SELECT 
            p.REGIONAL_BILL,
            p.WITEL_BILL,
            p.DATEL,
            p.CSTO,
            p.LSTO,
            cgf.GEOGRAPHIC_PRESENCE_TYPE,
            
            -- Customer and service metrics
            COUNT(DISTINCT p.NIP_NAS) as TOTAL_CUSTOMERS,
            COUNT(DISTINCT p.NCLI) as TOTAL_NCLI,
            COUNT(DISTINCT p.ND) as TOTAL_SERVICES,
            
            -- Revenue metrics
            SUM(p.REVENUE) as TOTAL_REVENUE,
            ROUND(AVG(p.REVENUE), 0) as AVG_REVENUE_PER_SERVICE,
            ROUND(SUM(p.REVENUE) / NULLIF(COUNT(DISTINCT p.NIP_NAS), 0), 0) as REVENUE_PER_CUSTOMER,
            ROUND(SUM(p.REVENUE) / NULLIF(COUNT(DISTINCT p.NCLI), 0), 0) as REVENUE_PER_NCLI,
            
            -- Multi-location customer metrics
            COUNT(DISTINCT CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'MULTI_REGIONAL_CUSTOMER' THEN p.NIP_NAS END) as MULTI_REGIONAL_CUSTOMERS,
            COUNT(DISTINCT CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'MULTI_WITEL_CUSTOMER' THEN p.NIP_NAS END) as MULTI_WITEL_CUSTOMERS,
            COUNT(DISTINCT CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'MULTI_DATEL_CUSTOMER' THEN p.NIP_NAS END) as MULTI_DATEL_CUSTOMERS,
            COUNT(DISTINCT CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'MULTI_STO_CUSTOMER' THEN p.NIP_NAS END) as MULTI_STO_CUSTOMERS,
            COUNT(DISTINCT CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'SINGLE_LOCATION_CUSTOMER' THEN p.NIP_NAS END) as SINGLE_LOCATION_CUSTOMERS,
            
            -- Revenue from multi-location customers
            SUM(CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'MULTI_REGIONAL_CUSTOMER' THEN p.REVENUE ELSE 0 END) as MULTI_REGIONAL_REVENUE,
            SUM(CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'MULTI_WITEL_CUSTOMER' THEN p.REVENUE ELSE 0 END) as MULTI_WITEL_REVENUE,
            SUM(CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'MULTI_DATEL_CUSTOMER' THEN p.REVENUE ELSE 0 END) as MULTI_DATEL_REVENUE,
            SUM(CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'MULTI_STO_CUSTOMER' THEN p.REVENUE ELSE 0 END) as MULTI_STO_REVENUE,
            SUM(CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE = 'SINGLE_LOCATION_CUSTOMER' THEN p.REVENUE ELSE 0 END) as SINGLE_LOCATION_REVENUE,
            
            -- Customer value segments for multi-location analysis
            COUNT(DISTINCT CASE WHEN cgf.TOTAL_CUSTOMER_REVENUE >= 5000000 AND cgf.GEOGRAPHIC_PRESENCE_TYPE != 'SINGLE_LOCATION_CUSTOMER' THEN p.NIP_NAS END) as HIGH_VALUE_MULTI_LOCATION,
            COUNT(DISTINCT CASE WHEN cgf.TOTAL_CUSTOMER_REVENUE >= 2000000 AND cgf.GEOGRAPHIC_PRESENCE_TYPE != 'SINGLE_LOCATION_CUSTOMER' THEN p.NIP_NAS END) as MEDIUM_VALUE_MULTI_LOCATION,
            
            -- Geographic diversity metrics
            ROUND(AVG(cgf.REGIONAL_COUNT), 1) as AVG_REGIONAL_PRESENCE_PER_CUSTOMER,
            ROUND(AVG(cgf.WITEL_COUNT), 1) as AVG_WITEL_PRESENCE_PER_CUSTOMER,
            ROUND(AVG(cgf.DATEL_COUNT), 1) as AVG_DATEL_PRESENCE_PER_CUSTOMER,
            ROUND(AVG(cgf.STO_COUNT), 1) as AVG_STO_PRESENCE_PER_CUSTOMER,
            
            -- Expansion opportunity metrics
            ROUND((COUNT(DISTINCT CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE != 'SINGLE_LOCATION_CUSTOMER' THEN p.NIP_NAS END) * 100.0) / NULLIF(COUNT(DISTINCT p.NIP_NAS), 0), 2) as MULTI_LOCATION_PENETRATION_RATE,
            
            ROUND((SUM(CASE WHEN cgf.GEOGRAPHIC_PRESENCE_TYPE != 'SINGLE_LOCATION_CUSTOMER' THEN p.REVENUE ELSE 0 END) * 100.0) / NULLIF(SUM(p.REVENUE), 0), 2) as MULTI_LOCATION_REVENUE_SHARE
            
        FROM USR_RPT.BRIGHTAI_REVENUE p
        JOIN CUSTOMER_GEOGRAPHIC_FOOTPRINT cgf ON p.NIP_NAS = cgf.NIP_NAS AND p.NCLI = cgf.NCLI
        WHERE p.GROUP4 = 'High Speed Internet'
          AND p.REVENUE > 0
        GROUP BY p.REGIONAL_BILL, p.WITEL_BILL, p.DATEL, p.CSTO, p.LSTO, cgf.GEOGRAPHIC_PRESENCE_TYPE
    )
    
    SELECT 
        REGIONAL_BILL,
        WITEL_BILL,
        DATEL,
        CSTO,
        LSTO,
        GEOGRAPHIC_PRESENCE_TYPE,
        TOTAL_CUSTOMERS,
        TOTAL_NCLI,
        TOTAL_SERVICES,
        TOTAL_REVENUE,
        AVG_REVENUE_PER_SERVICE,
        REVENUE_PER_CUSTOMER,
        REVENUE_PER_NCLI,
        MULTI_REGIONAL_CUSTOMERS,
        MULTI_WITEL_CUSTOMERS,
        MULTI_DATEL_CUSTOMERS,
        MULTI_STO_CUSTOMERS,
        SINGLE_LOCATION_CUSTOMERS,
        MULTI_REGIONAL_REVENUE,
        MULTI_WITEL_REVENUE,
        MULTI_DATEL_REVENUE,
        MULTI_STO_REVENUE,
        SINGLE_LOCATION_REVENUE,
        HIGH_VALUE_MULTI_LOCATION,
        MEDIUM_VALUE_MULTI_LOCATION,
        AVG_REGIONAL_PRESENCE_PER_CUSTOMER,
        AVG_WITEL_PRESENCE_PER_CUSTOMER,
        AVG_DATEL_PRESENCE_PER_CUSTOMER,
        AVG_STO_PRESENCE_PER_CUSTOMER,
        MULTI_LOCATION_PENETRATION_RATE,
        MULTI_LOCATION_REVENUE_SHARE,
        
        -- Ranking metrics
        RANK() OVER (ORDER BY TOTAL_REVENUE DESC) as REVENUE_RANK,
        RANK() OVER (ORDER BY MULTI_LOCATION_PENETRATION_RATE DESC) as PENETRATION_RANK,
        
        -- Expansion opportunity scoring
        CASE 
            WHEN MULTI_LOCATION_PENETRATION_RATE >= 30 AND MULTI_LOCATION_REVENUE_SHARE >= 40 THEN 'HIGH_EXPANSION_OPPORTUNITY'
            WHEN MULTI_LOCATION_PENETRATION_RATE >= 15 AND MULTI_LOCATION_REVENUE_SHARE >= 20 THEN 'MEDIUM_EXPANSION_OPPORTUNITY'
            WHEN MULTI_LOCATION_PENETRATION_RATE >= 5 THEN 'LOW_EXPANSION_OPPORTUNITY'
            ELSE 'MINIMAL_EXPANSION_OPPORTUNITY'
        END as EXPANSION_OPPORTUNITY_LEVEL
        
    FROM GEOGRAPHIC_REVENUE_MATRIX
    ORDER BY TOTAL_REVENUE DESC
  `,

  BUSINESS_LOGIC: {
    formatIndonesianResponse: function(data) {
      const totalRevenue = data.reduce((sum, d) => sum + d.TOTAL_REVENUE, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.TOTAL_CUSTOMERS, 0);
      const totalNCLI = data.reduce((sum, d) => sum + d.TOTAL_NCLI, 0);
      const totalServices = data.reduce((sum, d) => sum + d.TOTAL_SERVICES, 0);
      
      // Multi-location customer analysis
      const totalMultiRegional = data.reduce((sum, d) => sum + d.MULTI_REGIONAL_CUSTOMERS, 0);
      const totalMultiWitel = data.reduce((sum, d) => sum + d.MULTI_WITEL_CUSTOMERS, 0);
      const totalMultiDatel = data.reduce((sum, d) => sum + d.MULTI_DATEL_CUSTOMERS, 0);
      const totalMultiSTO = data.reduce((sum, d) => sum + d.MULTI_STO_CUSTOMERS, 0);
      const totalSingleLocation = data.reduce((sum, d) => sum + d.SINGLE_LOCATION_CUSTOMERS, 0);
      
      // Multi-location revenue analysis
      const totalMultiRegionalRevenue = data.reduce((sum, d) => sum + d.MULTI_REGIONAL_REVENUE, 0);
      const totalMultiWitelRevenue = data.reduce((sum, d) => sum + d.MULTI_WITEL_REVENUE, 0);
      const totalMultiDatelRevenue = data.reduce((sum, d) => sum + d.MULTI_DATEL_REVENUE, 0);
      const totalMultiSTORevenue = data.reduce((sum, d) => sum + d.MULTI_STO_REVENUE, 0);
      const totalSingleLocationRevenue = data.reduce((sum, d) => sum + d.SINGLE_LOCATION_REVENUE, 0);
      
      // Expansion opportunity distribution
      const expansionDistribution = data.reduce((acc, item) => {
        const level = item.EXPANSION_OPPORTUNITY_LEVEL;
        if (!acc[level]) {
          acc[level] = {
            locations: 0,
            revenue: 0,
            customers: 0
          };
        }
        acc[level].locations += 1;
        acc[level].revenue += item.TOTAL_REVENUE;
        acc[level].customers += item.TOTAL_CUSTOMERS;
        return acc;
      }, {});
      
      return {
        ringkasan: 'Analisis revenue HSI lintas geografis untuk mengidentifikasi pelanggan multi-lokasi dan opportunity expansion',
        periode_analisis: 'Data cross-geographic customer analysis',
        
        metrik_nasional: {
          total_revenue: `Rp ${totalRevenue.toLocaleString('id-ID')}`,
          total_pelanggan: totalCustomers.toLocaleString('id-ID'),
          total_ncli: totalNCLI.toLocaleString('id-ID'),
          total_layanan: totalServices.toLocaleString('id-ID'),
          total_lokasi_analyzed: data.length.toLocaleString('id-ID')
        },
        
        distribusi_multi_location_customers: {
          multi_regional: {
            jumlah_pelanggan: totalMultiRegional.toLocaleString('id-ID'),
            persentase_dari_total: `${((totalMultiRegional / totalCustomers) * 100).toFixed(2)}%`,
            total_revenue: `Rp ${totalMultiRegionalRevenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((totalMultiRegionalRevenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_pelanggan: totalMultiRegional > 0 ? `Rp ${Math.round(totalMultiRegionalRevenue / totalMultiRegional).toLocaleString('id-ID')}` : 'N/A'
          },
          multi_witel: {
            jumlah_pelanggan: totalMultiWitel.toLocaleString('id-ID'),
            persentase_dari_total: `${((totalMultiWitel / totalCustomers) * 100).toFixed(2)}%`,
            total_revenue: `Rp ${totalMultiWitelRevenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((totalMultiWitelRevenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_pelanggan: totalMultiWitel > 0 ? `Rp ${Math.round(totalMultiWitelRevenue / totalMultiWitel).toLocaleString('id-ID')}` : 'N/A'
          },
          multi_datel: {
            jumlah_pelanggan: totalMultiDatel.toLocaleString('id-ID'),
            persentase_dari_total: `${((totalMultiDatel / totalCustomers) * 100).toFixed(2)}%`,
            total_revenue: `Rp ${totalMultiDatelRevenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((totalMultiDatelRevenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_pelanggan: totalMultiDatel > 0 ? `Rp ${Math.round(totalMultiDatelRevenue / totalMultiDatel).toLocaleString('id-ID')}` : 'N/A'
          },
          multi_sto: {
            jumlah_pelanggan: totalMultiSTO.toLocaleString('id-ID'),
            persentase_dari_total: `${((totalMultiSTO / totalCustomers) * 100).toFixed(2)}%`,
            total_revenue: `Rp ${totalMultiSTORevenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((totalMultiSTORevenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_pelanggan: totalMultiSTO > 0 ? `Rp ${Math.round(totalMultiSTORevenue / totalMultiSTO).toLocaleString('id-ID')}` : 'N/A'
          },
          single_location: {
            jumlah_pelanggan: totalSingleLocation.toLocaleString('id-ID'),
            persentase_dari_total: `${((totalSingleLocation / totalCustomers) * 100).toFixed(2)}%`,
            total_revenue: `Rp ${totalSingleLocationRevenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((totalSingleLocationRevenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_pelanggan: totalSingleLocation > 0 ? `Rp ${Math.round(totalSingleLocationRevenue / totalSingleLocation).toLocaleString('id-ID')}` : 'N/A'
          }
        },
        
        distribusi_expansion_opportunity: Object.entries(expansionDistribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .map(([level, stats]) => ({
            opportunity_level: level,
            jumlah_lokasi: stats.locations,
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            total_pelanggan: stats.customers.toLocaleString('id-ID'),
            kontribusi_revenue: `${((stats.revenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_lokasi: `Rp ${Math.round(stats.revenue / stats.locations).toLocaleString('id-ID')}`
          })),
        
        top_expansion_locations: data
          .filter(item => item.EXPANSION_OPPORTUNITY_LEVEL === 'HIGH_EXPANSION_OPPORTUNITY' || item.EXPANSION_OPPORTUNITY_LEVEL === 'MEDIUM_EXPANSION_OPPORTUNITY')
          .slice(0, 15)
          .map(item => ({
            regional: item.REGIONAL_BILL,
            witel: item.WITEL_BILL,
            datel: item.DATEL,
            kode_sto: item.CSTO,
            nama_sto: item.LSTO,
            opportunity_level: item.EXPANSION_OPPORTUNITY_LEVEL,
            total_revenue: `Rp ${item.TOTAL_REVENUE.toLocaleString('id-ID')}`,
            total_pelanggan: item.TOTAL_CUSTOMERS.toLocaleString('id-ID'),
            multi_location_penetration: `${item.MULTI_LOCATION_PENETRATION_RATE}%`,
            multi_location_revenue_share: `${item.MULTI_LOCATION_REVENUE_SHARE}%`,
            multi_regional_customers: item.MULTI_REGIONAL_CUSTOMERS.toLocaleString('id-ID'),
            multi_witel_customers: item.MULTI_WITEL_CUSTOMERS.toLocaleString('id-ID'),
            multi_datel_customers: item.MULTI_DATEL_CUSTOMERS.toLocaleString('id-ID'),
            multi_sto_customers: item.MULTI_STO_CUSTOMERS.toLocaleString('id-ID'),
            high_value_multi_location: item.HIGH_VALUE_MULTI_LOCATION.toLocaleString('id-ID'),
            medium_value_multi_location: item.MEDIUM_VALUE_MULTI_LOCATION.toLocaleString('id-ID'),
            avg_regional_presence: item.AVG_REGIONAL_PRESENCE_PER_CUSTOMER,
            avg_witel_presence: item.AVG_WITEL_PRESENCE_PER_CUSTOMER,
            avg_datel_presence: item.AVG_DATEL_PRESENCE_PER_CUSTOMER,
            avg_sto_presence: item.AVG_STO_PRESENCE_PER_CUSTOMER,
            revenue_rank: item.REVENUE_RANK,
            penetration_rank: item.PENETRATION_RANK
          })),
        
        detail_per_lokasi: data.slice(0, 20).map(item => ({
          regional: item.REGIONAL_BILL,
          witel: item.WITEL_BILL,
          datel: item.DATEL,
          kode_sto: item.CSTO,
          nama_sto: item.LSTO,
          geographic_presence_type: item.GEOGRAPHIC_PRESENCE_TYPE,
          expansion_opportunity: item.EXPANSION_OPPORTUNITY_LEVEL,
          total_revenue: `Rp ${item.TOTAL_REVENUE.toLocaleString('id-ID')}`,
          total_pelanggan: item.TOTAL_CUSTOMERS.toLocaleString('id-ID'),
          total_ncli: item.TOTAL_NCLI.toLocaleString('id-ID'),
          total_layanan: item.TOTAL_SERVICES.toLocaleString('id-ID'),
          revenue_per_pelanggan: `Rp ${item.REVENUE_PER_CUSTOMER.toLocaleString('id-ID')}`,
          revenue_per_ncli: `Rp ${item.REVENUE_PER_NCLI.toLocaleString('id-ID')}`,
          multi_location_penetration: `${item.MULTI_LOCATION_PENETRATION_RATE}%`,
          multi_location_revenue_share: `${item.MULTI_LOCATION_REVENUE_SHARE}%`,
          multi_regional_revenue: `Rp ${item.MULTI_REGIONAL_REVENUE.toLocaleString('id-ID')}`,
          multi_witel_revenue: `Rp ${item.MULTI_WITEL_REVENUE.toLocaleString('id-ID')}`,
          multi_datel_revenue: `Rp ${item.MULTI_DATEL_REVENUE.toLocaleString('id-ID')}`,
          multi_sto_revenue: `Rp ${item.MULTI_STO_REVENUE.toLocaleString('id-ID')}`,
          single_location_revenue: `Rp ${item.SINGLE_LOCATION_REVENUE.toLocaleString('id-ID')}`
        })),
        
        insight_bisnis: [
          'Identifikasi pelanggan multi-lokasi dengan revenue potential tertinggi untuk expansion strategy',
          'Analisis penetrasi geographic dan opportunity cross-selling di lokasi berbeda',
          'Evaluasi customer value concentration dan geographic mobility patterns',
          'Monitoring expansion opportunity berdasarkan multi-location customer behavior',
          'Assessment revenue diversification risk dan geographic dependency',
          'Optimization resource allocation untuk geographic expansion berdasarkan customer footprint analysis'
        ]
      };
    }
  },

  PATTERN_MATCHING: {
    checkMatch: function(userInput) {
      const confidence = module.exports.KEYWORD_PATTERNS.calculateConfidence(userInput);
      return {
        matches: confidence >= 75,
        confidence: confidence,
        focus_area: 'cross_geographic_analysis'
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};