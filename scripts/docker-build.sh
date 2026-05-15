#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
echo "Building PaperLens Docker image..."
docker build -t paperlens:latest .
echo "Done. Run ./scripts/docker-up.sh to start."
