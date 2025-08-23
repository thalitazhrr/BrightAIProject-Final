// Login Component
import React, { useState } from 'react';
import { User, Lock, Mail, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import '../animations.css';

const Login = ({ onLogin, theme = 'dark' }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: ''
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin 
        ? { email: formData.email || formData.username, password: formData.password }
        : {
            username: formData.username,
            email: formData.email,
            password: formData.password,
            full_name: formData.fullName
          };

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },  
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (isLogin) {
          // Store token and user data
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          
          // Import and update authService
          const authService = (await import('../services/authService')).default;
          authService.token = data.token;
          authService.user = data.user;
          
          onLogin(data.user, data.token);
        } else {
          // Registration successful, switch to login
          setIsLogin(true);
          setFormData({ ...formData, password: '' });
          setError('Pendaftaran berhasil! Silakan masuk.');
        }
      } else {
        setError(data.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError('Tidak dapat terhubung ke server. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({
      username: '',
      email: '',
      password: '',
      fullName: ''
    });
  };

  // Blue color palette - consistent with main app
  const blueColors = [
    '#1E3A8A', '#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD',
    '#0EA5E9', '#0284C7', '#0369A1', '#075985'
  ];

  // Animation types for variety
  const animationTypes = ['float0', 'float1', 'float2', 'gentlePulse', 'drift', 'oceanWave'];
  
  // Star particle animations
  const starAnimations = ['starTwinkle', 'starPulse', 'starFloat', 'cosmicDance'];

  return (
    <div className={`min-h-screen flex items-center justify-center ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900' 
        : 'bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50'
    }`}>
      {/* Enhanced Animated Blue Background with Stars */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Floating blue orbs */}
        <div className="absolute inset-0">
          {Array.from({ length: 8 }, (_, i) => {
            // Fixed positions for consistent layout
            const positions = [
              { top: '10%', left: '15%' },
              { top: '25%', left: '85%' },
              { top: '70%', left: '10%' },
              { top: '45%', left: '80%' },
              { top: '85%', left: '70%' },
              { top: '20%', left: '50%' },
              { top: '75%', left: '30%' },
              { top: '60%', left: '90%' }
            ];
            
            const sizes = [250, 300, 180, 320, 200, 280, 220, 260];
            const animationType = animationTypes[i % animationTypes.length];
            
            return (
              <div
                key={i}
                className={`absolute rounded-full mix-blend-multiply filter blur-3xl ${
                  theme === 'dark' ? 'opacity-8' : 'opacity-12'
                }`}
                style={{
                  background: `radial-gradient(circle, ${blueColors[i % blueColors.length]}, transparent 70%)`,
                  width: `${sizes[i]}px`,
                  height: `${sizes[i]}px`,
                  top: positions[i].top,
                  left: positions[i].left,
                  animation: `${animationType} ${20 + (i * 3)}s ease-in-out infinite`,
                  animationDelay: `${i * 2.5}s`
                }}
              />
            );
          })}
        </div>
        
        {/* Twinkling star particles */}
        <div className="absolute inset-0">
          {Array.from({ length: 15 }, (_, i) => {
            // Random positions for stars
            const starPositions = [
              { top: '12%', left: '25%' }, { top: '35%', left: '75%' }, { top: '55%', left: '15%' },
              { top: '75%', left: '85%' }, { top: '22%', left: '65%' }, { top: '88%', left: '35%' },
              { top: '45%', left: '5%' }, { top: '65%', left: '95%' }, { top: '15%', left: '82%' },
              { top: '38%', left: '42%' }, { top: '82%', left: '58%' }, { top: '28%', left: '8%' },
              { top: '68%', left: '68%' }, { top: '52%', left: '28%' }, { top: '95%', left: '12%' }
            ];
            
            const starSizes = ['star-small', 'star-medium', 'star-large'];
            const starSize = starSizes[i % 3];
            const starAnimation = starAnimations[i % starAnimations.length];
            const position = starPositions[i % starPositions.length];
            
            return (
              <div
                key={`login-star-${i}`}
                className={`absolute star-particle ${starSize} ${
                  theme === 'dark' ? 'opacity-70' : 'opacity-50'
                }`}
                style={{
                  top: position.top,
                  left: position.left,
                  animation: `${starAnimation} ${4 + (i * 0.4)}s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                  background: theme === 'dark' 
                    ? 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(147, 197, 253, 0.6) 50%, transparent 100%)'
                    : 'radial-gradient(circle, rgba(59, 130, 246, 0.7) 0%, rgba(147, 197, 253, 0.5) 50%, transparent 100%)'
                }}
              />
            );
          })}
        </div>
        
        {/* Cosmic glow effects */}
        <div className="absolute inset-0">
          {Array.from({ length: 4 }, (_, i) => {
            const glowPositions = [
              { top: '30%', left: '20%' }, { top: '70%', left: '80%' },
              { top: '20%', left: '75%' }, { top: '80%', left: '25%' }
            ];
            
            const glowSizes = [100, 130, 110, 120];
            const position = glowPositions[i % glowPositions.length];
            
            return (
              <div
                key={`login-glow-${i}`}
                className={`absolute cosmic-glow ${
                  theme === 'dark' ? 'opacity-15' : 'opacity-10'
                }`}
                style={{
                  top: position.top,
                  left: position.left,
                  width: `${glowSizes[i]}px`,
                  height: `${glowSizes[i]}px`,
                  animation: `starGlow ${10 + (i * 2)}s ease-in-out infinite`,
                  animationDelay: `${i * 1.5}s`
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Login Card */}
      <div className={`relative z-10 w-full max-w-md p-8 ${
        theme === 'dark' ? 'bg-slate-800/60' : 'bg-white/60'
      } backdrop-blur-xl rounded-2xl border ${
        theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200/50'
      } shadow-2xl`}>
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' 
              ? 'bg-gradient-to-r from-blue-600 to-sky-600' 
              : 'bg-gradient-to-r from-blue-500 to-sky-500'
          } rounded-2xl flex items-center justify-center`}>
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Telkom HSI BrightAI
          </h1>
          <p className={`text-sm mt-2 ${
            theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
          }`}>
            {isLogin ? 'Masuk ke akun Anda' : 'Buat akun baru'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-4 p-3 rounded-lg ${
            error.includes('successful') 
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email for login, Username for registration */}
          {isLogin ? (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
              }`}>
                Email
              </label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                }`} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className={`w-full pl-11 pr-4 py-3 ${
                    theme === 'dark' 
                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                      : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                  } border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                  placeholder="Masukkan email Anda"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
              }`}>
                Username
              </label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                }`} />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className={`w-full pl-11 pr-4 py-3 ${
                    theme === 'dark' 
                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                      : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                  } border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                  placeholder="Masukkan username"
                />
              </div>
            </div>
          )}

          {/* Email (only for registration) */}
          {!isLogin && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
              }`}>
                Email
              </label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                }`} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required={!isLogin}
                  className={`w-full pl-11 pr-4 py-3 ${
                    theme === 'dark' 
                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                      : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                  } border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                  placeholder="Masukkan email Anda"
                />
              </div>
            </div>
          )}

          {/* Full Name (only for registration) */}
          {!isLogin && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
              }`}>
                Nama Lengkap
              </label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
                }`} />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={`w-full pl-11 pr-4 py-3 ${
                    theme === 'dark' 
                      ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                      : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                  } border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                  placeholder="Masukkan nama lengkap Anda"
                />
              </div>
            </div>
          )}


          {/* Password */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-gray-700'
            }`}>
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                theme === 'dark' ? 'text-slate-400' : 'text-gray-400'
              }`} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className={`w-full pl-11 pr-11 py-3 ${
                  theme === 'dark' 
                    ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400' 
                    : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
                } border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
                placeholder="Masukkan kata sandi Anda"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                  theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
                } transition-colors`}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600'
            } text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                <span>{isLogin ? 'Masuk' : 'Daftar'}</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle Auth Mode */}
        <div className="mt-6 text-center">
          <p className={`text-sm ${
            theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
          }`}>
            {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}
            <button
              onClick={toggleAuthMode}
              className={`ml-2 font-medium ${
                theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              } transition-colors`}
            >
              {isLogin ? 'Daftar' : 'Masuk'}
            </button>
          </p>
        </div>

        {/* Demo Info */}
        {isLogin && (
          <div className={`mt-4 p-3 rounded-lg ${
            theme === 'dark' ? 'bg-slate-700/50' : 'bg-gray-100/50'
          }`}>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-slate-400' : 'text-gray-600'
            }`}>
              Akun demo tersedia. Hubungi administrator untuk kredensial.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;