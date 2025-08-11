#!/bin/bash

# Script to run Helloworld A2A Server on port 9998

# Kill any existing process on port 9998
echo "🔍 Checking for existing processes on port 9998..."
lsof -ti:9998 | xargs kill -9 2>/dev/null || true

# Wait a moment
sleep 1

# Set port
export A2A_PORT=9998

# Navigate to script directory
cd "$(dirname "$0")"

# Create log file
LOG_FILE="helloworld-9998.log"

# Start server in background
echo "🚀 Starting Helloworld A2A Server on port 9998..."
nohup node server-stable.js > "$LOG_FILE" 2>&1 &

# Get PID
PID=$!
echo $PID > helloworld-9998.pid

# Wait for server to start
sleep 2

# Check if server is running
if ps -p $PID > /dev/null; then
    echo "✅ Server started successfully!"
    echo "📍 Server running at: http://localhost:9998"
    echo "📄 PID: $PID (saved to helloworld-9998.pid)"
    echo "📋 Logs: tail -f $LOG_FILE"
    echo ""
    echo "To stop the server: kill $PID"
    echo "Or use: kill \$(cat helloworld-9998.pid)"
else
    echo "❌ Failed to start server. Check $LOG_FILE for errors."
    exit 1
fi