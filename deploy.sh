#!/bin/bash

# Production deployment script for FastSync

echo "🚀 Starting FastSync production deployment..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build frontend
echo "🏗️ Building frontend..."
npm run build:production

# Set production environment
export NODE_ENV=production

# Start the server
echo "🔥 Starting production server..."
npm run start:production
