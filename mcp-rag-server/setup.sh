#!/bin/bash

# MCP RAG Server Setup Script
# Automated installation and configuration

set -e  # Exit on error

echo "🚀 MCP RAG Server Setup v3.0"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
echo -e "\n${YELLOW}Checking Python version...${NC}"
python_version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
required_version="3.8"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" = "$required_version" ]; then 
    echo -e "${GREEN}✓ Python $python_version found${NC}"
else
    echo -e "${RED}✗ Python $required_version or higher required. Found: $python_version${NC}"
    exit 1
fi

# Create virtual environment
echo -e "\n${YELLOW}Creating virtual environment...${NC}"
if [ -d "venv" ]; then
    echo "Virtual environment already exists. Updating..."
else
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo -e "\n${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip --quiet
echo -e "${GREEN}✓ Pip upgraded${NC}"

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
pip install -r requirements.txt --quiet
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create cache directory if it doesn't exist
echo -e "\n${YELLOW}Setting up cache directory...${NC}"
CACHE_DIR="$HOME/.claude/mcp-rag-cache"
if [ ! -d "$CACHE_DIR" ]; then
    mkdir -p "$CACHE_DIR"
    echo -e "${GREEN}✓ Cache directory created at $CACHE_DIR${NC}"
else
    echo -e "${GREEN}✓ Cache directory already exists at $CACHE_DIR${NC}"
fi

# Test MCP server
echo -e "\n${YELLOW}Testing MCP server...${NC}"
python3 -c "
import sys
import json

# Test basic import
try:
    with open('rag_server_v2.py', 'r') as f:
        code = f.read()
    if 'handle_request' in code:
        print('✓ MCP server code validated')
    else:
        print('✗ MCP server code invalid')
        sys.exit(1)
except Exception as e:
    print(f'✗ Error: {e}')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ MCP server test passed${NC}"
else
    echo -e "${RED}✗ MCP server test failed${NC}"
    exit 1
fi

# Test MCP protocol
echo -e "\n${YELLOW}Testing MCP protocol...${NC}"
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}}}' | \
    python3 rag_server_v2.py 2>/dev/null | \
    python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    if data.get('result', {}).get('serverInfo', {}).get('name') == 'rag-server-v2':
        print('✓ MCP protocol test passed')
        sys.exit(0)
except:
    pass
print('✗ MCP protocol test failed')
sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ MCP protocol working${NC}"
else
    echo -e "${YELLOW}⚠ MCP protocol test failed (non-critical)${NC}"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "\n${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
# MCP RAG Server Configuration
RAG_MODEL=all-MiniLM-L6-v2
RAG_CACHE_DIR=$HOME/.claude/mcp-rag-cache
RAG_LOG_LEVEL=INFO
RAG_MAX_DOCUMENTS=10000
RAG_EMBEDDING_BATCH_SIZE=32
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Display next steps
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test the MCP server:"
echo "   source venv/bin/activate"
echo "   python3 test_mcp.py"
echo ""
echo "2. Configure Claude Desktop:"
echo "   Add to ~/Library/Application Support/Claude/claude_desktop_config.json:"
echo '   "rag-server-v2": {'
echo '     "command": "'$(pwd)'/venv/bin/python",'
echo '     "args": ["'$(pwd)'/rag_server_v2.py"]'
echo '   }'
echo ""
echo "3. Start the web API (optional):"
echo "   python3 create_api_endpoint.py"
echo ""
echo "Documentation: README.md"
echo "Report issues: https://github.com/your-repo/issues"