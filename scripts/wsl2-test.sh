#!/bin/bash
set -e
echo "LearningTool WSL2 Test Suite"
echo "============================"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
echo "[1/4] Installing dependencies..."
npm install
echo "[2/4] Checking Node version..."
node --version
echo "[3/4] Starting server in background..."
node server.js &
SERVER_PID=$!
sleep 2
echo "[4/4] Testing HTTP endpoint..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/ || echo "Server check failed"
kill $SERVER_PID 2>/dev/null
echo "WSL2 test complete."
