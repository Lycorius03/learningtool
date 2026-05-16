#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
VERSION=$(node -e "console.log(require('./package.json').version)")
PACKAGE_NAME="learningtool-${VERSION}.tar.gz"
echo "Packaging LearningTool v${VERSION}..."
echo "  Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
tar --exclude='node_modules' --exclude='.git' --exclude='data' --exclude='.superpowers' --exclude='*.tar.gz' -czf "$PACKAGE_NAME" .
echo "Package created: $PACKAGE_NAME"
echo "To deploy: tar -xzf $PACKAGE_NAME && cd learningtool && npm install && npm start"
