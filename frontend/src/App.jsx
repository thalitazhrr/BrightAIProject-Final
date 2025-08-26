import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Settings, Sun, Moon, Loader,
  User, Target, X, Trash2, LogOut, RefreshCw, Bell,
  Plus, Search, Zap, Clock, Wifi, WifiOff, ChevronDown, ChevronUp, Menu
} from 'lucide-react';

// Import services and components
import authService from './services/authService';
import Login from './components/Login';
import { parseMarkdownToJSX } from './utils/markdownParser';
import './animations.css';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chat message error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-500 text-sm p-2 border border-red-300 rounded">
          Error displaying message. Please refresh the page.
        </div>
      );
    }

    return this.props.children;
  }
}

// Chat storage helper functions - now using database only

// Database chat functions - enhanced with proper auth handling
const apiCall = async (endpoint, options = {}) => {
  try {
    // Check authentication before making request
    if (!authService.isAuthenticated()) {
      throw new Error('Authentication required');
    }
    
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    const apiURL = `${baseURL}/api`;
    const authHeaders = authService.getAuthHeader();
    
    const response = await fetch(`${apiURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers
      },
      ...options
    });
    
    // Handle 401 responses immediately
    if (response.status === 401) {
      console.warn('401 Unauthorized in chat API - logging out');
      authService.logout();
      window.location.reload();
      throw new Error('Authentication expired');
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API call failed:', error);
    
    // Re-throw authentication errors
    if (error.message.includes('Authentication')) {
      throw error;
    }
    
    // Provide user-friendly error messages
    if (error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check your connection.');
    }
    
    throw error;
  }
};

const syncChatToDatabase = async (chat) => {
  try {
    // Redirect to sessions/create
    const response = await apiCall('/sessions/create', {
      method: 'POST',
      body: JSON.stringify({ chat })
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing chat to database:', error);
    return null;
  }
};

const loadChatsFromDatabase = async () => {
  try {
    if (!authService.isAuthenticated()) {
      throw new Error('Authentication required to load chats');
    }
    
    const response = await apiCall('/sessions/active');
    
    if (!response.success || !response.active_sessions) {
      console.warn('Invalid response format from sessions API');
      return [];
    }
    
    // For each session, get the first message to create a proper title and preview
    const chatsWithDetails = await Promise.all(
      response.active_sessions.map(async (session) => {
        try {
          const messagesResponse = await apiCall(`/chat/history?session_id=${session.SESSION_ID}`);
          const messages = messagesResponse.success && messagesResponse.data ? messagesResponse.data : [];
          
          // Find first user message for title
          const firstUserMessage = messages.find(msg => msg.MESSAGE_TYPE === 'user');
          const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
          
            // Create title from first user message, fallback to session name
          let title = session.SESSION_NAME || 'Percakapan Baru';
          if (firstUserMessage && firstUserMessage.MESSAGE) {
            let firstMsgText = '';
            if (typeof firstUserMessage.MESSAGE === 'string') {
              firstMsgText = firstUserMessage.MESSAGE;
            } else if (typeof firstUserMessage.MESSAGE === 'object') {
              firstMsgText = firstUserMessage.MESSAGE.text || firstUserMessage.MESSAGE.message || JSON.stringify(firstUserMessage.MESSAGE);
            } else {
              firstMsgText = String(firstUserMessage.MESSAGE);
            }
            
            if (firstMsgText && firstMsgText.trim()) {
              title = firstMsgText.slice(0, 50);
              if (firstMsgText.length > 50) title += '...';
            }
          }
          
          // Create preview from last message
          let preview = `${session.MESSAGE_COUNT || 0} pesan`;
          if (lastMessage && lastMessage.MESSAGE) {
            let lastMsgText = '';
            if (typeof lastMessage.MESSAGE === 'string') {
              lastMsgText = lastMessage.MESSAGE;
            } else if (typeof lastMessage.MESSAGE === 'object') {
              lastMsgText = lastMessage.MESSAGE.text || lastMessage.MESSAGE.message || JSON.stringify(lastMessage.MESSAGE);
            } else {
              lastMsgText = String(lastMessage.MESSAGE);
            }
            
            if (lastMsgText && lastMsgText.trim()) {
              preview = lastMsgText.slice(0, 80);
              if (lastMsgText.length > 80) preview += '...';
            }
          }
          
          return {
            id: session.SESSION_ID,
            title: title,
            messages: [],
            lastMessage: preview,
            createdAt: session.STARTED_AT,
            updatedAt: session.STARTED_AT,
            userId: session.USER_ID,
            messageCount: session.MESSAGE_COUNT || 0
          };
        } catch (error) {
          console.error(`Error loading details for session ${session.SESSION_ID}:`, error);
          // Fallback to basic session info
          return {
            id: session.SESSION_ID,
            title: session.SESSION_NAME || 'Percakapan Baru',
            messages: [],
            lastMessage: `${session.MESSAGE_COUNT || 0} pesan`,
            createdAt: session.STARTED_AT,
            updatedAt: session.STARTED_AT,
            userId: session.USER_ID,
            messageCount: session.MESSAGE_COUNT || 0
          };
        }
      })
    );
    
    return chatsWithDetails;
  } catch (error) {
    console.error('Error loading chats from database:', error);
    
    if (error.message.includes('Authentication')) {
      throw error; // Re-throw auth errors
    }
    
    return [];
  }
};

const loadChatMessagesFromDatabase = async (chatId) => {
  try {
    if (!authService.isAuthenticated()) {
      throw new Error('Authentication required to load messages');
    }
    
    const response = await apiCall(`/chat/history?session_id=${chatId}`);
    
    if (!response.success || !response.data) {
      console.warn('Invalid response format from messages API');
      return [];
    }
    
    // Enhanced message processing with safe handling
    return response.data.map(msg => {
      let messageText = '';
      
      // Safe extraction of message text
      if (msg.MESSAGE) {
        if (typeof msg.MESSAGE === 'string') {
          messageText = msg.MESSAGE;
        } else if (typeof msg.MESSAGE === 'object') {
          // Handle object messages
          if (msg.MESSAGE.text) {
            messageText = msg.MESSAGE.text;
          } else if (msg.MESSAGE.message) {
            messageText = msg.MESSAGE.message;
          } else if (msg.MESSAGE.response) {
            messageText = msg.MESSAGE.response;
          } else {
            messageText = JSON.stringify(msg.MESSAGE, null, 2);
          }
        } else {
          messageText = String(msg.MESSAGE);
        }
      } else if (msg.message) {
        messageText = String(msg.message);
      } else if (msg.text) {
        messageText = String(msg.text);
      } else {
        messageText = '[Empty message]';
      }
      
      return {
        id: msg.CHAT_ID || msg.id || `msg_${Date.now()}_${Math.random()}`,
        text: messageText,
        isBot: msg.MESSAGE_TYPE === 'assistant',
        timestamp: msg.CREATED_AT || msg.created_at || msg.timestamp || new Date().toISOString(),
        userId: msg.USER_ID || msg.user_id || msg.userId,
        ruleId: msg.RULE_ID,
        ruleName: msg.RULE_NAME,
        confidence: msg.CONFIDENCE
      };
    });
  } catch (error) {
    console.error('Error loading chat messages:', error);
    
    if (error.message.includes('Authentication')) {
      throw error; // Re-throw auth errors
    }
    
    return [];
  }
};

const saveChatToDatabase = async (chat) => {
  try {
    if (!authService.isAuthenticated()) {
      throw new Error('Authentication required to save chat');
    }
    
    const response = await apiCall('/sessions/create', {
      method: 'POST',
      body: JSON.stringify({
        session_name: chat.title
      })
    });
    return response.success ? response : null;
  } catch (error) {
    console.error('Error saving chat to database:', error);
    
    if (error.message.includes('Authentication')) {
      throw error; // Re-throw auth errors
    }
    
    return null;
  }
};

const saveMessageToDatabase = async (chatId, message, userId) => {
  try {
    if (!authService.isAuthenticated()) {
      throw new Error('Authentication required to save message');
    }
    
    const response = await apiCall(`/chat/message`, {
      method: 'POST',
      body: JSON.stringify({
        message: message.text || message.message,
        sessionId: chatId
      })
    });
    return response.data;
  } catch (error) {
    console.error('Error saving message to database:', error);
    
    if (error.message.includes('Authentication')) {
      throw error; // Re-throw auth errors
    }
    
    return null;
  }
};

const deleteChatFromDatabase = async (chatId) => {
  try {
    const response = await apiCall('/chat/history', {
      method: 'DELETE',
      body: JSON.stringify({
        sessionId: chatId
      }),
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting chat from database:', error);
    return null;
  }
};

// Animated Background Component with Starry Space Theme
const AnimatedBackground = ({ theme }) => {
  // Blue color palette - lighter shades for light theme
  const blueColors = theme === 'dark' ? [
    '#1E3A8A', // blue-800
    '#1E40AF', // blue-700
    '#2563EB', // blue-600
    '#3B82F6', // blue-500
    '#60A5FA', // blue-400
    '#93C5FD', // blue-300
    '#0EA5E9', // sky-500
    '#0284C7', // sky-600
    '#0369A1', // sky-700
    '#075985'  // sky-800
  ] : [
    '#DBEAFE', // blue-100
    '#BFDBFE', // blue-200
    '#93C5FD', // blue-300
    '#60A5FA', // blue-400
    '#3B82F6', // blue-500
    '#2563EB', // blue-600
    '#E0F2FE', // sky-100
    '#BAE6FD', // sky-200
    '#7DD3FC', // sky-300
    '#38BDF8'  // sky-400
  ];

  // Animation types for variety - all blue-themed
  const animationTypes = ['float0', 'float1', 'float2', 'float3', 'float4', 'gentlePulse', 'drift', 'oceanWave', 'blueBreeze', 'skyDrift'];
  
  // Star particle animations
  const starAnimations = ['starTwinkle', 'starPulse', 'starFloat', 'cosmicDance'];

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient background */}
      <div className={`absolute inset-0 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-slate-900 via-blue-950/40 to-slate-900'
          : 'bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50'
      }`} />
      
      {/* Floating blue orbs */}
      <div className="absolute inset-0">
        {Array.from({ length: 12 }, (_, i) => {
          // Extended positions for better coverage
          const positions = [
            { top: '5%', left: '10%' },
            { top: '20%', left: '88%' },
            { top: '70%', left: '5%' },
            { top: '40%', left: '78%' },
            { top: '88%', left: '70%' },
            { top: '15%', left: '55%' },
            { top: '80%', left: '25%' },
            { top: '55%', left: '92%' },
            { top: '30%', left: '35%' },
            { top: '95%', left: '50%' },
            { top: '12%', left: '75%' },
            { top: '60%', left: '60%' }
          ];
          
          // More varied sizes for better visual layering
          const sizes = [250, 300, 180, 350, 160, 320, 220, 280, 370, 200, 340, 190];
          
          // Select animation type
          const animationType = animationTypes[i % animationTypes.length];
          
          return (
            <div
              key={i}
              className={`absolute rounded-full mix-blend-multiply filter blur-3xl ${
                theme === 'dark' ? 'opacity-8' : 'opacity-20'
              }`}
              style={{
                background: `radial-gradient(circle, ${blueColors[i % blueColors.length]}, transparent 70%)`,
                width: `${sizes[i]}px`,
                height: `${sizes[i]}px`,
                top: positions[i].top,
                left: positions[i].left,
                animation: `${animationType} ${25 + (i * 2)}s ease-in-out infinite`,
                animationDelay: `${i * 1.8}s`
              }}
            />
          );
        })}
      </div>
      
      {/* Twinkling star particles */}
      <div className="absolute inset-0">
        {Array.from({ length: 25 }, (_, i) => {
          // Random positions for stars
          const starPositions = [
            { top: '8%', left: '15%' }, { top: '25%', left: '85%' }, { top: '45%', left: '12%' },
            { top: '65%', left: '78%' }, { top: '32%', left: '55%' }, { top: '18%', left: '92%' },
            { top: '75%', left: '33%' }, { top: '52%', left: '8%' }, { top: '88%', left: '65%' },
            { top: '12%', left: '42%' }, { top: '38%', left: '95%' }, { top: '72%', left: '18%' },
            { top: '55%', left: '72%' }, { top: '28%', left: '25%' }, { top: '85%', left: '45%' },
            { top: '15%', left: '68%' }, { top: '68%', left: '88%' }, { top: '42%', left: '35%' },
            { top: '78%', left: '58%' }, { top: '22%', left: '5%' }, { top: '95%', left: '22%' },
            { top: '58%', left: '48%' }, { top: '35%', left: '82%' }, { top: '82%', left: '95%' },
            { top: '48%', left: '62%' }
          ];
          
          const starSizes = ['star-small', 'star-medium', 'star-large'];
          const starSize = starSizes[i % 3];
          const starAnimation = starAnimations[i % starAnimations.length];
          const position = starPositions[i % starPositions.length];
          
          return (
            <div
              key={`star-${i}`}
              className={`absolute star-particle ${starSize} ${
                theme === 'dark' ? 'opacity-80' : 'opacity-60'
              }`}
              style={{
                top: position.top,
                left: position.left,
                animation: `${starAnimation} ${3 + (i * 0.3)}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                background: theme === 'dark' 
                  ? 'radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(147, 197, 253, 0.7) 50%, transparent 100%)'
                  : 'radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(147, 197, 253, 0.6) 50%, transparent 100%)'
              }}
            />
          );
        })}
      </div>
      
      {/* Cosmic glow effects */}
      <div className="absolute inset-0">
        {Array.from({ length: 8 }, (_, i) => {
          const glowPositions = [
            { top: '20%', left: '30%' }, { top: '60%', left: '80%' },
            { top: '35%', left: '15%' }, { top: '75%', left: '55%' },
            { top: '15%', left: '70%' }, { top: '85%', left: '25%' },
            { top: '50%', left: '90%' }, { top: '90%', left: '10%' }
          ];
          
          const glowSizes = [80, 120, 100, 150, 90, 110, 95, 130];
          const position = glowPositions[i % glowPositions.length];
          
          return (
            <div
              key={`glow-${i}`}
              className={`absolute cosmic-glow ${
                theme === 'dark' ? 'opacity-20' : 'opacity-15'
              }`}
              style={{
                top: position.top,
                left: position.left,
                width: `${glowSizes[i]}px`,
                height: `${glowSizes[i]}px`,
                animation: `starGlow ${8 + (i * 1.5)}s ease-in-out infinite`,
                animationDelay: `${i * 1.2}s`
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// Sidebar Component
const Sidebar = ({ activeView, setActiveView, theme, notifications }) => {
  const menuItems = [
    { id: 'ai', icon: Bot, label: 'BrightAI', badge: notifications },
    { id: 'profile', icon: User, label: 'Profil', badge: null },
    { id: 'settings', icon: Settings, label: 'Pengaturan', badge: null }
  ];

  return (
    <div className={`w-20 fixed left-0 top-0 h-screen z-50 ${
      theme === 'dark' ? 'bg-slate-800/60' : 'bg-white/60'
    } backdrop-blur-xl border-r ${
      theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
    } flex flex-col items-center py-6 space-y-6`}>
      <div className={`w-12 h-12 ${
        theme === 'dark' 
          ? 'bg-gradient-to-r from-blue-600 to-blue-800' 
          : 'bg-gradient-to-r from-blue-500 to-sky-600'
      } rounded-2xl flex items-center justify-center hover:scale-110 transition-transform cursor-pointer`}>
        <Target className="w-6 h-6 text-white" />
      </div>
      
      <div className="flex-1 flex flex-col space-y-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <div
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`relative w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 group ${
                isActive
                  ? theme === 'dark'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              
              {item.badge && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-medium">{item.badge}</span>
                </div>
              )}
              
              <div className={`absolute left-full ml-3 px-2 py-1 rounded-lg text-sm font-medium whitespace-nowrap z-[200] transition-all duration-200 ${
                theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-gray-900 text-white'
              } opacity-0 group-hover:opacity-100 pointer-events-none`}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Status Indicator Component
const StatusIndicator = ({ status, theme }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'online':
        return { color: 'green', icon: Wifi, text: 'Online' };
      case 'offline':
        return { color: 'red', icon: WifiOff, text: 'Offline' };
      case 'connecting':
        return { color: 'yellow', icon: Loader, text: 'Connecting' };
      default:
        return { color: 'gray', icon: Clock, text: 'Tidak dikenal' };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
      theme === 'dark' ? 'bg-slate-800/60' : 'bg-white/60'
    } backdrop-blur-xl border ${
      theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
    }`}>
      <Icon className={`w-4 h-4 ${
        config.color === 'green' ? 'text-green-500' :
        config.color === 'red' ? 'text-red-500' :
        config.color === 'yellow' ? 'text-yellow-500' : 'text-gray-500'
      } ${status === 'connecting' ? 'animate-spin' : ''}`} />
      <span className={`text-sm font-medium ${
        theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
      }`}>
        {config.text}
      </span>
    </div>
  );
};

// Header Component
const Header = ({ theme, setTheme, status, onRefresh, notifications, onNotificationClick, showNotifications, currentUser, onLogout }) => (
  <div className={`fixed top-0 left-20 right-0 z-40 ${
    theme === 'dark' ? 'bg-slate-800/60' : 'bg-white/60'
  } backdrop-blur-xl border-b ${
    theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
  } px-6 py-4 flex items-center justify-between`}>
    <div className="flex items-center space-x-4">
      <div>
        <h1 className={`text-2xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Telkom Bright
        </h1>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
        }`}>
          Platform Analisis dan Intelijensi Bisnis oleh Telkom Indonesia
        </p>
      </div>
    </div>

    <div className="flex items-center space-x-4 relative">
      <StatusIndicator status={status} theme={theme} />
      
      <button
        onClick={onRefresh}
        className={`p-2 rounded-xl ${
          theme === 'dark' 
            ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        } transition-colors`}
        title="Perbarui Data"
      >
        <RefreshCw className="w-5 h-5" />
      </button>

      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={`p-2 rounded-xl ${
          theme === 'dark' 
            ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        } transition-colors`}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="relative">
        <button 
          onClick={onNotificationClick}
          className={`p-2 rounded-xl ${
            theme === 'dark' 
              ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          } transition-colors relative`}
          title="Notifikasi"
        >
          <Bell className="w-5 h-5" />
          {notifications.filter(n => !n.isRead).length > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-medium">
                {notifications.filter(n => !n.isRead).length}
              </span>
            </div>
          )}
        </button>
        
        {showNotifications && (
          <div className={`fixed right-6 top-20 w-80 ${
            theme === 'dark' ? 'bg-slate-800' : 'bg-white'
          } rounded-xl border ${
            theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
          } shadow-2xl z-[10000] max-h-96 overflow-y-auto`}>
            <div className={`p-4 border-b ${
              theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Notifikasi
                </h3>
                {notifications.length > 0 && (
                  <button
                    onClick={() => {}}
                    className={`text-sm ${
                      theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                    }`}
                  >
                    Hapus Semua
                  </button>
                )}
              </div>
            </div>
            
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className={`${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                }`}>
                  No notifications
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b ${
                    theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
                  } hover:${theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-50'} cursor-pointer ${
                    !notification.isRead ? 'bg-opacity-50' : ''
                  }`}
                  onClick={() => {}}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      notification.type === 'warning' ? 'bg-yellow-500' :
                      notification.type === 'success' ? 'bg-green-500' :
                      notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <h4 className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {notification.title}
                      </h4>
                      <p className={`text-sm mt-1 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                      }`}>
                        {notification.message}
                      </p>
                      <p className={`text-xs mt-2 ${
                        theme === 'dark' ? 'text-slate-500' : 'text-gray-500'
                      }`}>
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* User Info and Logout */}
      {currentUser && (
        <div className="flex items-center space-x-3 ml-4">
          <div className={`text-right ${
            theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
          }`}>
            <p className="text-sm font-medium">{currentUser.full_name || currentUser.username}</p>
            <p className="text-xs opacity-75">{currentUser.department || 'User'}</p>
          </div>
          <button
            onClick={onLogout}
            className={`p-2 rounded-xl ${
              theme === 'dark' 
                ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700/50' 
                : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
            } transition-colors`}
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  </div>
);



// Chat Message Component
const ChatMessage = ({ message, isBot, theme }) => {
  // Safe message handling
  const safeMessage = React.useMemo(() => {
    if (!message) return 'Empty message';
    
    // If message is an object, convert to string
    if (typeof message === 'object') {
      try {
        // Handle specific object structures
        if (message.text) return String(message.text);
        if (message.message) return String(message.message);
        if (message.response) return String(message.response);
        
        // Otherwise stringify
        return JSON.stringify(message, null, 2);
      } catch (e) {
        return '[Complex Object - Cannot Display]';
      }
    }
    
    // Ensure it's a string
    return String(message);
  }, [message]);
  
  // Safe markdown parsing with error boundary
  const renderMessage = React.useMemo(() => {
    try {
      if (isBot) {
        // Only parse markdown for bot messages
        const parsed = parseMarkdownToJSX(safeMessage, theme);
        // If parsing returns null or invalid, fall back to plain text
        if (parsed && React.isValidElement(parsed)) {
          return parsed;
        }
        // Fallback to plain text with line breaks
        return (
          <div>
            {safeMessage.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < safeMessage.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        );
      }
      // For user messages, just display as plain text with line breaks
      return (
        <div>
          {safeMessage.split('\n').map((line, index) => (
            <React.Fragment key={index}>
              {line}
              {index < safeMessage.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      );
    } catch (error) {
      console.error('Error rendering message:', error);
      return <span className="text-red-500">[Error displaying message: {safeMessage.substring(0, 100)}...]</span>;
    }
  }, [safeMessage, isBot, theme]);
  
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${
        isBot 
          ? theme === 'dark' 
            ? 'bg-slate-700 text-white' 
            : 'bg-gray-100 text-gray-900'
          : 'bg-gradient-to-r from-blue-500 to-sky-500 text-white'
      } rounded-2xl px-4 py-3 shadow-lg`}>
        {isBot && (
          <div className="flex items-center mb-2">
            <Bot className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">BrightAI</span>
          </div>
        )}
        <div className="text-sm leading-relaxed">
          {renderMessage}
        </div>
      </div>
    </div>
  );
};

// Chat Sidebar Component
const ChatSidebar = ({ chats, activeChat, setActiveChat, onNewChat, onDeleteChat, theme }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchActive, setIsSearchActive] = React.useState(false);
  const [showChatControls, setShowChatControls] = React.useState(true);
  
  // Filter chats based on search query
  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle search activation
  const handleSearchFocus = () => {
    setIsSearchActive(true);
  };

  const handleSearchBlur = () => {
    if (!searchQuery) {
      setIsSearchActive(false);
    }
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setIsSearchActive(false);
  };

  return (
    <div className={`w-80 fixed left-20 top-20 bottom-0 z-30 ${
      theme === 'dark' ? 'bg-slate-800/60' : 'bg-white/60'
    } backdrop-blur-xl border-r ${
      theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
    } flex flex-col`}>
      <div className={`p-4 border-b ${
        theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-semibold text-lg ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Percakapan
          </h3>
          <button
            onClick={() => setShowChatControls(!showChatControls)}
            className={`p-1 rounded-md transition-colors ${
              theme === 'dark' 
                ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' 
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title={showChatControls ? 'Sembunyikan kontrol' : 'Tampilkan kontrol'}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
        
        {showChatControls && (
          <div className="space-y-3">
            <button
              onClick={onNewChat}
              className={`w-full flex items-center justify-center space-x-2 px-4 py-3 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700' 
                  : 'bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600'
              } text-white rounded-xl transition-all duration-200`}
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">Percakapan Baru</span>
            </button>
            
            {/* Search Box */}
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors ${
                isSearchActive 
                  ? theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                  : theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Cari percakapan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                className={`w-full pl-10 pr-10 py-2 rounded-lg border transition-all duration-200 ${
                  theme === 'dark' 
                    ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500 focus:bg-slate-700' 
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-blue-50/50'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              />
              {searchQuery && (
                <button
                  onClick={handleSearchClear}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${
                    theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 && searchQuery ? (
          <div className="p-4 text-center">
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
            }`}>
              No conversations found
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => setActiveChat(chat.id)}
            className={`p-4 border-b ${
              theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
            } cursor-pointer hover:${
              theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-50'
            } transition-colors ${
              activeChat === chat.id 
                ? theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-50'
                : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium truncate ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {chat.title}
                </h4>
                <p className={`text-sm mt-1 truncate ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                }`}>
                  {chat.lastMessage}
                </p>
                <p className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-slate-500' : 'text-gray-500'
                }`}>
                  {new Date(chat.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                className={`ml-2 p-1 rounded ${
                  theme === 'dark' 
                    ? 'text-slate-400 hover:text-red-400 hover:bg-slate-600/50' 
                    : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                } transition-colors`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )))}
      </div>
  </div>
);
}

// Main App Component
function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // App state
  const [theme, setTheme] = useState('dark');
  const [activeView, setActiveView] = useState('ai');
  const [status, setStatus] = useState('online'); // Simple status for app connection
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const chatEndRef = useRef(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    department: ''
  });
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);

  // Initialize authentication on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...');
        
        // Clean up any invalid tokens first
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedToken && (!storedToken.includes('.') || storedUser === 'null' || storedUser === 'undefined')) {
          console.log('Found invalid stored auth data, cleaning up');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('telkom_chat_history');
        }
        
        const authData = await authService.initializeAuth();
        if (authData) {
          console.log('Auth data found:', authData.user.username);
          setIsAuthenticated(true);
          setCurrentUser(authData.user);
        } else {
          console.log('No valid auth data found');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle login
  const handleLogin = (user, token) => {
    console.log('Login successful:', user);
    setCurrentUser(user);
    setIsAuthenticated(true);
    // Clear any existing chats to load user-specific ones
    setChats([]);
    setActiveChat(null);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setChats([]);
      setActiveChat(null);
      setNotifications([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Initialize profile form when user data is available
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        fullName: currentUser.fullName || currentUser.full_name || '',
        department: currentUser.department || ''
      });
    }
  }, [currentUser]);

  // Handle profile update
  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    
    setProfileUpdateLoading(true);
    try {
      const response = await apiCall('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profileForm.fullName,
          department: profileForm.department
        })
      });
      
      if (response.success) {
        // Update current user state
        setCurrentUser(prev => ({
          ...prev,
          fullName: profileForm.fullName,
          full_name: profileForm.fullName,
          department: profileForm.department
        }));
        
        // Update localStorage
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
          ...storedUser,
          fullName: profileForm.fullName,
          full_name: profileForm.fullName,
          department: profileForm.department
        }));
        
        alert('Profile updated successfully!');
      } else {
        alert('Failed to update profile: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Profile update error:', error);
      alert('Failed to update profile: ' + error.message);
    } finally {
      setProfileUpdateLoading(false);
    }
  };

  // Load user-specific chat history - with proper authentication check
  useEffect(() => {
    const loadChats = async () => {
      if (!isAuthenticated || !currentUser || authLoading) {
        console.log('Skipping chat load - auth not ready:', {
          isAuthenticated, 
          hasCurrentUser: !!currentUser, 
          authLoading
        });
        return;
      }
      
      try {
        console.log(`💬 Loading chats for user: ${currentUser.username}`);
        
        // Refresh auth state before loading chats
        authService.refreshAuthState();
        
        // Verify authentication before loading chats
        if (!authService.isAuthenticated()) {
          console.warn('Auth service says not authenticated, refreshing page...');
          window.location.reload();
          return;
        }
        
        // Load user-specific chats from database
        const dbChats = await loadChatsFromDatabase();
        console.log(`✅ Loaded ${dbChats.length} chats from database`);
        
        setChats(dbChats);
        if (dbChats.length > 0 && !activeChat) {
          setActiveChat(dbChats[0].id);
          console.log(`🎯 Set active chat: ${dbChats[0].id}`);
        }
      } catch (error) {
        console.error('❌ Error loading user chats:', error);
        
        // If authentication error, force logout
        if (error.message.includes('Authentication') || error.message.includes('token')) {
          console.warn('Authentication error while loading chats - logging out');
          setIsAuthenticated(false);
          setCurrentUser(null);
          authService.logout();
        } else {
          // For other errors, just set empty chats
          setChats([]);
          setActiveChat(null);
        }
      }
    };
    
    // Only load chats when user is fully authenticated and loading is complete
    if (isAuthenticated && currentUser && !authLoading) {
      // Add delay to ensure auth state is fully synced
      const timer = setTimeout(loadChats, 200);
      return () => clearTimeout(timer);
    } else if (!isAuthenticated && !authLoading) {
      // Clear chats when not authenticated
      console.log('🗺 Clearing chats - user not authenticated');
      setChats([]);
      setActiveChat(null);
    }
  }, [isAuthenticated, currentUser, authLoading]);

  // Note: Chats are now saved to database in real-time, no need for localStorage

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChat]);



  // Handle notification click
  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  // Mark notification as read
  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, isRead: true } : notif
      )
    );
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };


  // Create new chat with proper user association
  const handleNewChat = async () => {
    // Refresh auth state first
    authService.refreshAuthState();
    
    if (!currentUser || !authService.isAuthenticated()) {
      console.warn('Cannot create chat - user not authenticated:', {
        hasCurrentUser: !!currentUser,
        isAuthenticated: authService.isAuthenticated()
      });
      return;
    }
    
    const userId = currentUser.id || currentUser.userId;
    const chatId = `c${Date.now().toString(36).substr(-8)}${Math.random().toString(36).substr(2, 3)}`;
    const newChat = {
      id: chatId,
      title: 'Percakapan Baru',
      messages: [],
      lastMessage: 'Start a conversation...',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId // Ensure user ID is included
    };
    
    try {
      console.log(`🆕 Creating new chat ${chatId} for user ${currentUser.username}`);
      
      // Save to database first to ensure it's properly created
      const savedChat = await saveChatToDatabase(newChat);
      
      if (savedChat && savedChat.session_id) {
        // Create welcome message in Indonesian
        const welcomeMessage = {
          id: `welcome_${Date.now()}`,
          text: '🚀 **Selamat datang di BrightAI!**\n\nSaya adalah asisten analisis data Telkom yang dapat membantu Anda menganalisis data dari berbagai database perusahaan seperti:\n\n📊 **PS_SCONE_ORDER**: Analisis order dan sales HSI\n👥 **DAPROS_MIGRASI**: Profil dan segmentasi customer HSI\n🎯 **TARGET_ALL**: Analisis target dan performance\n💰 **MART_REV_PMS_POTS**: Analisis revenue dan billing\n📉 **CT0_NAL_EBIS**: Analisis churn dan customer lifecycle\n\n**Contoh pertanyaan yang bisa Anda ajukan:**\n• "Analisis total order HSI per regional"\n• "Bagaimana pola churn pelanggan HSI berdasarkan bandwidth?"\n• "Tren revenue HSI 6 bulan terakhir"\n• "Penetrasi HSI di wilayah Jawa Barat"\n\nSilakan ajukan pertanyaan analisis data yang Anda butuhkan! 💬',
          isBot: true,
          timestamp: new Date().toISOString(),
          userId: userId
        };

        // Update chat with real session ID from backend and welcome message
        const chatWithRealId = {
          ...newChat,
          id: savedChat.session_id,
          messages: [welcomeMessage],
          lastMessage: 'Selamat datang di BrightAI! Silakan ajukan pertanyaan...',
          title: 'Percakapan Baru - BrightAI'
        };
        setChats(prev => [chatWithRealId, ...prev]);
        setActiveChat(savedChat.session_id);
        
        console.log('✅ New chat created successfully with welcome:', savedChat.session_id);
      } else {
        console.error('❌ Failed to save chat to database');
        alert('Failed to create new chat. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error creating new chat:', error);
      
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        console.warn('Authentication error while creating chat');
        setIsAuthenticated(false);
        setCurrentUser(null);
        authService.logout();
      } else {
        alert('Failed to create new chat. Please try again.');
      }
    }
  };

  // Delete chat
  const handleDeleteChat = async (chatId) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    if (activeChat === chatId) {
      const remainingChats = chats.filter(chat => chat.id !== chatId);
      setActiveChat(remainingChats.length > 0 ? remainingChats[0].id : null);
    }
    
    // Delete from database
    await deleteChatFromDatabase(chatId);
  };

  // Send message with enhanced authentication and error handling
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !currentUser || !authService.isAuthenticated()) {
      console.warn('Cannot send message - missing requirements');
      return;
    }

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setIsTyping(true);

    // Verify current chat exists and belongs to user
    const currentChatObj = chats.find(chat => chat.id === activeChat);
    if (!currentChatObj) {
      console.error('Active chat not found');
      setIsTyping(false);
      return;
    }

    const userId = currentUser.id || currentUser.userId;
    const messageId = `m${Date.now().toString(36)}${Math.random().toString(36).substr(2, 2)}`;
    
    try {
      // Add user message to chat locally first
      const userMessageObj = { 
        id: messageId,
        text: userMessage, 
        isBot: false, 
        timestamp: new Date().toISOString(),
        userId: userId
      };
      
      const updatedChat = {
        ...currentChatObj,
        messages: [...currentChatObj.messages, userMessageObj],
        lastMessage: userMessage,
        updatedAt: new Date().toISOString(),
        title: currentChatObj.messages.length === 0 ? generateChatTitle(userMessage) : currentChatObj.title
      };

      setChats(prev => prev.map(chat => chat.id === activeChat ? updatedChat : chat));

      // Send to AI using correct endpoint
      const response = await apiCall('/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          message: userMessage,
          sessionId: activeChat
        })
      });

      // Process AI response - handle various response formats safely
      let aiMessage;
      if (response.response) {
        // Handle different response types
        if (typeof response.response === 'string') {
          aiMessage = response.response;
        } else if (typeof response.response === 'object') {
          try {
            aiMessage = JSON.stringify(response.response, null, 2);
          } catch (e) {
            aiMessage = '[Complex Response - Cannot Display]';
          }
        } else {
          aiMessage = String(response.response);
        }
      } else {
        aiMessage = 'Maaf, saya tidak dapat memproses permintaan Anda saat ini. Silakan coba lagi.';
      }

      const aiMessageObj = {
        id: `ai_${Date.now()}`,
        text: aiMessage,
        isBot: true,
        timestamp: new Date().toISOString(),
        userId: userId,
        rule_name: response.rule_name,
        confidence: response.confidence
      };
      
      setChats(prev => prev.map(chat => 
        chat.id === activeChat 
          ? {
              ...chat,
              messages: [...chat.messages, aiMessageObj],
              lastMessage: aiMessage.slice(0, 50) + (aiMessage.length > 50 ? '...' : ''),
              updatedAt: new Date().toISOString()
            }
          : chat
      ));

    } catch (error) {
      console.error('Send message error:', error);
      
      // Handle authentication errors
      if (error.message.includes('Authentication')) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        return;
      }
      
      // Add error message in Indonesian
      const errorMessage = {
        id: `error_${Date.now()}`,
        text: 'Maaf, saya mengalami masalah dalam terhubung ke layanan AI. Silakan coba lagi nanti.',
        isBot: true,
        timestamp: new Date().toISOString(),
        userId: userId
      };
      
      setChats(prev => prev.map(chat => 
        chat.id === activeChat 
          ? {
              ...chat,
              messages: [...chat.messages, errorMessage],
              lastMessage: 'Kesalahan koneksi',
              updatedAt: new Date().toISOString()
            }
          : chat
      ));
    } finally {
      setIsTyping(false);
    }
  };

  // Handle key press in chat input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle profile update
  const handleProfileUpdate = async () => {
    try {
      const response = await apiCall('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profileForm.fullName,
          department: profileForm.department
        })
      });

      if (response.success) {
        setCurrentUser(prev => ({
          ...prev,
          fullName: profileForm.fullName,
          department: profileForm.department
        }));
        alert('Profil berhasil diperbarui!');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      alert('Gagal memperbarui profil. Silakan coba lagi.');
    }
  };

  // Load messages for active chat
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeChat) return;
      
      const currentChatObj = chats.find(chat => chat.id === activeChat);
      if (!currentChatObj) return;
      
      // If messages not loaded, load from database
      if (currentChatObj.messages.length === 0) {
        try {
          const messages = await loadChatMessagesFromDatabase(activeChat);
          setChats(prev => prev.map(chat => 
            chat.id === activeChat 
              ? { ...chat, messages }
              : chat
          ));
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      }
    };
    
    loadMessages();
  }, [activeChat, chats]);

  // Get current chat messages
  const getCurrentChatMessages = () => {
    const currentChatObj = chats.find(chat => chat.id === activeChat);
    return currentChatObj ? currentChatObj.messages : [];
  };



  // Render content based on active view
  const renderContent = () => {
    switch (activeView) {
      case 'ai':
        return (
          <div className="flex h-full">
            <ChatSidebar 
              chats={chats}
              activeChat={activeChat}
              setActiveChat={setActiveChat}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteChat}
              theme={theme}
            />
            
            <div className="flex-1 flex flex-col ml-80">
              {activeChat ? (
                <>
                  <div className="flex-1 overflow-y-auto p-6">
                    {getCurrentChatMessages().map((message, index) => (
                      <ErrorBoundary key={`msg-${index}-${message.id || 'unknown'}`}>
                        <ChatMessage
                          key={index}
                          message={message.text}
                          isBot={message.isBot}
                          theme={theme}
                        />
                      </ErrorBoundary>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start mb-4">
                        <div className={`max-w-xs ${
                          theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'
                        } rounded-2xl px-4 py-3`}>
                          <div className="flex items-center space-x-1">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  
                  <div className={`p-4 border-t ${
                    theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
                  }`}>
                    {/* Quick Questions */}
                    <QuickQuestionsComponent onQuestionClick={handleQuickQuestionClick} theme={theme} />
                    
                    {/* Powered by BrightAI */}
                    <PoweredByComponent theme={theme} />
                    
                    <div className="flex space-x-4">
                      <textarea
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Tanyakan apa saja kepada BrightAI - dari pertanyaan umum hingga bantuan teknis..."
                        className={`flex-1 resize-none rounded-xl px-4 py-3 ${
                          theme === 'dark' 
                            ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        } border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                        rows="1"
                        disabled={isTyping}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!currentMessage.trim() || isTyping}
                        className={`px-6 py-3 ${
                          !currentMessage.trim() || isTyping
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600'
                        } text-white rounded-xl transition-all duration-200 flex items-center space-x-2`}
                      >
                        <Send className="w-4 h-4" />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col">
                  {/* Welcome Area */}
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <Bot className={`w-16 h-16 mx-auto mb-4 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                      }`} />
                      <h3 className={`text-xl font-semibold mb-2 ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        Welcome to BrightAI
                      </h3>
                      <p className={`${
                        theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
                      } mb-4`}>
                        Mulai percakapan baru untuk mendapatkan wawasan bertenaga AI
                      </p>
                      <button
                        onClick={handleNewChat}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-xl hover:from-blue-600 hover:to-sky-600 transition-all duration-200"
                      >
                        Mulai Percakapan Baru
                      </button>
                    </div>
                  </div>
                  
                  {/* Bottom section with Quick Questions and Powered by */}
                  <div className={`p-4 border-t ${
                    theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
                  }`}>
                    {/* Quick Questions for new users */}
                    <QuickQuestionsComponent onQuestionClick={(question) => {
                      handleNewChat();
                      setTimeout(() => {
                        setCurrentMessage(question);
                        setTimeout(() => handleSendMessage(), 100);
                      }, 200);
                    }} theme={theme} />
                    
                    {/* Powered by BrightAI */}
                    <PoweredByComponent theme={theme} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );


      case 'profile':
        return (
          <div className="p-8 ml-20">
            <div className="mb-8">
              <h2 className={`text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Profil Pengguna
              </h2>
              <p className={`text-lg mt-2 ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
              }`}>
                Kelola informasi profil dan preferensi akun Anda
              </p>
            </div>
            
            <div className={`${
              theme === 'dark' ? 'bg-slate-800/60' : 'bg-white/60'
            } backdrop-blur-xl rounded-2xl p-6 border ${
              theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
            } max-w-2xl`}>
              <div className="space-y-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                  }`}>
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({...profileForm, fullName: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      theme === 'dark' 
                        ? 'bg-slate-700 border-slate-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Masukkan nama lengkap"
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                  }`}>
                    Departemen
                  </label>
                  <input
                    type="text"
                    value={profileForm.department}
                    onChange={(e) => setProfileForm({...profileForm, department: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      theme === 'dark' 
                        ? 'bg-slate-700 border-slate-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Masukkan departemen"
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                  }`}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={currentUser?.email || ''}
                    disabled
                    className={`w-full px-4 py-3 rounded-xl border ${
                      theme === 'dark' 
                        ? 'bg-slate-600 border-slate-500 text-slate-300' 
                        : 'bg-gray-100 border-gray-300 text-gray-600'
                    } cursor-not-allowed`}
                  />
                </div>
                
                <button
                  onClick={handleProfileUpdate}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-xl hover:from-blue-600 hover:to-sky-600 transition-all duration-200"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="p-8 ml-20">
            <div className="mb-8">
              <h2 className={`text-3xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Pengaturan
              </h2>
              <p className={`text-lg mt-2 ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
              }`}>
                Kelola profil, keamanan, dan preferensi akun Anda
              </p>
            </div>
            <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={`${
                theme === 'dark' ? 'bg-slate-800/60' : 'bg-white/60'
              } backdrop-blur-xl rounded-2xl p-6 border ${
                theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
              }`}>
                <h3 className={`text-xl font-semibold mb-6 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Pengaturan Profil
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Nama Tampilan
                    </label>
                    <input
                      type="text"
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm({...profileForm, fullName: e.target.value})}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        theme === 'dark' 
                          ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                          : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      placeholder="Masukkan nama tampilan"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={currentUser?.email || ''}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        theme === 'dark' 
                          ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                          : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      placeholder="Email terhubung"
                      readOnly
                    />
                    <p className={`text-xs mt-1 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                    }`}>
                      Email tidak dapat diubah demi keamanan
                    </p>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Departemen
                    </label>
                    <input
                      type="text"
                      value={profileForm.department}
                      onChange={(e) => setProfileForm({...profileForm, department: e.target.value})}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        theme === 'dark' 
                          ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                          : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      placeholder="Departemen"
                    />
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={handleUpdateProfile}
                      disabled={profileUpdateLoading}
                      className={`w-full px-4 py-3 rounded-xl ${
                        theme === 'dark' 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      } transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
                    >
                      {profileUpdateLoading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin mr-2" />
                          Memperbarui...
                        </>
                      ) : (
                        'Perbarui Profil'
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className={`${
                theme === 'dark' ? 'bg-slate-800/60' : 'bg-white/60'
              } backdrop-blur-xl rounded-2xl p-6 border ${
                theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
              }`}>
                <h3 className={`text-xl font-semibold mb-6 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Akun & Keamanan
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
                    }`}>
                      Nama Pengguna
                    </label>
                    <input
                      type="text"
                      value={currentUser?.username || ''}
                      className={`w-full px-4 py-3 rounded-xl border ${
                        theme === 'dark' 
                          ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                          : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      readOnly
                    />
                  </div>
                  <div>
                    <button
                      className={`w-full px-4 py-3 rounded-xl border-2 border-dashed ${
                        theme === 'dark' 
                          ? 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300' 
                          : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600'
                      } transition-colors`}
                      onClick={() => alert('Fitur ubah kata sandi akan segera tersedia')}
                    >
                      Ubah Kata Sandi
                    </button>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        if (window.confirm('Apakah Anda yakin ingin keluar?')) {
                          authService.logout();
                          window.location.reload();
                        }
                      }}
                      className={`w-full px-4 py-3 rounded-xl ${
                        theme === 'dark' 
                          ? 'bg-red-600 hover:bg-red-700 text-white' 
                          : 'bg-red-500 hover:bg-red-600 text-white'
                      } transition-colors`}
                    >
                      Keluar dari Akun
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-8 ml-20 flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className={`text-2xl font-bold mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Segera Hadir
              </h2>
              <p className={`${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
              }`}>
                Fitur ini sedang dalam pengembangan
              </p>
            </div>
          </div>
        );
    }
  };

  // Show loading screen during auth initialization
  if (authLoading) {
    return (
      <div className={`min-h-screen ${
        theme === 'dark' 
          ? 'bg-slate-900 text-white' 
          : 'bg-gray-50 text-gray-900'
      } flex items-center justify-center`}>
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p>Loading BrightAI...</p>
        </div>
      </div>
    );
  }

  // Generate smart chat title based on message content
  const generateChatTitle = (message) => {
    const keywords = {
      'help': ['help', 'bantuan', 'panduan', 'cara'],
      'information': ['informasi', 'info', 'data', 'keterangan'],
      'question': ['pertanyaan', 'tanya', 'bagaimana', 'apa'],
      'support': ['support', 'dukungan', 'layanan'],
      'tutorial': ['tutorial', 'belajar', 'menggunakan'],
      'feature': ['fitur', 'feature', 'fungsi', 'kemampuan'],
      'profile': ['profil', 'profile', 'akun', 'account'],
      'settings': ['pengaturan', 'settings', 'konfigurasi']
    };

    const lowerMessage = message.toLowerCase();
    
    // Find matching keywords
    for (const [category, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (lowerMessage.includes(word)) {
          const shortMessage = message.slice(0, 25);
          return `${category.charAt(0).toUpperCase() + category.slice(1)}: ${shortMessage}${message.length > 25 ? '...' : ''}`;
        }
      }
    }
    
    // Default fallback with first few words
    const words = message.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.slice(0, 30) + '...' : words;
  };

  // Handle quick question click
  const handleQuickQuestionClick = (question) => {
    setCurrentMessage(question);
    // Auto-send the question
    setTimeout(() => {
      if (activeChat) {
        handleSendMessage();
      }
    }, 100);
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} theme={theme} />;
  }

  // Quick Questions Component
  const QuickQuestionsComponent = ({ onQuestionClick, theme }) => {
    const [showMore, setShowMore] = React.useState(false);
    
    const baseQuestions = [
      "Bagaimana cara menggunakan BrightAI?",
      "Apa saja fitur yang tersedia?",
      "Bagaimana cara mengubah profil saya?",
      "Apa yang bisa saya tanyakan ke BrightAI?",
      "Bagaimana cara mengatur preferensi akun?",
      "Bantuan untuk memulai percakapan?"
    ];
    
    const moreQuestions = [
      "Bagaimana cara menghapus riwayat chat?",
      "Apa saja topik yang bisa dibahas?",
      "Bagaimana cara mengubah tema aplikasi?",
      "Tips menggunakan BrightAI secara efektif?",
      "Bagaimana cara logout dari aplikasi?",
      "Panduan fitur chat dan messaging?",
      "Cara mengatur notifikasi aplikasi?",
      "Bantuan troubleshooting masalah umum?"
    ];
    
    const displayedQuestions = showMore ? [...baseQuestions, ...moreQuestions] : baseQuestions;
    
    return (
      <div className={`mb-4 p-4 rounded-xl border ${
        theme === 'dark' 
          ? 'bg-slate-800/40 border-slate-700/50' 
          : 'bg-blue-50/50 border-blue-200/50'
      } backdrop-blur-sm`}>
        <div className="flex items-center mb-3">
          <Zap className={`w-4 h-4 mr-2 ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`} />
          <h4 className={`font-semibold text-sm ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Quick Questions
          </h4>
        </div>
        
        <div className="grid grid-cols-1 gap-2 mb-3">
          {displayedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => onQuestionClick(question)}
              className={`text-left p-2 rounded-lg text-sm transition-colors ${
                theme === 'dark' 
                  ? 'text-slate-300 hover:text-white hover:bg-slate-700/50 border border-slate-600/50 hover:border-blue-500/50' 
                  : 'text-gray-700 hover:text-gray-900 hover:bg-blue-100/50 border border-gray-200 hover:border-blue-300'
              }`}
            >
              {question}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setShowMore(!showMore)}
          className={`w-full text-sm font-medium py-2 px-3 rounded-lg transition-colors ${
            theme === 'dark' 
              ? 'text-blue-400 hover:text-blue-300 hover:bg-slate-700/50 border border-blue-500/30 hover:border-blue-400/50' 
              : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 hover:border-blue-300'
          }`}
        >
          {showMore ? '- Show Less' : '+ Add More Questions'}
        </button>
      </div>
    );
  };

  // Powered by BrightAI Component
  const PoweredByComponent = ({ theme }) => (
    <div className={`flex items-center justify-center py-3 px-4 rounded-xl mb-4 ${
      theme === 'dark' 
        ? 'bg-gradient-to-r from-slate-800/60 to-slate-700/60 border border-slate-600/50' 
        : 'bg-gradient-to-r from-blue-50/80 to-sky-50/80 border border-blue-200/50'
    } backdrop-blur-sm`}>
      <div className="flex items-center space-x-2">
        <Zap className={`w-5 h-5 ${
          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
        }`} />
        <div className="text-center">
          <div className={`text-sm font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Powered by BrightAI
          </div>
          <div className={`text-xs ${
            theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
          }`}>
            AI canggih yang memahami data bisnis Anda dan memberikan wawasan cerdas
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${
      theme === 'dark' 
        ? 'bg-slate-900 text-white' 
        : 'bg-gray-50 text-gray-900'
    } transition-colors duration-200`}>
      <AnimatedBackground theme={theme} />
      
      <div className="relative z-10">
        <Sidebar 
          activeView={activeView} 
          setActiveView={setActiveView} 
          theme={theme} 
          notifications={chats.length}
        />
        
        <Header 
          theme={theme} 
          setTheme={setTheme} 
          status={status}
          onRefresh={() => {}}
          notifications={notifications}
          onNotificationClick={handleNotificationClick}
          showNotifications={showNotifications}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        
        <main className="pt-20 min-h-screen">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
export default App;