#!/usr/bin/env python3
"""
Servidor de Auto-Sync para MCP RAG Cache
Monitora mudanças no cache MCP e disponibiliza para o frontend
"""

import json
import os
import time
import hashlib
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import logging

# Configuração
MCP_CACHE_DIR = "/Users/agents/.claude/mcp-rag-cache"
MCP_DOCS_FILE = os.path.join(MCP_CACHE_DIR, "documents.json")
FRONTEND_SYNC_FILE = os.path.join(MCP_CACHE_DIR, "frontend-sync.json")
PORT = 8765

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CacheWatcher(FileSystemEventHandler):
    """Monitora mudanças no cache MCP"""
    
    def __init__(self):
        self.last_sync = datetime.now()
        self.last_hash = None
        
    def on_modified(self, event):
        if event.src_path == MCP_DOCS_FILE:
            logger.info(f"📝 Detectada mudança em: {event.src_path}")
            self.sync_to_frontend()
    
    def sync_to_frontend(self):
        """Sincroniza documentos para formato do frontend"""
        try:
            # Ler documentos do MCP
            with open(MCP_DOCS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            documents = data.get('documents', []) if isinstance(data, dict) else data
            
            # Filtrar documentos A2A
            a2a_docs = []
            for doc in documents:
                if isinstance(doc, dict):
                    tags = doc.get('tags', [])
                    category = doc.get('category', '')
                    source = doc.get('source', '')
                    
                    if ('a2a' in str(tags).lower() or 
                        'a2a' in str(category).lower() or
                        'a2aprotocol' in str(source).lower()):
                        a2a_docs.append(self.format_for_frontend(doc))
            
            # Criar arquivo de sincronização
            sync_data = {
                'documents': a2a_docs,
                'metadata': {
                    'total': len(a2a_docs),
                    'lastSync': datetime.now().isoformat(),
                    'source': 'auto-sync-server'
                }
            }
            
            # Salvar arquivo de sync
            with open(FRONTEND_SYNC_FILE, 'w', encoding='utf-8') as f:
                json.dump(sync_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"✅ Sincronizados {len(a2a_docs)} documentos A2A")
            self.last_sync = datetime.now()
            
        except Exception as e:
            logger.error(f"❌ Erro na sincronização: {e}")
    
    def format_for_frontend(self, doc):
        """Formata documento para o padrão do frontend"""
        # Extrair URL
        url = None
        content = doc.get('content', '')
        
        if 'Fonte:' in content:
            lines = content.split('\n')
            for line in lines:
                if line.startswith('Fonte:'):
                    url = line.replace('Fonte:', '').strip()
                    break
        
        if not url and doc.get('source', '').startswith('http'):
            url = doc['source']
        elif not url:
            url = 'https://a2aprotocol.ai/blog'
        
        return {
            'id': doc.get('id', self.generate_id()),
            'url': url,
            'title': doc.get('title', 'Documento A2A'),
            'content': content[:500] + '...' if len(content) > 500 else content,
            'fullContent': content,
            'category': doc.get('category', 'a2a'),
            'tags': doc.get('tags', ['a2a']),
            'type': doc.get('type', 'webpage'),
            'timestamp': doc.get('created_at', datetime.now().isoformat()),
            'metadata': {
                'source': doc.get('source', 'mcp-rag'),
                'hash': doc.get('hash', ''),
                'version': doc.get('version', 1),
                'syncedAt': datetime.now().isoformat()
            }
        }
    
    def generate_id(self):
        """Gera ID único"""
        return hashlib.md5(
            f"{datetime.now().isoformat()}{os.urandom(8).hex()}".encode()
        ).hexdigest()

class CORSRequestHandler(SimpleHTTPRequestHandler):
    """Handler HTTP com suporte a CORS"""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        # Servir arquivo de sincronização
        if self.path == '/sync' or self.path == '/frontend-sync.json':
            self.path = '/frontend-sync.json'
            return super().do_GET()
        
        # Status endpoint
        if self.path == '/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            status = {
                'running': True,
                'lastSync': watcher.last_sync.isoformat() if watcher else None,
                'cacheDir': MCP_CACHE_DIR,
                'port': PORT
            }
            self.wfile.write(json.dumps(status).encode())
            return
        
        # Default
        super().do_GET()

def run_server():
    """Executa servidor HTTP"""
    os.chdir(MCP_CACHE_DIR)
    server = HTTPServer(('localhost', PORT), CORSRequestHandler)
    logger.info(f"🚀 Servidor de auto-sync rodando em http://localhost:{PORT}")
    logger.info(f"📁 Servindo arquivos de: {MCP_CACHE_DIR}")
    server.serve_forever()

def main():
    global watcher
    
    logger.info("=" * 60)
    logger.info("🔄 Auto-Sync Server para MCP RAG Cache")
    logger.info("=" * 60)
    
    # Criar watcher
    watcher = CacheWatcher()
    
    # Sincronização inicial
    logger.info("📋 Executando sincronização inicial...")
    watcher.sync_to_frontend()
    
    # Configurar observador de arquivos
    observer = Observer()
    observer.schedule(watcher, MCP_CACHE_DIR, recursive=False)
    observer.start()
    logger.info(f"👁️ Monitorando: {MCP_CACHE_DIR}")
    
    # Iniciar servidor em thread separada
    server_thread = Thread(target=run_server, daemon=True)
    server_thread.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        logger.info("\n👋 Encerrando servidor...")
    
    observer.join()

if __name__ == "__main__":
    # Verificar dependências
    try:
        import watchdog
    except ImportError:
        print("❌ Instale watchdog: pip install watchdog")
        exit(1)
    
    main()