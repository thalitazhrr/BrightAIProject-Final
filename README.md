# BrightAI — Business Intelligence Chatbot

**Rule-based BI Chatbot with Natural Language Generation & Time Series Forecasting**

## Overview

BrightAI is a Business Intelligence system built as an interactive chatbot that allows internal users to query enterprise data using natural Indonesian language. The system combines:

- **🤖 Rule-Based Chatbot** — 30+ analytic rules across 5 business data domains
- **📊 Natural Language Generation** — Template-based NLG that converts SQL results into Indonesian narrative
- **📈 Time Series Forecasting** — GRU & LSTM deep learning models for business metric prediction
- **🔐 Secure Authentication** — JWT + bcrypt with rate limiting and security middleware

---

## Architecture

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   Frontend   │────▶│     Backend       │────▶│   ML Service     │
│  React.js    │◀────│  Node.js/Express  │◀────│  FastAPI/PyTorch  │
│  :3000       │     │  :3001            │     │  :8000           │
└──────────────┘     └────────┬──────────┘     └────────┬─────────┘
                              │                         │
                              ▼                         ▼
                     ┌────────────────────────────────────────────┐
                     │           Oracle Database (DWH)            │
                     │  User data · Chat history · Analytics data │
                     └────────────────────────────────────────────┘
```

**Three-tier architecture:**

| Layer | Technology | Port | Role |
|-------|-----------|------|------|
| Frontend | React.js 18, Tailwind CSS | 3000 | Chat UI, Forecast Panel, Guided Flow |
| Backend | Node.js, Express.js | 3001 | Rule engine, Intent classification, NLG, Auth |
| ML Service | Python, FastAPI, PyTorch | 8000 | GRU/LSTM training & inference |

---

## Project Structure

```
BrightAIProject-Final/
├── README.md
│
├── backend/                        # Node.js/Express API Server
│   ├── server.js                   # Entry point: Express init, middleware, routes
│   ├── config/
│   │   └── database.js             # Oracle connection pool & query executor
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js   # Register, login, profile management
│   │   │   └── chatController.js   # Chat message handling & rule dispatch
│   │   ├── models/                 # User, ChatHistory, Session models
│   │   ├── routes/
│   │   │   ├── authRoutes.js       # /api/auth/*
│   │   │   ├── chatRoutes.js       # /api/chat/*
│   │   │   ├── forecastRoutes.js   # /api/forecast/* (proxy to ML)
│   │   │   └── sessionRoutes.js    # /api/sessions/*
│   │   ├── rules/
│   │   │   ├── engine/
│   │   │   │   ├── ruleEngine.js         # Core rule execution & geo-filter injection
│   │   │   │   ├── queryProcessor.js     # Rule matching & keyword scoring
│   │   │   │   ├── intentClassifier.js   # Weighted keyword intent classification
│   │   │   │   ├── responseBuilder.js    # Response formatting
│   │   │   │   ├── nlgGenerator.js       # NLG orchestration
│   │   │   │   └── templateLibrary.js    # Response templates per intent
│   │   │   ├── databases/               # Rule definitions per domain
│   │   │   └── config/                  # Rule registry & table mappings
│   │   ├── middleware/             # JWT auth middleware
│   │   └── utils/                  # Logger, cache, helpers
│   └── package.json
│
├── ml-service/                     # Python FastAPI ML Microservice
│   ├── main.py                     # FastAPI app, CORS, lifespan
│   ├── config.py                   # Oracle credentials, hyperparameters, paths
│   ├── routers/
│   │   └── forecast.py             # Train & predict API endpoints
│   ├── models/
│   │   ├── gru_model.py            # GRU architecture (torch.nn.Module)
│   │   └── lstm_model.py           # LSTM architecture (torch.nn.Module)
│   ├── training/
│   │   └── trainer.py              # Walk-forward validation, auto-tune, benchmarking
│   ├── inference/
│   │   └── predictor.py            # Real-time prediction pipeline
│   ├── utils/
│   │   ├── preprocessing.py        # MinMaxScaler, sliding window, data split
│   │   └── metrics.py              # MAE, RMSE, sMAPE, MASE, Skill Score
│   ├── saved_models/               # Trained .pth models & .pkl scalers
│   └── requirements.txt
│
├── frontend/                       # React.js Frontend
│   ├── src/
│   │   ├── App.jsx                 # Main app: chat, auth, navigation
│   │   ├── components/
│   │   │   ├── Login.jsx           # Auth: login & registration
│   │   │   ├── ChatHistory.jsx     # Session list, search, delete
│   │   │   ├── ForecastPanel.jsx   # Forecast: metric/model/region selection
│   │   │   └── GuidedFlow.jsx      # Step-by-step guided analytics
│   │   ├── services/               # API client (axios)
│   │   └── utils/                  # Helpers
│   └── package.json
│
└── LaporanTA_18222023/             # Thesis Report (LaTeX)
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 16
- **Python** ≥ 3.9
- **Oracle Database** (with DWH schema access)

### 1. Backend

```bash
cd backend
cp .env.example .env    # Configure Oracle DB credentials & JWT secret
npm install
npm start               # Starts on :3001
```

**Required `.env` variables:**
```env
PORT=3001
JWT_SECRET=your-secret-key
ORACLE_USER=your_user
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=your_host:1521/your_service
```

### 2. ML Service

```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm start               # Starts on :3000
```

### 4. Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| ML Service (Swagger) | http://localhost:8000/docs |
| Health Check | http://localhost:3001/api/telkom/health |

---

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login & receive JWT token |
| GET | `/api/auth/profile` | Get user profile (auth required) |
| PUT | `/api/auth/profile` | Update user profile |
| PUT | `/api/auth/password` | Change password |

### Chat (`/api/chat`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/message` | Send message to chatbot |
| GET | `/api/chat/history` | Get conversation history |
| GET | `/api/chat/session/:id` | Get messages in a session |
| DELETE | `/api/chat/history` | Clear chat history |
| GET | `/api/chat/capabilities` | List available rules & capabilities |

### Sessions (`/api/sessions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all chat sessions |

### Forecast (`/api/forecast`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/forecast/*` | Proxy to ML Service (train/predict) |

### ML Service Direct (`localhost:8000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/forecast/train` | Train a GRU/LSTM model |
| POST | `/forecast/predict` | Run prediction with saved model |
| GET | `/forecast/models` | List available trained models |
| GET | `/health` | ML service health check |

---

## Key Features

### Rule Engine
- 30+ analytic rules across 5 domains: **Sales**, **Revenue**, **Target**, **Customer Data (Dapros)**, **Churn (CT0)**
- Dynamic geographic filter injection (regional & witel)
- MD5-based query result caching (30 min TTL)

### Intent Classification
- 7 intents: `quantity`, `trend`, `comparison`, `location`, `reason`, `performance`, `detail`
- 8 focus areas: `order`, `revenue`, `churn`, `fulfillment`, `subscriber`, `bundling`, `digital`, `target`
- Sub-millisecond classification latency

### NLG (Natural Language Generation)
- Template-based responses in Indonesian Markdown
- 3+ template variations per intent to avoid monotony
- 100% factual accuracy (all numbers from DB, no hallucination)

### Time Series Forecasting
- **Models**: GRU, LSTM (2-layer stacked, hidden_size=64, dropout=0.2)
- **Training**: Walk-forward validation, early stopping, auto-tune window size
- **Evaluation**: MAE, RMSE, sMAPE, MASE, Skill Score with KPI thresholds
- **Benchmarking**: New model only saved if it beats the previous best

---

## Security

- **Helmet** — HTTP security headers
- **CORS** — Configurable cross-origin policy
- **Rate Limiter** — 100 requests / 15 min per IP
- **JWT** — 24h token expiry, issuer validation
- **bcrypt** — 10 salt rounds for password hashing
- **Input Validation** — `express-validator` on all auth endpoints

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React.js 18, Tailwind CSS |
| Backend | Node.js, Express.js |
| ML Service | Python, FastAPI, PyTorch |
| Database | Oracle Database (DWH) |
| Auth | JWT, bcrypt |
| DB Driver | node-oracledb, oracledb (Python) |
| Data Processing | Pandas, NumPy, Scikit-learn |

---

## Troubleshooting

**Oracle Thick mode warning**
```
This is normal if Oracle Instant Client is not installed locally.
The app falls back to Thin mode automatically.
```

**Port already in use**
```bash
# Find and kill the process
lsof -i :3001    # or :8000, :3000
kill -9 <PID>
```

**ML Service can't connect to Oracle**
```bash
# Ensure Oracle DB credentials are set in ml-service/config.py
# or via environment variables
```

---

*BrightAI — Business Intelligence Chatbot Platform*