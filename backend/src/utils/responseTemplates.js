// backend/src/utils/responseTemplates.js
// Response templates untuk berbagai jenis analisis AI

class ResponseTemplates {
  
  constructor() {
    this.templates = {
      // Executive Level Response Templates
      executive: {
        intro: "📊 **Executive Intelligence Report:**",
        structure: {
          summary: "🎯 **Strategic Overview**",
          keyMetrics: "📈 **Key Performance Indicators**",
          businessHealth: "💼 **Business Health Assessment**",
          recommendations: "🚀 **Strategic Recommendations**",
          risks: "⚠️ **Risk Assessment**",
          opportunities: "💡 **Growth Opportunities**"
        },
        tone: "strategic",
        focus: ["ROI", "competitive advantage", "market position", "growth"],
        format: "high-level insights with actionable outcomes"
      },

      // Operational Level Response Templates  
      operational: {
        intro: "⚙️ **Operational Intelligence Analysis:**",
        structure: {
          summary: "📋 **Operational Overview**",
          performance: "⚡ **Performance Metrics**",
          efficiency: "🔧 **Process Efficiency**",
          quality: "✅ **Quality Indicators**",
          recommendations: "🛠️ **Process Improvements**",
          actions: "🎯 **Immediate Actions**"
        },
        tone: "analytical",
        focus: ["efficiency", "quality", "processes", "optimization"],
        format: "detailed metrics with improvement suggestions"
      },

      // Strategic Level Response Templates
      strategic: {
        intro: "🎯 **Strategic Business Intelligence:**",
        structure: {
          summary: "🌟 **Strategic Position**",
          market: "🏪 **Market Analysis**",
          competitive: "⚔️ **Competitive Landscape**",
          growth: "📈 **Growth Opportunities**",
          recommendations: "🚀 **Strategic Initiatives**",
          roadmap: "🗺️ **Implementation Roadmap**"
        },
        tone: "visionary",
        focus: ["market expansion", "innovation", "competitive advantage"],
        format: "market insights with strategic direction"
      },

      // Tactical Level Response Templates
      tactical: {
        intro: "🔧 **Tactical Action Intelligence:**",
        structure: {
          summary: "⚡ **Situation Analysis**",
          priorities: "🎯 **Priority Actions**",
          resources: "👥 **Resource Requirements**",
          timeline: "⏰ **Implementation Timeline**",
          kpis: "📊 **Success Metrics**",
          risks: "⚠️ **Implementation Risks**"
        },
        tone: "action-oriented",
        focus: ["immediate actions", "resource allocation", "quick wins"],
        format: "actionable insights with clear timelines"
      },

      // Technical Level Response Templates
      technical: {
        intro: "🔬 **Technical Analysis Report:**",
        structure: {
          summary: "🔍 **Technical Overview**",
          infrastructure: "🏗️ **Infrastructure Status**",
          performance: "⚡ **System Performance**",
          capacity: "📊 **Capacity Analysis**",
          recommendations: "🛠️ **Technical Recommendations**",
          roadmap: "🗺️ **Technical Roadmap**"
        },
        tone: "technical",
        focus: ["system performance", "infrastructure", "technical debt"],
        format: "technical metrics with engineering insights"
      },

      // Customer-Focused Response Templates
      customer: {
        intro: "👥 **Customer Intelligence Analysis:**",
        structure: {
          summary: "💼 **Customer Overview**",
          segmentation: "🎯 **Customer Segments**",
          journey: "🛤️ **Customer Journey**",
          satisfaction: "😊 **Satisfaction Metrics**",
          recommendations: "💡 **Customer Experience Improvements**",
          retention: "🔒 **Retention Strategies**"
        },
        tone: "customer-centric",
        focus: ["customer experience", "satisfaction", "retention"],
        format: "customer insights with experience improvements"
      },

      // Financial Level Response Templates
      financial: {
        intro: "💰 **Financial Intelligence Report:**",
        structure: {
          summary: "💼 **Financial Overview**",
          revenue: "📈 **Revenue Analysis**",
          profitability: "💵 **Profitability Metrics**",
          costs: "💸 **Cost Analysis**",
          recommendations: "🎯 **Financial Optimization**",
          forecast: "🔮 **Financial Forecast**"
        },
        tone: "financial",
        focus: ["revenue", "profitability", "cost optimization"],
        format: "financial metrics with business impact"
      }
    };

    // Response formatters for different data types
    this.formatters = {
      percentage: (value) => `${value}%`,
      currency: (value) => `Rp ${value?.toLocaleString('id-ID')}`,
      number: (value) => value?.toLocaleString('id-ID'),
      trend: (current, previous) => {
        const change = ((current - previous) / previous) * 100;
        const arrow = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
        return `${arrow} ${Math.abs(change).toFixed(1)}%`;
      },
      status: (value) => {
        if (value > 80) return '🟢 Excellent';
        if (value > 60) return '🟡 Good';
        if (value > 40) return '🟠 Fair';
        return '🔴 Needs Attention';
      }
    };

    // Pre-built insight templates
    this.insightTemplates = {
      positive: {
        icons: ['✅', '🎉', '🚀', '📈', '🌟'],
        phrases: [
          'Outstanding performance detected',
          'Significant improvement observed',
          'Excellent results achieved',
          'Strong positive trend identified',
          'Exceptional outcome recorded'
        ]
      },
      warning: {
        icons: ['⚠️', '🟡', '⏰', '🔍', '📊'],
        phrases: [
          'Attention required in this area',
          'Moderate concern identified',
          'Performance below expectations',
          'Trending towards suboptimal range',
          'Monitoring recommended'
        ]
      },
      critical: {
        icons: ['🚨', '🔴', '⛔', '💥', '🆘'],
        phrases: [
          'Critical issue detected',
          'Immediate action required',
          'Severe performance degradation',
          'Emergency intervention needed',
          'Critical threshold exceeded'
        ]
      },
      opportunity: {
        icons: ['💡', '🎯', '🚀', '📈', '💎'],
        phrases: [
          'Growth opportunity identified',
          'Potential for improvement detected',
          'Strategic opportunity available',
          'Optimization potential discovered',
          'Value creation opportunity found'
        ]
      }
    };
  }

  // Get template by type and customize for context
  getTemplate(type = 'operational', context = {}) {
    const template = this.templates[type] || this.templates.operational;
    
    return {
      ...template,
      customized: true,
      context: context,
      timestamp: new Date().toISOString()
    };
  }

  // Format response using template
  formatResponse(template, data, insights = [], recommendations = []) {
    const sections = [];
    
    // Intro
    sections.push(template.intro);
    sections.push('');

    // Summary section
    if (data.summary || data.coreKPIs) {
      sections.push(template.structure.summary);
      sections.push(this.formatSummarySection(data, template));
      sections.push('');
    }

    // Key metrics section
    if (data.coreKPIs || data.keyMetrics) {
      sections.push(template.structure.keyMetrics || template.structure.performance);
      sections.push(this.formatMetricsSection(data, template));
      sections.push('');
    }

    // Insights section
    if (insights.length > 0) {
      sections.push('🔍 **Key Insights:**');
      insights.slice(0, 5).forEach(insight => {
        const icon = this.getInsightIcon(insight.type);
        sections.push(`${icon} ${insight.message}`);
      });
      sections.push('');
    }

    // Recommendations section
    if (recommendations.length > 0) {
      sections.push(template.structure.recommendations);
      recommendations.slice(0, 3).forEach((rec, index) => {
        sections.push(`${index + 1}. **${rec.title || rec.action}**`);
        if (rec.description || rec.specific_actions) {
          sections.push(`   ${rec.description || rec.specific_actions[0]}`);
        }
        if (rec.expected_impact) {
          sections.push(`   💎 Impact: ${rec.expected_impact}`);
        }
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  // Format summary section based on data
  formatSummarySection(data, template) {
    const lines = [];
    const kpis = data.coreKPIs || data.summary || {};

    if (template.tone === 'strategic') {
      lines.push(`• Market Activity: ${this.formatters.number(kpis.total_orders)} total orders`);
      lines.push(`• Customer Base: ${this.formatters.number(kpis.unique_customers)} active customers`);
      lines.push(`• Regional Coverage: ${kpis.active_regions} regions, ${kpis.active_witels} witels`);
      lines.push(`• Growth Momentum: ${kpis.new_acquisitions - kpis.churn_count > 0 ? '📈 Positive' : '📉 Negative'} net growth`);
    } else if (template.tone === 'operational') {
      lines.push(`• Service Excellence: ${this.formatters.status(kpis.overall_completion_rate)} (${kpis.overall_completion_rate}%)`);
      lines.push(`• Processing Efficiency: ${kpis.avg_installation_days} days average delivery`);
      lines.push(`• Customer Retention: ${this.formatters.percentage(100 - kpis.churn_rate)} retention rate`);
      lines.push(`• Recent Activity: ${this.formatters.number(kpis.recent_orders)} orders (30 days)`);
    } else {
      lines.push(`• Total Orders: ${this.formatters.number(kpis.total_orders)}`);
      lines.push(`• Completion Rate: ${this.formatters.percentage(kpis.overall_completion_rate)}`);
      lines.push(`• Customer Growth: ${kpis.new_acquisitions - kpis.churn_count} net customers`);
    }

    return lines.join('\n');
  }

  // Format metrics section
  formatMetricsSection(data, template) {
    const lines = [];
    const kpis = data.coreKPIs || {};

    // Customer metrics
    lines.push('**Customer Dynamics:**');
    lines.push(`• New Acquisitions: ${this.formatters.number(kpis.new_acquisitions)}`);
    lines.push(`• Service Modifications: ${this.formatters.number(kpis.modifications)}`);
    lines.push(`• Customer Churn: ${this.formatters.number(kpis.churn_count)} (${this.formatters.percentage(kpis.churn_rate)})`);
    lines.push('');

    // Service metrics
    lines.push('**Service Performance:**');
    lines.push(`• Completion Rate: ${this.formatters.status(kpis.overall_completion_rate)} (${kpis.overall_completion_rate}%)`);
    lines.push(`• Installation Time: ${kpis.avg_installation_days} days average`);
    lines.push(`• Business Customers: ${this.formatters.number(kpis.business_customers)}`);

    return lines.join('\n');
  }

  // Get appropriate icon for insight type
  getInsightIcon(type) {
    const templates = this.insightTemplates[type];
    if (!templates) return '📊';
    
    const randomIndex = Math.floor(Math.random() * templates.icons.length);
    return templates.icons[randomIndex];
  }

  // Generate insight message with appropriate tone
  generateInsightMessage(type, data, context) {
    const templates = this.insightTemplates[type];
    if (!templates) return data.message || 'Insight detected';

    const randomPhrase = templates.phrases[Math.floor(Math.random() * templates.phrases.length)];
    const icon = this.getInsightIcon(type);
    
    return `${icon} ${data.message || randomPhrase}`;
  }

  // Get recommendations template
  getRecommendationsTemplate(type) {
    const templates = {
      immediate: {
        title: '🚨 Immediate Actions Required',
        timeframe: '24-48 hours',
        priority: 'Critical'
      },
      short_term: {
        title: '⚡ Short-term Improvements',
        timeframe: '1-4 weeks',
        priority: 'High'
      },
      medium_term: {
        title: '📈 Medium-term Strategies',
        timeframe: '1-3 months',
        priority: 'Medium'
      },
      long_term: {
        title: '🎯 Long-term Initiatives',
        timeframe: '3-12 months',
        priority: 'Strategic'
      }
    };

    return templates[type] || templates.short_term;
  }

  // Format business metrics with context
  formatBusinessMetrics(metrics, context = {}) {
    const formatted = {};
    
    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (key.includes('rate') || key.includes('percent')) {
          formatted[key] = this.formatters.percentage(value);
        } else if (key.includes('revenue') || key.includes('cost')) {
          formatted[key] = this.formatters.currency(value);
        } else {
          formatted[key] = this.formatters.number(value);
        }
      } else {
        formatted[key] = value;
      }
    });
    
    return formatted;
  }

  // Create contextual response based on user intent and data
  createContextualResponse(intent, data, template_type = 'operational') {
    const template = this.getTemplate(template_type, { intent });
    const insights = this.generateContextualInsights(data, intent);
    const recommendations = this.generateContextualRecommendations(data, intent);
    
    return this.formatResponse(template, data, insights, recommendations);
  }

  // Generate contextual insights based on intent
  generateContextualInsights(data, intent) {
    const insights = [];
    const kpis = data.coreKPIs || {};
    
    // Customer-focused insights
    if (intent.primary === 'customer_intelligence') {
      if (kpis.churn_rate < 15) {
        insights.push({
          type: 'positive',
          message: `Excellent customer retention with ${100 - kpis.churn_rate}% retention rate`
        });
      } else if (kpis.churn_rate > 25) {
        insights.push({
          type: 'critical',
          message: `High churn rate of ${kpis.churn_rate}% requires immediate intervention`
        });
      }
    }
    
    // Performance insights
    if (intent.primary === 'operational_excellence') {
      if (kpis.overall_completion_rate > 85) {
        insights.push({
          type: 'positive',
          message: `Outstanding service delivery with ${kpis.overall_completion_rate}% completion rate`
        });
      } else if (kpis.overall_completion_rate < 70) {
        insights.push({
          type: 'warning',
          message: `Service completion rate below standard at ${kpis.overall_completion_rate}%`
        });
      }
    }
    
    return insights;
  }

  // Generate contextual recommendations
  generateContextualRecommendations(data, intent) {
    const recommendations = [];
    const kpis = data.coreKPIs || {};
    
    // Strategic recommendations
    if (intent.business_impact === 'high') {
      recommendations.push({
        title: 'Strategic Performance Review',
        action: 'Conduct comprehensive performance assessment across all regions',
        expected_impact: 'Identify optimization opportunities worth 15-20% improvement',
        timeline: '2-3 weeks'
      });
    }
    
    // Operational recommendations
    if (kpis.overall_completion_rate < 80) {
      recommendations.push({
        title: 'Service Delivery Optimization',
        action: 'Implement process improvement program for service delivery',
        expected_impact: 'Increase completion rate to 85%+ within 8 weeks',
        timeline: '6-8 weeks'
      });
    }
    
    return recommendations;
  }
}

module.exports = ResponseTemplates;