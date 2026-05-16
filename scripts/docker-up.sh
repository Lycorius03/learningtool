#!/bin/bash
# LearningTool — Docker 一键启动
# Outputs full logs to terminal
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "========================================"
echo "  LearningTool — Docker 容器化部署"
echo "  Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================"
echo ""

# ---- 1. Check Docker ----
echo "[1/4] Docker check ..."
if ! command -v docker &>/dev/null; then
    echo "  [ERR] Docker not found. Install Docker >= 24."
    exit 1
fi
echo "  Docker   : $(docker --version)"
if command -v docker-compose &>/dev/null; then
    echo "  Compose  : $(docker-compose --version)"
elif docker compose version &>/dev/null 2>&1; then
    echo "  Compose  : $(docker compose version)"
else
    echo "  [ERR] Docker Compose not found. Install Docker Compose >= 2."
    exit 1
fi
echo ""

# ---- 2. .env check ----
echo "[2/4] Environment config ..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "  [WARN] .env created from .env.example — please edit it"
    else
        echo "PORT=3000" > .env
        echo "DEEPSEEK_API_KEY=sk-your-key-here" >> .env
        echo "SESSION_SECRET=learningtool-dev-secret" >> .env
        echo "  [WARN] .env created with placeholders"
    fi
fi

if grep -q "DEEPSEEK_API_KEY=sk-your-key-here" .env 2>/dev/null; then
    echo "  [WARN] DEEPSEEK_API_KEY is placeholder — AI will fail"
fi
echo ""

# ---- 3. Build and Start ----
echo "[3/4] Building and starting container ..."
docker-compose build --no-cache
docker-compose up -d

echo ""
echo "[4/4] Status check ..."
docker-compose ps

echo ""
echo "========================================"
echo "  LearningTool running at http://localhost:${PORT:-3000}"
echo ""
echo "  View logs:   docker-compose logs -f"
echo "  Stop:        docker-compose down"
echo "  Container:   docker exec -it learntool sh"
echo "========================================"
echo ""
