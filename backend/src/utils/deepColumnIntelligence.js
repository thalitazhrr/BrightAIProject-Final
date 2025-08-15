// Deep Column Intelligence & Advanced Pattern Recognition
class DeepColumnIntelligence {
  
  constructor() {
    // Ultra-deep understanding of each column's business intelligence
    this.advancedColumnPatterns = {
      
      // ORDER_ID Intelligence
      order_id: {
        patterns: {
          sequential: /^100[0-9]{7}$/,
          businessRules: 'Sequential 10-digit identifier starting with 100',
          anomalyDetection: 'Gaps in sequence, duplicates, invalid formats',
          insights: [
            'Order volume velocity analysis',
            'System capacity planning',
            'Fraud detection patterns',
            'Business growth tracking'
          ]
        }
      },
      
      // REGIONAL Intelligence (Critical Business Dimension)
      regional: {
        mapping: {
          '1': {
            name: 'Regional 1 - Sumatra',
            coverage: ['Aceh', 'Sumut', 'Sumbar', 'Riau', 'Jambi', 'Sumsel', 'Bengkulu', 'Lampung'],
            characteristics: 'Resource-rich region, oil & gas industry, plantation economy',
            challenges: 'Geographic spread, infrastructure development',
            opportunities: 'Industrial digitalization, smart city initiatives'
          },
          '2': {
            name: 'Regional 2 - Jakarta & West Java',
            coverage: ['DKI Jakarta', 'Jawa Barat', 'Banten'],
            characteristics: 'Economic center, highest GDP, tech hub',
            challenges: 'High competition, premium expectations',
            opportunities: 'Enterprise solutions, 5G deployment, fintech'
          },
          '3': {
            name: 'Regional 3 - Central & East Java',
            coverage: ['Jawa Tengah', 'Jawa Timur', 'DIY'],
            characteristics: 'Manufacturing hub, cultural center, education',
            challenges: 'Price sensitivity, traditional business models',
            opportunities: 'Digital transformation, e-commerce, education tech'
          },
          '4': {
            name: 'Regional 4 - Kalimantan & Sulawesi',
            coverage: ['Kalimantan', 'Sulawesi'],
            characteristics: 'Mining, agriculture, growing urban centers',
            challenges: 'Remote areas, infrastructure gaps',
            opportunities: 'Smart mining, agricultural tech, connectivity expansion'
          },
          '5': {
            name: 'Regional 5 - Eastern Indonesia',
            coverage: ['Bali', 'NTB', 'NTT', 'Maluku', 'Papua'],
            characteristics: 'Tourism, fisheries, remote islands',
            challenges: 'Geographic barriers, limited infrastructure',
            opportunities: 'Tourism digitalization, satellite connectivity, government projects'
          }
        }
      },
      
      // JENISPSB Intelligence (Customer Lifecycle Critical)
      jenispsb: {
        deepAnalysis: {
          'AO': {
            fullName: 'Activation Order',
            businessImpact: 'New customer acquisition - primary growth driver',
            revenueImpact: 'Immediate ARPU increase, long-term revenue potential',
            operationalLoad: 'High - requires full installation process',
            successFactors: ['Network availability', 'Installation quality', 'Customer onboarding'],
            kpiMetrics: ['Acquisition rate', 'Time to activate', 'First month retention'],
            riskFactors: ['Installation delays', 'Technical issues', 'Competitor interference']
          },
          'MO': {
            fullName: 'Modification Order',
            businessImpact: 'Customer evolution - indicates engagement',
            revenueImpact: 'Potential ARPU increase through upgrades',
            operationalLoad: 'Medium - configuration changes',
            successFactors: ['Service continuity', 'Upgrade experience', 'Value demonstration'],
            kpiMetrics: ['Upgrade rate', 'ARPU lift', 'Satisfaction score'],
            riskFactors: ['Service disruption', 'Billing issues', 'Expectation mismatch']
          },
          'DO': {
            fullName: 'Disconnect Order',
            businessImpact: 'Customer churn - revenue loss and negative signal',
            revenueImpact: 'Direct ARPU loss, potential negative referrals',
            operationalLoad: 'Low - service termination',
            successFactors: ['Win-back offers', 'Exit interview', 'Service recovery'],
            kpiMetrics: ['Churn rate', 'Save rate', 'Win-back success'],
            riskFactors: ['Competitor acquisition', 'Service dissatisfaction', 'Economic factors']
          },
          'AS': {
            fullName: 'Add Service',
            businessImpact: 'Upselling success - customer value expansion',
            revenueImpact: 'ARPU increase, customer stickiness',
            operationalLoad: 'Low-Medium - additional service provisioning',
            successFactors: ['Service integration', 'Value proposition', 'Cross-selling timing'],
            kpiMetrics: ['Attach rate', 'ARPU uplift', 'Service adoption'],
            riskFactors: ['Service complexity', 'Integration issues', 'Customer confusion']
          },
          'RO': {
            fullName: 'Reconnection Order',
            businessImpact: 'Win-back success - customer recovery',
            revenueImpact: 'Revenue recovery, loyalty rebuilding',
            operationalLoad: 'Medium - reactivation process',
            successFactors: ['Win-back offers', 'Service improvement', 'Relationship repair'],
            kpiMetrics: ['Win-back rate', 'Retention after reconnect', 'ARPU recovery'],
            riskFactors: ['Repeat churn', 'Service quality', 'Competitor retention']
          }
        }
      },
      
      // STATUS_RESUME Intelligence (Critical for Service Quality)
      status_resume: {
        patterns: {
          completed: /Completed|Complete|SUCCESS/i,
          inProgress: /Progress|Processing|In Progress/i,
          cancelled: /Cancel|Cancelled|CANCEL/i,
          failed: /Failed|Error|Reject/i,
          pending: /Pending|Wait|Hold/i
        },
        businessImplications: {
          'Completed (PS)': {
            meaning: 'Service successfully provisioned',
            impact: 'Positive customer experience, revenue recognition',
            nextActions: ['Customer satisfaction survey', 'Upselling opportunity'],
            kpi: 'Service completion rate'
          },
          'Cancel Completed': {
            meaning: 'Order cancelled successfully',
            impact: 'Lost revenue opportunity, operational waste',
            nextActions: ['Root cause analysis', 'Process improvement'],
            kpi: 'Cancellation rate'
          },
          'In Progress': {
            meaning: 'Order being processed',
            impact: 'Customer waiting, resource utilization',
            nextActions: ['Progress tracking', 'Customer communication'],
            kpi: 'Processing time'
          }
        }
      },
      
      // Package Intelligence (Revenue Critical)
      package_name: {
        revenuePatterns: {
          extractRevenue: /\[(\d+)\]/g,
          packageCodes: /([A-Z]\d+)/g,
          speedPatterns: /(\d+)M(?:bps)?/gi,
          bundlePatterns: /(\d+)P/gi
        },
        businessSegments: {
          'JITU': {
            targetMarket: 'Mass market residential',
            priceStrategy: 'Competitive pricing',
            valueProposition: 'Affordable internet + entertainment',
            competitivePosition: 'Market leader in residential'
          },
          'Indibiz': {
            targetMarket: 'SME and enterprise',
            priceStrategy: 'Premium pricing',
            valueProposition: 'Business-grade connectivity + support',
            competitivePosition: 'Premium business segment'
          },
          'IndiHome': {
            targetMarket: 'Premium residential',
            priceStrategy: 'Value pricing',
            valueProposition: 'Integrated home connectivity',
            competitivePosition: 'Established brand leader'
          }
        }
      },
      
      // Geographic Intelligence Patterns
      location: {
        hierarchyMapping: {
          regional: 'Strategic business unit level',
          witel: 'Operational area management',
          datel: 'Local service area',
          sto: 'Technical serving area',
          city_name: 'Market segment'
        },
        performanceFactors: {
          urban: ['Higher ARPU', 'More competition', 'Faster deployment'],
          rural: ['Lower ARPU', 'Coverage challenges', 'Government programs'],
          industrial: ['B2B opportunities', 'Higher bandwidth needs', 'Custom solutions']
        }
      },
      
      // Temporal Intelligence (Critical for Operations)
      timeAnalysis: {
        order_date: {
          patterns: ['Seasonality', 'Campaign effectiveness', 'Market trends'],
          businessRules: 'Customer demand timing'
        },
        tgl_ps: {
          patterns: ['Installation efficiency', 'Resource capacity', 'SLA compliance'],
          businessRules: 'Service delivery performance'
        },
        leadTimeAnalysis: {
          excellent: '≤ 3 days',
          good: '4-7 days',
          acceptable: '8-14 days',
          poor: '> 14 days'
        }
      },
      
      // Customer Intelligence Patterns
      customerPatterns: {
        businessCustomers: {
          indicators: ['Bisnis in kat_hvc', 'Company names', 'Multiple orders', 'B2B packages'],
          characteristics: ['Higher ARPU', 'Longer contracts', 'Custom solutions', 'SLA requirements']
        },
        premiumCustomers: {
          indicators: ['High-value packages', 'Multiple services', 'Premium locations', 'Email contacts'],
          characteristics: ['Price insensitive', 'Quality focused', 'Brand loyal', 'Early adopters']
        },
        priceConsciousCustomers: {
          indicators: ['Basic packages', 'Frequent modifications', 'Rural locations', 'Limited contact info'],
          characteristics: ['Price sensitive', 'Value seekers', 'Churn risk', 'Promotion responsive']
        }
      }
    };
  }
  
  // Advanced Pattern Analysis Methods
  analyzeOrderIdPatterns(orders) {
    const analysis = {
      sequentialGaps: [],
      duplicates: [],
      formatAnomalies: [],
      velocityAnalysis: {}
    };
    
    const orderIds = orders.map(o => parseInt(o.order_id)).filter(id => !isNaN(id)).sort((a, b) => a - b);
    
    // Detect sequential gaps
    for (let i = 1; i < orderIds.length; i++) {
      const gap = orderIds[i] - orderIds[i-1];
      if (gap > 100) { // Significant gap threshold
        analysis.sequentialGaps.push({
          from: orderIds[i-1],
          to: orderIds[i],
          gap: gap,
          possibleCause: gap > 1000 ? 'System migration or major outage' : 'Business slowdown or seasonal effect'
        });
      }
    }
    
    // Calculate order velocity
    if (orderIds.length > 1) {
      const range = orderIds[orderIds.length - 1] - orderIds[0];
      const timeSpan = orders.length; // Simplified - should use actual time data
      analysis.velocityAnalysis = {
        ordersPerPeriod: range / timeSpan,
        trend: range > timeSpan * 100 ? 'Accelerating' : 'Stable',
        systemCapacity: range > 10000 ? 'High volume system' : 'Standard volume'
      };
    }
    
    return analysis;
  }
  
  analyzeCustomerLifecyclePatterns(orders) {
    const lifecycleInsights = {
      acquisitionPatterns: {},
      churnIndicators: {},
      evolutionPaths: {},
      riskFactors: {}
    };
    
    // Group by customer for lifecycle analysis
    const customerJourneys = {};
    orders.forEach(order => {
      if (!customerJourneys[order.customer_name]) {
        customerJourneys[order.customer_name] = [];
      }
      customerJourneys[order.customer_name].push(order);
    });
    
    // Analyze each customer journey
    Object.values(customerJourneys).forEach(journey => {
      const sortedJourney = journey.sort((a, b) => new Date(a.order_date) - new Date(b.order_date));
      const sequence = sortedJourney.map(o => o.jenispsb).join('→');
      
      // Pattern recognition
      if (sequence.includes('AO→MO')) {
        lifecycleInsights.evolutionPaths['Acquisition_to_Evolution'] = 
          (lifecycleInsights.evolutionPaths['Acquisition_to_Evolution'] || 0) + 1;
      }
      
      if (sequence.includes('AO→DO')) {
        lifecycleInsights.churnIndicators['Early_Churn'] = 
          (lifecycleInsights.churnIndicators['Early_Churn'] || 0) + 1;
      }
      
      if (sequence.includes('DO→RO')) {
        lifecycleInsights.evolutionPaths['Churn_to_Winback'] = 
          (lifecycleInsights.evolutionPaths['Churn_to_Winback'] || 0) + 1;
      }
      
      if (sequence.includes('MO→DO')) {
        lifecycleInsights.riskFactors['Modification_to_Churn'] = 
          (lifecycleInsights.riskFactors['Modification_to_Churn'] || 0) + 1;
      }
    });
    
    return lifecycleInsights;
  }
  
  analyzeGeographicPerformancePatterns(orders) {
    const geoInsights = {
      regionalCharacteristics: {},
      performanceClusters: {},
      infrastructureHealth: {},
      marketPenetration: {}
    };
    
    // Analyze by regional
    const regionalData = {};
    orders.forEach(order => {
      const region = order.regional;
      if (!regionalData[region]) {
        regionalData[region] = {
          orders: 0,
          completions: 0,
          churn: 0,
          acquisitions: 0,
          avgLeadTime: [],
          cities: new Set(),
          packages: {},
          businessRatio: 0
        };
      }
      
      const data = regionalData[region];
      data.orders++;
      data.cities.add(order.city_name);
      
      if (order.status_resume && order.status_resume.includes('Completed')) data.completions++;
      if (order.jenispsb === 'DO') data.churn++;
      if (order.jenispsb === 'AO') data.acquisitions++;
      if (order.kat_hvc === 'Bisnis') data.businessRatio++;
      
      // Calculate lead time
      if (order.order_date && order.tgl_ps) {
        const leadTime = (new Date(order.tgl_ps) - new Date(order.order_date)) / (1000 * 60 * 60 * 24);
        if (leadTime > 0 && leadTime < 365) data.avgLeadTime.push(leadTime);
      }
      
      // Package analysis
      if (order.package_name) {
        const packageType = this.classifyPackage(order.package_name);
        data.packages[packageType] = (data.packages[packageType] || 0) + 1;
      }
    });
    
    // Generate insights for each regional
    Object.entries(regionalData).forEach(([region, data]) => {
      const regionInfo = this.advancedColumnPatterns.regional.mapping[region];
      
      geoInsights.regionalCharacteristics[region] = {
        name: regionInfo?.name || `Regional ${region}`,
        performance: {
          completionRate: (data.completions / data.orders) * 100,
          churnRate: (data.churn / data.orders) * 100,
          netGrowth: data.acquisitions - data.churn,
          avgLeadTime: data.avgLeadTime.length ? 
            data.avgLeadTime.reduce((a, b) => a + b, 0) / data.avgLeadTime.length : null,
          businessRatio: (data.businessRatio / data.orders) * 100,
          marketDiversity: data.cities.size
        },
        characteristics: regionInfo?.characteristics || 'No data available',
        dominantPackage: Object.entries(data.packages).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
      };
      
      // Performance classification
      const completionRate = (data.completions / data.orders) * 100;
      const churnRate = (data.churn / data.orders) * 100;
      
      if (completionRate > 85 && churnRate < 15) {
        geoInsights.performanceClusters[region] = 'High Performance';
      } else if (completionRate > 70 && churnRate < 25) {
        geoInsights.performanceClusters[region] = 'Good Performance';
      } else {
        geoInsights.performanceClusters[region] = 'Needs Improvement';
      }
    });
    
    return geoInsights;
  }
  
  analyzeTemporalPatterns(orders) {
    const temporalInsights = {
      seasonality: {},
      trendAnalysis: {},
      operationalEfficiency: {},
      demandPatterns: {}
    };
    
    // Group by month for seasonality analysis
    const monthlyData = {};
    orders.forEach(order => {
      if (!order.order_date) return;
      
      const month = new Date(order.order_date).getMonth() + 1;
      const year = new Date(order.order_date).getFullYear();
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          orders: 0,
          acquisitions: 0,
          churn: 0,
          leadTimes: [],
          completions: 0
        };
      }
      
      const data = monthlyData[monthKey];
      data.orders++;
      if (order.jenispsb === 'AO') data.acquisitions++;
      if (order.jenispsb === 'DO') data.churn++;
      if (order.status_resume && order.status_resume.includes('Completed')) data.completions++;
      
      // Lead time calculation
      if (order.order_date && order.tgl_ps) {
        const leadTime = (new Date(order.tgl_ps) - new Date(order.order_date)) / (1000 * 60 * 60 * 24);
        if (leadTime > 0 && leadTime < 365) data.leadTimes.push(leadTime);
      }
    });
    
    // Analyze trends
    const months = Object.keys(monthlyData).sort();
    if (months.length >= 3) {
      const recent = monthlyData[months[months.length - 1]];
      const previous = monthlyData[months[months.length - 2]];
      const older = monthlyData[months[months.length - 3]];
      
      temporalInsights.trendAnalysis = {
        orderTrend: this.calculateTrend([older.orders, previous.orders, recent.orders]),
        acquisitionTrend: this.calculateTrend([older.acquisitions, previous.acquisitions, recent.acquisitions]),
        churnTrend: this.calculateTrend([older.churn, previous.churn, recent.churn]),
        efficiency: {
          recent: recent.leadTimes.length ? 
            recent.leadTimes.reduce((a, b) => a + b, 0) / recent.leadTimes.length : null,
          previous: previous.leadTimes.length ? 
            previous.leadTimes.reduce((a, b) => a + b, 0) / previous.leadTimes.length : null
        }
      };
    }
    
    return temporalInsights;
  }
  
  analyzePackageIntelligence(orders) {
    const packageInsights = {
      revenueAnalysis: {},
      marketSegmentation: {},
      bundlingPatterns: {},
      competitivePosition: {}
    };
    
    orders.forEach(order => {
      if (!order.package_name) return;
      
      const packageInfo = this.extractPackageIntelligence(order.package_name);
      const category = this.classifyPackage(order.package_name);
      
      if (!packageInsights.revenueAnalysis[category]) {
        packageInsights.revenueAnalysis[category] = {
          orders: 0,
          totalRevenue: 0,
          avgRevenue: 0,
          acquisitions: 0,
          churn: 0,
          modifications: 0
        };
      }
      
      const analysis = packageInsights.revenueAnalysis[category];
      analysis.orders++;
      
      if (packageInfo.revenue) {
        analysis.totalRevenue += packageInfo.revenue;
      }
      
      switch (order.jenispsb) {
        case 'AO': analysis.acquisitions++; break;
        case 'DO': analysis.churn++; break;
        case 'MO': analysis.modifications++; break;
      }
    });
    
    // Calculate averages and insights
    Object.values(packageInsights.revenueAnalysis).forEach(analysis => {
      analysis.avgRevenue = analysis.totalRevenue / analysis.orders;
      analysis.churnRate = (analysis.churn / analysis.orders) * 100;
      analysis.modificationRate = (analysis.modifications / analysis.orders) * 100;
    });
    
    return packageInsights;
  }
  
  // Utility methods
  classifyPackage(packageName) {
    const name = packageName.toLowerCase();
    if (name.includes('jitu')) return 'JITU';
    if (name.includes('indibiz') || name.includes('hsi b2b')) return 'Indibiz';
    if (name.includes('indihome')) return 'IndiHome';
    if (name.includes('sooltannet')) return 'SooltanNet';
    if (name.match(/\d+\s*mbps/)) return 'Speed Package';
    return 'Other';
  }
  
  extractPackageIntelligence(packageName) {
    const revenueMatch = packageName.match(/\[(\d+)\]/);
    const speedMatch = packageName.match(/(\d+)M(?:bps)?/i);
    const bundleMatch = packageName.match(/(\d+)P/);
    
    return {
      revenue: revenueMatch ? parseInt(revenueMatch[1]) : null,
      speed: speedMatch ? parseInt(speedMatch[1]) : null,
      bundle: bundleMatch ? parseInt(bundleMatch[1]) : 1,
      services: this.extractServices(packageName)
    };
  }
  
  extractServices(packageName) {
    const services = [];
    if (packageName.toLowerCase().includes('inet')) services.push('Internet');
    if (packageName.toLowerCase().includes('phone') || packageName.toLowerCase().includes('voice')) services.push('Voice');
    if (packageName.toLowerCase().includes('tv') || packageName.toLowerCase().includes('usee')) services.push('TV');
    return services;
  }
  
  calculateTrend(values) {
    if (values.length < 2) return 'Insufficient data';
    
    const latest = values[values.length - 1];
    const previous = values[values.length - 2];
    const change = ((latest - previous) / previous) * 100;
    
    if (change > 10) return 'Strongly Increasing';
    if (change > 5) return 'Increasing';
    if (change > -5) return 'Stable';
    if (change > -10) return 'Decreasing';
    return 'Strongly Decreasing';
  }
  
  // Generate Advanced Business Recommendations
  generateAdvancedRecommendations(insights) {
    const recommendations = [];
    
    // Geographic recommendations
    if (insights.geographic) {
      Object.entries(insights.geographic.performanceClusters).forEach(([region, performance]) => {
        if (performance === 'Needs Improvement') {
          recommendations.push({
            type: 'geographic',
            priority: 'high',
            region: region,
            action: `Deploy performance improvement plan for Regional ${region}`,
            specific_actions: [
              'Analyze root causes of low completion rate',
              'Implement additional training for field teams',
              'Review and optimize local processes',
              'Increase resource allocation if needed'
            ],
            expected_impact: 'Improve completion rate by 15-20% within 3 months'
          });
        }
      });
    }
    
    // Lifecycle recommendations
    if (insights.lifecycle) {
      if (insights.lifecycle.churnIndicators.Early_Churn > 0) {
        recommendations.push({
          type: 'customer_retention',
          priority: 'critical',
          action: 'Implement early churn prevention program',
          specific_actions: [
            'Identify early churn warning signals',
            'Create rapid response retention team',
            'Develop onboarding improvement program',
            'Implement proactive customer success management'
          ],
          expected_impact: 'Reduce early churn by 30-40%'
        });
      }
    }
    
    // Package recommendations
    if (insights.package) {
      const lowPerformingPackages = Object.entries(insights.package.revenueAnalysis)
        .filter(([_, analysis]) => analysis.churnRate > 30);
      
      lowPerformingPackages.forEach(([packageType, analysis]) => {
        recommendations.push({
          type: 'product_optimization',
          priority: 'medium',
          action: `Optimize ${packageType} package performance`,
          specific_actions: [
            'Review package value proposition',
            'Analyze competitive positioning',
            'Improve customer onboarding for this package',
            'Consider pricing or feature adjustments'
          ],
          expected_impact: `Reduce ${packageType} churn rate from ${analysis.churnRate}% to <20%`
        });
      });
    }
    
    return recommendations;
  }
}

module.exports = DeepColumnIntelligence;