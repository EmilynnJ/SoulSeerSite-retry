#!/bin/bash
set -e  # Exit on error

# Ensure required directories exist and are clean
rm -rf dist
mkdir -p dist/public/uploads dist/public/images

# Create other required directories if they don't exist
mkdir -p public/uploads public/images

# Install dependencies if needed
echo "Installing dependencies..."
npm install --production=false

# Ensure node_modules/.bin is in PATH
export PATH="./node_modules/.bin:$PATH"

# Build the client
echo "Building client..."
NODE_ENV=production vite build

# Build the server with ES Module compatibility fixes
echo "Building server..."

# Common esbuild options
ESBUILD_COMMON_OPTS="--platform=node --packages=external --format=esm --sourcemap --minify=false"

# Build server files
echo "Building server files..."
npx esbuild \
  server/index.ts \
  server/run-migrations.ts \
  server/utils.ts \
  server/db.ts \
  $ESBUILD_COMMON_OPTS \
  --outdir=dist

# Copy required files
echo "Copying static files..."
cp -r public/* dist/public/ 2>/dev/null || :

# Copy migrations to both locations (for compatibility)
echo "Copying database migrations..."
mkdir -p dist/server/migrations dist/migrations
cp -r server/migrations/* dist/server/migrations/ 2>/dev/null || :
cp -r server/migrations/* dist/migrations/ 2>/dev/null || :

# Ensure all required directories exist
mkdir -p \
  dist/public/uploads \
  dist/public/images \
  dist/public/assets

# Copy package.json and package-lock.json for production dependencies
cp package*.json dist/

# Install production dependencies in the dist folder
echo "Installing production dependencies..."
cd dist && npm install --production
cd ..

# Run database migrations
echo "Running database migrations..."
NODE_ENV=production DATABASE_URL="postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  node --experimental-specifier-resolution=node dist/run-migrations.js

echo "Build completed successfully!"
