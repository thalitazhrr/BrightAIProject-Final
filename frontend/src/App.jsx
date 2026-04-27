import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Settings, Sun, Moon, Loader,
  User, Target, X, Trash2, LogOut, RefreshCw,
  Plus, Search, Zap, Clock, Wifi, WifiOff, ChevronDown, ChevronUp, Menu,
  Eye, EyeOff
} from 'lucide-react';

// Import services and components
import authService from './services/authService';
import Login from './components/Login';
import GuidedFlow from './components/GuidedFlow';
import { parseMarkdownToJSX } from './utils/markdownParser';
import { generateWelcomeMessage } from './utils/welcomeTemplate';
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

    // Single API call — no per-session message fetching to keep load fast
    return response.active_sessions.map(session => ({
      id: session.SESSION_ID,
      title: session.SESSION_NAME || 'Percakapan Baru',
      messages: [],
      lastMessage: session.MESSAGE_COUNT > 0
        ? `${session.MESSAGE_COUNT} pesan`
        : 'Percakapan baru',
      createdAt: session.STARTED_AT,
      updatedAt: session.STARTED_AT,
      userId: session.USER_ID,
      messageCount: session.MESSAGE_COUNT || 0
    }));

  } catch (error) {
    console.error('Error loading chats from database:', error);
    if (error.message.includes('Authentication')) throw error;
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


// Sidebar Component
const Sidebar = ({ activeView, setActiveView, theme, notifications }) => {
  const menuItems = [
    { id: 'ai', icon: Bot, label: 'BrightAI', badge: null },
    { id: 'profile', icon: User, label: 'Profil', badge: null },
    { id: 'settings', icon: Settings, label: 'Pengaturan', badge: null }
  ];

  return (
    <div className={`w-16 fixed left-0 top-0 h-screen z-50 ${
      theme === 'dark' ? 'bg-slate-900/80' : 'bg-white/80'
    } backdrop-blur-xl border-r ${
      theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/70'
    } flex flex-col items-center py-5 gap-2`}>
      {/* Logo */}
      <div className={`w-10 h-10 mb-2 ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-blue-600 to-blue-800'
          : 'bg-gradient-to-br from-blue-500 to-sky-600'
      } rounded-xl flex items-center justify-center shadow-lg`}>
        <Target className="w-5 h-5 text-white" />
      </div>

      {/* Divider */}
      <div className={`w-8 h-px ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'} mb-2`} />

      <div className="flex-1 flex flex-col gap-1 w-full px-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <div
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={item.label}
              className={`relative w-full h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 group ${
                isActive
                  ? theme === 'dark'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />

              {/* Active indicator */}
              {isActive && (
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${
                  theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'
                }`} />
              )}

              {/* Tooltip */}
              <div className={`absolute left-full ml-2 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap z-[200] pointer-events-none
                transition-all duration-150 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 ${
                theme === 'dark' ? 'bg-slate-700 text-white border border-slate-600' : 'bg-gray-900 text-white'
              } shadow-lg`}>
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
const Header = ({ theme, setTheme, status, currentUser, onLogout, onToggleSidebar, sidebarOpen, showSidebarToggle }) => (
  <div className={`fixed top-0 left-16 right-0 z-40 ${
    theme === 'dark' ? 'bg-slate-900/80' : 'bg-white/80'
  } backdrop-blur-xl border-b ${
    theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/70'
  } px-4 h-14 flex items-center justify-between`}>

    {/* Left: Sidebar toggle + Brand */}
    <div className="flex items-center gap-3 min-w-0">
      {showSidebarToggle && (
        <button
          onClick={onToggleSidebar}
          className={`p-2 rounded-lg transition-colors shrink-0 ${
            theme === 'dark'
              ? 'text-slate-400 hover:text-white hover:bg-slate-700/60'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title={sidebarOpen ? 'Sembunyikan percakapan' : 'Tampilkan percakapan'}
        >
          <Menu className="w-4 h-4" />
        </button>
      )}
      <div className="min-w-0">
        <h1 className={`text-lg font-bold leading-tight truncate ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Welcome to BrightAI
        </h1>
        <p className={`text-xs truncate ${
          theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
        }`}>
          Platform Analisis dan Intelijensi Bisnis untuk HSI
        </p>
      </div>
    </div>

    {/* Right: Status + Theme + User */}
    <div className="flex items-center gap-1 shrink-0">
      <StatusIndicator status={status} theme={theme} />

      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={`p-2 rounded-lg ${
          theme === 'dark'
            ? 'text-slate-400 hover:text-white hover:bg-slate-700/60'
            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
        } transition-colors`}
        title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Divider */}
      <div className={`w-px h-6 mx-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`} />

      {/* User Info */}
      {currentUser && (
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${
            theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
          }`}>
            {(currentUser.full_name || currentUser.username || 'U')[0].toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className={`text-sm font-medium leading-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {currentUser.full_name || currentUser.username}
            </p>
            <p className={`text-xs leading-tight ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              {currentUser.role || 'User'}
            </p>
          </div>
          <button
            onClick={onLogout}
            className={`p-2 rounded-lg ${
              theme === 'dark'
                ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700/60'
                : 'text-gray-500 hover:text-red-600 hover:bg-gray-100'
            } transition-colors`}
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  </div>
);



// Chat Message Component
const ChatMessage = ({ message, isBot, theme }) => {
  const safeMessage = React.useMemo(() => {
    if (!message) return 'Empty message';
    if (typeof message === 'object') {
      try {
        if (message.text) return String(message.text);
        if (message.message) return String(message.message);
        if (message.response) return String(message.response);
        return JSON.stringify(message, null, 2);
      } catch (e) {
        return '[Complex Object - Cannot Display]';
      }
    }
    return String(message);
  }, [message]);

  const renderMessage = React.useMemo(() => {
    try {
      if (isBot) {
        const parsed = parseMarkdownToJSX(safeMessage, theme);
        if (parsed && React.isValidElement(parsed)) return parsed;
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
      return <span className="text-red-500">[Error: {safeMessage.substring(0, 100)}]</span>;
    }
  }, [safeMessage, isBot, theme]);

  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4 gap-2`}>
      {/* Bot avatar */}
      {isBot && (
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center self-end ${
          theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'
        }`}>
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={`max-w-[75%] xl:max-w-[70%] ${
        isBot
          ? theme === 'dark'
            ? 'bg-slate-800/80 text-slate-100 border border-slate-700/50'
            : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
          : theme === 'dark'
            ? 'bg-blue-600 text-white'
            : 'bg-blue-500 text-white'
      } rounded-2xl px-4 py-3`}>
        <div className="text-sm leading-relaxed">
          {renderMessage}
        </div>
      </div>

      {/* User avatar */}
      {!isBot && (
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center self-end ${
          theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'
        }`}>
          <User className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-600'}`} />
        </div>
      )}
    </div>
  );
};

// Chat Sidebar Component
const ChatSidebar = ({ chats, activeChat, setActiveChat, onNewChat, onDeleteChat, theme, isOpen }) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`w-72 fixed left-16 top-14 bottom-0 z-30 transition-transform duration-300 ease-in-out ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } ${
      theme === 'dark' ? 'bg-slate-900/90' : 'bg-white/90'
    } backdrop-blur-xl border-r ${
      theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/70'
    } flex flex-col`}>
      {/* Header */}
      <div className={`px-4 pt-4 pb-3 border-b ${
        theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/70'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-semibold ${
            theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
          }`}>
            Percakapan
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'
          }`}>
            {chats.length}
          </span>
        </div>

        <button
          onClick={onNewChat}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            theme === 'dark'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          } shadow-sm`}
        >
          <Plus className="w-4 h-4" />
          Percakapan Baru
        </button>

        {/* Search */}
        <div className="relative mt-2">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${
            theme === 'dark' ? 'text-slate-500' : 'text-gray-400'
          }`} />
          <input
            type="text"
            placeholder="Cari..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-400'
            } focus:outline-none`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${
                theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-6 text-center">
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
              {searchQuery ? 'Tidak ditemukan' : 'Belum ada percakapan'}
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={`group px-3 py-3 mx-2 my-0.5 rounded-xl cursor-pointer transition-all duration-150 ${
                activeChat === chat.id
                  ? theme === 'dark'
                    ? 'bg-blue-600/20 border border-blue-500/30'
                    : 'bg-blue-50 border border-blue-200'
                  : theme === 'dark'
                    ? 'hover:bg-slate-800/60 border border-transparent'
                    : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-medium truncate ${
                    activeChat === chat.id
                      ? theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                      : theme === 'dark' ? 'text-slate-200' : 'text-gray-800'
                  }`}>
                    {chat.title}
                  </h4>
                  <p className={`text-xs mt-0.5 truncate ${
                    theme === 'dark' ? 'text-slate-500' : 'text-gray-400'
                  }`}>
                    {chat.lastMessage}
                  </p>
                  <p className={`text-xs mt-1 ${
                    theme === 'dark' ? 'text-slate-600' : 'text-gray-400'
                  }`}>
                    {new Date(chat.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                  className={`shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                    theme === 'dark'
                      ? 'text-slate-500 hover:text-red-400 hover:bg-slate-700'
                      : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Main App Component
function App() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  
  // App state
  const [theme, setTheme] = useState('dark');
  const [activeView, setActiveView] = useState('ai');
  const [status, setStatus] = useState('online'); // Simple status for app connection
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef(null);

  // Guided flow state
  const [guidedStep, setGuidedStep] = useState('mode_select'); // 'mode_select' | 'forecast_select' | 'category_select' | 'question_select' | 'awaiting' | 'post_answer'
  const [guidedCategory, setGuidedCategory] = useState(null);
  const prevIsTypingRef = useRef(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    username: '',
    email: ''
  });
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);
  const [profileUpdateMsg, setProfileUpdateMsg] = useState({ type: '', text: '' });

  // Password change form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  // Always start at login page — clear any stored auth on mount
  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('telkom_chat_history');
    authService.token = null;
    authService.user = null;
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAuthLoading(false);
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
  const handleLogout = () => {
    // Clear state immediately so the button always works
    setIsAuthenticated(false);
    setCurrentUser(null);
    setChats([]);
    setActiveChat(null);
    setNotifications([]);
    // Fire-and-forget API call to invalidate server-side token
    authService.logout().catch(err => console.error('Logout API error:', err));
  };

  // Initialize profile form when user data is available
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        fullName: currentUser.fullName || currentUser.full_name || '',
        username: currentUser.username || '',
        email: currentUser.email || ''
      });
    }
  }, [currentUser]);

  // Handle profile update (used by both profile page and settings page)
  const handleUpdateProfile = async () => {
    if (!currentUser) return;

    if (!profileForm.fullName.trim()) {
      setProfileUpdateMsg({ type: 'error', text: 'Nama lengkap wajib diisi.' });
      return;
    }
    if (!profileForm.username.trim() || profileForm.username.trim().length < 3) {
      setProfileUpdateMsg({ type: 'error', text: 'Username minimal 3 karakter.' });
      return;
    }
    if (!profileForm.email.trim() || !/\S+@\S+\.\S+/.test(profileForm.email)) {
      setProfileUpdateMsg({ type: 'error', text: 'Format email tidak valid.' });
      return;
    }

    setProfileUpdateLoading(true);
    setProfileUpdateMsg({ type: '', text: '' });
    try {
      const response = await apiCall('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profileForm.fullName.trim(),
          username: profileForm.username.trim(),
          email: profileForm.email.trim()
        })
      });

      if (response.success) {
        const updatedFields = {
          fullName: profileForm.fullName.trim(),
          full_name: profileForm.fullName.trim(),
          username: profileForm.username.trim(),
          email: profileForm.email.trim()
        };

        setCurrentUser(prev => ({ ...prev, ...updatedFields }));

        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...storedUser, ...updatedFields }));

        setProfileUpdateMsg({ type: 'success', text: 'Profil berhasil diperbarui.' });
      } else {
        setProfileUpdateMsg({ type: 'error', text: response.error || 'Gagal memperbarui profil.' });
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setProfileUpdateMsg({ type: 'error', text: 'Tidak dapat terhubung ke server.' });
    } finally {
      setProfileUpdateLoading(false);
    }
  };

  // Handle password change
  const handleChangePassword = async () => {
    setPasswordMsg({ type: '', text: '' });

    if (!passwordForm.currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Kata sandi lama wajib diisi.' });
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Kata sandi baru minimal 6 karakter.' });
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(passwordForm.newPassword)) {
      setPasswordMsg({ type: 'error', text: 'Kata sandi baru harus mengandung huruf besar, huruf kecil, dan angka.' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await apiCall('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
        })
      });

      if (response.success) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordMsg({ type: 'success', text: 'Kata sandi berhasil diubah.' });
      } else {
        setPasswordMsg({ type: 'error', text: response.error || 'Gagal mengubah kata sandi.' });
      }
    } catch (error) {
      console.error('Change password error:', error);
      const isNetworkError = error.message.includes('connect') || error.message.includes('fetch') || error.message.includes('network');
      setPasswordMsg({
        type: 'error',
        text: isNetworkError
          ? 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
          : (error.message || 'Gagal mengubah kata sandi.')
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Load user-specific chat history from Oracle after login
  useEffect(() => {
    const loadChats = async () => {
      try {
        const dbChats = await loadChatsFromDatabase();
        setChats(dbChats);
        if (dbChats.length > 0) {
          setActiveChat(dbChats[0].id);
        }
      } catch (error) {
        console.error('Error loading chats from Oracle:', error);
        if (error.message.includes('Authentication') || error.message.includes('token')) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          authService.logout();
        } else {
          setChats([]);
          setActiveChat(null);
        }
      }
    };

    if (isAuthenticated && currentUser && !authLoading) {
      loadChats();
    } else if (!isAuthenticated && !authLoading) {
      setChats([]);
      setActiveChat(null);
    }
  }, [isAuthenticated, currentUser, authLoading]);

  // Note: Chats are now saved to database in real-time, no need for localStorage

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChat]);

  // Reset guided flow when switching chats
  useEffect(() => {
    if (activeChat) {
      const chat = chats.find(c => c.id === activeChat);
      const hasUserMessages = chat?.messages?.some(m => !m.isBot) ?? false;
      if (hasUserMessages) {
        // Existing chat — go straight to category selection
        setGuidedStep('category_select');
      } else {
        setGuidedStep('mode_select');
      }
      setGuidedCategory(null);
    }
  }, [activeChat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Transition from 'awaiting' → 'post_answer' when AI finishes typing
  useEffect(() => {
    if (prevIsTypingRef.current && !isTyping && guidedStep === 'awaiting') {
      const timer = setTimeout(() => setGuidedStep('post_answer'), 200);
      return () => clearTimeout(timer);
    }
    prevIsTypingRef.current = isTyping;
  }, [isTyping]); // eslint-disable-line react-hooks/exhaustive-deps



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
        // Create welcome message from template (see src/utils/welcomeTemplate.js)
        const welcomeMessage = {
          id: `welcome_${Date.now()}`,
          text: generateWelcomeMessage(),
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
          title: 'Percakapan Baru - BrightAI',
          _loaded: true // mark as loaded so welcome message isn't overwritten
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

  // Guided flow handlers
  const handleModeSelect = (mode) => {
    if (mode === 'forecast') {
      setGuidedStep('forecast_select');
      return;
    }
    setGuidedStep('category_select');
  };

  const handleCategorySelect = (categoryId) => {
    setGuidedCategory(categoryId);
    setGuidedStep('question_select');
  };

  // Populate input field with selected question (user can edit before sending)
  const handleQuestionSelect = (questionText) => {
    setCurrentMessage(questionText);
  };

  // Send the current input message from guided flow
  const handleGuidedSend = () => {
    if (!currentMessage.trim()) return;
    setGuidedStep('awaiting');
    handleSendMessage(currentMessage.trim());
    setCurrentMessage('');
  };

  const handleGuidedBack = (targetStep) => {
    setGuidedStep(targetStep);
  };

  const handleGuidedReset = () => {
    setGuidedStep('mode_select');
    setGuidedCategory(null);
  };

  // Send message with enhanced authentication and error handling
  const handleSendMessage = async (messageText = null) => {
    const userMessage = messageText || currentMessage.trim();
    if (!userMessage || !currentUser || !authService.isAuthenticated()) {
      console.warn('Cannot send message - missing requirements');
      return;
    }

    if (!messageText) setCurrentMessage('');
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
      
      // First real user message → update title locally and in Oracle
      const isFirstUserMessage = !currentChatObj.messages.some(m => !m.isBot);
      const newTitle = isFirstUserMessage
        ? (userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''))
        : currentChatObj.title;

      if (isFirstUserMessage) {
        apiCall(`/sessions/${activeChat}/name`, {
          method: 'PUT',
          body: JSON.stringify({ session_name: newTitle })
        }).catch(err => console.warn('Failed to update session name:', err));
      }

      const updatedChat = {
        ...currentChatObj,
        messages: [...currentChatObj.messages, userMessageObj],
        lastMessage: userMessage,
        updatedAt: new Date().toISOString(),
        title: newTitle
      };

      // Move active chat to top of sidebar
      setChats(prev => {
        const mapped = prev.map(chat => chat.id === activeChat ? updatedChat : chat);
        return [mapped.find(c => c.id === activeChat), ...mapped.filter(c => c.id !== activeChat)];
      });

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
      
      setChats(prev => {
        const mapped = prev.map(chat =>
          chat.id === activeChat
            ? {
                ...chat,
                messages: [...chat.messages, aiMessageObj],
                lastMessage: aiMessage.slice(0, 50) + (aiMessage.length > 50 ? '...' : ''),
                updatedAt: new Date().toISOString()
              }
            : chat
        );
        return [mapped.find(c => c.id === activeChat), ...mapped.filter(c => c.id !== activeChat)];
      });

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


  // Load messages for active chat
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeChat) return;

      const currentChatObj = chats.find(chat => chat.id === activeChat);
      if (!currentChatObj) return;

      // Only load from DB if messages haven't been fetched yet (marked with _loaded flag)
      if (!currentChatObj._loaded) {
        try {
          const dbMessages = await loadChatMessagesFromDatabase(activeChat);
          setChats(prev => prev.map(chat =>
            chat.id === activeChat
              ? { ...chat, messages: dbMessages, _loaded: true }
              : chat
          ));
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      }
    };

    loadMessages();
  }, [activeChat]); // Only re-run when activeChat changes, not on every chats update

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
          <div className="flex flex-1 overflow-hidden h-full">
            <ChatSidebar
              chats={chats}
              activeChat={activeChat}
              setActiveChat={setActiveChat}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteChat}
              theme={theme}
              isOpen={sidebarOpen}
            />

            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-72' : 'ml-0'}`}>
              {activeChat ? (
                <>
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {getCurrentChatMessages().map((message, index) => (
                      <ErrorBoundary key={`msg-${index}-${message.id || 'unknown'}`}>
                        <ChatMessage
                          message={message.text}
                          isBot={message.isBot}
                          theme={theme}
                        />
                      </ErrorBoundary>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start mb-4 gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 self-end ${
                          theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'
                        }`}>
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className={`px-4 py-3 rounded-2xl ${
                          theme === 'dark'
                            ? 'bg-slate-800/80 border border-slate-700/50'
                            : 'bg-white border border-gray-200 shadow-sm'
                        }`}>
                          <div className="flex gap-1">
                            <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-slate-400' : 'bg-gray-400'}`}></div>
                            <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-slate-400' : 'bg-gray-400'}`} style={{ animationDelay: '0.15s' }}></div>
                            <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-slate-400' : 'bg-gray-400'}`} style={{ animationDelay: '0.3s' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Guided Flow Controls (replaces free-form input) */}
                  <GuidedFlow
                    theme={theme}
                    guidedStep={guidedStep}
                    guidedCategory={guidedCategory}
                    inputValue={currentMessage}
                    onModeSelect={handleModeSelect}
                    onCategorySelect={handleCategorySelect}
                    onInputChange={setCurrentMessage}
                    onSend={handleGuidedSend}
                    onBack={handleGuidedBack}
                    onGantiKategori={() => handleGuidedBack('category_select')}
                    onReset={handleGuidedReset}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                    theme === 'dark' ? 'bg-blue-600/20' : 'bg-blue-50'
                  }`}>
                    <Bot className={`w-8 h-8 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
                  </div>
                  <h3 className={`text-xl font-semibold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Selamat Datang di BrightAI
                  </h3>
                  <p className={`text-sm mb-6 max-w-sm ${
                    theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
                  }`}>
                    Mulai percakapan baru untuk menganalisis data HSI Telkom dengan kecerdasan buatan
                  </p>
                  <button
                    onClick={handleNewChat}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Mulai Percakapan Baru
                  </button>
                </div>
              )}
            </div>
          </div>
        );


      case 'profile':
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 flex flex-col items-center">
              <div className="w-full max-w-xl space-y-4">

                {/* Page title */}
                <div>
                  <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Profil Saya
                  </h2>
                  <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    Informasi identitas akun Anda
                  </p>
                </div>

                {/* Card 1: Identity view */}
                <div className={`rounded-2xl border ${
                  theme === 'dark' ? 'bg-slate-800/70 border-slate-700/50' : 'bg-white border-gray-200 shadow-sm'
                }`}>
                  <div className="px-5 pt-5 pb-4 flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 ${
                      theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                    }`}>
                      {(currentUser?.full_name || currentUser?.username || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-base font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {currentUser?.full_name || currentUser?.username || '-'}
                      </p>
                      <p className={`text-sm truncate mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        {currentUser?.email || '-'}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
                        }`}>
                          @{currentUser?.username || '-'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          theme === 'dark' ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {currentUser?.role || 'Analis'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Aktif
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`border-t ${theme === 'dark' ? 'border-slate-700/40' : 'border-gray-100'}`}>
                    {[
                      { label: 'Username', value: `@${currentUser?.username || '-'}` },
                      { label: 'Email', value: currentUser?.email || '-' },
                      { label: 'Bergabung', value: currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-' },
                      { label: 'Percakapan', value: `${chats.length} sesi` },
                    ].map(({ label, value }, i, arr) => (
                      <div key={label} className={`px-5 py-3 flex items-center justify-between ${
                        i < arr.length - 1 ? theme === 'dark' ? 'border-b border-slate-700/40' : 'border-b border-gray-100' : ''
                      }`}>
                        <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{label}</span>
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 2: Edit form — nama, username, email */}
                <div className={`rounded-2xl border ${
                  theme === 'dark' ? 'bg-slate-800/70 border-slate-700/50' : 'bg-white border-gray-200 shadow-sm'
                }`}>
                  <div className="px-5 pt-5 pb-5">
                    <p className={`text-sm font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Edit Profil
                    </p>

                    {profileUpdateMsg.text && (
                      <div className={`mb-4 px-3 py-2.5 rounded-lg text-sm ${
                        profileUpdateMsg.type === 'success'
                          ? theme === 'dark' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-green-50 border border-green-200 text-green-700'
                          : theme === 'dark' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>
                        {profileUpdateMsg.text}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          Nama Lengkap
                        </label>
                        <input
                          type="text"
                          value={profileForm.fullName}
                          onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                          className={`w-full px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                            theme === 'dark'
                              ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                          placeholder="Masukkan nama lengkap"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          Username
                        </label>
                        <input
                          type="text"
                          value={profileForm.username}
                          onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                          className={`w-full px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                            theme === 'dark'
                              ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                          placeholder="Masukkan username"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          Email
                        </label>
                        <input
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          className={`w-full px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                            theme === 'dark'
                              ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                          placeholder="email@telkom.co.id"
                        />
                      </div>
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={handleUpdateProfile}
                          disabled={profileUpdateLoading}
                          className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {profileUpdateLoading
                            ? <><Loader className="w-3.5 h-3.5 animate-spin" />Menyimpan...</>
                            : 'Simpan Perubahan'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 flex flex-col items-center">
              <div className="w-full max-w-xl space-y-4">

                {/* Page header */}
                <div>
                  <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Pengaturan
                  </h2>
                  <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                    Preferensi tampilan dan keamanan akun
                  </p>
                </div>

                {/* Card: Tampilan */}
                <div className={`rounded-2xl border ${
                  theme === 'dark' ? 'bg-slate-800/70 border-slate-700/50' : 'bg-white border-gray-200 shadow-sm'
                }`}>
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        theme === 'dark' ? 'bg-slate-700' : 'bg-gray-100'
                      }`}>
                        {theme === 'dark'
                          ? <Moon className="w-4 h-4 text-blue-400" />
                          : <Sun className="w-4 h-4 text-amber-500" />}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {theme === 'dark' ? 'Tema Gelap' : 'Tema Terang'}
                        </p>
                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          Tampilan antarmuka aplikasi
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${
                        theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                        theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Card: Ubah Kata Sandi */}
                <div className={`rounded-2xl border ${
                  theme === 'dark' ? 'bg-slate-800/70 border-slate-700/50' : 'bg-white border-gray-200 shadow-sm'
                }`}>
                  <div className="px-5 pt-5 pb-5">
                    <p className={`text-sm font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      Ubah Kata Sandi
                    </p>

                    {passwordMsg.text && (
                      <div className={`mb-4 px-3 py-2.5 rounded-lg text-sm ${
                        passwordMsg.type === 'success'
                          ? theme === 'dark' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-green-50 border border-green-200 text-green-700'
                          : theme === 'dark' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>
                        {passwordMsg.text}
                      </div>
                    )}

                    <div className="space-y-3">
                      {/* Kata Sandi Lama */}
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          Kata Sandi Lama
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.current ? 'text' : 'password'}
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            className={`w-full px-3 py-2.5 pr-10 text-sm rounded-lg border transition-colors ${
                              theme === 'dark'
                                ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                            placeholder="Masukkan kata sandi lama"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Kata Sandi Baru */}
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                          Kata Sandi Baru
                          <span className={`ml-1 font-normal ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                            (min. 6 karakter, huruf besar + angka)
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.new ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            className={`w-full px-3 py-2.5 pr-10 text-sm rounded-lg border transition-colors ${
                              theme === 'dark'
                                ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                            placeholder="Masukkan kata sandi baru"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Konfirmasi Kata Sandi Baru */}
                      {(() => {
                        const mismatch = passwordForm.confirmPassword.length > 0 && passwordForm.confirmPassword !== passwordForm.newPassword;
                        return (
                          <div>
                            <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                              Konfirmasi Kata Sandi Baru
                            </label>
                            <div className="relative">
                              <input
                                type={showPasswords.confirm ? 'text' : 'password'}
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                className={`w-full px-3 py-2.5 pr-10 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 ${
                                  mismatch
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20 ' + (theme === 'dark' ? 'bg-slate-700/50 text-white placeholder-slate-500' : 'bg-gray-50 text-gray-900 placeholder-gray-400')
                                    : theme === 'dark'
                                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500/20'
                                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'
                                }`}
                                placeholder="Ulangi kata sandi baru"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
                                className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}`}
                              >
                                {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {mismatch && (
                              <p className="mt-1 text-xs text-red-500">Password tidak sesuai</p>
                            )}
                          </div>
                        );
                      })()}
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={handleChangePassword}
                          disabled={passwordLoading}
                          className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          {passwordLoading
                            ? <><Loader className="w-3.5 h-3.5 animate-spin" />Menyimpan...</>
                            : 'Ubah Kata Sandi'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card: Sesi */}
                <div className={`rounded-2xl border ${
                  theme === 'dark' ? 'bg-slate-800/70 border-slate-700/50' : 'bg-white border-gray-200 shadow-sm'
                }`}>
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Keluar dari Akun
                      </p>
                      <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                        Mengakhiri sesi aktif Anda
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('Apakah Anda yakin ingin keluar?')) {
                          authService.logout();
                          window.location.reload();
                        }
                      }}
                      className="text-sm font-semibold px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Keluar
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Segera Hadir
              </h2>
              <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
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
    <div className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg mb-2 ${
      theme === 'dark'
        ? 'bg-slate-800/40 border border-slate-700/40'
        : 'bg-gray-50/80 border border-gray-200/60'
    }`}>
      <Zap className={`w-3.5 h-3.5 shrink-0 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
      <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
        Powered by <span className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>BrightAI</span>
      </span>
    </div>
  );

  return (
    <div className={`min-h-screen ${
      theme === 'dark' 
        ? 'bg-slate-900 text-white' 
        : 'bg-gray-50 text-gray-900'
    } transition-colors duration-200`}>
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
          currentUser={currentUser}
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          sidebarOpen={sidebarOpen}
          showSidebarToggle={activeView === 'ai'}
        />
        
        <main className="pl-16 pt-14 min-h-screen h-screen flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
export default App;