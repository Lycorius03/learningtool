#!/bin/bash
set -e
echo "========================================"
echo "  LearningTool — Linux/WSL 一键启动"
echo "========================================"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f ".env" ]; then
    echo "[0/3] Creating .env from .env.example..."
    cp .env.example .env
    echo "  Please edit .env to set your DEEPSEEK_API_KEY"
fi

if [ ! -d "node_modules" ]; then
    echo "[1/3] Installing dependencies..."
    npm install
fi

echo "[2/3] Starting server..."
echo ""
node server.js
