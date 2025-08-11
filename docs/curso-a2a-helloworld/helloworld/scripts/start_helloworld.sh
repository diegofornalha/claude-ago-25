#!/bin/bash
# HelloWorld A2A Agent Startup Script  
# Starts HelloWorld agent using A2A Protocol standard

echo "🚀 Starting HelloWorld A2A Agent..."
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Set log and pid directory
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR"

# Set port (A2A default is dynamic, check server.py for actual port)
PORT=9999  # Actual port used by A2A server
NAME="HelloWorld"
PID_FILE="$LOG_DIR/${NAME}.pid"
LOG_FILE="$LOG_DIR/${NAME}.log"

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  HelloWorld Agent is already running (PID: $OLD_PID)${NC}"
        echo -e "${BLUE}   Port: $PORT${NC}"
        echo -e "${BLUE}   Logs: tail -f \"$LOG_FILE\"${NC}"
        exit 0
    else
        echo -e "${YELLOW}📝 Removing stale PID file${NC}"
        rm -f "$PID_FILE"
    fi
fi

# Check if port is available
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${RED}❌ Port $PORT is already in use${NC}"
    echo -e "${YELLOW}   Try: lsof -i:$PORT${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Port $PORT is available${NC}"

# Activate virtual environment if exists
if [ -d ".venv" ]; then
    echo -e "${BLUE}📦 Activating virtual environment${NC}"
    source .venv/bin/activate
elif [ -d "../.venv" ]; then
    echo -e "${BLUE}📦 Activating parent virtual environment${NC}"
    source ../.venv/bin/activate
fi

# Start the server
echo -e "${BLUE}🤖 Starting HelloWorld Agent on port $PORT...${NC}"

# Export port environment variable
export PORT=$PORT

# Use uv if available, otherwise use python directly
if command -v uv &> /dev/null && [ -f "pyproject.toml" ]; then
    echo -e "${YELLOW}📝 Using uv to run server${NC}"
    nohup uv run python src/server.py > "$LOG_FILE" 2>&1 &
else
    echo -e "${YELLOW}📝 Using python directly${NC}"
    nohup python src/server.py > "$LOG_FILE" 2>&1 &
fi

PID=$!
echo $PID > "$PID_FILE"

# Wait for server to start
echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
sleep 3

# Verify server started
if ps -p $PID > /dev/null 2>&1; then
    # Test discovery endpoint
    if curl -s --max-time 2 "http://localhost:$PORT/.well-known/agent.json" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ HelloWorld Agent started successfully!${NC}"
        echo ""
        echo -e "${BLUE}📊 Agent Details:${NC}"
        echo -e "   • Name: HelloWorld Agent"
        echo -e "   • Port: $PORT"
        echo -e "   • PID: $PID"
        echo -e "   • URL: http://localhost:$PORT"
        echo ""
        echo -e "${BLUE}🔗 Endpoints:${NC}"
        echo -e "   • Discovery: http://localhost:$PORT/.well-known/agent.json"
        echo -e "   • API Docs: http://localhost:$PORT/docs"
        echo ""
        echo -e "${BLUE}📋 Management:${NC}"
        echo -e "   • View logs: tail -f \"$LOG_FILE\""
        echo -e "   • Stop agent: ./scripts/stop_helloworld.sh"
        echo -e "   • Check status: curl http://localhost:$PORT/.well-known/agent.json"
        echo ""
        echo -e "${GREEN}🎯 HelloWorld Agent is ready!${NC}"
    else
        echo -e "${RED}❌ Server started but not responding${NC}"
        echo -e "${YELLOW}   Check logs: tail -f \"$LOG_FILE\"${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Failed to start HelloWorld Agent${NC}"
    echo -e "${YELLOW}   Check logs: cat \"$LOG_FILE\"${NC}"
    rm -f "$PID_FILE"
    exit 1
fi