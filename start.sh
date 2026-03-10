#!/bin/bash

echo "Starting Telkom HSI BrightAI Application..."
echo "================================================"

# Function to check if port is in use
check_port() {
    if lsof -i :$1 >/dev/null 2>&1; then
        echo "✅ Port $1 is already in use"
        return 0
    else
        echo "❌ Port $1 is not in use"
        return 1
    fi
}

# Check backend
echo "🔍 Checking Backend (Port 3001)..."
if ! check_port 3001; then
    echo "Starting Backend..."
    cd backend
    npm start &
    BACKEND_PID=$!
    cd ..
    echo "Backend PID: $BACKEND_PID"
    sleep 3
fi

# Check frontend
echo "🔍 Checking Frontend (Port 3000)..."
if ! check_port 3000; then
    echo "Starting Frontend..."
    cd frontend
    npm start &
    FRONTEND_PID=$!
    cd ..
    echo "Frontend PID: $FRONTEND_PID"
    sleep 3
fi

echo "================================================"
echo "🎉 Application Status:"
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo "================================================"
echo "📋 Login Credentials:"
echo "Username: admin"
echo "Password: admin123"
echo "================================================"
echo "⚠️  To stop the application, press Ctrl+C or run:"
echo "   pkill -f 'node server.js'"
echo "   pkill -f 'react-scripts'"
echo "================================================"

# Wait for user input
echo "Press Enter to check application status..."
read

# Test both servers
echo "🧪 Testing Backend..."
curl -s http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"username": "admin", "password": "admin123"}' | head -c 100
echo

echo "🧪 Testing Frontend..."
curl -s http://localhost:3000 | head -c 100
echo

echo "✅ Both servers should be running now!"
echo "Open your browser and go to: http://localhost:3000"