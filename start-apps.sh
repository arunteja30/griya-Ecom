#!/bin/bash

# Script to run both main e-commerce app and delivery app simultaneously

echo "🚀 Starting Griya E-commerce & Delivery Apps..."

# Function to cleanup processes on exit
cleanup() {
    echo "🛑 Stopping all processes..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT

# Start main e-commerce app on port 3000
echo "📱 Starting main e-commerce app on http://localhost:3000"
cd "$(dirname "$0")" || exit
npm run dev &

# Start delivery app on port 3001  
echo "🚚 Starting delivery app on http://localhost:3001"
cd delivery-app || exit
npm run dev &

echo "✅ Both apps are running:"
echo "   📱 Main App: http://localhost:3000"
echo "   🚚 Delivery: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both apps"

# Wait for all background jobs
wait