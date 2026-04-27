#!/bin/bash

echo "Starting BrightAI Platform..."
echo "================================================"

mkdir -p logs

# ── ML Service (Python) ───────────────────────────────────────────────────────
echo "🤖 Starting ML Service (port 8000)..."
if lsof -i :8000 >/dev/null 2>&1; then
    echo "   ML Service already running on port 8000"
else
    cd ml-service
    if [ ! -d ".venv" ]; then
        echo "   Creating Python venv & installing deps (first time)..."
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -r requirements.txt -q
    else
        source .venv/bin/activate
    fi
    .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 > ../logs/ml-service.log 2>&1 &
    ML_PID=$!
    echo "   ML Service PID: $ML_PID"
    cd ..
    sleep 3
fi

# ── Backend (Node.js) ─────────────────────────────────────────────────────────
echo "🖥️  Starting Backend (port 3001)..."
if lsof -i :3001 >/dev/null 2>&1; then
    echo "   Backend already running on port 3001"
else
    cd backend
    npm start > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"
    cd ..
    sleep 3
fi

# ── Frontend (React) ──────────────────────────────────────────────────────────
echo "🌐 Starting Frontend (port 3000)..."
if lsof -i :3000 >/dev/null 2>&1; then
    echo "   Frontend already running on port 3000"
else
    cd frontend
    npm start > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "   Frontend PID: $FRONTEND_PID"
    cd ..
fi

echo ""
echo "================================================"
echo "✅ BrightAI Platform Running:"
echo "   Frontend  : http://localhost:3000"
echo "   Backend   : http://localhost:3001"
echo "   ML Service: http://localhost:8000/docs"
echo ""
echo "📋 Login: admin / admin123"
echo ""
echo "📊 Untuk evaluasi forecasting:"
echo "   1. Buka http://localhost:8000/docs"
echo "   2. POST /forecast/train  → training model"
echo "   3. POST /forecast/predict → lihat hasil + KPI"
echo "================================================"
echo "Logs ada di folder logs/"
echo "Tekan Ctrl+C untuk stop semua"
echo ""

wait
