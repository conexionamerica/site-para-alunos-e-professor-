#!/bin/sh
# Build script for Vercel
set -e

echo "Installing dependencies..."
npm ci --legacy-peer-deps

echo "Building project..."
NODE_ENV=production npx vite build

echo "Build completed successfully!"
