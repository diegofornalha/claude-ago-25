#!/usr/bin/env python3
"""
Servidor WebSocket para Sincronização em Tempo Real
Monitora mudanças no cache MCP e notifica o frontend instantaneamente
"""

import asyncio
import json
import os
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Set, Dict, Any

import websockets
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configuração
MCP_CACHE_DIR = "/Users/agents/.claude/mcp-rag-cache"
MCP_DOCS_FILE = os.path.join(MCP_CACHE_DIR, "documents.json")
WS_PORT = 8766
HTTP_PORT = 8765

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Clientes WebSocket conectados
connected_clients: Set[websockets.WebSocketServerProtocol] = set()

class CacheMonitor(FileSystemEventHandler):
    """Monitora mudanças no cache MCP e notifica via WebSocket"""
    
    def __init__(self):
        self.last_sync = datetime.now()
        self.last_hash = None
        self.loop = None
        
    def set_event_loop(self, loop):
        """Define o event loop para comunicação assíncrona"""
        self.loop = loop
        
    def on_modified(self, event):
        """Detecta modificações no arquivo de documentos"""
        if event.src_path == MCP_DOCS_FILE:
            logger.info(f"📝 Mudança detectada: {event.src_path}")
            
            # Calcular hash do arquivo para evitar notificações duplicadas
            current_hash = self.calculate_file_hash(MCP_DOCS_FILE)
            if current_hash != self.last_hash:
                self.last_hash = current_hash
                
                # Processar e notificar
                if self.loop:
                    asyncio.run_coroutine_threadsafe(
                        self.process_and_notify(),
                        self.loop
                    )
    
    def calculate_file_hash(self, filepath):
        """Calcula hash MD5 do arquivo"""
        try:
            with open(filepath, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()
        except:
            return None
    
    async def process_and_notify(self):
        """Processa documentos e notifica clientes conectados"""
        try:
            # Processar documentos
            sync_data = self.process_documents()
            
            # Notificar todos os clientes conectados
            if connected_clients:
                message = json.dumps({
                    'type': 'sync',
                    'data': sync_data,
                    'timestamp': datetime.now().isoformat()
                })
                
                # Enviar para todos os clientes
                disconnected = set()
                for client in connected_clients:
                    try:
                        await client.send(message)
                        logger.info(f"✉️ Notificação enviada para cliente")
                    except:
                        disconnected.add(client)
                
                # Remover clientes desconectados
                for client in disconnected:
                    connected_clients.discard(client)
                
                logger.info(f"📤 Sincronização enviada para {len(connected_clients)} clientes")
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar/notificar: {e}")
    
    def process_documents(self) -> Dict[str, Any]:
        """Processa documentos do cache MCP para o formato do frontend"""
        try:
            # Ler documentos
            with open(MCP_DOCS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            documents = data.get('documents', []) if isinstance(data, dict) else data
            
            # Filtrar documentos A2A
            a2a_docs = []
            for doc in documents:
                if self.is_a2a_document(doc):
                    a2a_docs.append(self.format_for_frontend(doc))
            
            return {
                'documents': a2a_docs,
                'metadata': {
                    'total': len(a2a_docs),
                    'lastSync': datetime.now().isoformat(),
                    'source': 'websocket-sync'
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao processar documentos: {e}")
            return {'documents': [], 'metadata': {'error': str(e)}}
    
    def is_a2a_document(self, doc: Dict) -> bool:
        """Verifica se é um documento A2A"""
        if not isinstance(doc, dict):
            return False
            
        tags = doc.get('tags', [])
        category = doc.get('category', '')
        source = doc.get('source', '')
        content = doc.get('content', '')
        
        return any([
            'a2a' in str(tags).lower(),
            'a2a' in str(category).lower(),
            'a2aprotocol' in str(source).lower(),
            'a2a protocol' in str(content).lower()[:200]
        ])
    
    def format_for_frontend(self, doc: Dict) -> Dict:
        """Formata documento para o padrão do frontend"""
        # Extrair URL
        url = self.extract_url(doc)
        content = doc.get('content', '')
        
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
    
    def extract_url(self, doc: Dict) -> str:
        """Extrai URL do documento"""
        content = doc.get('content', '')
        
        # Procurar por "Fonte:" no conteúdo
        if 'Fonte:' in content:
            for line in content.split('\n'):
                if line.startswith('Fonte:'):
                    return line.replace('Fonte:', '').strip()
        
        # Usar source se for URL
        source = doc.get('source', '')
        if source.startswith('http'):
            return source
            
        # Default
        return 'https://a2aprotocol.ai/blog'
    
    def generate_id(self) -> str:
        """Gera ID único"""
        return hashlib.md5(
            f"{datetime.now().isoformat()}{os.urandom(8).hex()}".encode()
        ).hexdigest()

async def handle_websocket(websocket, path):
    """Handler para conexões WebSocket"""
    # Adicionar cliente
    connected_clients.add(websocket)
    client_id = id(websocket)
    logger.info(f"🔌 Cliente conectado: {client_id} | Total: {len(connected_clients)}")
    
    try:
        # Enviar dados iniciais
        monitor = cache_monitor  # Usar instância global
        initial_data = monitor.process_documents()
        
        await websocket.send(json.dumps({
            'type': 'initial',
            'data': initial_data,
            'timestamp': datetime.now().isoformat()
        }))
        
        # Manter conexão aberta
        async for message in websocket:
            # Processar mensagens do cliente se necessário
            try:
                msg = json.loads(message)
                
                if msg.get('type') == 'ping':
                    await websocket.send(json.dumps({
                        'type': 'pong',
                        'timestamp': datetime.now().isoformat()
                    }))
                    
                elif msg.get('type') == 'request_sync':
                    sync_data = monitor.process_documents()
                    await websocket.send(json.dumps({
                        'type': 'sync',
                        'data': sync_data,
                        'timestamp': datetime.now().isoformat()
                    }))
                    
            except json.JSONDecodeError:
                pass
                
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        # Remover cliente
        connected_clients.discard(websocket)
        logger.info(f"🔌 Cliente desconectado: {client_id} | Total: {len(connected_clients)}")

async def start_websocket_server():
    """Inicia servidor WebSocket"""
    logger.info(f"🚀 Servidor WebSocket rodando na porta {WS_PORT}")
    async with websockets.serve(handle_websocket, "localhost", WS_PORT):
        await asyncio.Future()  # Rodar indefinidamente

def run_file_monitor(loop):
    """Executa monitor de arquivos em thread separada"""
    global cache_monitor
    
    # Criar monitor
    cache_monitor = CacheMonitor()
    cache_monitor.set_event_loop(loop)
    
    # Configurar observador
    observer = Observer()
    observer.schedule(cache_monitor, MCP_CACHE_DIR, recursive=False)
    observer.start()
    
    logger.info(f"👁️ Monitorando: {MCP_CACHE_DIR}")
    
    try:
        observer.join()
    except KeyboardInterrupt:
        observer.stop()
        observer.join()

async def main():
    """Função principal"""
    logger.info("=" * 60)
    logger.info("🔄 WebSocket Sync Server para MCP RAG Cache")
    logger.info("=" * 60)
    
    # Obter event loop
    loop = asyncio.get_event_loop()
    
    # Iniciar monitor de arquivos em thread separada
    import threading
    monitor_thread = threading.Thread(
        target=run_file_monitor, 
        args=(loop,),
        daemon=True
    )
    monitor_thread.start()
    
    # Aguardar um pouco para o monitor inicializar
    await asyncio.sleep(1)
    
    # Processar dados iniciais
    if 'cache_monitor' in globals():
        initial = cache_monitor.process_documents()
        logger.info(f"📊 Documentos A2A iniciais: {initial['metadata'].get('total', 0)}")
    
    # Iniciar servidor WebSocket
    await start_websocket_server()

if __name__ == "__main__":
    # Verificar dependências
    required_packages = ['websockets', 'watchdog']
    missing = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        print("❌ Dependências faltando. Instale com:")
        print(f"   pip install {' '.join(missing)}")
        print("\nOu use o servidor simples:")
        print("   python3 /Users/agents/.claude/simple-sync-server.py")
        exit(1)
    
    # Executar servidor
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("\n👋 Encerrando servidor...")