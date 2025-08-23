// src/components/ChatHistory.jsx
import React, { useState, useEffect } from 'react';
import telkomApi from '../services/telkomApi';
import authService from '../services/authService';

const ChatHistory = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadChatData();
  }, []);

  const loadChatData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load chat history and stats in parallel
      const [historyResponse, statsResponse] = await Promise.all([
        telkomApi.getChatHistory(50, 0),
        telkomApi.getChatStats(30)
      ]);

      if (historyResponse.success) {
        setChatHistory(historyResponse.chat_history || []);
        
        // Group by sessions
        const sessionMap = {};
        historyResponse.chat_history.forEach(chat => {
          const sessionId = chat.SESSION_ID || 'default';
          if (!sessionMap[sessionId]) {
            sessionMap[sessionId] = {
              session_id: sessionId,
              messages: [],
              last_message: null,
              message_count: 0
            };
          }
          sessionMap[sessionId].messages.push(chat);
          sessionMap[sessionId].message_count++;
          if (!sessionMap[sessionId].last_message || 
              new Date(chat.CREATED_AT) > new Date(sessionMap[sessionId].last_message.CREATED_AT)) {
            sessionMap[sessionId].last_message = chat;
          }
        });

        setSessions(Object.values(sessionMap));
      }

      if (statsResponse.success) {
        setStats(statsResponse.stats);
      }

    } catch (err) {
      console.error('Error loading chat data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const response = await telkomApi.getChatSession(sessionId);
      if (response.success) {
        setSelectedSession({
          session_id: sessionId,
          messages: response.chat_session || []
        });
      }
    } catch (err) {
      console.error('Error loading session:', err);
      setError(err.message);
    }
  };

  const handleDeleteHistory = async (sessionId = null) => {
    try {
      const response = await telkomApi.deleteChatHistory(sessionId);
      if (response.success) {
        await loadChatData();
        setSelectedSession(null);
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
      } else {
        setError(response.error || 'Failed to delete chat history');
      }
    } catch (err) {
      console.error('Error deleting chat history:', err);
      setError(err.message);
    }
  };

  const confirmDelete = (sessionId = null) => {
    setDeleteTarget(sessionId);
    setShowDeleteConfirm(true);
  };

  const formatMessage = (message) => {
    if (typeof message === 'string') {
      return message;
    }
    if (typeof message === 'object') {
      return JSON.stringify(message, null, 2);
    }
    return String(message);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading chat history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-700">Error: {error}</div>
        <button 
          onClick={loadChatData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat History</h1>
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-blue-600 text-sm font-medium">Total Messages</div>
              <div className="text-2xl font-bold text-blue-900">{stats.TOTAL_MESSAGES || 0}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-green-600 text-sm font-medium">User Messages</div>
              <div className="text-2xl font-bold text-green-900">{stats.USER_MESSAGES || 0}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-purple-600 text-sm font-medium">AI Responses</div>
              <div className="text-2xl font-bold text-purple-900">{stats.ASSISTANT_MESSAGES || 0}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-yellow-600 text-sm font-medium">Sessions</div>
              <div className="text-2xl font-bold text-yellow-900">{stats.TOTAL_SESSIONS || 0}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Chat Sessions</h2>
              <button
                onClick={() => confirmDelete()}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Clear All
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="p-4 text-gray-500 text-center">No chat sessions found</div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                      selectedSession?.session_id === session.session_id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => loadSession(session.session_id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          Session {session.session_id.slice(-8)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {session.message_count} messages
                        </div>
                        {session.last_message && (
                          <div className="text-xs text-gray-400 mt-1">
                            {formatDate(session.last_message.CREATED_AT)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDelete(session.session_id);
                        }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedSession 
                  ? `Session: ${selectedSession.session_id.slice(-8)}` 
                  : 'Select a session to view messages'
                }
              </h2>
            </div>
            <div className="max-h-96 overflow-y-auto p-4">
              {!selectedSession ? (
                <div className="text-gray-500 text-center py-8">
                  Select a chat session from the left to view messages
                </div>
              ) : selectedSession.messages.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  No messages in this session
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedSession.messages.map((message, index) => (
                    <div key={index} className={`flex ${message.MESSAGE_TYPE === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.MESSAGE_TYPE === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <div className="text-sm">
                          {formatMessage(message.MESSAGE)}
                        </div>
                        <div className={`text-xs mt-1 ${
                          message.MESSAGE_TYPE === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatDate(message.CREATED_AT)}
                          {message.RULE_NAME && (
                            <span className="ml-2">• {message.RULE_NAME}</span>
                          )}
                          {message.CONFIDENCE && (
                            <span className="ml-2">• {message.CONFIDENCE}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Delete
            </h3>
            <p className="text-gray-600 mb-6">
              {deleteTarget 
                ? 'Are you sure you want to delete this chat session? This action cannot be undone.'
                : 'Are you sure you want to delete all chat history? This action cannot be undone.'
              }
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteHistory(deleteTarget)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHistory;