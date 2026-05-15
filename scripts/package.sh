#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
VERSION=$(node -e "console.log(require('./package.json').version)")
PACKAGE_NAME="paperlens-${VERSION}.tar.gz"
echo "Packaging PaperLens v${VERSION}..."
tar --exclude='node_modules' --exclude='.git' --exclude='data' --exclude='.superpowers' --exclude='*.tar.gz' -czf "$PACKAGE_NAME" .
echo "Package created: $PACKAGE_NAME"
echo "To deploy: tar -xzf $PACKAGE_NAME && cd paperlens && npm install && npm start"
