# 🚀 Telkom HSI BrightAI Platform

**AI-Powered HSI Analytics & Intelligence Dashboard untuk Telkom**

## 📋 Overview

Platform **BrightAI** adalah solusi analytics dan intelligence untuk manajemen HSI (High Speed Internet) Telkom yang menggabungkan:

- **📊 Real-time Dashboard** - Monitoring performa HSI
- **🤖 AI Assistant** - Analisis data dengan natural language  
- **🔐 Secure Authentication** - Bcrypt + JWT authentication
- **⚡ Optimized Performance** - Fast response dengan database integration

---

## ✨ Fitur Utama

### 🏢 BrightInsight Dashboard
- Overview statistics (total orders, completion rate, regional coverage)
- Regional performance analysis dengan completion rate
- Package analytics dan trending paket IndiHome
- Real-time charts dan visualisasi data

### 🤖 BrightAI Assistant  
- Natural language chat dalam bahasa Indonesia
- Smart analytics dan insight otomatis dari data HSI
- Contextual responses berdasarkan data real-time
- Multi-session chat support dengan database

### 🔒 Security Features
- Bcrypt password hashing (12-round salted)
- Environment variables untuk JWT secrets
- Token-based authentication dengan secure expiry
- Input validation dan error handling

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **PostgreSQL** (optional, untuk fitur database)

### 1. Clone & Install
```bash
git clone <repository-url>
cd BrightAIProject
npm run install-all
```

### 2. Setup Environment
```bash
# Backend
cd backend
cp .env.example .env
# Edit .env dengan konfigurasi database Anda

# Frontend  
cd ../frontend
cp .env.example .env
cd ..
```

### 3. Jalankan Aplikasi
```bash
# Start both servers
npm run dev
```

### 4. Akses Aplikasi
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

---

## 🔑 Default Login

```
👤 Admin Account:
   Username: admin
   Password: admin123
```

**⚠️ Ganti credentials ini di production!**

---

## 📁 Struktur Project

```
BrightAIProject/
├── README.md
├── package.json
├── backend/                 # Express.js API Server
│   ├── .env                # Environment variables
│   ├── server.js           # Main server file
│   └── src/
│       ├── config/         # Database config
│       ├── models/         # Data models (User, Chat)
│       └── middleware/     # Authentication middleware
│
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── App.jsx        # Main component
│   │   ├── components/    # UI components
│   │   └── services/      # API services
│   └── public/
│
└── data/                  # Sample HSI data
    └── SALES_ORDER.xlsx
```

---

## ⚙️ Environment Variables

### Backend (.env)
```bash
# Security
JWT_SECRET=your-super-secret-jwt-key-here

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telkom_brightai_db
DB_USER=postgres
=your-db-password

# Server
PORT=3001
NODE_ENV=development
```

### Frontend (.env)
```bash
REACT_APP_API_URL=http://localhost:3001
PORT=3000
```

---

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Token verification

### Dashboard
- `GET /api/telkom/dashboard/data` - Dashboard data
- `GET /api/telkom/health` - Health check

### AI Chat
- `POST /api/ai/chat` - Send message to AI
- `GET /api/chats` - Get user chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id/messages` - Get chat messages
- `POST /api/chats/:id/messages` - Add message

---

## 🐛 Troubleshooting

### Common Issues

**❌ "JWT_SECRET not configured"**
```bash
cd backend
echo 'JWT_SECRET=your-secret-key-here' >> .env
```

**❌ Database connection failed**
- Pastikan PostgreSQL berjalan
- Cek credentials di `.env` file
- Server tetap akan jalan tanpa database (mode fallback)

**❌ "Network Error" di frontend**
```bash
# Pastikan backend berjalan
curl http://localhost:3001/health
```

**❌ Port sudah digunakan**
```bash
# Hentikan proses yang ada
pkill -f "node.*server"
# Atau ganti port di .env
```

---

## 📚 Development Commands

### Root Commands
```bash
npm run dev            # Start both servers  
npm run install-all    # Install all dependencies
npm run backend        # Start backend only
npm run frontend       # Start frontend only
```

### Backend Commands
```bash
npm start              # Start production server
npm run dev            # Start dengan nodemon
```

### Frontend Commands  
```bash
npm start              # Start development server
npm run build          # Build for production
```

---

## 🔄 Database Setup (Optional)

Jika ingin menggunakan database PostgreSQL:

### 1. Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
```

### 2. Create Database
```sql
CREATE DATABASE telkom_brightai_db;
CREATE USER postgres WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE telkom_brightai_db TO postgres;
```

### 3. Update Environment
```bash
# Update backend/.env dengan credentials database Anda
DB_HOST=localhost
DB_PORT=5432
DB_NAME=telkom_brightai_db  
DB_USER=postgres
DB_PASSWORD=your-password
```

**💡 Note**: Aplikasi akan otomatis membuat tabel yang diperlukan saat startup.

---

## 🛡️ Security Notes

1. **Environment Variables**: Jangan commit file `.env` ke repository
2. **Production**: Ganti semua default passwords dan secrets
3. **Database**: Gunakan credentials yang kuat untuk database
4. **JWT**: Set expiry time yang sesuai dengan kebutuhan

---

## 📞 Support

Untuk issue atau pertanyaan:
- Buka GitHub Issues di repository ini
- Contact: HSI Development Team

---

*AI-Powered HSI Analytics Platform untuk Telkom Indonesia*