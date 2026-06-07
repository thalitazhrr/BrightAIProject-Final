# BrightAI Project Final - Detailed Directory Structure

## Project Overview
BrightAI adalah aplikasi chatbot cerdas berbasis web yang telah disederhanakan untuk fokus pada fungsionalitas chatbot dengan fitur login, register, profile, dan settings. Aplikasi ini menggunakan PostgreSQL database dan arsitektur frontend-backend terpisah.

## Root Directory Structure

```
BrightAIProjectFinal/
├── .git/                        # Git repository files
├── .gitignore                   # Git ignore rules
├── DASHBOARD_IMPROVEMENTS.md    # Documentation for dashboard improvements
├── README.md                    # Project main documentation
├── backend.log                  # Backend server logs
├── package.json                 # Root package.json for development scripts
├── package-lock.json            # Lock file for root dependencies
├── start-dev.js                 # Development server starter script
├── start.sh                     # Shell script to start the application
├── test-chat-api.js             # API testing script for chat functionality
├── test-indonesian-chatbot.js   # Indonesian chatbot testing script
├── backend/                     # Backend Node.js application
├── frontend/                    # Frontend React application
└── data/                        # Data files and datasets
```

## Backend Structure (`./backend/`)

```
backend/
├── package.json                 # Backend dependencies and scripts
├── package-lock.json            # Backend dependency lock file
├── server.js                    # Main server entry point
├── server-backup.js             # Backup of original server file
├── server-original.js           # Original server configuration
├── server.log                   # Server operation logs
├── .env                         # Environment variables (database config, JWT secret)
├── scripts/                     # Utility scripts
│   └── importTelkomData.js      # Data import script for Telkom data
└── src/                         # Source code directory
    ├── config/                  # Configuration files
    │   └── database.js          # PostgreSQL database configuration
    ├── controllers/             # Request handlers
    │   ├── aiController.js      # AI chat functionality controller
    │   ├── authController.js    # Authentication controller
    │   └── chatController.js    # Chat management controller
    ├── middleware/              # Express middleware
    │   ├── aiMiddleware.js      # AI processing middleware
    │   └── rateLimiter.js       # Rate limiting middleware
    ├── models/                  # Database models
    │   ├── chatModel.js         # Chat and message data models
    │   ├── hsiModel.js          # HSI data model (simplified)
    │   ├── hsiModel.js.bak      # Backup of HSI model
    │   ├── telkomOrderModel.js  # Telkom order data model
    │   └── userModel.js         # User authentication model
    ├── routes/                  # API route definitions
    │   ├── aiRoutes.js          # AI chat routes
    │   ├── authRoutes.js        # Authentication routes
    │   ├── chatRoutes.js        # Chat management routes
    │   └── telkomRoutes.js      # Simplified Telkom routes
    └── utils/                   # Utility functions
        ├── aiIntelligence.js    # AI processing utilities
        ├── deepColumnIntelligence.js # Data analysis utilities
        └── responseTemplates.js # Response formatting templates
```

## Frontend Structure (`./frontend/`)

```
frontend/
├── package.json                 # Frontend dependencies and scripts
├── package-lock.json            # Frontend dependency lock file
├── postcss.config.js            # PostCSS configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── .env                         # Frontend environment variables
├── frontend.log                 # Frontend operation logs
├── test-scroll.html             # UI testing file
├── public/                      # Static public files
│   ├── index.html               # Main HTML template
│   ├── favicon.ico              # Application favicon
│   ├── manifest.json            # PWA manifest
│   └── service-worker.js        # Service worker for PWA
├── build/                       # Production build output (generated)
└── src/                         # Source code directory
    ├── index.js                 # React application entry point
    ├── index.css                # Global CSS styles
    ├── App.jsx                  # Main application component (simplified)
    ├── animations.css           # Animation styles for UI
    ├── components/              # React components
    │   └── Login.jsx            # Login/Register component
    ├── services/                # API service functions
    │   ├── authService.js       # Authentication service
    │   └── telkomApi.js         # API communication service
    └── utils/                   # Utility functions
        └── markdownParser.js    # Markdown to JSX parser
```

## Data Directory (`./data/`)

```
data/
└── SALES_ORDER.xlsx             # Sample sales order data for testing
```

## Key Features

### Current Application Features (Simplified)
1. **Authentication System**
   - Login/Register functionality
   - JWT token-based authentication
   - User profile management

2. **BrightAI Chatbot**
   - Interactive chat interface
   - Chat history management
   - Message persistence in database
   - Real-time chat functionality

3. **User Management**
   - Profile page for user information
   - Settings page for preferences
   - Account security management

4. **Database Integration**
   - PostgreSQL database
   - User data storage
   - Chat message storage
   - Session management

### Technology Stack

**Backend:**
- Node.js with Express.js
- PostgreSQL database
- JWT authentication
- bcrypt for password hashing
- CORS for cross-origin requests
- Rate limiting and security middleware

**Frontend:**
- React.js 18
- Tailwind CSS for styling
- Lucide React for icons
- Responsive design
- PWA capabilities

## Environment Configuration

### Backend Environment Variables (`.env`)
```
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=brightai_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Frontend Environment Variables (`.env`)
```
REACT_APP_API_URL=http://localhost:3001
```

## API Endpoints

### Authentication Routes (`/api/auth/`)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Token verification
- `PUT /api/auth/profile` - Update user profile

### Chat Routes (`/api/chats/`)
- `GET /api/chats` - Get user chat history
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id/messages` - Get chat messages
- `POST /api/chats/:id/messages` - Add message to chat
- `DELETE /api/chats/:id` - Delete chat

### AI Routes (`/api/ai/`)
- `POST /api/ai/chat` - Send message to AI chatbot

### Health Check Routes
- `GET /health` - Application health check
- `GET /api/telkom/health` - API health check

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `username` (VARCHAR, Unique)
- `email` (VARCHAR, Unique)
- `password_hash` (VARCHAR)
- `full_name` (VARCHAR)
- `department` (VARCHAR)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Chats Table
- `id` (VARCHAR, Primary Key)
- `user_id` (UUID, Foreign Key)
- `title` (VARCHAR)
- `last_message` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Messages Table
- `id` (UUID, Primary Key)
- `chat_id` (VARCHAR, Foreign Key)
- `user_id` (UUID, Foreign Key)
- `message` (TEXT)
- `is_bot` (BOOLEAN)
- `created_at` (TIMESTAMP)

## Development Commands

### Root Directory
```bash
npm run dev          # Start both frontend and backend
npm run start:backend # Start only backend
npm run start:frontend # Start only frontend
```

### Backend Commands
```bash
cd backend
npm start           # Start production server
npm run dev         # Start development server with nodemon
npm run import      # Run data import script
```

### Frontend Commands
```bash
cd frontend
npm start           # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Run ESLint
npm run format      # Format code with Prettier
```

## Recent Changes (Simplification)

The application has been simplified from a complex dashboard system to focus purely on chatbot functionality:

1. **Removed Features:**
   - Dashboard analytics
   - HSI (Health Service Index) specific features
   - Complex data visualization
   - Regional/Witel comparison charts
   - Predictive analytics

2. **Kept Features:**
   - User authentication (login/register)
   - BrightAI chatbot interface
   - User profile management
   - Settings page
   - Chat history and management

3. **Updated Components:**
   - Simplified navigation (3 items: AI, Profile, Settings)
   - Streamlined API endpoints
   - Focused database schema
   - Cleaner UI/UX design

This simplified structure makes the application more focused, maintainable, and easier to understand while preserving the core chatbot functionality.