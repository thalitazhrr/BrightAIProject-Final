// src/services/telkomApi.js
// Complete HSI Analytics API Service with Error Handling & Retry Logic

import authService from './authService';

class TelkomApiService {
  constructor() {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    this.baseURL = process.env.REACT_APP_TELKOM_URL || `${apiUrl}/api/telkom`;
    this.aiBaseURL = process.env.REACT_APP_AI_URL || `${apiUrl}/api/ai`;
    this.timeout = 15000; // Increased to 15 seconds for real data
    this.retryAttempts = 2; // Increased retry attempts for better reliability
    this.retryDelay = 500; // 500ms base delay
    this.concurrentRequests = new Map(); // Track concurrent requests
    this.requestQueue = []; // Queue for rate limiting
    this.maxConcurrent = 5; // Increased max concurrent requests
  }

  // Generic API call method with enhanced authentication and retry logic
  async apiCall(endpoint, options = {}, useAiBase = false) {
    const baseUrl = useAiBase ? this.aiBaseURL : this.baseURL;
    const url = `${baseUrl}${endpoint}`;
    
    // Check authentication before making request
    if (!authService.isAuthenticated()) {
      console.warn('No valid authentication, skipping API call');
      throw new Error('Authentication required. Please log in.');
    }
    
    // Get authentication headers from authService
    const authHeaders = authService.getAuthHeader();
    
    const config = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
        ...options.headers
      },
      ...options
    };

    // Add request timestamp for debugging
    const requestId = Date.now().toString(36);
    const startTime = Date.now();
    console.log(`[API-${requestId}] 🚀 Starting: ${config.method || 'GET'} ${url}`);

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Log response status with timing
        const responseTime = Date.now() - startTime;
        console.log(`[API-${requestId}] ✅ Response: ${response.status} ${response.statusText} (${responseTime}ms)`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Handle authentication errors immediately - don't retry
          if (response.status === 401) {
            console.warn('401 Unauthorized - clearing auth and stopping retries');
            authService.logout();
            throw new Error('Authentication expired. Please log in again.');
          }
          
          // Handle forbidden errors - don't retry
          if (response.status === 403) {
            throw new Error('Access forbidden.');
          }
          
          // Handle client errors - don't retry
          if (response.status >= 400 && response.status < 500) {
            throw new Error(errorData.error || errorData.message || `Client error: ${response.status}`);
          }
          
          // Handle server errors - retry these
          if (response.status >= 500) {
            const serverError = new Error('Server error. Please try again later.');
            serverError.retryable = true;
            throw serverError;
          }
          
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const totalTime = Date.now() - startTime;
        console.log(`[API-${requestId}] 🎉 Success (total: ${totalTime}ms)`);
        return data;

      } catch (error) {
        lastError = error;
        console.error(`[API-${requestId}] Attempt ${attempt} failed:`, error.message);

        // Don't retry on specific errors
        if (error.name === 'AbortError' || 
            error.message.includes('Authentication') ||
            error.message.includes('Access forbidden') ||
            error.message.includes('Client error') ||
            !error.retryable && !(error.name === 'TypeError' || error.message.includes('fetch'))) {
          console.log(`[API-${requestId}] Not retrying due to error type`);
          throw error;
        }

        // Only retry on network errors or server errors
        if (attempt < this.retryAttempts && 
            (error.retryable || error.name === 'TypeError' || error.message.includes('fetch'))) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[API-${requestId}] Retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryAttempts})`);
          await this.delay(delay);
        } else {
          console.log(`[API-${requestId}] Max retries reached or non-retryable error`);
          break;
        }
      }
    }

    throw lastError;
  }

  // Utility method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== DASHBOARD & ANALYTICS ENDPOINTS =====

  // Get overview statistics
  async getOverviewStats() {
    try {
      return await this.apiCall('/stats/overview');
    } catch (error) {
      console.error('Failed to fetch overview stats:', error);
      return {
        success: false,
        data: {
          totalOrders: 0,
          completionRate: 0,
          totalRegions: 0,
          totalWitels: 0,
          totalCities: 0,
          completedOrders: 0
        }
      };
    }
  }

  // Get regional performance data
  async getRegionalPerformance(limit = 10) {
    try {
      return await this.apiCall(`/stats/regional?limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch regional performance:', error);
      return { success: false, data: [] };
    }
  }

  // Get specific regional details
  async getRegionalDetails(regionalName) {
    try {
      return await this.apiCall(`/stats/regional/${encodeURIComponent(regionalName)}`);
    } catch (error) {
      console.error(`Failed to fetch details for regional ${regionalName}:`, error);
      return { success: false, data: null };
    }
  }

  // Get witel breakdown
  async getWitelBreakdown(regional = null, limit = 20) {
    try {
      const params = new URLSearchParams();
      if (regional) params.append('regional', regional);
      if (limit) params.append('limit', limit);
      
      const query = params.toString() ? `?${params.toString()}` : '';
      return await this.apiCall(`/stats/witel${query}`);
    } catch (error) {
      console.error('Failed to fetch witel breakdown:', error);
      return { success: false, data: [] };
    }
  }

  // Get package analytics
  async getPackageAnalytics() {
    try {
      return await this.apiCall('/stats/packages');
    } catch (error) {
      console.error('Failed to fetch package analytics:', error);
      return { success: false, data: [] };
    }
  }

  // Get status breakdown
  async getStatusBreakdown(detailed = false) {
    try {
      const query = detailed ? '?detailed=true' : '';
      return await this.apiCall(`/stats/status${query}`);
    } catch (error) {
      console.error('Failed to fetch status breakdown:', error);
      return { success: false, data: {} };
    }
  }

  // Get trends data
  async getTrends(type = 'daily', days = 30) {
    try {
      return await this.apiCall(`/stats/trends?type=${type}&days=${days}`);
    } catch (error) {
      console.error('Failed to fetch trends:', error);
      return { success: false, data: [] };
    }
  }

  // Get geographic statistics
  async getGeographicStats(type = 'cities') {
    try {
      return await this.apiCall(`/stats/geographic?type=${type}`);
    } catch (error) {
      console.error('Failed to fetch geographic stats:', error);
      return { success: false, data: type === 'stats' ? {} : [] };
    }
  }

  // Get technical statistics
  async getTechnicalStats() {
    try {
      return await this.apiCall('/stats/technical');
    } catch (error) {
      console.error('Failed to fetch technical stats:', error);
      return { success: false, data: {} };
    }
  }

  // Get conversion statistics
  async getConversionStats() {
    try {
      return await this.apiCall('/stats/conversion');
    } catch (error) {
      console.error('Failed to fetch conversion stats:', error);
      return { success: false, data: {} };
    }
  }

  // Get dashboard data (comprehensive)
  async getDashboardData(timeRange = '7d', regional = null, witel = null) {
    try {
      const params = new URLSearchParams();
      params.append('timeRange', timeRange);
      if (regional) params.append('regional', regional);
      if (witel) params.append('witel', witel);

      // Use the test endpoint with complete data including witel
      console.log(`🔍 Calling dashboard API: ${this.baseURL}/dashboard/test`);
      const result = await fetch(`${this.baseURL}/dashboard/test`).then(r => r.json());
      console.log('📊 Dashboard API response:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to fetch dashboard data:', error);
      return { success: false, data: {} };
    }
  }

  // Get real-time data
  async getRealtimeData() {
    try {
      return await this.apiCall('/dashboard/realtime');
    } catch (error) {
      console.error('Failed to fetch realtime data:', error);
      return { success: false, data: {} };
    }
  }

  // Get performance metrics for specific period
  async getPerformanceMetrics(startDate, endDate) {
    try {
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);

      return await this.apiCall(`/dashboard/performance?${params.toString()}`);
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
      return { success: false, data: {} };
    }
  }

  // ===== ORDER MANAGEMENT ENDPOINTS =====

  // Search orders with filters
  async searchOrders(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });

      const query = params.toString() ? `?${params.toString()}` : '';
      return await this.apiCall(`/orders/search${query}`);
    } catch (error) {
      console.error('Failed to search orders:', error);
      return { success: false, data: [], pagination: {} };
    }
  }

  // Get order by ID
  async getOrderById(orderId) {
    try {
      return await this.apiCall(`/orders/${encodeURIComponent(orderId)}`);
    } catch (error) {
      console.error(`Failed to fetch order ${orderId}:`, error);
      return { success: false, data: null };
    }
  }

  // Update order status
  async updateOrderStatus(orderId, status, message = null) {
    try {
      return await this.apiCall(`/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, message })
      });
    } catch (error) {
      console.error(`Failed to update order ${orderId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // ===== AI CHAT ENDPOINTS =====

  // Send chat message to AI
  async sendChatMessage(message, sessionId = null) {
    try {
      const userId = authService.getUserId();
      if (!userId) {
        throw new Error('User authentication required');
      }

      return await this.apiCall('/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          message,
          userId,
          sessionId: sessionId || this.generateSessionId()
        })
      }, true); // Use AI base URL
    } catch (error) {
      console.error('Failed to send chat message:', error);
      return {
        success: false,
        response: 'I apologize, but I\'m currently experiencing connectivity issues. Please try again in a moment.',
        error: error.message
      };
    }
  }

  // Get chat history for user
  async getChatHistory(limit = 50, offset = 0) {
    try {
      return await this.apiCall(`/chat/history?limit=${limit}&offset=${offset}`, {}, true);
    } catch (error) {
      console.error('Failed to get chat history:', error);
      return {
        success: false,
        chat_history: [],
        pagination: { limit, offset, total: 0 }
      };
    }
  }

  // Get specific chat session
  async getChatSession(sessionId) {
    try {
      return await this.apiCall(`/chat/session/${encodeURIComponent(sessionId)}`, {}, true);
    } catch (error) {
      console.error('Failed to get chat session:', error);
      return {
        success: false,
        session_id: sessionId,
        chat_session: []
      };
    }
  }

  // Get chat statistics
  async getChatStats(days = 30) {
    try {
      return await this.apiCall(`/chat/stats?days=${days}`, {}, true);
    } catch (error) {
      console.error('Failed to get chat stats:', error);
      return {
        success: false,
        stats: {},
        period_days: days
      };
    }
  }

  // Delete chat history
  async deleteChatHistory(sessionId = null) {
    try {
      const body = sessionId ? { sessionId } : {};
      return await this.apiCall('/chat/history', {
        method: 'DELETE',
        body: JSON.stringify(body)
      }, true);
    } catch (error) {
      console.error('Failed to delete chat history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get chat capabilities
  async getChatCapabilities() {
    try {
      return await this.apiCall('/chat/capabilities', {}, true);
    } catch (error) {
      console.error('Failed to get chat capabilities:', error);
      return {
        success: false,
        capabilities: {},
        rules: []
      };
    }
  }

  // Get AI dashboard insights
  async getAIDashboard() {
    try {
      return await this.apiCall('/dashboard/data');
    } catch (error) {
      console.error('Failed to fetch AI dashboard:', error);
      return { success: false, data: {} };
    }
  }

  // Get AI realtime analytics
  async getAIRealtimeAnalytics() {
    try {
      return await this.apiCall('/ai/realtime');
    } catch (error) {
      console.error('Failed to fetch AI realtime analytics:', error);
      return { success: false, data: {} };
    }
  }

  // Get AI KPI data
  async getAIKPI() {
    try {
      return await this.apiCall('/kpi', {}, true);
    } catch (error) {
      console.error('Failed to fetch AI KPI:', error);
      return { success: false, data: {} };
    }
  }

  // Get AI customer analytics
  async getAICustomerAnalytics() {
    try {
      return await this.apiCall('/customer-analytics', {}, true);
    } catch (error) {
      console.error('Failed to fetch AI customer analytics:', error);
      return { success: false, data: {} };
    }
  }

  // Get AI regional performance
  async getAIRegionalPerformance() {
    try {
      return await this.apiCall('/regional-performance', {}, true);
    } catch (error) {
      console.error('Failed to fetch AI regional performance:', error);
      return { success: false, data: {} };
    }
  }

  // Get AI package analytics
  async getAIPackageAnalytics() {
    try {
      return await this.apiCall('/package-analytics', {}, true);
    } catch (error) {
      console.error('Failed to fetch AI package analytics:', error);
      return { success: false, data: {} };
    }
  }

  // Get AI service performance
  async getAIServicePerformance() {
    try {
      return await this.apiCall('/service-performance', {}, true);
    } catch (error) {
      console.error('Failed to fetch AI service performance:', error);
      return { success: false, data: {} };
    }
  }

  // Get AI sales trends
  async getAISalesTrends() {
    try {
      return await this.apiCall('/sales-trends', {}, true);
    } catch (error) {
      console.error('Failed to fetch AI sales trends:', error);
      return { success: false, data: {} };
    }
  }

  // Get AI quick insights
  async getAIQuickInsights() {
    try {
      return await this.apiCall('/quick-insights', {}, true);
    } catch (error) {
      console.error('Failed to fetch AI quick insights:', error);
      return { success: false, data: {} };
    }
  }

  // ===== UTILITY ENDPOINTS =====

  // Get available filter options
  async getFilters() {
    try {
      return await this.apiCall('/filters');
    } catch (error) {
      console.error('Failed to fetch filters:', error);
      return {
        success: false,
        data: {
          regional: [],
          witel: [],
          cities: [],
          packages: [],
          statuses: []
        }
      };
    }
  }

  // Export data to CSV
  async exportToCSV(filters = {}) {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value);
        }
      });

      const response = await fetch(`${this.baseURL}/export/csv?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv'
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hsi_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('Failed to export CSV:', error);
      return { success: false, error: error.message };
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.apiCall('/health');
      return {
        success: true,
        status: 'connected',
        data: response
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        success: false,
        status: 'disconnected',
        error: error.message
      };
    }
  }

  // Database health check
  async databaseHealthCheck() {
    try {
      return await this.apiCall('/health/database');
    } catch (error) {
      console.error('Database health check failed:', error);
      return { success: false, data: {} };
    }
  }

  // ===== ANALYTICS SUMMARY ENDPOINTS =====

  // Get analytics summary
  async getAnalyticsSummary(period = '30d') {
    try {
      return await this.apiCall(`/analytics/summary?period=${period}`);
    } catch (error) {
      console.error('Failed to fetch analytics summary:', error);
      return { success: false, data: {} };
    }
  }

  // Execute custom analytics query
  async executeCustomQuery(query, params = []) {
    try {
      return await this.apiCall('/analytics/custom', {
        method: 'POST',
        body: JSON.stringify({ query, params })
      });
    } catch (error) {
      console.error('Failed to execute custom query:', error);
      return { success: false, data: [] };
    }
  }

  // ===== BATCH OPERATIONS =====

  // Fetch multiple endpoints in parallel
  async fetchMultiple(endpoints) {
    try {
      const promises = endpoints.map(endpoint => 
        this.apiCall(endpoint).catch(error => ({ error: error.message, endpoint }))
      );
      
      const results = await Promise.allSettled(promises);
      return results.map((result, index) => ({
        endpoint: endpoints[index],
        success: result.status === 'fulfilled' && !result.value.error,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : result.value?.error
      }));
    } catch (error) {
      console.error('Batch fetch failed:', error);
      return endpoints.map(endpoint => ({
        endpoint,
        success: false,
        data: null,
        error: error.message
      }));
    }
  }

  // ===== UTILITY METHODS =====

  // Generate session ID for chat
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Format error message for user display
  formatError(error) {
    if (error.message?.includes('fetch')) {
      return 'Unable to connect to HSI analytics server. Please check your connection.';
    }
    if (error.message?.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (error.message?.includes('500')) {
      return 'Server error occurred. Please try again later.';
    }
    return error.message || 'An unexpected error occurred.';
  }

  // Get connection status
  async getConnectionStatus() {
    try {
      await this.healthCheck();
      return 'connected';
    } catch (error) {
      return 'disconnected';
    }
  }

  // Validate API response
  validateResponse(response) {
    if (!response) return false;
    if (response.success === false) return false;
    return true;
  }
}

// Export singleton instance
const telkomApi = new TelkomApiService();

// Export individual methods for easy importing
export const {
  getOverviewStats,
  getRegionalPerformance,
  getRegionalDetails,
  getWitelBreakdown,
  getPackageAnalytics,
  getStatusBreakdown,
  getTrends,
  getGeographicStats,
  getTechnicalStats,
  getConversionStats,
  getDashboardData,
  getRealtimeData,
  getPerformanceMetrics,
  searchOrders,
  getOrderById,
  updateOrderStatus,
  sendChatMessage,
  getAIDashboard,
  getAIRealtimeAnalytics,
  getAIKPI,
  getAICustomerAnalytics,
  getAIRegionalPerformance,
  getAIPackageAnalytics,
  getAIServicePerformance,
  getAISalesTrends,
  getAIQuickInsights,
  getFilters,
  exportToCSV,
  healthCheck,
  databaseHealthCheck,
  getAnalyticsSummary,
  executeCustomQuery,
  fetchMultiple
} = telkomApi;

// Export default instance
export default telkomApi;

// Export class for custom instances
export { TelkomApiService };