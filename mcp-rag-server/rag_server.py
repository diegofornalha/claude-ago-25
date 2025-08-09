#!/usr/bin/env python3
"""
MCP RAG Server - Versão mínima funcional
"""
import json
import sys
import os
from pathlib import Path

# Cache path
CACHE_PATH = Path.home() / ".claude" / "mcp-rag-cache"
CACHE_FILE = CACHE_PATH / "documents.json"

class RAGServer:
    def __init__(self):
        self.documents = []
        self.load_documents()
    
    def load_documents(self):
        """Carrega documentos do cache"""
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.documents = data.get('documents', [])
            except:
                self.documents = []
    
    def save_documents(self):
        """Salva documentos no cache"""
        CACHE_PATH.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump({'documents': self.documents}, f, ensure_ascii=False, indent=2)
    
    def search(self, query, limit=5):
        """Busca simples por texto"""
        query_lower = query.lower()
        results = []
        
        for doc in self.documents:
            content = f"{doc.get('title', '')} {doc.get('content', '')}".lower()
            if query_lower in content:
                results.append({
                    'id': doc.get('id'),
                    'title': doc.get('title'),
                    'content': doc.get('content', '')[:200] + '...' if len(doc.get('content', '')) > 200 else doc.get('content', ''),
                    'type': doc.get('type'),
                    'source': doc.get('source')
                })
                
                if len(results) >= limit:
                    break
        
        return results
    
    def add_document(self, doc):
        """Adiciona documento"""
        if 'id' not in doc:
            import time
            doc['id'] = f"doc_{int(time.time() * 1000)}"
        
        self.documents.append(doc)
        self.save_documents()
        return doc
    
    def remove_document(self, doc_id):
        """Remove documento"""
        for i, doc in enumerate(self.documents):
            if doc.get('id') == doc_id:
                self.documents.pop(i)
                self.save_documents()
                return True
        return False
    
    def list_documents(self):
        """Lista todos os documentos"""
        return [{
            'id': doc.get('id'),
            'title': doc.get('title'),
            'type': doc.get('type'),
            'source': doc.get('source')
        } for doc in self.documents]
    
    def get_stats(self):
        """Estatísticas do cache"""
        return {
            'total_documents': len(self.documents),
            'cache_file': str(CACHE_FILE),
            'cache_size_bytes': CACHE_FILE.stat().st_size if CACHE_FILE.exists() else 0
        }

# Instância global
server = RAGServer()

def handle_request(request):
    """Processa requisições MCP"""
    method = request.get('method')
    params = request.get('params', {})
    
    if method == 'initialize':
        return {
            'protocolVersion': '2024-11-05',
            'capabilities': {
                'tools': {}
            },
            'serverInfo': {
                'name': 'rag-server',
                'version': '1.0.0'
            }
        }
    
    elif method == 'initialized':
        return None  # Notificação, sem resposta
    
    elif method == 'tools/list':
        return {
            'tools': [
                {
                    'name': 'search',
                    'description': 'Busca documentos no cache RAG',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'query': {'type': 'string'},
                            'limit': {'type': 'number', 'default': 5}
                        },
                        'required': ['query']
                    }
                },
                {
                    'name': 'add',
                    'description': 'Adiciona documento ao cache RAG',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'title': {'type': 'string'},
                            'content': {'type': 'string'},
                            'type': {'type': 'string'},
                            'source': {'type': 'string'}
                        },
                        'required': ['title', 'content']
                    }
                },
                {
                    'name': 'remove',
                    'description': 'Remove documento do cache RAG',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'string'}
                        },
                        'required': ['id']
                    }
                },
                {
                    'name': 'list',
                    'description': 'Lista todos os documentos',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {}
                    }
                },
                {
                    'name': 'stats',
                    'description': 'Estatísticas do cache RAG',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {}
                    }
                }
            ]
        }
    
    elif method == 'tools/call':
        tool_name = params.get('name')
        args = params.get('arguments', {})
        
        try:
            if tool_name == 'search':
                results = server.search(args['query'], args.get('limit', 5))
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'results': results,
                            'query': args['query'],
                            'total': len(results)
                        }, ensure_ascii=False)
                    }]
                }
            
            elif tool_name == 'add':
                doc = server.add_document({
                    'title': args['title'],
                    'content': args['content'],
                    'type': args.get('type', 'general'),
                    'source': args.get('source', 'manual')
                })
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'success': True,
                            'document': doc
                        }, ensure_ascii=False)
                    }]
                }
            
            elif tool_name == 'remove':
                success = server.remove_document(args['id'])
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'success': success,
                            'id': args['id']
                        }, ensure_ascii=False)
                    }]
                }
            
            elif tool_name == 'list':
                docs = server.list_documents()
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'documents': docs,
                            'total': len(docs)
                        }, ensure_ascii=False)
                    }]
                }
            
            elif tool_name == 'stats':
                stats = server.get_stats()
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps(stats, ensure_ascii=False)
                    }]
                }
            
            else:
                return {'error': {'message': f'Tool not found: {tool_name}'}}
        
        except Exception as e:
            return {'error': {'message': str(e)}}
    
    else:
        return {'error': {'message': f'Method not supported: {method}'}}

def main():
    """Loop principal do servidor MCP"""
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            request = json.loads(line.strip())
            result = handle_request(request)
            
            if result is None:
                continue
            
            response = {
                'jsonrpc': '2.0',
                'id': request.get('id'),
                'result': result
            }
            
            print(json.dumps(response))
            sys.stdout.flush()
            
        except Exception as e:
            error_response = {
                'jsonrpc': '2.0',
                'id': request.get('id') if 'request' in locals() else None,
                'error': {
                    'code': -32603,
                    'message': str(e)
                }
            }
            print(json.dumps(error_response))
            sys.stdout.flush()

if __name__ == '__main__':
    main()