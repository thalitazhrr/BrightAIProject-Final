// Auth Service - Handle authentication API calls
class AuthService {
  constructor() {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    this.baseURL = process.env.REACT_APP_AUTH_URL || `${apiUrl}/api/auth`;
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  // Generic API call with authentication and retry logic
  async apiCall(endpoint, options = {}, retryCount = 0) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add authorization header if token exists
    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, config);
      
      // Handle 401 responses immediately
      if (response.status === 401) {
        console.warn('401 Unauthorized - clearing auth data');
        this.logout();
        throw new Error('Authentication failed. Please log in again.');
      }
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Auth API call failed:', error);
      
      // Don't retry 401 errors or if we've already retried
      if (error.message.includes('Authentication failed') || retryCount >= 2) {
        throw error;
      }
      
      // Retry on network errors
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        console.log(`Retrying API call (attempt ${retryCount + 1})...`);
        await this.delay(1000 * (retryCount + 1));
        return this.apiCall(endpoint, options, retryCount + 1);
      }
      
      throw error;
    }
  }

  // Login user
  async login(username, password) {
    try {
      const response = await this.apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (response.success) {
        this.token = response.data.token;
        this.user = response.data.user;
        
        // Store in localStorage
        localStorage.setItem('token', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        
        return response.data;
      }

      throw new Error(response.error);
    } catch (error) {
      throw error;
    }
  }

  // Register user
  async register(userData) {
    try {
      const response = await this.apiCall('/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error);
    } catch (error) {
      throw error;
    }
  }

  // Logout user
  async logout() {
    try {
      if (this.token) {
        // Call logout endpoint
        await this.apiCall('/logout', {
          method: 'POST'
        });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage regardless of API call result
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('telkom_chat_history');
    }
  }

  // Get current user profile
  async getProfile() {
    try {
      const response = await this.apiCall('/profile');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Update user profile
  async updateProfile(updateData) {
    try {
      const response = await this.apiCall('/profile', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      if (response.success) {
        this.user = response.data;
        localStorage.setItem('user', JSON.stringify(this.user));
        return response.data;
      }

      throw new Error(response.error);
    } catch (error) {
      throw error;
    }
  }

  // Verify token
  async verifyToken() {
    try {
      if (!this.token) {
        console.log('No token to verify');
        return false;
      }
      
      console.log('Verifying token...');
      const response = await this.apiCall('/verify');
      
      if (response && response.success) {
        console.log('Token verification successful');
        return true;
      } else {
        console.log('Token verification failed - invalid response');
        this.logout();
        return false;
      }
    } catch (error) {
      console.log('Token verification failed:', error.message);
      this.logout();
      return false;
    }
  }

  // Check if user is authenticated (with token validation)
  isAuthenticated() {
    // First, try to refresh state from localStorage if we don't have current data
    if (!this.token || !this.user) {
      this.refreshAuthState();
    }
    
    const hasTokenAndUser = !!this.token && !!this.user;
    
    if (!hasTokenAndUser) {
      return false;
    }
    
    // Check if token is expired (basic JWT check)
    try {
      if (this.token) {
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        const now = Date.now() / 1000;
        
        if (payload.exp && payload.exp < now) {
          console.log('Token expired, clearing auth data');
          this.logout();
          return false;
        }
      }
    } catch (e) {
      console.warn('Could not decode token for expiry check:', e);
      // Continue with basic check if token parsing fails
    }
    
    return true;
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Get current token
  getToken() {
    return this.token;
  }

  // Check if user is admin
  isAdmin() {
    return this.user?.role === 'admin';
  }

  // Get user's department
  getUserDepartment() {
    return this.user?.department;
  }

  // Get user's full name
  getUserFullName() {
    return this.user?.full_name || this.user?.username;
  }

  // Refresh auth state from localStorage
  refreshAuthState() {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        this.token = storedToken;
        this.user = JSON.parse(storedUser);
        console.log('Auth state refreshed for user:', this.user.username);
        return true;
      } else {
        this.token = null;
        this.user = null;
        return false;
      }
    } catch (error) {
      console.error('Error refreshing auth state:', error);
      this.token = null;
      this.user = null;
      return false;
    }
  }

  // Auto-login on app start with enhanced validation
  async initializeAuth() {
    try {
      console.log('Initializing authentication...');
      
      // First refresh auth state from localStorage
      const hasStoredAuth = this.refreshAuthState();
      
      if (!hasStoredAuth) {
        console.log('No stored auth data found');
        return null;
      }

      console.log('Found stored auth data for user:', this.user.username);

      // Basic token structure validation
      if (!this.token.includes('.')) {
        console.log('Invalid token format');
        this.logout();
        return null;
      }

      // Verify token is still valid with server
      const isValid = await this.verifyToken();
      if (isValid) {
        console.log('Auth initialization successful');
        return { user: this.user, token: this.token };
      } else {
        console.log('Token verification failed during initialization');
        this.logout();
        return null;
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      this.logout();
      return null;
    }
  }

  // Get authorization header for other API calls
  getAuthHeader() {
    // Refresh state first to ensure we have latest data
    this.refreshAuthState();
    
    if (!this.isAuthenticated()) {
      console.log('🔒 No authentication - returning empty header');
      return {};
    }
    
    const header = this.token ? { Authorization: `Bearer ${this.token}` } : {};
    console.log('🔑 Auth header generated:', { hasToken: !!this.token, headerKeys: Object.keys(header) });
    return header;
  }
  
  // Utility method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Validate API response
  validateApiResponse(response) {
    return response && typeof response === 'object' && response.hasOwnProperty('success');
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;