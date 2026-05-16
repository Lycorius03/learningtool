#!/bin/bash
# LearningTool — Linux/WSL/macOS 一键启动脚本
# Outputs full verbose logs to terminal

set -e

echo "========================================"
echo "  LearningTool — Linux/WSL/macOS 启动"
echo "  Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# ---- 1. Environment check ----
echo "[1/5] Environment check ..."
echo "  OS       : $(uname -s) $(uname -r)"
echo "  Arch     : $(uname -m)"
echo "  CWD      : $(pwd)"
echo "  Node.js  : $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "  npm      : $(npm -v 2>/dev/null || echo 'NOT FOUND')"

if ! command -v node &>/dev/null; then
    echo "  [ERR] Node.js not found. Install Node.js >= 20."
    exit 1
fi
echo "  OK"
echo ""

# ---- 2. Project files ----
echo "[2/5] Project file check ..."
for f in server.js index.html package.json; do
    if [ -f "$f" ]; then
        echo "  [OK] $f"
    else
        echo "  [ERR] $f missing"
    fi
done
echo "  JS files   : $(find src/js -name '*.js' 2>/dev/null | wc -l)"
echo "  View files : $(find src/views -name '*.html' 2>/dev/null | wc -l)"
echo "  CSS files  : $(find src/css -name '*.css' 2>/dev/null | wc -l)"
echo ""

# ---- 3. .env config ----
echo "[3/5] Environment config (.env) ..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "  [WARN] .env created from .env.example — please edit it"
    else
        echo "  [WARN] .env.example not found, creating minimal .env"
        cat > .env <<'ENVEOF'
PORT=3000
DEEPSEEK_API_KEY=sk-your-key-here
SESSION_SECRET=learningtool-dev-secret
ENVEOF
    fi
fi
echo "  .env file : exists"

if grep -q "DEEPSEEK_API_KEY=sk-your-key-here" .env 2>/dev/null; then
    echo "  [WARN] DEEPSEEK_API_KEY is placeholder — AI will fail"
elif grep -q "DEEPSEEK_API_KEY=sk-" .env 2>/dev/null; then
    echo "  DEEPSEEK_API_KEY : configured (starts with sk-)"
elif grep -q "DEEPSEEK_API_KEY=" .env 2>/dev/null; then
    echo "  DEEPSEEK_API_KEY : present (non-standard format)"
else
    echo "  [WARN] DEEPSEEK_API_KEY not set — AI will fail"
fi

if grep -q "SESSION_SECRET=change_me" .env 2>/dev/null; then
    echo "  [WARN] SESSION_SECRET is default — consider changing"
fi
echo ""

# ---- 4. Dependencies ----
echo "[4/5] Dependencies ..."
if [ ! -d "node_modules" ]; then
    echo "  Running npm install ..."
    npm install
    echo "  npm install : complete"
else
    echo "  node_modules : exists"
fi

# Verify key packages
for pkg in express multer dotenv pdf-parse mammoth marked; do
    if [ -d "node_modules/$pkg" ]; then
        echo "  [OK] $pkg"
    else
        echo "  [WARN] $pkg missing — run: npm install"
    fi
done
echo ""

# ---- 5. Port check ----
echo "[5/5] Port check ..."
PORT=$(grep -oP 'PORT=\K.*' .env 2>/dev/null || echo "3000")
PORT=${PORT:-3000}
echo "  Port: $PORT"

if command -v lsof &>/dev/null; then
    if lsof -i :$PORT -sTCP:LISTEN &>/dev/null; then
        echo "  [WARN] Port $PORT is in use"
        echo "  Occupied by:"
        lsof -i :$PORT -sTCP:LISTEN
    else
        echo "  Port $PORT : available"
    fi
elif command -v ss &>/dev/null; then
    if ss -tlnp | grep -q ":$PORT "; then
        echo "  [WARN] Port $PORT is in use"
        ss -tlnp | grep ":$PORT "
    else
        echo "  Port $PORT : available"
    fi
else
    echo "  Port check skipped (no lsof/ss)"
fi
echo ""

# ---- Start server ----
echo "========================================"
echo "  Starting Node.js server ..."
echo "  Full logs below:"
echo "========================================"
echo ""

# Run node directly — full verbose output to terminal
exec node server.js
