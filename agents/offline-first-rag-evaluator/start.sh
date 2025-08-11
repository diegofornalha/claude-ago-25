#!/bin/bash

# Start script for Offline-First RAG Evaluator Agent (A2A Protocol)

echo "🚀 Offline-First RAG Evaluator Agent - A2A Protocol Server"
echo "=========================================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check dependencies
echo "📦 Checking dependencies..."

check_package() {
    python3 -c "import $1" 2>/dev/null
    return $?
}

MISSING_DEPS=""

if ! check_package "fastapi"; then
    MISSING_DEPS="$MISSING_DEPS fastapi"
fi

if ! check_package "uvicorn"; then
    MISSING_DEPS="$MISSING_DEPS uvicorn"
fi

if ! check_package "pydantic"; then
    MISSING_DEPS="$MISSING_DEPS pydantic"
fi

if ! check_package "httpx"; then
    MISSING_DEPS="$MISSING_DEPS httpx"
fi

# Install missing dependencies
if [ ! -z "$MISSING_DEPS" ]; then
    echo "⚠️ Missing dependencies: $MISSING_DEPS"
    echo "📦 Installing..."
    pip3 install $MISSING_DEPS
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        echo "Try: pip3 install --user $MISSING_DEPS"
        exit 1
    fi
fi

# Check if port is already in use
if lsof -i:8800 > /dev/null 2>&1; then
    echo "⚠️ Port 8800 is already in use"
    read -p "Stop existing process? [y/n]: " stop
    if [ "$stop" = "y" ]; then
        kill $(lsof -t -i:8800) 2>/dev/null
        echo "✅ Process stopped"
        sleep 2
    else
        echo "❌ Cannot start agent. Port in use."
        exit 1
    fi
fi

# Start the agent server
echo ""
echo "🎯 Starting A2A Protocol Server..."
echo "📍 Agent Card: http://localhost:8800/.well-known/agent-card"
echo "🔌 A2A Endpoint: http://localhost:8800/a2a"
echo "📊 Health Check: http://localhost:8800/health"
echo ""
echo "✨ Agent follows A2A Protocol v0.2.5 specification"
echo "📚 Skills available:"
echo "  - evaluate_rag_system: Comprehensive RAG evaluation"
echo "  - test_offline_functionality: Test offline features"
echo "  - optimize_cache_strategy: Optimize caching for offline"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the server
cd "$(dirname "$0")"
python3 a2a-server.py