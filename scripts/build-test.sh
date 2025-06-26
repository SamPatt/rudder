#!/bin/bash

echo "🧪 Testing production build..."

# Clean previous build
rm -rf dist

# Install dependencies
npm install

# Run production build
npm run build

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Build successful! Production files created in dist/"
    echo "📁 Build contents:"
    ls -la dist/
else
    echo "❌ Build failed!"
    exit 1
fi

echo "🚀 Ready for deployment to Netlify!" 