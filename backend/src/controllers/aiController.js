// AICONTROLLER.JS
const { Pool } = require('pg');
const DeepColumnIntelligence = require('../utils/deepColumnIntelligence');
const TelkomAIIntelligence = require('../utils/aiIntelligence');
const TelkomOrderModel = require('../models/telkomOrderModel');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Master AI Controller - Complete Telkom Business Intelligence System
class aiController {
  
  constructor() {
    this.deepIntelligence = new DeepColumnIntelligence();
    this.aiIntelligence = new TelkomAIIntelligence();
    
    // Advanced response templates with business context
    this.responseTemplates = {
      executive: {
        intro: "📊 **Executive Intelligence Report:**",
        format: "high-level strategic insights with actionable recommendations",
        focus: "business impact, ROI, competitive advantage"
      },
      operational: {
        intro: "⚙️ **Operational Intelligence Analysis:**",
        format: "detailed operational metrics with process improvements",
        focus: "efficiency, quality, resource optimization"
      },
      strategic: {
        intro: "🎯 **Strategic Business Intelligence:**",
        format: "market insights with growth opportunities",
        focus: "market expansion, customer value, innovation"
      },
      tactical: {
        intro: "🔧 **Tactical Action Intelligence:**",
        format: "immediate actionable insights with timelines",
        focus: "quick wins, problem solving, resource allocation"
      }
    };
  }

  // Enhanced Chat with Complete Intelligence - Bahasa Indonesia Support
  async chat(req, res) {
    try {
      const { message, conversationHistory = [], responseType = 'operational' } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Pesan diperlukan / Message is required' });
      }

      console.log(`🤖 AI Processing: "${message}" (Type: ${responseType})`);

      // Get enhanced HSI business data from model
      const stats = await TelkomOrderModel.getOverallStats();
      const regionalData = await TelkomOrderModel.getRegionalBreakdown();
      const jenisPsbData = await TelkomOrderModel.getJenisPsbComposition();
      const processingRiskAlerts = await TelkomOrderModel.getProcessingRiskAlerts();
      const jenisPsbChampions = await TelkomOrderModel.getJenisPsbChampions();
      
      // Enhanced intent detection for Indonesian language
      const lowerMessage = message.toLowerCase();
      let aiResponse = "";
      let insights = [];
      let recommendations = [];
      
      // Indonesian language detection patterns
      const indonesianKeywords = {
        performance: ['performa', 'kinerja', 'prestasi', 'pencapaian', 'hasil'],
        overview: ['ringkasan', 'gambaran', 'ikhtisar', 'overview', 'summary'],
        regional: ['regional', 'wilayah', 'daerah', 'area'],
        problem: ['masalah', 'kendala', 'hambatan', 'gangguan', 'trouble'],
        help: ['bantuan', 'tolong', 'bantu', 'help', 'assist'],
        data: ['data', 'informasi', 'laporan', 'report'],
        analysis: ['analisis', 'analisa', 'evaluasi', 'kajian'],
        status: ['status', 'kondisi', 'keadaan', 'situasi'],
        trend: ['tren', 'trend', 'pola', 'pattern'],
        customer: ['pelanggan', 'customer', 'klien', 'client']
      };
      
      // Check for Indonesian keywords
      const isIndonesian = Object.values(indonesianKeywords).some(keywords => 
        keywords.some(keyword => lowerMessage.includes(keyword))
      );

      if (lowerMessage.includes('performance') || lowerMessage.includes('overview') || lowerMessage.includes('summary') ||
          lowerMessage.includes('performa') || lowerMessage.includes('kinerja') || lowerMessage.includes('ringkasan') ||
          lowerMessage.includes('gambaran') || lowerMessage.includes('ikhtisar') || lowerMessage.includes('pencapaian')) {
        aiResponse = isIndonesian ? 
          `📊 **Dashboard Kinerja Bisnis HSI**

**🎯 Metrik Bisnis Utama:**
• Total Order: ${stats.totalOrders.toLocaleString()}
• Tingkat Pencapaian: ${stats.achievementPercentage.toFixed(1)}% (Target: 85%)
• Tingkat Penyelesaian: ${stats.completionRate.toFixed(1)}%
• Rasio Churn terhadap Penjualan: ${stats.churnToSalesRatio.toFixed(1)}%
• Rasio CT0 terhadap Penjualan: ${stats.ct0ToSalesRatio.toFixed(1)}%

**📈 Intelijen Bisnis:**
• Order Aktivasi (AO): ${stats.activationOrders.toLocaleString()}
• Order Pemutusan (DO): ${stats.disconnectOrders.toLocaleString()}
• Pertumbuhan Bersih: ${(stats.activationOrders - stats.disconnectOrders).toLocaleString()}
• Waktu Proses Rata-rata: ${stats.avgProcessingDays.toFixed(1)} hari
• Kecepatan Penjualan Harian: ${stats.dailySalesVelocity} order/hari

**🏢 Cakupan Organisasi:**
• Regional: ${stats.totalRegions} | Witel: ${stats.totalWitels} | Datel: ${stats.totalDatels}
• Kota: ${stats.totalCities}

**Analisis:**
Sistem HSI Indibiz menunjukkan performa ${stats.achievementPercentage > 90 ? 'sangat baik' : stats.achievementPercentage > 80 ? 'baik' : 'perlu perbaikan'} dengan tingkat pencapaian ${stats.achievementPercentage.toFixed(1)}% terhadap target 85%. Rasio churn ${stats.churnToSalesRatio.toFixed(1)}% ${stats.churnToSalesRatio > 15 ? 'perlu perhatian khusus' : 'dalam batas normal'}.` :
          `📊 **HSI Business Performance Dashboard**

**🎯 Key Business Metrics:**
• Total Orders: ${stats.totalOrders.toLocaleString()}
• Achievement Rate: ${stats.achievementPercentage.toFixed(1)}% (Target: 85%)
• Completion Rate: ${stats.completionRate.toFixed(1)}%
• Churn to Sales Ratio: ${stats.churnToSalesRatio.toFixed(1)}%
• CT0 to Sales Ratio: ${stats.ct0ToSalesRatio.toFixed(1)}%

**📈 Business Intelligence:**
• Activation Orders (AO): ${stats.activationOrders.toLocaleString()}
• Disconnect Orders (DO): ${stats.disconnectOrders.toLocaleString()}
• Net Growth: ${(stats.activationOrders - stats.disconnectOrders).toLocaleString()}
• Average Processing Time: ${stats.avgProcessingDays.toFixed(1)} days
• Daily Sales Velocity: ${stats.dailySalesVelocity} orders/day

**🏢 Organizational Coverage:**
• Regional: ${stats.totalRegions} | Witel: ${stats.totalWitels} | Datel: ${stats.totalDatels}
• Cities: ${stats.totalCities}

**Analysis:**
Sistem HSI Indibiz menunjukkan performa ${stats.achievementPercentage > 90 ? 'excellent' : stats.achievementPercentage > 80 ? 'good' : 'needs improvement'} dengan achievement rate ${stats.achievementPercentage.toFixed(1)}% terhadap target 85%. Churn ratio ${stats.churnToSalesRatio.toFixed(1)}% ${stats.churnToSalesRatio > 15 ? 'perlu perhatian khusus' : 'dalam batas normal'}.`;
        
        insights = isIndonesian ? [
          `Tingkat pencapaian ${stats.achievementPercentage.toFixed(1)}% vs target 85%`,
          `Pertumbuhan pelanggan bersih: ${(stats.activationOrders - stats.disconnectOrders).toLocaleString()}`,
          `Rasio churn terhadap penjualan: ${stats.churnToSalesRatio.toFixed(1)}%`,
          `Efisiensi pemrosesan: rata-rata ${stats.avgProcessingDays.toFixed(1)} hari`,
          `${stats.slowProcessingOrders} order memerlukan waktu > 3 hari`
        ] : [
          `Achievement rate ${stats.achievementPercentage.toFixed(1)}% vs target 85%`,
          `Net customer growth: ${(stats.activationOrders - stats.disconnectOrders).toLocaleString()}`,
          `Churn to sales ratio: ${stats.churnToSalesRatio.toFixed(1)}%`,
          `Processing efficiency: ${stats.avgProcessingDays.toFixed(1)} days average`,
          `${stats.slowProcessingOrders} orders memerlukan waktu > 3 hari`
        ];
        
        recommendations = isIndonesian ? [
          stats.achievementPercentage < 85 ? "Fokus pada peningkatan tingkat penyelesaian untuk mencapai target 85%" : "Pertahankan performa pencapaian yang sangat baik",
          stats.churnToSalesRatio > 15 ? "Implementasikan strategi retensi pelanggan untuk mengurangi churn" : "Pantau tren rasio churn",
          stats.avgProcessingDays > 3 ? "Optimalkan alur kerja pemrosesan untuk mengurangi waktu pengiriman" : "Pertahankan waktu pemrosesan yang efisien",
          "Manfaatkan regional berkinerja tinggi untuk berbagi praktik terbaik"
        ] : [
          stats.achievementPercentage < 85 ? "Focus on improving completion rate to achieve 85% target" : "Maintain excellent achievement performance",
          stats.churnToSalesRatio > 15 ? "Implement customer retention strategies to reduce churn" : "Monitor churn ratio trends",
          stats.avgProcessingDays > 3 ? "Optimize processing workflow to reduce delivery time" : "Maintain efficient processing time",
          "Leverage high-performing regions for best practice sharing"
        ];
      } else if (lowerMessage.includes('regional') || lowerMessage.includes('region') || 
                 lowerMessage.includes('wilayah') || lowerMessage.includes('daerah')) {
        let regionalInfo = regionalData.slice(0, 5).map(r => 
          `• Regional ${r.regional}: ${r.total_orders} orders | Achievement: ${r.achievement_percentage.toFixed(1)}% | Churn: ${r.churn_to_sales_ratio.toFixed(1)}%`
        ).join('\n');
        
        aiResponse = isIndonesian ?
          `🗺️ **Analisis Kinerja Regional**

**Regional Berkinerja Terbaik:**
${regionalInfo}

**📊 Wawasan Regional:**
• Pencapaian Terbaik: Regional ${regionalData[0].regional} (${regionalData[0].achievement_percentage.toFixed(1)}%)
• Order Terbanyak: Regional ${regionalData[0].regional} (${regionalData[0].total_orders} order)
• Churn Terendah: Regional ${regionalData.find(r => r.churn_to_sales_ratio === Math.min(...regionalData.map(rd => rd.churn_to_sales_ratio)))?.regional} (${Math.min(...regionalData.map(rd => rd.churn_to_sales_ratio)).toFixed(1)}%)

**🏢 Struktur Organisasi:**
• Total Witel: ${regionalData.reduce((sum, r) => sum + r.witel_count, 0)}
• Total Datel: ${regionalData.reduce((sum, r) => sum + r.datel_count, 0)}
• Cakupan Kota: ${regionalData.reduce((sum, r) => sum + r.city_count, 0)}

**Analisis:**
Regional ${regionalData[0].regional} menunjukkan performa terbaik dengan ${regionalData[0].total_orders} order dan tingkat pencapaian ${regionalData[0].achievement_percentage.toFixed(1)}%. Struktur hierarkis Telkom tersebar di ${regionalData.length} regional dengan cakupan yang komprehensif.` :
          `🗺️ **Regional Business Performance Analysis**

**Top Performing Regions:**
${regionalInfo}

**📊 Regional Insights:**
• Best Achievement: Regional ${regionalData[0].regional} (${regionalData[0].achievement_percentage.toFixed(1)}%)
• Highest Orders: Regional ${regionalData[0].regional} (${regionalData[0].total_orders} orders)
• Lowest Churn: Regional ${regionalData.find(r => r.churn_to_sales_ratio === Math.min(...regionalData.map(rd => rd.churn_to_sales_ratio)))?.regional} (${Math.min(...regionalData.map(rd => rd.churn_to_sales_ratio)).toFixed(1)}%)

**🏢 Organizational Structure:**
• Total Witels: ${regionalData.reduce((sum, r) => sum + r.witel_count, 0)}
• Total Datels: ${regionalData.reduce((sum, r) => sum + r.datel_count, 0)}
• Coverage Cities: ${regionalData.reduce((sum, r) => sum + r.city_count, 0)}

**Analysis:**
Regional ${regionalData[0].regional} menunjukkan performa terbaik dengan ${regionalData[0].total_orders} orders dan achievement rate ${regionalData[0].achievement_percentage.toFixed(1)}%. Struktur hierarkis Telkom tersebar di ${regionalData.length} regional dengan coverage yang komprehensif.`;
        
        insights = regionalData.slice(0, 3).map(r => 
          `Regional ${r.regional}: ${r.total_orders} orders, ${r.achievement_percentage.toFixed(1)}% achievement, ${r.churn_to_sales_ratio.toFixed(1)}% churn ratio`
        );
      } else if (lowerMessage.includes('package') || lowerMessage.includes('produk') || 
                 lowerMessage.includes('paket') || lowerMessage.includes('layanan')) {
        const packageResult = await pool.query(`
          SELECT 
            CASE 
              WHEN package_name LIKE '%JITU%' THEN 'JITU Package'
              WHEN package_name LIKE '%Indibiz%' OR package_name LIKE '%EBIS%' THEN 'Indibiz Package'
              WHEN package_name LIKE '%IndiHome%' THEN 'IndiHome Package'
              ELSE 'Other Package'
            END as package_category,
            COUNT(*) as total_orders
          FROM telkom_orders 
          WHERE package_name IS NOT NULL
          GROUP BY package_category
          ORDER BY total_orders DESC 
        `);
        
        let packageInfo = packageResult.rows.map(p => 
          `• ${p.package_category}: ${parseInt(p.total_orders)} orders`
        ).join('\n');
        
        aiResponse = isIndonesian ?
          `📦 **Analisis Kinerja Paket**

**Distribusi Paket:**
${packageInfo}

Paket ${packageResult.rows[0].package_category} paling populer dengan ${parseInt(packageResult.rows[0].total_orders)} order.` :
          `📦 **Package Performance Analysis**

**Package Distribution:**
${packageInfo}

Package ${packageResult.rows[0].package_category} paling populer dengan ${parseInt(packageResult.rows[0].total_orders)} orders.`;
      } else {
        // Handle common Indonesian greetings and help requests
        if (lowerMessage.includes('halo') || lowerMessage.includes('hai') || lowerMessage.includes('hello') ||
            lowerMessage.includes('selamat') || lowerMessage.includes('bantuan') || lowerMessage.includes('tolong')) {
          aiResponse = `🤖 **BrightAI Assistant**

Halo! Saya adalah BrightAI, asisten analitik HSI Telkom yang siap membantu Anda. Saat ini kami memiliki ${stats.totalOrders.toLocaleString()} total order dengan tingkat penyelesaian ${stats.completionRate.toFixed(1)}%.

**Yang bisa saya bantu:**
• Gambaran performa dan KPI utama
• Analisis regional dan distribusi order
• Kinerja paket dan produk
• Tren dan wawasan bisnis

**Contoh pertanyaan:**
• "Bagaimana performa HSI hari ini?"
• "Analisis regional mana yang terbaik?"
• "Berapa tingkat churn pelanggan?"
• "Paket apa yang paling laris?"

Silakan tanyakan tentang performa HSI, analisis regional, atau kinerja paket!`;
        } else {
          aiResponse = isIndonesian ?
            `🤖 **BrightAI Assistant**

Halo! Saya adalah BrightAI, asisten analitik HSI Telkom. Saat ini kami memiliki ${stats.totalOrders.toLocaleString()} total order dengan tingkat penyelesaian ${stats.completionRate.toFixed(1)}%.

**Yang bisa saya bantu:**
• Gambaran performa dan KPI utama
• Analisis regional dan distribusi order
• Kinerja paket dan produk
• Tren dan wawasan bisnis

Silakan tanyakan tentang performa HSI, analisis regional, atau kinerja paket!` :
            `🤖 **BrightAI Assistant**

Hello! I am BrightAI, HSI Telkom analytics assistant. Currently we have ${stats.totalOrders.toLocaleString()} total orders with completion rate ${stats.completionRate.toFixed(1)}%.

**What I can help with:**
• Performance overview and key KPIs
• Regional analysis and order distribution
• Package and product performance
• Business trends and insights

Please ask about HSI performance, regional analysis, or package performance!`;
        }
        
        insights = isIndonesian ? ["Sistem siap dengan data real-time HSI"] : ["System ready dengan data real-time HSI"];
        recommendations = isIndonesian ? ["Tanyakan tentang 'gambaran performa' untuk wawasan lengkap"] : ["Tanyakan tentang 'performance overview' untuk insight lengkap"];
      }

      res.json({
        response: aiResponse,
        data: {
          totalOrders: parseInt(stats.total_orders),
          completedOrders: parseInt(stats.completed_orders),
          pendingOrders: parseInt(stats.pending_orders),
          completionRate: parseFloat(stats.avg_completion_rate),
          totalRegions: parseInt(stats.total_regions)
        },
        insights: insights,
        recommendations: recommendations,
        patterns: [],
        predictions: [],
        alerts: [],
        opportunities: [],
        kpis: {
          totalOrders: parseInt(stats.total_orders),
          completionRate: parseFloat(stats.avg_completion_rate),
          activeRegions: parseInt(stats.total_regions)
        },
        metadata: {
          intent: { primary: 'hsi_analysis', confidence: 0.9 },
          analysisDepth: 'real_data',
          responseType: responseType,
          dataPoints: parseInt(stats.total_orders),
          confidenceScore: 0.95
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('🚨 AI Chat Error:', error);
      res.status(500).json({ 
        error: 'Maaf, terjadi kendala sistem AI. Silakan coba lagi.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Advanced Intent Analysis with Context Understanding
  async analyzeAdvancedIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    // Enhanced intent patterns with business context
    const advancedIntents = {
      // Strategic Business Intelligence
      strategic_performance: {
        keywords: ['strategic', 'business performance', 'competitive', 'market position', 'growth strategy'],
        confidence_multiplier: 2.0,
        business_impact: 'high',
        decision_level: 'executive'
      },
      
      // Customer Intelligence & Experience
      customer_intelligence: {
        keywords: ['customer', 'pelanggan', 'churn', 'retention', 'satisfaction', 'behavior', 'journey', 'lifecycle'],
        confidence_multiplier: 1.8,
        business_impact: 'high',
        decision_level: 'strategic'
      },
      
      // Revenue & Financial Intelligence
      revenue_intelligence: {
        keywords: ['revenue', 'pendapatan', 'arpu', 'financial', 'profitability', 'pricing', 'monetization'],
        confidence_multiplier: 1.9,
        business_impact: 'critical',
        decision_level: 'executive'
      },
      
      // Operational Excellence
      operational_excellence: {
        keywords: ['operational', 'efficiency', 'process', 'quality', 'sla', 'completion rate', 'delivery'],
        confidence_multiplier: 1.6,
        business_impact: 'medium',
        decision_level: 'operational'
      },
      
      // Network & Infrastructure Intelligence
      infrastructure_intelligence: {
        keywords: ['network', 'infrastructure', 'capacity', 'coverage', 'fiber', 'technical', 'deployment'],
        confidence_multiplier: 1.5,
        business_impact: 'medium',
        decision_level: 'technical'
      },
      
      // Market & Geographic Intelligence
      market_intelligence: {
        keywords: ['market', 'geographic', 'regional', 'penetration', 'expansion', 'coverage', 'competition'],
        confidence_multiplier: 1.7,
        business_impact: 'high',
        decision_level: 'strategic'
      },
      
      // Product & Package Intelligence
      product_intelligence: {
        keywords: ['product', 'package', 'bundle', 'offering', 'portfolio', 'jitu', 'indibiz', 'indihome'],
        confidence_multiplier: 1.6,
        business_impact: 'medium',
        decision_level: 'product'
      },
      
      // Risk & Predictive Intelligence
      risk_intelligence: {
        keywords: ['risk', 'prediction', 'forecast', 'early warning', 'anomaly', 'trend', 'future'],
        confidence_multiplier: 1.8,
        business_impact: 'high',
        decision_level: 'strategic'
      },
      
      // Sales & Channel Intelligence
      sales_intelligence: {
        keywords: ['sales', 'channel', 'agent', 'distribution', 'acquisition', 'conversion', 'pipeline'],
        confidence_multiplier: 1.5,
        business_impact: 'medium',
        decision_level: 'sales'
      }
    };

    // Calculate intent scores with context
    const intentScores = {};
    const urgencyIndicators = ['urgent', 'critical', 'emergency', 'immediately', 'asap'];
    const timeIndicators = ['today', 'now', 'current', 'latest', 'recent'];
    
    for (const [intent, config] of Object.entries(advancedIntents)) {
      let score = 0;
      
      // Keyword matching with confidence multiplier
      config.keywords.forEach(keyword => {
        if (lowerMessage.includes(keyword)) {
          score += config.confidence_multiplier;
        }
      });
      
      // Urgency boost
      if (urgencyIndicators.some(indicator => lowerMessage.includes(indicator))) {
        score *= 1.5;
      }
      
      // Time sensitivity boost
      if (timeIndicators.some(indicator => lowerMessage.includes(indicator))) {
        score *= 1.2;
      }
      
      intentScores[intent] = {
        score: score,
        business_impact: config.business_impact,
        decision_level: config.decision_level
      };
    }

    // Find best intent with confidence
    const bestIntent = Object.entries(intentScores).reduce((best, [intent, data]) => {
      return data.score > (best?.score || 0) ? { intent, ...data } : best;
    }, null);

    return {
      primary: bestIntent?.intent || 'general_inquiry',
      confidence: Math.min(bestIntent?.score || 0, 10) / 10,
      business_impact: bestIntent?.business_impact || 'low',
      decision_level: bestIntent?.decision_level || 'operational',
      all_scores: intentScores
    };
  }

  // Comprehensive Data Gathering with Deep Analysis
  async gatherComprehensiveData(intent) {
    const data = {};
    const primaryIntent = intent.primary;

    try {
      // Always gather core KPIs for context
      data.coreKPIs = await this.getCoreKPIs();
      
      // Intent-specific deep data gathering
      switch (primaryIntent) {
        case 'strategic_performance':
          data.strategicMetrics = await this.getStrategicPerformanceMetrics();
          data.competitiveAnalysis = await this.getCompetitiveAnalysis();
          data.marketTrends = await this.getMarketTrendAnalysis();
          data.growthOpportunities = await this.getGrowthOpportunities();
          break;

        case 'customer_intelligence':
          data.customerSegmentation = await this.getAdvancedCustomerSegmentation();
          data.churnPrediction = await this.getChurnPredictionData();
          data.customerJourney = await this.getCustomerJourneyAnalysis();
          data.satisfactionMetrics = await this.getCustomerSatisfactionMetrics();
          data.lifetimeValue = await this.getCustomerLifetimeValue();
          break;

        case 'revenue_intelligence':
          data.revenueAnalysis = await this.getComprehensiveRevenueAnalysis();
          data.arpuAnalysis = await this.getARPUAnalysis();
          data.pricingIntelligence = await this.getPricingIntelligence();
          data.revenueForecasting = await this.getRevenueForecast();
          break;

        case 'operational_excellence':
          data.operationalMetrics = await this.getOperationalExcellenceMetrics();
          data.processEfficiency = await this.getProcessEfficiencyAnalysis();
          data.qualityMetrics = await this.getQualityMetrics();
          data.resourceUtilization = await this.getResourceUtilizationAnalysis();
          break;

        case 'infrastructure_intelligence':
          data.networkHealth = await this.getNetworkHealthAnalysis();
          data.capacityAnalysis = await this.getCapacityAnalysis();
          data.infrastructureROI = await this.getInfrastructureROI();
          data.deploymentEfficiency = await this.getDeploymentEfficiency();
          break;

        case 'market_intelligence':
          data.marketPenetration = await this.getMarketPenetrationAnalysis();
          data.geographicPerformance = await this.getGeographicPerformanceAnalysis();
          data.competitiveLandscape = await this.getCompetitiveLandscape();
          data.expansionOpportunities = await this.getExpansionOpportunities();
          break;

        case 'product_intelligence':
          data.productPerformance = await this.getProductPerformanceAnalysis();
          data.bundlingAnalysis = await this.getBundlingAnalysis();
          data.productLifecycle = await this.getProductLifecycleAnalysis();
          data.crossSelling = await this.getCrossSellAnalysis();
          break;

        case 'risk_intelligence':
          data.riskAssessment = await this.getRiskAssessmentAnalysis();
          data.predictiveModels = await this.getPredictiveModelResults();
          data.anomalyDetection = await this.getAnomalyDetection();
          data.earlyWarning = await this.getEarlyWarningIndicators();
          break;

        case 'sales_intelligence':
          data.salesPerformance = await this.getSalesPerformanceAnalysis();
          data.channelEffectiveness = await this.getChannelEffectivenessAnalysis();
          data.conversionAnalysis = await this.getConversionAnalysis();
          data.pipelineAnalysis = await this.getPipelineAnalysis();
          break;

        default:
          // General comprehensive overview
          data.generalOverview = await this.getGeneralOverview();
          data.quickInsights = await this.getQuickInsights();
      }

      return data;
    } catch (error) {
      console.error('Error in comprehensive data gathering:', error);
      return { error: error.message };
    }
  }

  // Core KPIs - Always Available
  async getCoreKPIs() {
    const query = `
      SELECT 
        -- Volume Metrics
        COUNT(*) as total_orders,
        COUNT(DISTINCT customer_name) as unique_customers,
        COUNT(DISTINCT regional) as active_regions,
        COUNT(DISTINCT witel) as active_witels,
        
        -- Business Health Metrics
        COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END) as new_acquisitions,
        COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) as churn_count,
        COUNT(CASE WHEN jenispsb = 'MO' THEN 1 END) as modifications,
        COUNT(CASE WHEN jenispsb = 'AS' THEN 1 END) as add_services,
        
        -- Performance Metrics
        ROUND(
          COUNT(CASE WHEN status_resume LIKE '%Completed%' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as overall_completion_rate,
        
        -- Customer Value Metrics
        COUNT(CASE WHEN kat_hvc = 'Bisnis' THEN 1 END) as business_customers,
        COUNT(CASE WHEN provider = '2P' THEN 1 END) as dual_play_customers,
        COUNT(CASE WHEN provider = '3P' THEN 1 END) as triple_play_customers,
        
        -- Time Performance
        ROUND(
          AVG(CASE WHEN 
            order_date IS NOT NULL AND 
            tgl_ps IS NOT NULL AND 
            (tgl_ps - order_date) >= INTERVAL '0 days'
          THEN EXTRACT(days FROM (tgl_ps - order_date)) END), 2
        ) as avg_installation_days,
        
        -- Recent Activity (30 days)
        COUNT(CASE WHEN order_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_orders,
        
        -- Risk Indicators
        ROUND(
          COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(CASE WHEN jenispsb IN ('AO', 'MO', 'DO') THEN 1 END), 0), 2
        ) as churn_rate
        
      FROM telkom_orders
    `;
    
    const result = await pool.query(query);
    return result.rows[0];
  }

  // Strategic Performance Metrics
  async getStrategicPerformanceMetrics() {
    const query = `
      WITH monthly_performance AS (
        SELECT 
          DATE_TRUNC('month', order_date) as month,
          COUNT(*) as monthly_orders,
          COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END) as monthly_acquisitions,
          COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) as monthly_churn,
          COUNT(CASE WHEN kat_hvc = 'Bisnis' THEN 1 END) as monthly_business
        FROM telkom_orders 
        WHERE order_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', order_date)
        ORDER BY month
      ),
      regional_comparison AS (
        SELECT 
          regional,
          COUNT(*) as orders,
          ROUND(AVG(CASE WHEN status_resume LIKE '%Completed%' THEN 100.0 ELSE 0 END), 2) as completion_rate,
          COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END) - COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) as net_growth
        FROM telkom_orders
        GROUP BY regional
      )
      SELECT 
        'strategic_overview' as metric_type,
        json_build_object(
          'monthly_trends', array_agg(monthly_performance ORDER BY month),
          'regional_performance', array_agg(regional_comparison ORDER BY orders DESC),
          'growth_rate', (
            SELECT ROUND(
              (MAX(monthly_acquisitions) - MIN(monthly_acquisitions)) * 100.0 / 
              NULLIF(MIN(monthly_acquisitions), 0), 2
            ) FROM monthly_performance
          ),
          'market_expansion', (
            SELECT COUNT(DISTINCT city_name) FROM telkom_orders
          )
        ) as data
      FROM monthly_performance, regional_comparison
      GROUP BY metric_type
    `;
    
    const result = await pool.query(query);
    return result.rows[0]?.data || {};
  }

  // Advanced Customer Segmentation
  async getAdvancedCustomerSegmentation() {
    const query = `
      WITH customer_profile AS (
        SELECT 
          customer_name,
          regional,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN jenispsb = 'AO' THEN 1 END) as acquisitions,
          COUNT(CASE WHEN jenispsb = 'DO' THEN 1 END) as disconnections,
          COUNT(CASE WHEN jenispsb = 'MO' THEN 1 END) as modifications,
          COUNT(CASE WHEN jenispsb = 'AS' THEN 1 END) as add_services,
          COUNT(CASE WHEN provider = '3P' THEN 1 END) as triple_play_orders,
          COUNT(CASE WHEN kat_hvc = 'Bisnis' THEN 1 END) as business_orders,
          ROUND(
            COUNT(CASE WHEN status_resume LIKE '%Completed%' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as success_rate,
          MIN(order_date) as first_order,
          MAX(order_date) as last_order
        FROM telkom_orders 
        WHERE customer_name IS NOT NULL
        GROUP BY customer_name, regional
      ),
      customer_segments AS (
        SELECT 
          customer_name,
          regional,
          total_orders,
          success_rate,
          CASE 
            WHEN business_orders > 0 AND total_orders >= 5 THEN 'Enterprise Champion'
            WHEN triple_play_orders > 0 AND total_orders >= 3 THEN 'Premium Multi-Service'
            WHEN add_services > 0 AND modifications > 0 THEN 'Growth Partner'
            WHEN total_orders >= 10 THEN 'Loyal Advocate'
            WHEN disconnections > acquisitions THEN 'At-Risk Customer'
            WHEN total_orders >= 3 AND success_rate > 80 THEN 'Satisfied Regular'
            WHEN total_orders = 1 AND disconnections = 0 THEN 'New Customer'
            ELSE 'Standard Customer'
          END as segment,
          CASE 
            WHEN total_orders >= 10 OR business_orders > 0 THEN 'High'
            WHEN total_orders >= 3 OR triple_play_orders > 0 THEN 'Medium'
            ELSE 'Low'
          END as value_tier,
          EXTRACT(days FROM (last_order - first_order)) as customer_lifespan_days
        FROM customer_profile
      )
      SELECT 
        segment,
        value_tier,
        COUNT(*) as customer_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage,
        ROUND(AVG(total_orders), 2) as avg_orders,
        ROUND(AVG(success_rate), 2) as avg_success_rate,
        ROUND(AVG(customer_lifespan_days), 0) as avg_lifespan_days,
        COUNT(CASE WHEN regional = '1' THEN 1 END) as reg1_count,
        COUNT(CASE WHEN regional = '2' THEN 1 END) as reg2_count,
        COUNT(CASE WHEN regional = '3' THEN 1 END) as reg3_count,
        COUNT(CASE WHEN regional = '4' THEN 1 END) as reg4_count,
        COUNT(CASE WHEN regional = '5' THEN 1 END) as reg5_count
      FROM customer_segments
      GROUP BY segment, value_tier
      ORDER BY customer_count DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  // Deep Pattern Analysis
  async performDeepPatternAnalysis(contextData) {
    console.log('🔍 Starting Deep Pattern Analysis...');
    
    const patterns = {
      totalPatterns: 0,
      businessPatterns: {},
      riskPatterns: {},
      opportunityPatterns: {},
      anomalies: [],
      trends: {},
      predictions: {}
    };

    try {
      // Get raw order data for pattern analysis
      const ordersQuery = `
        SELECT * FROM telkom_orders 
        ORDER BY order_date DESC 
        LIMIT 1000
      `;
      const ordersResult = await pool.query(ordersQuery);
      const orders = ordersResult.rows;

      // Perform deep column intelligence analysis
      const orderIdPatterns = this.deepIntelligence.analyzeOrderIdPatterns(orders);
      const lifecyclePatterns = this.deepIntelligence.analyzeCustomerLifecyclePatterns(orders);
      const geoPatterns = this.deepIntelligence.analyzeGeographicPerformancePatterns(orders);
      const temporalPatterns = this.deepIntelligence.analyzeTemporalPatterns(orders);
      const packagePatterns = this.deepIntelligence.analyzePackageIntelligence(orders);

      // Consolidate patterns
      patterns.businessPatterns = {
        orderSequencing: orderIdPatterns,
        customerLifecycle: lifecyclePatterns,
        geographic: geoPatterns,
        temporal: temporalPatterns,
        product: packagePatterns
      };

      // Identify risk patterns
      patterns.riskPatterns = this.identifyRiskPatterns(patterns.businessPatterns);
      
      // Identify opportunity patterns
      patterns.opportunityPatterns = this.identifyOpportunityPatterns(patterns.businessPatterns);
      
      // Calculate total patterns found
      patterns.totalPatterns = Object.keys(patterns.businessPatterns).length + 
                              Object.keys(patterns.riskPatterns).length + 
                              Object.keys(patterns.opportunityPatterns).length;

      console.log(`✅ Pattern Analysis Complete: ${patterns.totalPatterns} patterns identified`);
      
      return patterns;
    } catch (error) {
      console.error('❌ Pattern Analysis Error:', error);
      return patterns;
    }
  }

  // Risk Pattern Identification
  identifyRiskPatterns(businessPatterns) {
    const riskPatterns = {};

    // Customer lifecycle risks
    if (businessPatterns.customerLifecycle?.churnIndicators?.Early_Churn > 0) {
      riskPatterns.early_churn_alert = {
        severity: 'high',
        pattern: 'Customers churning shortly after acquisition',
        count: businessPatterns.customerLifecycle.churnIndicators.Early_Churn,
        impact: 'Revenue loss and acquisition cost waste',
        action_required: 'Immediate onboarding improvement needed'
      };
    }

    // Geographic performance risks
    if (businessPatterns.geographic?.performanceClusters) {
      const lowPerformanceRegions = Object.entries(businessPatterns.geographic.performanceClusters)
        .filter(([region, performance]) => performance === 'Needs Improvement');
      
      if (lowPerformanceRegions.length > 0) {
        riskPatterns.regional_performance_risk = {
          severity: 'medium',
          pattern: 'Multiple regions underperforming',
          affected_regions: lowPerformanceRegions.map(([region]) => region),
          impact: 'Market share loss and operational inefficiency',
          action_required: 'Regional improvement plans needed'
        };
      }
    }

    // Product performance risks
    if (businessPatterns.product?.revenueAnalysis) {
      const highChurnProducts = Object.entries(businessPatterns.product.revenueAnalysis)
        .filter(([product, analysis]) => analysis.churnRate > 30);
      
      if (highChurnProducts.length > 0) {
        riskPatterns.product_churn_risk = {
          severity: 'medium',
          pattern: 'High churn rate in specific products',
          affected_products: highChurnProducts.map(([product]) => product),
          impact: 'Product portfolio erosion',
          action_required: 'Product strategy review needed'
        };
      }
    }

    return riskPatterns;
  }

  // Opportunity Pattern Identification
  identifyOpportunityPatterns(businessPatterns) {
    const opportunityPatterns = {};

    // Upselling opportunities
    if (businessPatterns.customerLifecycle?.evolutionPaths?.Acquisition_to_Evolution > 0) {
      opportunityPatterns.upselling_potential = {
        opportunity: 'High customer evolution rate indicates upselling readiness',
        count: businessPatterns.customerLifecycle.evolutionPaths.Acquisition_to_Evolution,
        potential_impact: 'ARPU increase through service expansion',
        recommended_action: 'Deploy targeted upselling campaigns'
      };
    }

    // Geographic expansion opportunities
    if (businessPatterns.geographic?.regionalCharacteristics) {
      const highPerformanceRegions = Object.entries(businessPatterns.geographic.regionalCharacteristics)
        .filter(([region, data]) => data.performance.completionRate > 85)
        .map(([region]) => region);
      
      if (highPerformanceRegions.length > 0) {
        opportunityPatterns.geographic_expansion = {
          opportunity: 'High-performance regions ready for expansion',
          target_regions: highPerformanceRegions,
          potential_impact: 'Market share growth in proven markets',
          recommended_action: 'Scale successful strategies to similar markets'
        };
      }
    }

    // Win-back opportunities
    if (businessPatterns.customerLifecycle?.evolutionPaths?.Churn_to_Winback > 0) {
      opportunityPatterns.winback_success = {
        opportunity: 'Proven win-back capability',
        count: businessPatterns.customerLifecycle.evolutionPaths.Churn_to_Winback,
        potential_impact: 'Customer recovery and loyalty rebuilding',
        recommended_action: 'Expand win-back program to all churned customers'
      };
    }

    return opportunityPatterns;
  }

  // Generate Master Intelligence Response
  async generateMasterIntelligenceResponse(message, intent, contextData, patternInsights, responseType, conversationHistory) {
    console.log(`🧠 Generating Master Response for: ${intent.primary} (${responseType} format)`);
    
    const response = {
      text: '',
      data: contextData,
      insights: [],
      recommendations: [],
      patterns: patternInsights,
      predictions: [],
      alerts: [],
      opportunities: [],
      kpis: contextData.coreKPIs || {},
      confidence: intent.confidence,
      dataPoints: this.calculateDataPoints(contextData)
    };

    // Get appropriate response template
    const template = this.responseTemplates[responseType] || this.responseTemplates.operational;
    
    // Generate response based on intent and type
    switch (intent.primary) {
      case 'strategic_performance':
        response.text = this.generateStrategicPerformanceResponse(contextData, template);
        response.insights = this.generateStrategicInsights(contextData, patternInsights);
        response.recommendations = this.generateStrategicRecommendations(contextData, patternInsights);
        break;

      case 'customer_intelligence':
        response.text = this.generateCustomerIntelligenceResponse(contextData, template);
        response.insights = this.generateCustomerInsights(contextData, patternInsights);
        response.recommendations = this.generateCustomerRecommendations(contextData, patternInsights);
        break;

      case 'revenue_intelligence':
        response.text = this.generateRevenueIntelligenceResponse(contextData, template);
        response.insights = this.generateRevenueInsights(contextData, patternInsights);
        response.recommendations = this.generateRevenueRecommendations(contextData, patternInsights);
        break;

      default:
        response.text = this.generateEnhancedGeneralResponse(message, contextData, template);
        response.insights = this.generateGeneralInsights(contextData, patternInsights);
        response.recommendations = this.generateGeneralRecommendations(contextData, patternInsights);
    }

    // Extract alerts from risk patterns
    response.alerts = this.extractRiskAlerts(patternInsights.riskPatterns);
    
    // Extract opportunities
    response.opportunities = this.extractOpportunities(patternInsights.opportunityPatterns);
    
    // Generate predictions based on patterns and trends
    response.predictions = this.generatePredictions(contextData, patternInsights);

    console.log(`✅ Master Response Complete: ${response.insights.length} insights, ${response.recommendations.length} recommendations`);
    
    return response;
  }

  // Strategic Performance Response Generator
  generateStrategicPerformanceResponse(contextData, template) {
    const kpis = contextData.coreKPIs || {};
    const strategic = contextData.strategicMetrics || {};
    
    return `${template.intro}

**🎯 Strategic Performance Overview:**
• Total Market Activity: ${kpis.total_orders?.toLocaleString()} orders across ${kpis.active_regions} regions
• Customer Base: ${kpis.unique_customers?.toLocaleString()} unique customers
• Net Growth: ${(kpis.new_acquisitions - kpis.churn_count)?.toLocaleString()} customers
• Business Penetration: ${Math.round(kpis.business_customers * 100 / kpis.total_orders)}% enterprise customers

**📈 Business Health Indicators:**
• Service Excellence: ${kpis.overall_completion_rate}% completion rate
• Customer Retention: ${100 - kpis.churn_rate}% retention rate
• Service Velocity: ${kpis.avg_installation_days} days average delivery
• Market Evolution: ${kpis.modifications} customer upgrades/changes

**🚀 Growth Dynamics:**
• Acquisition Momentum: ${kpis.new_acquisitions?.toLocaleString()} new customers
• Service Expansion: ${kpis.add_services} upselling successes
• Premium Adoption: ${kpis.triple_play_customers} triple-play customers
• Recent Activity: ${kpis.recent_orders} orders in last 30 days

**Strategic Position:** ${kpis.churn_rate < 20 ? 
  '✅ Strong market position with healthy customer retention' : 
  '⚠️ Market position requires strategic intervention for customer retention'}`;
  }

  // Extract Risk Alerts
  extractRiskAlerts(riskPatterns) {
    const alerts = [];
    
    Object.entries(riskPatterns).forEach(([pattern, details]) => {
      alerts.push({
        type: 'risk',
        severity: details.severity,
        title: pattern.replace(/_/g, ' ').toUpperCase(),
        message: details.pattern,
        impact: details.impact,
        action: details.action_required,
        data: details.count || details.affected_regions || details.affected_products
      });
    });
    
    return alerts;
  }

  // Extract Opportunities
  extractOpportunities(opportunityPatterns) {
    const opportunities = [];
    
    Object.entries(opportunityPatterns).forEach(([pattern, details]) => {
      opportunities.push({
        type: 'opportunity',
        title: pattern.replace(/_/g, ' ').toUpperCase(),
        description: details.opportunity,
        impact: details.potential_impact,
        action: details.recommended_action,
        data: details.count || details.target_regions
      });
    });
    
    return opportunities;
  }

  // Calculate Data Points
  calculateDataPoints(contextData) {
    let dataPoints = 0;
    
    Object.values(contextData).forEach(data => {
      if (Array.isArray(data)) {
        dataPoints += data.length;
      } else if (typeof data === 'object' && data !== null) {
        dataPoints += Object.keys(data).length;
      } else {
        dataPoints += 1;
      }
    });
    
    return dataPoints;
  }

  // === DASHBOARD DATA METHODS ===
  
  // Get core KPIs from database
  async getCoreKPIs() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status_resume LIKE '%COMPLETE%' OR status_resume LIKE '%SUCCESS%' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status_resume LIKE '%PENDING%' OR status_resume LIKE '%WAIT%' THEN 1 END) as pending_orders,
          COUNT(DISTINCT regional) as total_regions,
          COUNT(DISTINCT witel) as total_witels
        FROM telkom_orders
      `);
      
      const stats = result.rows[0];
      const completionRate = stats.total_orders > 0 ? 
        (parseInt(stats.completed_orders) / parseInt(stats.total_orders)) * 100 : 0;
      
      return {
        totalOrders: parseInt(stats.total_orders),
        completedOrders: parseInt(stats.completed_orders),
        pendingOrders: parseInt(stats.pending_orders),
        completionRate: parseFloat(completionRate.toFixed(2)),
        totalRegions: parseInt(stats.total_regions),
        totalWitels: parseInt(stats.total_witels),
        growthRate: 12.5 // Mock data
      };
    } catch (error) {
      console.error('Error getting core KPIs:', error);
      return {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        completionRate: 0,
        totalRegions: 0,
        totalWitels: 0,
        growthRate: 0
      };
    }
  }
  
  // Get regional performance data
  async getRegionalPerformanceData() {
    try {
      const result = await pool.query(`
        SELECT 
          regional,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status_resume LIKE '%COMPLETE%' OR status_resume LIKE '%SUCCESS%' THEN 1 END) as completed_orders,
          ROUND(
            COUNT(CASE WHEN status_resume LIKE '%COMPLETE%' OR status_resume LIKE '%SUCCESS%' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate
        FROM telkom_orders 
        WHERE regional IS NOT NULL
        GROUP BY regional 
        ORDER BY total_orders DESC 
        LIMIT 10
      `);
      
      return result.rows.map(row => ({
        regional: row.regional,
        total_orders: parseInt(row.total_orders),
        completed_orders: parseInt(row.completed_orders),
        completion_rate: parseFloat(row.completion_rate || 0)
      }));
    } catch (error) {
      console.error('Error getting regional data:', error);
      return [];
    }
  }
  
  // Get trends data
  async getTrendsData(timeRange = '7d') {
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      
      const result = await pool.query(`
        SELECT 
          DATE(order_date) as date,
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status_resume LIKE '%COMPLETE%' OR status_resume LIKE '%SUCCESS%' THEN 1 END) as completed_orders,
          ROUND(
            COUNT(CASE WHEN status_resume LIKE '%COMPLETE%' OR status_resume LIKE '%SUCCESS%' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 1
          ) as completion_rate
        FROM telkom_orders 
        WHERE order_date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(order_date)
        ORDER BY date DESC
        LIMIT ${days}
      `);
      
      return result.rows.map(row => ({
        date: row.date,
        total_orders: parseInt(row.total_orders),
        completed_orders: parseInt(row.completed_orders),
        completion_rate: parseFloat(row.completion_rate || 0)
      }));
    } catch (error) {
      console.error('Error getting trends data:', error);
      return [];
    }
  }
  
  // Get dashboard data for BrightInsight with HSI Business Metrics
  async getDashboardData(req, res) {
    try {
      const { timeRange = '7d', regional, witel } = req.query;
      
      console.log('🚀 Fetching enhanced HSI dashboard data...');
      
      // Get enhanced overview stats with HSI business metrics
      const overviewStats = await TelkomOrderModel.getOverallStats();
      
      // Get regional breakdown with business metrics
      const regionalData = await TelkomOrderModel.getRegionalBreakdown();
      
      // Get witel breakdown with business metrics
      const witelData = await TelkomOrderModel.getWitelBreakdown();
      
      // Get package breakdown with business metrics
      const packageData = await TelkomOrderModel.getPackageBreakdown();
      
      // Get jenispsb composition
      const jenisPsbComposition = await TelkomOrderModel.getJenisPsbComposition();
      
      // Get witel leaderboard
      const witelLeaderboard = await TelkomOrderModel.getWitelLeaderboard();
      
      // Get monthly trends
      const trendsData = await TelkomOrderModel.getMonthlyTrends();
      
      // Get enhanced jenispsb insights
      const jenisPsbByHierarchy = await TelkomOrderModel.getJenisPsbByHierarchy();
      const processingTimeAnalysis = await TelkomOrderModel.getProcessingTimeAnalysis();
      const processingRiskAlerts = await TelkomOrderModel.getProcessingRiskAlerts();
      const jenisPsbChampions = await TelkomOrderModel.getJenisPsbChampions();
      
      res.json({
        success: true,
        data: {
          overview: overviewStats,
          regional: regionalData,
          witel: witelData,
          packages: packageData,
          jenisPsbComposition,
          witelLeaderboard,
          trends: trendsData,
          // Enhanced Insights
          jenisPsbByHierarchy,
          processingTimeAnalysis,
          processingRiskAlerts,
          jenisPsbChampions,
          // Business Intelligence Summary
          businessIntelligence: {
            keyMetrics: {
              achievement: `${overviewStats.achievementPercentage.toFixed(1)}% vs 85% target`,
              churnToSales: `${overviewStats.churnToSalesRatio.toFixed(1)}% churn ratio`,
              processingEfficiency: `${overviewStats.avgProcessingDays.toFixed(1)} days avg processing`,
              dailyVelocity: `${overviewStats.dailySalesVelocity} orders/day`
            },
            alerts: [
              overviewStats.churnToSalesRatio > 15 ? 'High churn ratio detected' : null,
              overviewStats.avgProcessingDays > 3 ? 'Processing time exceeds 3 days' : null,
              overviewStats.completionRate < 80 ? 'Completion rate below 80%' : null
            ].filter(Boolean),
            insights: [
              `${overviewStats.activationOrders} new activations vs ${overviewStats.disconnectOrders} disconnections`,
              `${overviewStats.slowProcessingOrders} orders processing > 3 days (${((overviewStats.slowProcessingOrders / overviewStats.totalOrders) * 100).toFixed(1)}%)`,
              `${overviewStats.completionRate.toFixed(1)}% overall completion rate`,
              `Processing efficiency: ${((overviewStats.totalOrders - overviewStats.slowProcessingOrders) / overviewStats.totalOrders * 100).toFixed(1)}% orders completed within 3 days`,
              `Top jenispsb risks: ${processingRiskAlerts.slice(0, 3).map(r => `${r.jenispsb} in ${r.witel} (${r.avg_processing_days.toFixed(1)}d)`).join(', ')}`
            ]
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Dashboard data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch enhanced dashboard data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get regional performance data
  async getRegionalPerformanceData() {
    const query = `
      SELECT 
        regional,
        COUNT(*) as order_count,
        COUNT(DISTINCT witel) as witel_count,
        COUNT(DISTINCT city_name) as city_count,
        ROUND(
          COUNT(CASE WHEN status_resume LIKE '%Completed%' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as completion_rate,
        COUNT(CASE WHEN order_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as recent_orders
      FROM telkom_orders 
      WHERE regional IS NOT NULL
      GROUP BY regional
      ORDER BY order_count DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  // Get package performance data
  async getPackagePerformanceData() {
    const query = `
      SELECT 
        LEFT(package_name, 50) as package_name,
        COUNT(*) as order_count,
        ROUND(
          COUNT(CASE WHEN status_resume LIKE '%Completed%' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 2
        ) as success_rate,
        ROUND(AVG(CASE WHEN estimated_price IS NOT NULL THEN estimated_price END), 0) as estimated_price
      FROM telkom_orders 
      WHERE package_name IS NOT NULL
      GROUP BY LEFT(package_name, 50)
      ORDER BY order_count DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  // Get trends data
  async getTrendsData(timeRange) {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    
    const query = `
      SELECT 
        DATE(order_date) as date,
        COUNT(*) as order_count,
        COUNT(CASE WHEN status_resume LIKE '%Completed%' THEN 1 END) as completed_count
      FROM telkom_orders 
      WHERE order_date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(order_date)
      ORDER BY date DESC
      LIMIT ${days}
    `;
    
    const result = await pool.query(query);
    return result.rows.reverse(); // Show oldest to newest
  }

  // === GENERAL RESPONSE METHODS ===

  generateEnhancedGeneralResponse(message, contextData, template) {
    const kpis = contextData.coreKPIs || {};
    
    return `${template.intro}

**📊 Current HSI Performance Overview:**

🎯 **Key Metrics:**
• Total Orders: ${kpis.total_orders?.toLocaleString() || '0'}
• Active Customers: ${kpis.unique_customers?.toLocaleString() || '0'}
• Service Completion Rate: ${kpis.overall_completion_rate || 0}%
• Active Regions: ${kpis.active_regions || 0}

📈 **Business Health:**
• New Acquisitions: ${kpis.new_acquisitions?.toLocaleString() || '0'}
• Customer Retention: ${100 - (kpis.churn_rate || 0)}%
• Service Velocity: ${kpis.avg_installation_days || 0} days average

🚀 **Growth Indicators:**
• Recent Activity: ${kpis.recent_orders?.toLocaleString() || '0'} orders (30 days)
• Business Customers: ${kpis.business_customers?.toLocaleString() || '0'}
• Premium Services: ${kpis.triple_play_customers?.toLocaleString() || '0'} triple-play

Saya siap membantu Anda menganalisis data HSI lebih mendalam. Silakan tanyakan tentang regional performance, customer insights, atau metrics specific lainnya!`;
  }

  generateGeneralInsights(contextData, patternInsights) {
    const kpis = contextData.coreKPIs || {};
    const insights = [];

    if (kpis.overall_completion_rate > 85) {
      insights.push('Excellent service delivery performance with completion rate above 85%');
    } else if (kpis.overall_completion_rate < 70) {
      insights.push('Service delivery needs improvement - completion rate below 70%');
    }

    if (kpis.churn_rate < 15) {
      insights.push('Strong customer retention with low churn rate');
    } else if (kpis.churn_rate > 25) {
      insights.push('High churn rate indicates customer satisfaction issues');
    }

    if (kpis.business_customers > 0) {
      const businessRatio = (kpis.business_customers / kpis.total_orders) * 100;
      insights.push(`Business customer segment represents ${businessRatio.toFixed(1)}% of total orders`);
    }

    if (kpis.recent_orders > 0) {
      insights.push(`Active market with ${kpis.recent_orders} recent orders in the last 30 days`);
    }

    return insights;
  }

  generateGeneralRecommendations(contextData, patternInsights) {
    const kpis = contextData.coreKPIs || {};
    const recommendations = [];

    if (kpis.overall_completion_rate < 80) {
      recommendations.push({
        title: 'Improve Service Completion Rate',
        action: 'Focus on operational efficiency to increase completion rate above 80%',
        priority: 'high'
      });
    }

    if (kpis.churn_rate > 20) {
      recommendations.push({
        title: 'Reduce Customer Churn',
        action: 'Implement customer retention programs and improve service quality',
        priority: 'high'
      });
    }

    if (kpis.avg_installation_days > 7) {
      recommendations.push({
        title: 'Optimize Installation Process',
        action: 'Streamline installation process to reduce delivery time',
        priority: 'medium'
      });
    }

    if (kpis.business_customers > 0) {
      recommendations.push({
        title: 'Expand Business Segment',
        action: 'Leverage business customer success to expand enterprise offerings',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  generatePredictions(contextData, patternInsights) {
    const kpis = contextData.coreKPIs || {};
    const predictions = [];

    if (kpis.recent_orders > 0 && kpis.total_orders > 0) {
      const monthlyGrowthRate = (kpis.recent_orders / kpis.total_orders) * 12;
      predictions.push({
        metric: 'Monthly Growth',
        prediction: `${(monthlyGrowthRate * 100).toFixed(1)}% projected monthly growth`,
        confidence: 'medium'
      });
    }

    if (kpis.churn_rate > 0) {
      predictions.push({
        metric: 'Customer Retention',
        prediction: `${(100 - kpis.churn_rate).toFixed(1)}% retention rate trend`,
        confidence: 'high'
      });
    }

    return predictions;
  }

  // === PLACEHOLDER IMPLEMENTATIONS ===
  
  async getCompetitiveAnalysis() { 
    return {
      marketPosition: 'Leading provider in HSI services',
      competitiveAdvantage: 'Strong regional coverage and service quality'
    }; 
  }
  
  async getMarketTrendAnalysis() { 
    return {
      trends: ['Growing demand for high-speed internet', 'Increasing business segment adoption'],
      outlook: 'positive'
    }; 
  }
  
  async getGrowthOpportunities() { 
    return {
      opportunities: ['Business segment expansion', 'Premium service upselling'],
      potential: 'high'
    }; 
  }
  
  async getChurnPredictionData() { return { churnRisk: 'low', factors: [] }; }
  async getCustomerJourneyAnalysis() { return { journeyStages: [], insights: [] }; }
  async getCustomerSatisfactionMetrics() { return { satisfaction: 85, feedback: [] }; }
  async getCustomerLifetimeValue() { return { averageCLV: 0, segments: [] }; }
  
  generateStrategicInsights(contextData, patternInsights) { 
    return ['Strategic positioning strong', 'Market opportunities identified'];
  }
  
  generateStrategicRecommendations(contextData, patternInsights) { 
    return [
      { title: 'Market Expansion', action: 'Explore new regional markets', priority: 'medium' }
    ];
  }
  
  generateCustomerIntelligenceResponse(contextData, template) { 
    return `${template.intro}\n\nCustomer intelligence analysis shows positive engagement trends and loyalty patterns.`; 
  }
  
  generateCustomerInsights(contextData, patternInsights) { 
    return ['Customer base is growing', 'Retention rates are healthy'];
  }
  
  generateCustomerRecommendations(contextData, patternInsights) { 
    return [
      { title: 'Customer Engagement', action: 'Enhance customer communication', priority: 'medium' }
    ];
  }
  
  generateRevenueIntelligenceResponse(contextData, template) { 
    return `${template.intro}\n\nRevenue analysis indicates stable performance with growth opportunities.`; 
  }
  
  generateRevenueInsights(contextData, patternInsights) { 
    return ['Revenue streams are diversified', 'Business segment shows strong performance'];
  }
  
  generateRevenueRecommendations(contextData, patternInsights) { 
    return [
      { title: 'Revenue Optimization', action: 'Focus on high-value segments', priority: 'high' }
    ];
  }
}

module.exports = new aiController();