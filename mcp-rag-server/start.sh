#!/bin/bash
# Start MCP RAG Server
cd /Users/agents/.claude/mcp-rag-server
source venv/bin/activate
exec python server.py