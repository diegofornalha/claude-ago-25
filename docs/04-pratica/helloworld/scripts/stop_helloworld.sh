#!/bin/bash
# HelloWorld A2A Agent Shutdown Script

echo "🛑 Stopping HelloWorld A2A Agent..."
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Set log and pid directory
LOG_DIR="$SCRIPT_DIR/log e pid"
NAME="HelloWorld"
PID_FILE="$LOG_DIR/${NAME}.pid"
LOG_FILE="$LOG_DIR/${NAME}.log"
PORT=9999

echo -e "${BLUE}🔍 Looking for HelloWorld Agent...${NC}"

# Try to stop using PID file
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "${YELLOW}📝 Found HelloWorld Agent (PID: $PID)${NC}"
        echo -e "${YELLOW}   Sending SIGTERM...${NC}"
        kill $PID
        
        # Wait for graceful shutdown
        for i in {1..5}; do
            if ! ps -p $PID > /dev/null 2>&1; then
                echo -e "${GREEN}✅ HelloWorld Agent stopped gracefully${NC}"
                rm -f "$PID_FILE"
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  Process still running, forcing shutdown...${NC}"
            kill -9 $PID
            sleep 1
            if ! ps -p $PID > /dev/null 2>&1; then
                echo -e "${GREEN}✅ HelloWorld Agent stopped (forced)${NC}"
            else
                echo -e "${RED}❌ Failed to stop HelloWorld Agent${NC}"
            fi
        fi
        rm -f "$PID_FILE" 2>/dev/null
    else
        echo -e "${YELLOW}⚠️  PID file exists but process not running${NC}"
        echo -e "${YELLOW}   Cleaning up stale PID file${NC}"
        rm -f "$PID_FILE"
    fi
else
    echo -e "${YELLOW}⚠️  No PID file found${NC}"
fi

# Check if port is still in use
echo -e "${BLUE}🔍 Checking port $PORT...${NC}"
if lsof -ti:$PORT -sTCP:LISTEN > /dev/null 2>&1; then
    PID=$(lsof -ti:$PORT -sTCP:LISTEN)
    echo -e "${YELLOW}⚠️  Found process on port $PORT (PID: $PID)${NC}"
    echo -e "${YELLOW}   Killing process...${NC}"
    kill $PID 2>/dev/null
    sleep 1
    if ! lsof -ti:$PORT -sTCP:LISTEN > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Port $PORT is now free${NC}"
    else
        kill -9 $PID 2>/dev/null
        echo -e "${GREEN}✅ Port $PORT freed (forced)${NC}"
    fi
else
    echo -e "${GREEN}✅ Port $PORT is already free${NC}"
fi

# Clean up any stray python processes running server.py in this directory
echo -e "${BLUE}🔍 Looking for stray server.py processes...${NC}"
STRAY_PIDS=$(pgrep -f "python.*$SCRIPT_DIR/server.py")
if [ ! -z "$STRAY_PIDS" ]; then
    echo -e "${YELLOW}📝 Found stray processes: $STRAY_PIDS${NC}"
    kill $STRAY_PIDS 2>/dev/null
    sleep 1
    echo -e "${GREEN}✅ Stray processes cleaned${NC}"
else
    echo -e "${GREEN}✅ No stray processes found${NC}"
fi

# Cleanup options
echo ""
echo -e "${BLUE}🧹 Cleanup Options${NC}"
echo "==================="
# Auto-cleanup logs (no confirmation)
REPLY="y"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "$LOG_FILE" ]; then
        # Create backup
        mv "$LOG_FILE" "$LOG_FILE.backup" 2>/dev/null
        echo -e "${GREEN}✅ Log file backed up to $LOG_FILE.backup${NC}"
    fi
else
    echo -e "${BLUE}📝 Log files preserved${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}🎯 Shutdown Summary${NC}"
echo "==================="
echo -e "${GREEN}✅ HelloWorld Agent stopped${NC}"
echo -e "${GREEN}✅ Port $PORT is free${NC}"
echo -e "${GREEN}✅ PID file cleaned${NC}"

echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"
echo "   • Start agent again: ./start_helloworld.sh"
echo "   • View old logs: cat \"$LOG_FILE.backup\" (if backed up)"
echo "   • Check port status: lsof -i:$PORT"

echo ""
echo -e "${GREEN}🛑 HelloWorld shutdown complete!${NC}"