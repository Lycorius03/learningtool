#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
echo "Building LearningTool Docker image..."
echo "  Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
docker build -t learntool:latest .
echo "Done. Run ./scripts/docker-up.sh to start."
