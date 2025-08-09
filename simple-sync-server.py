#!/usr/bin/env python3
"""
Servidor Simples de Sync - Disponibiliza cache MCP para o frontend
"""

import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from datetime import datetime

PORT = 8765
MCP_CACHE_DIR = "/Users/agents/.claude/mcp-rag-cache"

class CORSRequestHandler(SimpleHTTPRequestHandler):
    """Handler HTTP com CORS habilitado"""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def main():
    os.chdir(MCP_CACHE_DIR)
    server = HTTPServer(('localhost', PORT), CORSRequestHandler)
    print(f"🚀 Servidor rodando em http://localhost:{PORT}")
    print(f"📁 Servindo arquivos de: {MCP_CACHE_DIR}")
    print("✨ Frontend pode acessar via: http://localhost:{PORT}/documents.json")
    print("\nPressione Ctrl+C para parar")
    server.serve_forever()

if __name__ == "__main__":
    main()