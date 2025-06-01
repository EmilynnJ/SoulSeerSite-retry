#!/bin/bash
set -e  # Exit on error

# Ensure required directories exist
mkdir -p dist/public/uploads

# Install dependencies if needed
echo "Installing dependencies..."
npm install

# Ensure node_modules/.bin is in PATH
export PATH="./node_modules/.bin:$PATH"

# Build the client
echo "Building client..."
NODE_ENV=production vite build

# Build the server with ES Module compatibility fixes
echo "Building server..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist \
  --banner:js="import { createRequire } from 'module';import path from 'path';import { fileURLToPath } from 'url';const require = createRequire(import.meta.url);const __filename = fileURLToPath(import.meta.url);const __dirname = path.dirname(__filename);" \
  --minify

# Copy required files
echo "Copying static files..."
cp -r public/* dist/public/ 2>/dev/null || :

# Create required directories
mkdir -p dist/public/uploads

echo "Build completed successfully!"
