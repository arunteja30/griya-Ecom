#!/bin/bash

# Script to start all three applications

echo "🚀 Starting Griya E-Commerce Apps..."

# Kill any existing processes on the ports
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

# Start main app (Customer app)
echo "📱 Starting Main Customer App (Port 3000)..."
cd "$(dirname "$0")" && npm run dev &
MAIN_PID=$!

# Start delivery app
echo "🚗 Starting Delivery Partner App (Port 3001)..."
cd "$(dirname "$0")/delivery-app" && npm run dev &
DELIVERY_PID=$!

# Start merchant app  
echo "🏪 Starting Merchant App (Port 3002)..."
cd "$(dirname "$0")/merchant-app" && npm run dev &
MERCHANT_PID=$!

echo ""
echo "✅ All apps started successfully!"
echo ""
echo "🌐 Application URLs:"
echo "   📱 Customer App:     http://localhost:3000"
echo "   🚗 Delivery App:     http://localhost:3001" 
echo "   🏪 Merchant App:     http://localhost:3002"
echo ""
echo "🔑 Demo Credentials:"
echo ""
echo "   📊 Admin Panel (Main App):"
echo "      Email: admin@griya.com"
echo "      Password: admin123"
echo ""
echo "   🚗 Delivery Partners:"
echo "      DEL001 / DEL002 / DEL003"
echo "      Password: delivery123"
echo ""
echo "   🏪 Merchants:"
echo "      MER001 / MER002 / MER003"
echo "      Password: merchant123"
echo ""
echo "🛑 To stop all apps, run: killall -9 node"
echo ""

# Wait for all processes
wait $MAIN_PID $DELIVERY_PID $MERCHANT_PID