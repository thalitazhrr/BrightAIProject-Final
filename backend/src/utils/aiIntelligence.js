// utils/aiIntelligence.js - Enhanced with Indonesian Language Support
class TelkomAIIntelligence {
  
  // Advanced pattern recognition for Telkom business context
  static analyzeMessageContext(message) {
    const context = {
      urgency: this.detectUrgency(message),
      businessArea: this.detectBusinessArea(message),
      metricType: this.detectMetricType(message),
      timeframe: this.detectTimeframe(message),
      actionRequired: this.detectActionRequirement(message)
    };
    
    return context;
  }
  
  // Detect urgency level from message
  static detectUrgency(message) {
    const urgentWords = [
      'urgent', 'critical', 'emergency', 'asap', 'immediately', 'now',
      'mendesak', 'kritis', 'segera', 'darurat', 'penting sekali'
    ];
    
    const highWords = [
      'important', 'priority', 'significant', 'major',
      'penting', 'prioritas', 'signifikan', 'besar'
    ];
    
    const lowerMessage = message.toLowerCase();
    
    if (urgentWords.some(word => lowerMessage.includes(word))) {
      return 'urgent';
    } else if (highWords.some(word => lowerMessage.includes(word))) {
      return 'high';
    } else {
      return 'normal';
    }
  }
  
  // Detect business area focus with enhanced Indonesian support
  static detectBusinessArea(message) {
    const areas = {
      customer: ['customer', 'pelanggan', 'client', 'user', 'churn', 'retention', 'satisfaction', 'klien', 'pengguna', 'kepuasan', 'retensi'],
      technical: ['technical', 'service', 'performance', 'sla', 'completion', 'teknis', 'layanan', 'kinerja', 'performa', 'penyelesaian'],
      sales: ['sales', 'revenue', 'acquisition', 'penjualan', 'pendapatan', 'akuisisi', 'omzet', 'hasil', 'pencapaian'],
      operations: ['operational', 'process', 'efficiency', 'operasional', 'proses', 'efisiensi', 'operasi', 'workflow', 'alur'],
      financial: ['financial', 'cost', 'profit', 'budget', 'keuangan', 'biaya', 'untung', 'keuntungan', 'anggaran', 'finansial'],
      regional: ['regional', 'geographical', 'location', 'area', 'wilayah', 'geografis', 'lokasi', 'daerah', 'tempat', 'zona']
    };
    
    const lowerMessage = message.toLowerCase();
    
    for (const [area, keywords] of Object.entries(areas)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return area;
      }
    }
    
    return 'general';
  }
  
  // Detect metric type requested with enhanced Indonesian support
  static detectMetricType(message) {
    const metrics = {
      kpi: ['kpi', 'key performance', 'metrics', 'dashboard', 'overview', 'indikator', 'metrik', 'gambaran', 'ringkasan'],
      trend: ['trend', 'pattern', 'growth', 'decline', 'tren', 'pola', 'pertumbuhan', 'penurunan', 'kenaikan', 'grafik'],
      comparison: ['compare', 'vs', 'versus', 'against', 'bandingkan', 'dibanding', 'perbandingan', 'banding', 'versus'],
      prediction: ['predict', 'forecast', 'future', 'prediksi', 'ramalan', 'masa depan', 'prakiraan', 'proyeksi', 'estimasi'],
      breakdown: ['breakdown', 'segment', 'category', 'rincian', 'segmen', 'kategori', 'detail', 'pecahan', 'bagian']
    };
    
    const lowerMessage = message.toLowerCase();
    
    for (const [metric, keywords] of Object.entries(metrics)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return metric;
      }
    }
    
    return 'summary';
  }
  
  // Detect timeframe context with enhanced Indonesian support
  static detectTimeframe(message) {
    const timeframes = {
      realtime: ['now', 'current', 'today', 'sekarang', 'saat ini', 'hari ini', 'real time', 'waktu nyata'],
      recent: ['recent', 'latest', 'last week', 'terbaru', 'minggu lalu', 'belakangan', 'baru-baru ini', 'terakhir'],
      monthly: ['month', 'monthly', 'bulan', 'bulanan', 'per bulan', 'setiap bulan'],
      quarterly: ['quarter', 'quarterly', 'kuartal', 'triwulan', 'per kuartal', 'setiap kuartal'],
      yearly: ['year', 'yearly', 'annual', 'tahun', 'tahunan', 'per tahun', 'setiap tahun'],
      historical: ['history', 'historical', 'past', 'sejarah', 'historis', 'masa lalu', 'dulu', 'lampau']
    };
    
    const lowerMessage = message.toLowerCase();
    
    for (const [timeframe, keywords] of Object.entries(timeframes)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return timeframe;
      }
    }
    
    return 'current';
  }
  
  // Detect if action is required with enhanced Indonesian support
  static detectActionRequirement(message) {
    const actionWords = [
      'how to', 'what should', 'recommend', 'suggest', 'action', 'strategy',
      'bagaimana', 'apa yang harus', 'rekomendasikan', 'sarankan', 'aksi', 'strategi',
      'cara', 'solusi', 'langkah', 'tindakan', 'saran', 'usulan', 'rekomendasi'
    ];
    
    const lowerMessage = message.toLowerCase();
    return actionWords.some(word => lowerMessage.includes(word));
  }
  
  // Generate intelligent insights based on data patterns
  static generateDataInsights(data, context) {
    const insights = [];
    
    // Customer behavior insights
    if (context.businessArea === 'customer' && data.customerBehavior) {
      insights.push(...this.generateCustomerInsights(data.customerBehavior));
    }
    
    // Performance insights
    if (context.businessArea === 'technical' && data.serviceMetrics) {
      insights.push(...this.generatePerformanceInsights(data.serviceMetrics));
    }
    
    // Sales insights
    if (context.businessArea === 'sales' && data.salesTrends) {
      insights.push(...this.generateSalesInsights(data.salesTrends));
    }
    
    // Regional insights
    if (context.businessArea === 'regional' && data.regionalPerformance) {
      insights.push(...this.generateRegionalInsights(data.regionalPerformance));
    }
    
    return insights;
  }
  
  // Customer behavior pattern analysis
  static generateCustomerInsights(customerData) {
    const insights = [];
    
    const aoData = customerData.find(c => c.jenispsb === 'AO');
    const doData = customerData.find(c => c.jenispsb === 'DO');
    const moData = customerData.find(c => c.jenispsb === 'MO');
    
    // Acquisition vs Churn analysis with Indonesian language support
    if (aoData && doData) {
      const netGrowth = aoData.count - doData.count;
      if (netGrowth > 0) {
        insights.push({
          type: 'positive',
          message: `Pertumbuhan pelanggan bersih positif: +${netGrowth} (${aoData.count} akuisisi vs ${doData.count} churn)`,
          recommendation: 'Pertahankan momentum akuisisi dan fokus pada program retensi pelanggan'
        });
      } else {
        insights.push({
          type: 'warning',
          message: `Pertumbuhan pelanggan bersih negatif: ${netGrowth} (${aoData.count} akuisisi vs ${doData.count} churn)`,
          recommendation: 'URGENT: Implementasi strategi retensi agresif dan pencegahan churn'
        });
      }
    }
    
    // Modification pattern analysis with Indonesian language support
    if (moData && aoData) {
      const modificationRate = (moData.count / aoData.count) * 100;
      if (modificationRate > 30) {
        insights.push({
          type: 'opportunity',
          message: `Tingkat modifikasi tinggi (${modificationRate.toFixed(1)}%) - indikasi keterlibatan pelanggan yang baik`,
          recommendation: 'Manfaatkan pola modifikasi untuk program upselling dan cross-selling'
        });
      }
    }
    
    return insights;
  }
  
  // Performance pattern analysis
  static generatePerformanceInsights(serviceData) {
    const insights = [];
    
    if (serviceData.completion_rate) {
      if (serviceData.completion_rate >= 90) {
        insights.push({
          type: 'excellent',
          message: `Tingkat penyelesaian layanan sangat baik: ${serviceData.completion_rate}%`,
          recommendation: 'Pertahankan proses saat ini dan bagikan praktik terbaik ke regional lain'
        });
      } else if (serviceData.completion_rate < 70) {
        insights.push({
          type: 'critical',
          message: `Tingkat penyelesaian layanan di bawah standar: ${serviceData.completion_rate}%`,
          recommendation: 'KRITIS: Tinjau alur kerja proses dan program pelatihan untuk tim lapangan'
        });
      }
    }
    
    if (serviceData.sla_compliance_rate) {
      if (serviceData.sla_compliance_rate < 60) {
        insights.push({
          type: 'warning',
          message: `Kepatuhan SLA rendah: ${serviceData.sla_compliance_rate}%`,
          recommendation: 'Implementasi otomasi proses dan optimasi sumber daya'
        });
      }
    }
    
    return insights;
  }
  
  // Sales trend analysis
  static generateSalesInsights(salesData) {
    const insights = [];
    
    if (salesData.length >= 2) {
      const latest = salesData[0];
      const previous = salesData[1];
      
      const growthRate = ((latest.new_sales - previous.new_sales) / previous.new_sales) * 100;
      
      if (growthRate > 10) {
        insights.push({
          type: 'positive',
          message: `Momentum pertumbuhan penjualan kuat: +${growthRate.toFixed(1)}% MoM`,
          recommendation: 'Tingkatkan strategi penjualan yang sukses dan ekspansi ke regional potensial'
        });
      } else if (growthRate < -10) {
        insights.push({
          type: 'warning',
          message: `Penurunan penjualan: ${growthRate.toFixed(1)}% MoM`,
          recommendation: 'Tinjau strategi penjualan, posisi kompetitif, dan kondisi pasar'
        });
      }
    }
    
    return insights;
  }
  
  // Regional performance analysis
  static generateRegionalInsights(regionalData) {
    const insights = [];
    
    if (regionalData.length > 0) {
      const topPerformer = regionalData[0];
      const avgCompletion = regionalData.reduce((sum, r) => sum + r.completion_rate, 0) / regionalData.length;
      
      insights.push({
        type: 'benchmark',
        message: `Regional ${topPerformer.regional} memimpin dengan ${topPerformer.total_orders} order (tingkat penyelesaian: ${topPerformer.completion_rate}%)`,
        recommendation: `Ekstrak praktik terbaik dari Regional ${topPerformer.regional} untuk direplikasi ke regional lain`
      });
      
      const underperformers = regionalData.filter(r => r.completion_rate < avgCompletion - 10);
      if (underperformers.length > 0) {
        insights.push({
          type: 'action_required',
          message: `${underperformers.length} regional perlu perhatian (tingkat penyelesaian di bawah rata-rata)`,
          recommendation: 'Program perbaikan terfokus untuk regional yang berkinerja rendah'
        });
      }
    }
    
    return insights;
  }
  
  // Generate smart recommendations based on context and data
  static generateSmartRecommendations(context, data, insights) {
    const recommendations = [];
    
    // Urgency-based recommendations
    if (context.urgency === 'urgent') {
      recommendations.push({
        priority: 'immediate',
        action: 'Setup real-time monitoring dashboard untuk metric kritical',
        timeline: '24 hours'
      });
    }
    
    // Business area specific recommendations
    switch (context.businessArea) {
      case 'customer':
        recommendations.push({
          priority: 'high',
          action: 'Implementasi customer health scoring untuk early churn detection',
          timeline: '2 weeks'
        });
        break;
        
      case 'technical':
        recommendations.push({
          priority: 'medium',
          action: 'Automated SLA monitoring dengan alert system',
          timeline: '1 week'
        });
        break;
        
      case 'sales':
        recommendations.push({
          priority: 'high',
          action: 'Develop lead scoring model untuk improve conversion rate',
          timeline: '3 weeks'
        });
        break;
    }
    
    // Data-driven recommendations from insights
    insights.forEach(insight => {
      if (insight.type === 'critical' || insight.type === 'warning') {
        recommendations.push({
          priority: 'high',
          action: insight.recommendation,
          timeline: 'immediate',
          reason: insight.message
        });
      }
    });
    
    return recommendations;
  }
  
  // Format response based on user preference and context
  static formatIntelligentResponse(rawResponse, context, userPreference = 'detailed') {
    const formatted = {
      summary: this.generateExecutiveSummary(rawResponse),
      details: rawResponse.text,
      insights: rawResponse.insights || [],
      recommendations: rawResponse.suggestions || [],
      visualData: this.prepareVisualizationData(rawResponse.data),
      nextActions: this.generateNextActions(context, rawResponse)
    };
    
    // Adjust response based on user preference
    switch (userPreference) {
      case 'brief':
        return {
          response: formatted.summary,
          insights: formatted.insights.slice(0, 3),
          recommendations: formatted.recommendations.slice(0, 2)
        };
        
      case 'detailed':
        return formatted;
        
      case 'executive':
        return {
          response: formatted.summary,
          keyInsights: formatted.insights.filter(i => i.type === 'critical' || i.type === 'excellent'),
          strategicRecommendations: formatted.recommendations.filter(r => r.priority === 'high'),
          kpiSummary: formatted.visualData
        };
        
      default:
        return formatted;
    }
  }
  
  // Generate executive summary
  static generateExecutiveSummary(response) {
    const text = response.text || '';
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Extract key numbers and percentages
    const keyMetrics = text.match(/\d+(?:\.\d+)?%|\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
    
    // Generate concise summary
    let summary = '';
    if (lines.length > 0) {
      summary = lines[0]; // First meaningful line
      if (keyMetrics.length > 0) {
        summary += ` Key metrics: ${keyMetrics.slice(0, 3).join(', ')}.`;
      }
    }
    
    return summary || 'Data analysis completed successfully.';
  }
  
  // Prepare data for visualization
  static prepareVisualizationData(rawData) {
    if (!rawData) return null;
    
    const vizData = {};
    
    // Regional performance chart data
    if (rawData.regionalPerformance) {
      vizData.regional = rawData.regionalPerformance.map(r => ({
        name: `Region ${r.regional}`,
        orders: r.total_orders,
        completion: r.completion_rate,
        churn: r.churn_rate
      }));
    }
    
    // Customer behavior pie chart
    if (rawData.customerBehavior) {
      vizData.customerSegments = rawData.customerBehavior.map(c => ({
        name: c.behavior_type || c.jenispsb,
        value: c.count,
        percentage: c.percentage
      }));
    }
    
    // Package popularity
    if (rawData.packagePopularity) {
      vizData.packages = rawData.packagePopularity.slice(0, 10).map(p => ({
        name: p.package_category,
        orders: p.order_count,
        marketShare: p.market_share_percent
      }));
    }
    
    return vizData;
  }
  
  // Generate next action suggestions with Indonesian support
  static generateNextActions(context, response) {
    const actions = [];
    
    if (context.actionRequired) {
      actions.push('Tinjau rekomendasi dan buat rencana tindakan');
      actions.push('Jadwalkan pertemuan tindak lanjut dengan stakeholder terkait');
    }
    
    if (context.urgency === 'urgent') {
      actions.push('Eskalasi temuan ke tingkat manajemen');
      actions.push('Setup monitoring langsung untuk metrik kritis');
    }
    
    actions.push('Pantau kemajuan dan jadwalkan review reguler');
    
    return actions;
  }
  
  // Enhanced Indonesian language pattern detection
  static detectIndonesianPatterns(message) {
    const indonesianPatterns = {
      questions: ['apa', 'siapa', 'kapan', 'dimana', 'mengapa', 'bagaimana', 'berapa'],
      polite: ['tolong', 'mohon', 'silakan', 'terima kasih', 'maaf'],
      performance: ['kinerja', 'performa', 'prestasi', 'hasil', 'capaian'],
      analysis: ['analisis', 'analisa', 'evaluasi', 'kajian', 'review'],
      improvement: ['perbaikan', 'peningkatan', 'optimasi', 'upgrade'],
      problem: ['masalah', 'kendala', 'gangguan', 'trouble', 'issue']
    };
    
    const lowerMessage = message.toLowerCase();
    const detected = {};
    
    for (const [category, patterns] of Object.entries(indonesianPatterns)) {
      detected[category] = patterns.some(pattern => lowerMessage.includes(pattern));
    }
    
    return detected;
  }
  
  // Generate contextual dashboard insights
  static generateDashboardInsights(dashboardData, language = 'id') {
    const insights = [];
    
    if (dashboardData.stats) {
      const stats = dashboardData.stats;
      
      if (language === 'id') {
        // Indonesian insights
        if (stats.completionRate > 90) {
          insights.push('Tingkat penyelesaian sangat baik (>90%)');
        } else if (stats.completionRate < 70) {
          insights.push('Tingkat penyelesaian perlu ditingkatkan (<70%)');
        }
        
        if (stats.churnToSalesRatio > 15) {
          insights.push('Rasio churn tinggi - perlu strategi retensi');
        }
        
        if (stats.avgProcessingDays > 3) {
          insights.push('Waktu pemrosesan melebihi target (>3 hari)');
        }
      } else {
        // English insights
        if (stats.completionRate > 90) {
          insights.push('Excellent completion rate (>90%)');
        } else if (stats.completionRate < 70) {
          insights.push('Completion rate needs improvement (<70%)');
        }
        
        if (stats.churnToSalesRatio > 15) {
          insights.push('High churn ratio - retention strategy needed');
        }
        
        if (stats.avgProcessingDays > 3) {
          insights.push('Processing time exceeds target (>3 days)');
        }
      }
    }
    
    return insights;
  }
  
  // Generate smart recommendations based on HSI data
  static generateHSIRecommendations(hsiData, language = 'id') {
    const recommendations = [];
    
    if (language === 'id') {
      // Indonesian recommendations
      if (hsiData.achievementPercentage < 85) {
        recommendations.push({
          priority: 'tinggi',
          action: 'Fokus peningkatan completion rate untuk mencapai target 85%',
          timeline: '2 minggu'
        });
      }
      
      if (hsiData.churnToSalesRatio > 15) {
        recommendations.push({
          priority: 'tinggi',
          action: 'Implementasi program retensi pelanggan untuk mengurangi churn',
          timeline: '1 bulan'
        });
      }
      
      if (hsiData.avgProcessingDays > 3) {
        recommendations.push({
          priority: 'sedang',
          action: 'Optimasi workflow untuk mengurangi waktu pemrosesan',
          timeline: '3 minggu'
        });
      }
      
      recommendations.push({
        priority: 'rendah',
        action: 'Manfaatkan regional berkinerja tinggi untuk sharing best practices',
        timeline: 'berkelanjutan'
      });
    } else {
      // English recommendations
      if (hsiData.achievementPercentage < 85) {
        recommendations.push({
          priority: 'high',
          action: 'Focus on improving completion rate to achieve 85% target',
          timeline: '2 weeks'
        });
      }
      
      if (hsiData.churnToSalesRatio > 15) {
        recommendations.push({
          priority: 'high',
          action: 'Implement customer retention programs to reduce churn',
          timeline: '1 month'
        });
      }
      
      if (hsiData.avgProcessingDays > 3) {
        recommendations.push({
          priority: 'medium',
          action: 'Optimize workflow to reduce processing time',
          timeline: '3 weeks'
        });
      }
      
      recommendations.push({
        priority: 'low',
        action: 'Leverage high-performing regions for best practice sharing',
        timeline: 'ongoing'
      });
    }
    
    return recommendations;
  }
}

module.exports = TelkomAIIntelligence;