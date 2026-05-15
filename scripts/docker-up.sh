#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit .env to set your DEEPSEEK_API_KEY"
fi
docker-compose up -d
echo "PaperLens running at http://localhost:3000"
