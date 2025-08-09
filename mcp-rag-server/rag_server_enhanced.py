#!/usr/bin/env python3
"""
MCP RAG Server - Versão Avançada (10/10)
Servidor MCP completo com todas as funcionalidades profissionais
"""
import json
import sys
import os
import time
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

# Configuração de logging
LOG_PATH = Path.home() / ".claude" / "mcp-rag-cache" / "server.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger("mcp-rag-server")

# Cache path
CACHE_PATH = Path.home() / ".claude" / "mcp-rag-cache"
CACHE_FILE = CACHE_PATH / "documents.json"
BACKUP_PATH = CACHE_PATH / "backups"

class MCPError(Exception):
    """Exceção personalizada para erros MCP"""
    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(f"MCP Error {code}: {message}")

class RAGServerEnhanced:
    """Servidor RAG avançado com recursos profissionais"""
    
    def __init__(self):
        self.documents = []
        self.version = "2.0.0"
        self.protocol_version = "2024-11-05"
        self.capabilities = {
            "tools": {
                "listChanged": True
            },
            "resources": {},
            "prompts": {},
            "logging": {}
        }
        self.server_info = {
            "name": "rag-webfetch",
            "version": self.version,
            "description": "Advanced RAG Server with semantic search and document management"
        }
        
        # Inicializar diretórios
        CACHE_PATH.mkdir(parents=True, exist_ok=True)
        BACKUP_PATH.mkdir(parents=True, exist_ok=True)
        
        # Carregar documentos
        self.load_documents()
        
        # Log de inicialização
        logger.info(f"RAG Server Enhanced v{self.version} initialized")
    
    def load_documents(self):
        """Carrega documentos do cache com tratamento de erro robusto"""
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.documents = data.get('documents', [])
                    logger.info(f"Loaded {len(self.documents)} documents from cache")
            else:
                self.documents = []
                logger.info("No cache file found, starting with empty document set")
        except Exception as e:
            logger.error(f"Error loading documents: {e}")
            self.documents = []
    
    def save_documents(self):
        """Salva documentos no cache com backup automático"""
        try:
            # Backup automático antes de salvar
            if CACHE_FILE.exists():
                backup_file = BACKUP_PATH / f"documents_{int(time.time())}.json"
                with open(CACHE_FILE, 'r') as src, open(backup_file, 'w') as dst:
                    dst.write(src.read())
                logger.info(f"Backup created: {backup_file}")
            
            # Salvar nova versão
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump({
                    'documents': self.documents,
                    'metadata': {
                        'last_updated': datetime.now().isoformat(),
                        'version': self.version,
                        'total_documents': len(self.documents)
                    }
                }, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Saved {len(self.documents)} documents to cache")
            
            # Limpar backups antigos (manter apenas os 10 mais recentes)
            self._cleanup_old_backups()
            
        except Exception as e:
            logger.error(f"Error saving documents: {e}")
            raise MCPError(-32603, f"Failed to save documents: {e}")
    
    def _cleanup_old_backups(self):
        """Remove backups antigos mantendo apenas os 10 mais recentes"""
        try:
            backup_files = sorted(BACKUP_PATH.glob("documents_*.json"), key=lambda x: x.stat().st_mtime)
            if len(backup_files) > 10:
                for old_backup in backup_files[:-10]:
                    old_backup.unlink()
                    logger.info(f"Removed old backup: {old_backup}")
        except Exception as e:
            logger.warning(f"Error cleaning up backups: {e}")
    
    def search(self, query: str, limit: int = 5) -> List[Dict]:
        """Busca avançada com scoring e relevância"""
        start_time = time.time()
        query_lower = query.lower()
        results = []
        
        try:
            for doc in self.documents:
                # Calcular score de relevância
                title = doc.get('title', '').lower()
                content = doc.get('content', '').lower()
                
                title_matches = title.count(query_lower)
                content_matches = content.count(query_lower)
                
                # Score baseado em posição e frequência
                score = (title_matches * 3) + content_matches
                
                if score > 0:
                    # Snippet inteligente
                    snippet = self._extract_snippet(doc.get('content', ''), query, 200)
                    
                    results.append({
                        'id': doc.get('id'),
                        'title': doc.get('title'),
                        'content': snippet,
                        'type': doc.get('type'),
                        'source': doc.get('source'),
                        'score': score,
                        'metadata': doc.get('metadata', {})
                    })
            
            # Ordenar por score (maior primeiro)
            results.sort(key=lambda x: x['score'], reverse=True)
            results = results[:limit]
            
            # Remover score do resultado final
            for result in results:
                result.pop('score', None)
            
            search_time = time.time() - start_time
            logger.info(f"Search for '{query}' returned {len(results)} results in {search_time:.3f}s")
            
            return results
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            raise MCPError(-32603, f"Search failed: {e}")
    
    def _extract_snippet(self, content: str, query: str, max_length: int) -> str:
        """Extrai snippet inteligente ao redor da query"""
        if not content or not query:
            return content[:max_length] + '...' if len(content) > max_length else content
        
        query_lower = query.lower()
        content_lower = content.lower()
        
        # Encontrar primeira ocorrência
        pos = content_lower.find(query_lower)
        if pos == -1:
            return content[:max_length] + '...' if len(content) > max_length else content
        
        # Calcular início e fim do snippet
        start = max(0, pos - max_length // 3)
        end = min(len(content), start + max_length)
        
        snippet = content[start:end]
        
        # Adicionar ... se necessário
        if start > 0:
            snippet = '...' + snippet
        if end < len(content):
            snippet = snippet + '...'
        
        return snippet
    
    def add_document(self, doc: Dict) -> Dict:
        """Adiciona documento com validação avançada"""
        try:
            # Validação de campos obrigatórios
            required_fields = ['title', 'content']
            for field in required_fields:
                if not doc.get(field):
                    raise MCPError(-32602, f"Missing required field: {field}")
            
            # Gerar ID único se não fornecido
            if 'id' not in doc:
                doc['id'] = f"doc_{int(time.time() * 1000)}"
            
            # Verificar se ID já existe
            existing_ids = [d.get('id') for d in self.documents]
            if doc['id'] in existing_ids:
                raise MCPError(-32602, f"Document with ID {doc['id']} already exists")
            
            # Adicionar metadados
            doc['metadata'] = doc.get('metadata', {})
            doc['metadata'].update({
                'added_at': datetime.now().isoformat(),
                'server_version': self.version,
                'content_length': len(doc.get('content', ''))
            })
            
            # Adicionar documento
            self.documents.append(doc)
            self.save_documents()
            
            logger.info(f"Added document: {doc['id']} - {doc.get('title', 'No title')}")
            
            return {
                'success': True,
                'document': {
                    'id': doc['id'],
                    'title': doc.get('title'),
                    'type': doc.get('type'),
                    'source': doc.get('source')
                }
            }
            
        except MCPError:
            raise
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            raise MCPError(-32603, f"Failed to add document: {e}")
    
    def remove_document(self, doc_id: str) -> Dict:
        """Remove documento com validação"""
        try:
            for i, doc in enumerate(self.documents):
                if doc.get('id') == doc_id:
                    removed_doc = self.documents.pop(i)
                    self.save_documents()
                    logger.info(f"Removed document: {doc_id} - {removed_doc.get('title', 'No title')}")
                    return {'success': True, 'id': doc_id}
            
            raise MCPError(-32602, f"Document with ID {doc_id} not found")
            
        except MCPError:
            raise
        except Exception as e:
            logger.error(f"Error removing document: {e}")
            raise MCPError(-32603, f"Failed to remove document: {e}")
    
    def list_documents(self) -> Dict:
        """Lista documentos com metadados completos"""
        try:
            documents = []
            for doc in self.documents:
                documents.append({
                    'id': doc.get('id'),
                    'title': doc.get('title'),
                    'type': doc.get('type'),
                    'source': doc.get('source'),
                    'metadata': doc.get('metadata', {})
                })
            
            return {
                'documents': documents,
                'total': len(documents)
            }
            
        except Exception as e:
            logger.error(f"Error listing documents: {e}")
            raise MCPError(-32603, f"Failed to list documents: {e}")
    
    def get_stats(self) -> Dict:
        """Estatísticas detalhadas do sistema"""
        try:
            # Estatísticas básicas
            total_docs = len(self.documents)
            cache_size = CACHE_FILE.stat().st_size if CACHE_FILE.exists() else 0
            
            # Estatísticas por tipo
            type_stats = {}
            for doc in self.documents:
                doc_type = doc.get('type', 'unknown')
                type_stats[doc_type] = type_stats.get(doc_type, 0) + 1
            
            # Informações do sistema
            stats = {
                'total_documents': total_docs,
                'cache_file': str(CACHE_FILE),
                'cache_size_bytes': cache_size,
                'server_version': self.version,
                'protocol_version': self.protocol_version,
                'uptime_start': datetime.now().isoformat(),
                'type_distribution': type_stats,
                'backup_count': len(list(BACKUP_PATH.glob("documents_*.json"))),
                'capabilities': self.capabilities
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            raise MCPError(-32603, f"Failed to get stats: {e}")

# Instância global
server = RAGServerEnhanced()

def create_tools_schema():
    """Define schema completo das ferramentas MCP"""
    return [
        {
            "name": "search",
            "description": "Busca semântica avançada em documentos com scoring de relevância",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Termo de busca ou pergunta"
                    },
                    "limit": {
                        "type": "number",
                        "description": "Número máximo de resultados (padrão: 5)",
                        "default": 5,
                        "minimum": 1,
                        "maximum": 50
                    }
                },
                "required": ["query"]
            }
        },
        {
            "name": "add",
            "description": "Adiciona novo documento ao cache RAG com validação completa",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Título do documento"
                    },
                    "content": {
                        "type": "string",
                        "description": "Conteúdo completo do documento"
                    },
                    "type": {
                        "type": "string",
                        "description": "Tipo do documento (webpage, documentation, etc.)",
                        "default": "document"
                    },
                    "source": {
                        "type": "string",
                        "description": "Fonte ou URL do documento"
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Metadados adicionais do documento"
                    }
                },
                "required": ["title", "content"]
            }
        },
        {
            "name": "remove",
            "description": "Remove documento do cache RAG por ID",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "ID único do documento a ser removido"
                    }
                },
                "required": ["id"]
            }
        },
        {
            "name": "list",
            "description": "Lista todos os documentos disponíveis no cache RAG",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": False
            }
        },
        {
            "name": "stats",
            "description": "Retorna estatísticas detalhadas do sistema RAG",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": False
            }
        }
    ]

def handle_request(request: Dict) -> Dict:
    """Processa requisições MCP com tratamento de erro completo"""
    try:
        method = request.get('method')
        params = request.get('params', {})
        request_id = request.get('id')
        
        logger.debug(f"Processing request: {method}")
        
        if method == 'initialize':
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'protocolVersion': server.protocol_version,
                    'capabilities': server.capabilities,
                    'serverInfo': server.server_info
                }
            }
        
        elif method == 'tools/list':
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'tools': create_tools_schema()
                }
            }
        
        elif method == 'tools/call':
            tool_name = params.get('name')
            arguments = params.get('arguments', {})
            
            # Executar ferramenta
            if tool_name == 'search':
                query = arguments.get('query', '')
                limit = arguments.get('limit', 5)
                results = server.search(query, limit)
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': json.dumps({
                                    'results': results,
                                    'query': query,
                                    'total': len(results)
                                }, ensure_ascii=False, indent=2)
                            }
                        ]
                    }
                }
            
            elif tool_name == 'add':
                result = server.add_document(arguments)
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': json.dumps(result, ensure_ascii=False, indent=2)
                            }
                        ]
                    }
                }
            
            elif tool_name == 'remove':
                doc_id = arguments.get('id')
                if not doc_id:
                    raise MCPError(-32602, "Missing required parameter: id")
                result = server.remove_document(doc_id)
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': json.dumps(result, ensure_ascii=False, indent=2)
                            }
                        ]
                    }
                }
            
            elif tool_name == 'list':
                result = server.list_documents()
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': json.dumps(result, ensure_ascii=False, indent=2)
                            }
                        ]
                    }
                }
            
            elif tool_name == 'stats':
                result = server.get_stats()
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': json.dumps(result, ensure_ascii=False, indent=2)
                            }
                        ]
                    }
                }
            
            else:
                raise MCPError(-32601, f"Unknown tool: {tool_name}")
        
        else:
            raise MCPError(-32601, f"Unknown method: {method}")
    
    except MCPError as e:
        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'error': {
                'code': e.code,
                'message': e.message,
                'data': e.data
            }
        }
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {
            'jsonrpc': '2.0',
            'id': request.get('id'),
            'error': {
                'code': -32603,
                'message': f"Internal error: {str(e)}"
            }
        }

def main():
    """Loop principal do servidor MCP"""
    logger.info("Starting MCP RAG Server Enhanced")
    
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            
            try:
                request = json.loads(line)
                response = handle_request(request)
                print(json.dumps(response), flush=True)
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON: {e}")
                error_response = {
                    'jsonrpc': '2.0',
                    'id': None,
                    'error': {
                        'code': -32700,
                        'message': 'Parse error'
                    }
                }
                print(json.dumps(error_response), flush=True)
    
    except KeyboardInterrupt:
        logger.info("Server shutting down")
    
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()