// Login Component
import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, LogIn, UserPlus, User, Target } from 'lucide-react';

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
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (isLogin) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          const authService = (await import('../services/authService')).default;
          authService.token = data.token;
          authService.user = data.user;
          onLogin(data.user, data.token);
        } else {
          setIsLogin(true);
          setFormData({ username: '', email: '', password: '', fullName: '' });
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
    setFormData({ username: '', email: '', password: '', fullName: '' });
  };

  const isSuccess = error.includes('berhasil');

  return (
    <div className={`min-h-screen flex ${
      theme === 'dark'
        ? 'bg-slate-900'
        : 'bg-gray-50'
    }`}>
      {/* Left Panel - Branding with building photo */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 relative overflow-hidden"
        style={{
          backgroundImage: `url('/images/telkom-building.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Blue overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/85 via-blue-800/70 to-slate-900/90" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Target className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Telkom HSI BrightAI</span>
        </div>

        {/* Center Content */}
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white mb-4 leading-snug">
            Platform Analisis &<br />Intelijensi Bisnis
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed mb-8">
            Dapatkan wawasan mendalam dari data HSI Telkom dengan kecerdasan buatan yang canggih.
          </p>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              'Analisis data real-time dari 5 database',
              'AI yang memahami konteks bisnis Telkom',
              'Laporan interaktif dan visualisasi data',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-blue-100 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-blue-200/60 text-xs">
          &copy; {new Date().getFullYear()} Telkom Indonesia. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'
          }`}>
            <Target className="w-5 h-5 text-white" />
          </div>
          <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Welcome to BrightAI
          </span>
        </div>

        <div className="w-full max-w-sm">
          {/* Form Header */}
          <div className="mb-7">
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {isLogin ? 'Masuk ke Akun' : 'Buat Akun Baru'}
            </h1>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              {isLogin
                ? 'Masukkan email dan kata sandi Anda'
                : 'Isi formulir di bawah untuk mendaftar'}
            </p>
          </div>

          {/* Error/Success Message */}
          {error && (
            <div className={`mb-5 px-4 py-3 rounded-xl text-sm ${
              isSuccess
                ? theme === 'dark'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-green-50 border border-green-200 text-green-700'
                : theme === 'dark'
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Login: Email only | Register: Username + Email + Full Name */}
            {isLogin ? (
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Email
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border ${
                      theme === 'dark'
                        ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors`}
                    placeholder="email@telkom.co.id"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Username
                  </label>
                  <div className="relative">
                    <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border ${
                        theme === 'dark'
                          ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors`}
                      placeholder="username"
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Email
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border ${
                        theme === 'dark'
                          ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors`}
                      placeholder="email@telkom.co.id"
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border ${
                        theme === 'dark'
                          ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors`}
                      placeholder="Nama Lengkap"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  Kata Sandi
                </label>
                {!isLogin && (
                  <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                    Min. 6 karakter, huruf besar + angka
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className={`w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border ${
                    theme === 'dark'
                      ? 'bg-slate-800/60 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${
                    theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
                  } transition-colors`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 mt-2 ${
                loading
                  ? theme === 'dark' ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {isLogin ? 'Masuk' : 'Daftar'}
                </>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <p className={`text-center text-sm mt-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
            {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}
            {' '}
            <button
              onClick={toggleAuthMode}
              className={`font-medium ${
                theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              } transition-colors`}
            >
              {isLogin ? 'Daftar sekarang' : 'Masuk'}
            </button>
          </p>

          {/* Demo Note */}
          {isLogin && (
            <p className={`text-center text-xs mt-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`}>
              Hubungi administrator untuk informasi akun demo
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
