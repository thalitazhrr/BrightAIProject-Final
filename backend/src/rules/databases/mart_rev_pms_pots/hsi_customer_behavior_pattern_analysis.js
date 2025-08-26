// ========================================
// RULE mart_007: HSI CUSTOMER BEHAVIOR PATTERN ANALYSIS
// ========================================
const { loadRuleDatabase } = require('../../config/databaseLoader');
const patternMatcher = require('../../utils/patternMatcher');
module.exports = {
  RULE_META: {
    RULE_ID: 'mart_007',
    RULE_NAME: 'hsi_customer_behavior_pattern_analysis',
    DESCRIPTION: 'Analisis pola behavior pelanggan HSI berdasarkan NCLI, service adoption, dan geographic mobility',
    DATABASE: 'MART_REV_PMS_POTS',
    CATEGORY: 'customer_analytics',
    COMPLEXITY: 'HIGH',
    EXECUTION_PRIORITY: 'HIGH',
    CACHE_DURATION: 3600,
    CREATED_BY: 'System',
    VERSION: '1.0'
  },

  DATABASE_CONFIG: loadRuleDatabase("MART_REV_PMS_POTS"),

  KEYWORD_PATTERNS: {
    primary: [
      'behavior pelanggan hsi', 'customer behavior hsi', 'pola pelanggan hsi',
      'pattern customer hsi', 'analisis behavior internet', 'perilaku pelanggan hsi',
      'customer pattern hsi', 'behavior analysis hsi', 'pola customer internet'
    ],
    supporting: [
      'behavior', 'behaviour', 'perilaku', 'pola', 'pattern', 'customer',
      'pelanggan', 'analisis', 'ncli', 'line', 'identifier', 'adoption',
      'mobility', 'hsi', 'internet', 'usage', 'segmentasi', 'classification'
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
    WITH CUSTOMER_BEHAVIOR_BASE AS (
        SELECT 
            NIP_NAS,
            NCLI,
            REGIONAL_BILL,
            WITEL_BILL,
            DATEL,
            CSTO,
            LSTO,
            
            -- Service adoption metrics
            COUNT(DISTINCT ND) as TOTAL_SERVICES_PER_CUSTOMER,
            COUNT(DISTINCT YEAR_ID || MONTH_ID) as ACTIVE_MONTHS,
            SUM(REVENUE) as TOTAL_CUSTOMER_REVENUE,
            ROUND(AVG(REVENUE), 0) as AVG_REVENUE_PER_SERVICE,
            MIN(YEAR_ID || LPAD(MONTH_ID, 2, '0')) as FIRST_ACTIVITY_PERIOD,
            MAX(YEAR_ID || LPAD(MONTH_ID, 2, '0')) as LAST_ACTIVITY_PERIOD,
            
            -- Service diversity metrics
            COUNT(DISTINCT GL_ACC) as GL_ACCOUNT_DIVERSITY,
            COUNT(DISTINCT GROUP1) as GROUP1_DIVERSITY,
            COUNT(DISTINCT GROUP2) as GROUP2_DIVERSITY,
            COUNT(DISTINCT GROUP3) as GROUP3_DIVERSITY,
            COUNT(DISTINCT GROUP5) as GROUP5_DIVERSITY,
            
            -- Geographic behavior
            COUNT(DISTINCT REGIONAL_BILL) as MULTI_REGIONAL_PRESENCE,
            COUNT(DISTINCT WITEL_BILL) as MULTI_WITEL_PRESENCE,
            COUNT(DISTINCT DATEL) as MULTI_DATEL_PRESENCE,
            COUNT(DISTINCT CSTO) as MULTI_STO_PRESENCE,
            
            -- Revenue scaling behavior
            SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING NEW' THEN REVENUE ELSE 0 END) as TOTAL_NEW_REVENUE,
            SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SCALING RECURRING' THEN REVENUE ELSE 0 END) as TOTAL_RECURRING_REVENUE,
            SUM(CASE WHEN FLAG_SCALING_MONTHLY_REVENUE = 'REV SUSTAIN' THEN REVENUE ELSE 0 END) as TOTAL_SUSTAIN_REVENUE,
            
            -- Service lifecycle behavior
            COUNT(CASE WHEN TGL_PS IS NOT NULL THEN 1 END) as SERVICES_WITH_INSTALL_DATE,
            COUNT(CASE WHEN TGL_CA IS NOT NULL THEN 1 END) as SERVICES_WITH_DISCONNECT_DATE,
            
            -- Revenue volatility
            ROUND(STDDEV(REVENUE), 0) as REVENUE_VOLATILITY,
            
            -- Customer value classification
            CASE 
                WHEN SUM(REVENUE) >= 10000000 THEN 'ULTRA_HIGH_VALUE'
                WHEN SUM(REVENUE) >= 5000000 THEN 'HIGH_VALUE_CUSTOMER'
                WHEN SUM(REVENUE) >= 2000000 THEN 'MEDIUM_VALUE_CUSTOMER'
                WHEN SUM(REVENUE) >= 500000 THEN 'STANDARD_VALUE_CUSTOMER'
                ELSE 'LOW_VALUE_CUSTOMER'
            END as CUSTOMER_VALUE_SEGMENT,
            
            -- Service usage pattern
            CASE 
                WHEN COUNT(DISTINCT ND) >= 10 THEN 'HEAVY_MULTI_SERVICE'
                WHEN COUNT(DISTINCT ND) >= 5 THEN 'MULTI_SERVICE_MEDIUM'
                WHEN COUNT(DISTINCT ND) >= 3 THEN 'MULTI_SERVICE_LIGHT'
                WHEN COUNT(DISTINCT ND) = 2 THEN 'DUAL_SERVICE'
                ELSE 'SINGLE_SERVICE'
            END as SERVICE_USAGE_PATTERN,
            
            -- Geographic mobility pattern
            CASE 
                WHEN COUNT(DISTINCT REGIONAL_BILL) > 1 THEN 'MULTI_REGIONAL_CUSTOMER'
                WHEN COUNT(DISTINCT WITEL_BILL) > 1 THEN 'MULTI_WITEL_CUSTOMER'
                WHEN COUNT(DISTINCT DATEL) > 1 THEN 'MULTI_DATEL_CUSTOMER'
                WHEN COUNT(DISTINCT CSTO) > 1 THEN 'MULTI_STO_CUSTOMER'
                ELSE 'SINGLE_LOCATION_CUSTOMER'
            END as GEOGRAPHIC_MOBILITY_PATTERN
            
        FROM PMSDBS.MART_REV_PMS_POTS
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
        GROUP BY NIP_NAS, NCLI, REGIONAL_BILL, WITEL_BILL, DATEL, CSTO, LSTO
    ),
    
    CUSTOMER_BEHAVIOR_AGGREGATED AS (
        SELECT 
            NIP_NAS,
            NCLI,
            REGIONAL_BILL,
            WITEL_BILL,
            DATEL,
            CSTO,
            LSTO,
            CUSTOMER_VALUE_SEGMENT,
            SERVICE_USAGE_PATTERN,
            GEOGRAPHIC_MOBILITY_PATTERN,
            
            -- Aggregated customer metrics
            COUNT(DISTINCT NIP_NAS) as TOTAL_CUSTOMERS,
            COUNT(DISTINCT NCLI) as TOTAL_NCLI,
            SUM(TOTAL_CUSTOMER_REVENUE) as SEGMENT_TOTAL_REVENUE,
            ROUND(AVG(TOTAL_CUSTOMER_REVENUE), 0) as AVG_CUSTOMER_REVENUE,
            ROUND(AVG(TOTAL_SERVICES_PER_CUSTOMER), 1) as AVG_SERVICES_PER_CUSTOMER,
            ROUND(AVG(ACTIVE_MONTHS), 1) as AVG_ACTIVE_MONTHS,
            
            -- Service diversity metrics
            ROUND(AVG(GL_ACCOUNT_DIVERSITY), 1) as AVG_GL_DIVERSITY,
            ROUND(AVG(GROUP1_DIVERSITY), 1) as AVG_GROUP1_DIVERSITY,
            ROUND(AVG(GROUP2_DIVERSITY), 1) as AVG_GROUP2_DIVERSITY,
            ROUND(AVG(GROUP3_DIVERSITY), 1) as AVG_GROUP3_DIVERSITY,
            ROUND(AVG(GROUP5_DIVERSITY), 1) as AVG_GROUP5_DIVERSITY,
            
            -- Geographic behavior metrics
            ROUND(AVG(MULTI_REGIONAL_PRESENCE), 1) as AVG_REGIONAL_PRESENCE,
            ROUND(AVG(MULTI_WITEL_PRESENCE), 1) as AVG_WITEL_PRESENCE,
            ROUND(AVG(MULTI_DATEL_PRESENCE), 1) as AVG_DATEL_PRESENCE,
            ROUND(AVG(MULTI_STO_PRESENCE), 1) as AVG_STO_PRESENCE,
            
            -- Revenue scaling distribution
            SUM(TOTAL_NEW_REVENUE) as SEGMENT_NEW_REVENUE,
            SUM(TOTAL_RECURRING_REVENUE) as SEGMENT_RECURRING_REVENUE,
            SUM(TOTAL_SUSTAIN_REVENUE) as SEGMENT_SUSTAIN_REVENUE,
            
            -- Service lifecycle behavior
            ROUND(AVG(SERVICES_WITH_INSTALL_DATE), 1) as AVG_SERVICES_WITH_INSTALL,
            ROUND(AVG(SERVICES_WITH_DISCONNECT_DATE), 1) as AVG_SERVICES_WITH_DISCONNECT,
            
            -- Revenue volatility
            ROUND(AVG(REVENUE_VOLATILITY), 0) as AVG_REVENUE_VOLATILITY,
            
            -- Performance metrics
            ROUND(SUM(TOTAL_CUSTOMER_REVENUE) / NULLIF(COUNT(DISTINCT NIP_NAS), 0), 0) as REVENUE_PER_CUSTOMER,
            ROUND(SUM(TOTAL_CUSTOMER_REVENUE) / NULLIF(COUNT(DISTINCT NCLI), 0), 0) as REVENUE_PER_NCLI,
            
            -- Loyalty indicators
            CASE 
                WHEN AVG(ACTIVE_MONTHS) >= 6 AND AVG(SERVICES_WITH_DISCONNECT_DATE) < 0.5 THEN 'HIGH_LOYALTY'
                WHEN AVG(ACTIVE_MONTHS) >= 4 AND AVG(SERVICES_WITH_DISCONNECT_DATE) < 1 THEN 'MEDIUM_LOYALTY'
                WHEN AVG(ACTIVE_MONTHS) >= 2 THEN 'STANDARD_LOYALTY'
                ELSE 'LOW_LOYALTY'
            END as LOYALTY_INDICATOR,
            
            -- Revenue stability
            CASE 
                WHEN AVG(REVENUE_VOLATILITY) < 50000 THEN 'STABLE_REVENUE'
                WHEN AVG(REVENUE_VOLATILITY) < 150000 THEN 'MODERATE_VOLATILITY'
                ELSE 'HIGH_VOLATILITY'
            END as REVENUE_STABILITY_INDICATOR
            
        FROM CUSTOMER_BEHAVIOR_BASE
        GROUP BY REGIONAL_BILL, WITEL_BILL, DATEL, CSTO, LSTO, 
                 CUSTOMER_VALUE_SEGMENT, SERVICE_USAGE_PATTERN, GEOGRAPHIC_MOBILITY_PATTERN
        ORDER BY SEGMENT_TOTAL_REVENUE DESC
    )
    
    SELECT * FROM CUSTOMER_BEHAVIOR_AGGREGATED
  `,

  BUSINESS_LOGIC: {
    formatIndonesianResponse: function(data) {
      const totalRevenue = data.reduce((sum, d) => sum + d.SEGMENT_TOTAL_REVENUE, 0);
      const totalCustomers = data.reduce((sum, d) => sum + d.TOTAL_CUSTOMERS, 0);
      const totalNCLI = data.reduce((sum, d) => sum + d.TOTAL_NCLI, 0);
      
      // Customer value segment analysis
      const valueSegmentDistribution = data.reduce((acc, item) => {
        const segment = item.CUSTOMER_VALUE_SEGMENT;
        if (!acc[segment]) {
          acc[segment] = {
            customers: 0,
            ncli: 0,
            revenue: 0,
            locations: new Set()
          };
        }
        acc[segment].customers += item.TOTAL_CUSTOMERS;
        acc[segment].ncli += item.TOTAL_NCLI;
        acc[segment].revenue += item.SEGMENT_TOTAL_REVENUE;
        acc[segment].locations.add(`${item.CSTO}-${item.LSTO}`);
        return acc;
      }, {});
      
      // Service usage pattern analysis
      const usagePatternDistribution = data.reduce((acc, item) => {
        const pattern = item.SERVICE_USAGE_PATTERN;
        if (!acc[pattern]) {
          acc[pattern] = {
            customers: 0,
            ncli: 0,
            revenue: 0,
            avg_services: 0,
            count: 0
          };
        }
        acc[pattern].customers += item.TOTAL_CUSTOMERS;
        acc[pattern].ncli += item.TOTAL_NCLI;
        acc[pattern].revenue += item.SEGMENT_TOTAL_REVENUE;
        acc[pattern].avg_services += item.AVG_SERVICES_PER_CUSTOMER;
        acc[pattern].count += 1;
        return acc;
      }, {});
      
      // Geographic mobility pattern analysis
      const mobilityPatternDistribution = data.reduce((acc, item) => {
        const pattern = item.GEOGRAPHIC_MOBILITY_PATTERN;
        if (!acc[pattern]) {
          acc[pattern] = {
            customers: 0,
            ncli: 0,
            revenue: 0,
            count: 0
          };
        }
        acc[pattern].customers += item.TOTAL_CUSTOMERS;
        acc[pattern].ncli += item.TOTAL_NCLI;
        acc[pattern].revenue += item.SEGMENT_TOTAL_REVENUE;
        acc[pattern].count += 1;
        return acc;
      }, {});
      
      // Calculate averages for usage patterns
      Object.keys(usagePatternDistribution).forEach(pattern => {
        usagePatternDistribution[pattern].avg_services = 
          usagePatternDistribution[pattern].avg_services / usagePatternDistribution[pattern].count;
      });
      
      return {
        ringkasan: 'Analisis pola behavior pelanggan HSI berdasarkan NCLI, service adoption, dan geographic mobility',
        periode_analisis: 'Data historical pelanggan HSI dengan geographic breakdown',
        
        metrik_nasional: {
          total_pelanggan_analyzed: totalCustomers.toLocaleString('id-ID'),
          total_ncli_analyzed: totalNCLI.toLocaleString('id-ID'),
          total_revenue_analyzed: `Rp ${totalRevenue.toLocaleString('id-ID')}`,
          rata_revenue_per_pelanggan: `Rp ${Math.round(totalRevenue / totalCustomers).toLocaleString('id-ID')}`,
          rata_revenue_per_ncli: `Rp ${Math.round(totalRevenue / totalNCLI).toLocaleString('id-ID')}`,
          total_segment_behavior_unik: data.length
        },
        
        distribusi_value_segment: Object.entries(valueSegmentDistribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .map(([segment, stats]) => ({
            customer_segment: segment,
            jumlah_pelanggan: stats.customers.toLocaleString('id-ID'),
            jumlah_ncli: stats.ncli.toLocaleString('id-ID'),
            persentase_pelanggan: `${((stats.customers / totalCustomers) * 100).toFixed(2)}%`,
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((stats.revenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_pelanggan: `Rp ${Math.round(stats.revenue / stats.customers).toLocaleString('id-ID')}`,
            rata_revenue_per_ncli: `Rp ${Math.round(stats.revenue / stats.ncli).toLocaleString('id-ID')}`,
            coverage_lokasi: stats.locations.size
          })),
        
        distribusi_usage_pattern: Object.entries(usagePatternDistribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .map(([pattern, stats]) => ({
            service_usage_pattern: pattern,
            jumlah_pelanggan: stats.customers.toLocaleString('id-ID'),
            jumlah_ncli: stats.ncli.toLocaleString('id-ID'),
            persentase_pelanggan: `${((stats.customers / totalCustomers) * 100).toFixed(2)}%`,
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((stats.revenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_services_per_customer: stats.avg_services.toFixed(1),
            rata_revenue_per_pelanggan: `Rp ${Math.round(stats.revenue / stats.customers).toLocaleString('id-ID')}`
          })),
        
        distribusi_mobility_pattern: Object.entries(mobilityPatternDistribution)
          .sort(([,a], [,b]) => b.revenue - a.revenue)
          .map(([pattern, stats]) => ({
            geographic_mobility_pattern: pattern,
            jumlah_pelanggan: stats.customers.toLocaleString('id-ID'),
            jumlah_ncli: stats.ncli.toLocaleString('id-ID'),
            persentase_pelanggan: `${((stats.customers / totalCustomers) * 100).toFixed(2)}%`,
            total_revenue: `Rp ${stats.revenue.toLocaleString('id-ID')}`,
            kontribusi_revenue: `${((stats.revenue / totalRevenue) * 100).toFixed(2)}%`,
            rata_revenue_per_pelanggan: `Rp ${Math.round(stats.revenue / stats.customers).toLocaleString('id-ID')}`
          })),
        
        detail_behavior_per_lokasi: data.slice(0, 20).map(item => ({
          regional: item.REGIONAL_BILL,
          witel: item.WITEL_BILL,
          datel: item.DATEL,
          kode_sto: item.CSTO,
          nama_sto: item.LSTO,
          customer_value_segment: item.CUSTOMER_VALUE_SEGMENT,
          service_usage_pattern: item.SERVICE_USAGE_PATTERN,
          geographic_mobility_pattern: item.GEOGRAPHIC_MOBILITY_PATTERN,
          jumlah_pelanggan: item.TOTAL_CUSTOMERS.toLocaleString('id-ID'),
          jumlah_ncli: item.TOTAL_NCLI.toLocaleString('id-ID'),
          total_revenue: `Rp ${item.SEGMENT_TOTAL_REVENUE.toLocaleString('id-ID')}`,
          avg_customer_revenue: `Rp ${item.AVG_CUSTOMER_REVENUE.toLocaleString('id-ID')}`,
          revenue_per_pelanggan: `Rp ${item.REVENUE_PER_CUSTOMER.toLocaleString('id-ID')}`,
          revenue_per_ncli: `Rp ${item.REVENUE_PER_NCLI.toLocaleString('id-ID')}`,
          avg_services_per_customer: item.AVG_SERVICES_PER_CUSTOMER,
          avg_active_months: item.AVG_ACTIVE_MONTHS,
          avg_gl_diversity: item.AVG_GL_DIVERSITY,
          avg_group1_diversity: item.AVG_GROUP1_DIVERSITY,
          avg_regional_presence: item.AVG_REGIONAL_PRESENCE,
          avg_witel_presence: item.AVG_WITEL_PRESENCE,
          avg_datel_presence: item.AVG_DATEL_PRESENCE,
          avg_sto_presence: item.AVG_STO_PRESENCE,
          loyalty_indicator: item.LOYALTY_INDICATOR,
          revenue_stability: item.REVENUE_STABILITY_INDICATOR,
          new_revenue: `Rp ${item.SEGMENT_NEW_REVENUE.toLocaleString('id-ID')}`,
          recurring_revenue: `Rp ${item.SEGMENT_RECURRING_REVENUE.toLocaleString('id-ID')}`,
          sustain_revenue: `Rp ${item.SEGMENT_SUSTAIN_REVENUE.toLocaleString('id-ID')}`
        })),
        
        insight_bisnis: [
          'Identifikasi customer behavior patterns berdasarkan service adoption dan value segments per lokasi',
          'Analisis geographic mobility patterns dan dampaknya terhadap revenue concentration',
          'Evaluasi customer loyalty dan revenue stability indicators per area geographic',
          'Monitoring service diversity adoption dan cross-selling opportunities per customer segment',
          'Assessment customer lifetime value berdasarkan behavior patterns dan geographic presence',
          'Optimization customer engagement strategy berdasarkan behavior segmentation per STO'
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
        focus_area: 'customer_behavior_analysis'
      };
    },
    
  },

  CACHE_DURATION: 3600,
  COMPLEXITY: 'HIGH',
  EXECUTION_PRIORITY: 'HIGH'
};