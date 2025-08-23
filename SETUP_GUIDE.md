# BrightAI Project - Setup Guide

## 📋 Prerequisites

- Node.js 16+ and npm
- Oracle Database access (DWHNAS & DADBS)
- Git

## 🚀 Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd BrightAIProject-Final
```

### 2. Backend Setup

```bash
cd backend
npm install
```

**Environment Configuration:**
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your database credentials
nano .env
```

**Required Environment Variables:**
```env
# Server Configuration
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-here-min-32-chars

# Database Configuration - DWHNAS
ORACLE_DWHNAS_HOST=10.60.180.19
ORACLE_DWHNAS_PORT=1525
ORACLE_DWHNAS_DATABASE=DWHNAS
ORACLE_DWHNAS_USER=dwh_mois
ORACLE_DWHNAS_PASSWORD=your_password_here

# Database Configuration - DADBS
ORACLE_DADBS_HOST=10.62.165.144
ORACLE_DADBS_PORT=1521
ORACLE_DADBS_DATABASE=DADBS
ORACLE_DADBS_USER=pmsdbs
ORACLE_DADBS_PASSWORD=your_password_here
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

**Environment Configuration:**
```bash
# Create .env file
nano .env
```

```env
REACT_APP_API_URL=http://localhost:3001
```

### 4. Database Setup

**Execute DDL Scripts in Oracle:**

1. Connect to Oracle as appropriate user
2. Run the following scripts in order:

```sql
-- 1. Create sequences
CREATE SEQUENCE SEQ_BRIGHTAI_USER START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE SEQ_BRIGHTAI_CHAT START WITH 1 INCREMENT BY 1;

-- 2. Create tables (run the DDL scripts provided earlier)
-- 3. Create triggers
-- 4. Create indexes
```

### 5. Start Applications

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm start
```

## 🏗️ Project Structure

```
BrightAIProject-Final/
├── backend/
│   ├── config/          # Database configuration
│   ├── src/
│   │   ├── controllers/ # Request handlers
│   │   ├── models/      # Database models
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Auth, validation, etc.
│   │   ├── rules/       # AI rule engine
│   │   └── utils/       # Utilities
│   ├── .env.example     # Environment template
│   └── server.js        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   └── services/    # API services
│   └── public/
└── SETUP_GUIDE.md
```

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting
- Input validation
- SQL injection protection
- Environment variable encryption support

## 🗄️ Database Tables

- **BRIGHTAI_USER**: User management
- **BRIGHTAI_CHAT**: Chat messages
- **BRIGHTAI_SESSION**: Chat sessions
- **BRIGHTAI_RULES**: AI response rules

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `GET /api/auth/verify` - Verify token

### Chat
- `POST /api/chat/message` - Send chat message
- `GET /api/chat/history` - Get chat history
- `GET /api/chat/session/:id` - Get chat session
- `GET /api/chat/stats` - Get chat statistics
- `DELETE /api/chat/history` - Delete chat history

## 🧪 Testing

**Test Database Connection:**
```bash
cd backend
node test-env.js
```

**Test API:**
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Send Chat Message
curl -X POST http://localhost:3001/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"message":"Hello","userId":1}'
```

## 🔧 Troubleshooting

### Database Connection Issues
1. Check Oracle service is running
2. Verify credentials in `.env`
3. Test connectivity: `tnsping <connect_string>`

### Authentication Issues
1. Verify JWT_SECRET is set
2. Check token expiration
3. Confirm user exists in database

### Frontend Connection Issues
1. Check `REACT_APP_API_URL` in frontend `.env`
2. Verify backend is running on correct port
3. Check CORS settings

## 📝 Development Notes

- Backend runs on port 3001
- Frontend runs on port 3000  
- Database changes require restart
- JWT tokens expire in 24h by default
- Rule engine auto-loads on startup

## 🎯 Next Steps

1. Set up database connections
2. Create first user account
3. Test chat functionality
4. Configure rules for specific use cases
5. Deploy to production environment

## 📞 Support

For issues or questions, check:
1. Console logs (browser/server)
2. Database connectivity
3. Environment variable setup
4. API endpoint responses