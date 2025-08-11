#!/usr/bin/env python3
"""
Proxy reverso simples para expor HelloWorld Agent publicamente
"""
import http.server
import socketserver
import urllib.request
import urllib.parse
import json
from urllib.error import URLError

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Redirecionar para o HelloWorld Agent local
        target_url = f"http://localhost:9999{self.path}"
        
        try:
            with urllib.request.urlopen(target_url) as response:
                self.send_response(response.status)
                
                # Copiar headers
                for header, value in response.headers.items():
                    if header.lower() not in ['server', 'date']:
                        self.send_header(header, value)
                
                # Adicionar CORS headers
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                
                # Copiar conteúdo
                self.wfile.write(response.read())
                
        except URLError as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = {
                "error": "Bad Gateway", 
                "message": f"Cannot connect to HelloWorld Agent: {str(e)}"
            }
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_POST(self):
        # Ler dados do POST
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        target_url = f"http://localhost:9999{self.path}"
        
        try:
            req = urllib.request.Request(target_url, data=post_data)
            
            # Copiar headers importantes
            for header in ['Content-Type', 'Content-Length']:
                if header in self.headers:
                    req.add_header(header, self.headers[header])
            
            with urllib.request.urlopen(req) as response:
                self.send_response(response.status)
                
                # Copiar headers
                for header, value in response.headers.items():
                    if header.lower() not in ['server', 'date']:
                        self.send_header(header, value)
                
                # Adicionar CORS headers
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
                
                # Copiar conteúdo
                self.wfile.write(response.read())
                
        except URLError as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = {
                "error": "Bad Gateway", 
                "message": f"Cannot connect to HelloWorld Agent: {str(e)}"
            }
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == "__main__":
    PORT = 8080
    
    with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
        print(f"🌐 Proxy server running on port {PORT}")
        print(f"🔗 Proxying localhost:9999 -> 0.0.0.0:{PORT}")
        print(f"📡 Access HelloWorld Agent via: http://localhost:{PORT}/.well-known/agent.json")
        httpd.serve_forever()