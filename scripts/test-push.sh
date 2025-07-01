#!/bin/bash

echo "🧪 Testing Push Notification Setup..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the test script
echo "🚀 Running push notification test..."
node scripts/test-push-setup.js

echo ""
echo "✅ Test completed! Check the output above for any issues." 