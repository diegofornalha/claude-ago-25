#!/usr/bin/env python3
"""
MCP RAG Server v2 - Versão melhorada com busca semântica e mais recursos
"""
import json
import sys
import os
import hashlib
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import numpy as np
from collections import defaultdict

# Importações para embeddings
try:
    from sentence_transformers import SentenceTransformer
    HAS_EMBEDDINGS = True
except ImportError:
    HAS_EMBEDDINGS = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_TFIDF = True
except ImportError:
    HAS_TFIDF = False

# Cache paths
CACHE_PATH = Path.home() / ".claude" / "mcp-rag-cache"
CACHE_FILE = CACHE_PATH / "documents.json"
VECTORS_FILE = CACHE_PATH / "vectors.npy"
INDEX_FILE = CACHE_PATH / "index.pkl"
STATS_FILE = CACHE_PATH / "stats.json"

class RAGServerV2:
    def __init__(self):
        self.documents = []
        self.embeddings = None
        self.model = None
        self.tfidf = None
        self.tfidf_matrix = None
        self.document_index = {}  # id -> index mapping
        self.tags_index = defaultdict(set)  # tag -> document_ids
        self.categories_index = defaultdict(set)  # category -> document_ids
        
        # Inicializar modelo de embeddings se disponível
        if HAS_EMBEDDINGS:
            try:
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
            except:
                self.model = None
        
        # Inicializar TF-IDF como fallback
        if HAS_TFIDF:
            self.tfidf = TfidfVectorizer(max_features=1000, stop_words='english')
        
        self.load_documents()
        self.build_indices()
    
    def load_documents(self):
        """Carrega documentos do cache com suporte a novos campos"""
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.documents = data.get('documents', [])
                    
                    # Migrar documentos antigos para novo formato
                    for doc in self.documents:
                        if 'tags' not in doc:
                            doc['tags'] = []
                        if 'category' not in doc:
                            doc['category'] = 'uncategorized'
                        if 'hash' not in doc:
                            doc['hash'] = self.compute_hash(doc.get('content', ''))
                        if 'created_at' not in doc:
                            doc['created_at'] = doc.get('timestamp', datetime.now().isoformat())
                        if 'updated_at' not in doc:
                            doc['updated_at'] = doc.get('timestamp', datetime.now().isoformat())
                        if 'version' not in doc:
                            doc['version'] = 1
            except Exception as e:
                print(f"Erro ao carregar documentos: {e}", file=sys.stderr)
                self.documents = []
        
        # Carregar embeddings se existirem
        if VECTORS_FILE.exists() and HAS_EMBEDDINGS:
            try:
                self.embeddings = np.load(VECTORS_FILE)
            except:
                self.embeddings = None
    
    def save_documents(self):
        """Salva documentos e embeddings no cache"""
        CACHE_PATH.mkdir(parents=True, exist_ok=True)
        
        # Salvar documentos
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump({'documents': self.documents}, f, ensure_ascii=False, indent=2)
        
        # Salvar embeddings
        if self.embeddings is not None:
            np.save(VECTORS_FILE, self.embeddings)
        
        # Atualizar estatísticas
        self.save_stats()
    
    def save_stats(self):
        """Salva estatísticas do cache"""
        stats = self.get_stats()
        with open(STATS_FILE, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
    
    def build_indices(self):
        """Constrói índices para busca rápida"""
        self.document_index = {}
        self.tags_index = defaultdict(set)
        self.categories_index = defaultdict(set)
        
        for i, doc in enumerate(self.documents):
            doc_id = doc.get('id')
            if doc_id:
                self.document_index[doc_id] = i
                
                # Índice de tags
                for tag in doc.get('tags', []):
                    self.tags_index[tag.lower()].add(doc_id)
                
                # Índice de categorias
                category = doc.get('category', 'uncategorized')
                self.categories_index[category.lower()].add(doc_id)
        
        # Construir matriz TF-IDF se disponível
        if HAS_TFIDF and self.tfidf and len(self.documents) > 0:
            try:
                texts = [doc.get('content', '') for doc in self.documents]
                self.tfidf_matrix = self.tfidf.fit_transform(texts)
            except:
                self.tfidf_matrix = None
    
    def compute_hash(self, content: str) -> str:
        """Calcula hash do conteúdo para deduplicação"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def semantic_search(self, query: str, limit: int = 5) -> List[Dict]:
        """Busca semântica usando embeddings ou TF-IDF"""
        if not self.documents:
            return []
        
        results = []
        
        # Tentar busca com embeddings primeiro
        if self.model and HAS_EMBEDDINGS:
            try:
                # Gerar embedding da query
                query_embedding = self.model.encode([query])
                
                # Se não temos embeddings dos documentos, criar agora
                if self.embeddings is None or len(self.embeddings) != len(self.documents):
                    texts = [f"{doc.get('title', '')} {doc.get('content', '')}" for doc in self.documents]
                    self.embeddings = self.model.encode(texts)
                    np.save(VECTORS_FILE, self.embeddings)
                
                # Calcular similaridade
                similarities = cosine_similarity(query_embedding, self.embeddings)[0]
                
                # Ordenar por similaridade
                indices = np.argsort(similarities)[::-1][:limit]
                
                for idx in indices:
                    if similarities[idx] > 0.1:  # Threshold mínimo
                        doc = self.documents[idx].copy()
                        doc['score'] = float(similarities[idx])
                        results.append(doc)
                
                return results
            except Exception as e:
                print(f"Erro na busca semântica: {e}", file=sys.stderr)
        
        # Fallback para TF-IDF
        if HAS_TFIDF and self.tfidf_matrix is not None:
            try:
                query_vec = self.tfidf.transform([query])
                similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]
                indices = np.argsort(similarities)[::-1][:limit]
                
                for idx in indices:
                    if similarities[idx] > 0.05:
                        doc = self.documents[idx].copy()
                        doc['score'] = float(similarities[idx])
                        results.append(doc)
                
                return results
            except:
                pass
        
        # Fallback final: busca por substring
        return self.simple_search(query, limit)
    
    def simple_search(self, query: str, limit: int = 5) -> List[Dict]:
        """Busca simples por texto (fallback)"""
        query_lower = query.lower()
        results = []
        
        for doc in self.documents:
            content = f"{doc.get('title', '')} {doc.get('content', '')} {' '.join(doc.get('tags', []))}".lower()
            if query_lower in content:
                # Calcular score simples baseado na frequência
                score = content.count(query_lower) / len(content.split())
                doc_copy = doc.copy()
                doc_copy['score'] = score
                results.append(doc_copy)
        
        # Ordenar por score
        results.sort(key=lambda x: x.get('score', 0), reverse=True)
        return results[:limit]
    
    def search_by_tags(self, tags: List[str], limit: int = 10) -> List[Dict]:
        """Busca documentos por tags"""
        matching_ids = set()
        
        for tag in tags:
            matching_ids.update(self.tags_index.get(tag.lower(), set()))
        
        results = []
        for doc_id in matching_ids:
            if doc_id in self.document_index:
                idx = self.document_index[doc_id]
                results.append(self.documents[idx])
        
        return results[:limit]
    
    def search_by_category(self, category: str, limit: int = 10) -> List[Dict]:
        """Busca documentos por categoria"""
        doc_ids = self.categories_index.get(category.lower(), set())
        results = []
        
        for doc_id in doc_ids:
            if doc_id in self.document_index:
                idx = self.document_index[doc_id]
                results.append(self.documents[idx])
        
        return results[:limit]
    
    def add_document(self, doc: Dict) -> Dict:
        """Adiciona documento com deduplicação e versionamento"""
        # Gerar ID se não existir
        if 'id' not in doc:
            doc['id'] = f"doc_{int(time.time() * 1000)}"
        
        # Adicionar campos obrigatórios
        content = doc.get('content', '')
        doc['hash'] = self.compute_hash(content)
        doc['created_at'] = datetime.now().isoformat()
        doc['updated_at'] = datetime.now().isoformat()
        doc['version'] = 1
        
        # Garantir campos opcionais
        if 'tags' not in doc:
            doc['tags'] = []
        if 'category' not in doc:
            doc['category'] = 'uncategorized'
        
        # Verificar duplicação
        for existing_doc in self.documents:
            if existing_doc.get('hash') == doc['hash']:
                # Documento duplicado - atualizar metadados apenas
                existing_doc['updated_at'] = doc['updated_at']
                existing_doc['version'] = existing_doc.get('version', 1) + 1
                
                # Mesclar tags
                existing_tags = set(existing_doc.get('tags', []))
                new_tags = set(doc.get('tags', []))
                existing_doc['tags'] = list(existing_tags.union(new_tags))
                
                self.save_documents()
                self.build_indices()
                return existing_doc
        
        # Adicionar novo documento
        self.documents.append(doc)
        
        # Atualizar embeddings se disponível
        if self.model and HAS_EMBEDDINGS:
            try:
                text = f"{doc.get('title', '')} {content}"
                new_embedding = self.model.encode([text])
                
                if self.embeddings is None:
                    self.embeddings = new_embedding
                else:
                    self.embeddings = np.vstack([self.embeddings, new_embedding])
            except:
                pass
        
        self.save_documents()
        self.build_indices()
        return doc
    
    def update_document(self, doc_id: str, updates: Dict) -> bool:
        """Atualiza documento existente"""
        if doc_id not in self.document_index:
            return False
        
        idx = self.document_index[doc_id]
        doc = self.documents[idx]
        
        # Atualizar campos
        for key, value in updates.items():
            if key not in ['id', 'created_at']:  # Não permitir mudança desses campos
                doc[key] = value
        
        doc['updated_at'] = datetime.now().isoformat()
        doc['version'] = doc.get('version', 1) + 1
        
        # Recalcular hash se conteúdo mudou
        if 'content' in updates:
            doc['hash'] = self.compute_hash(updates['content'])
            
            # Atualizar embedding
            if self.model and HAS_EMBEDDINGS and self.embeddings is not None:
                try:
                    text = f"{doc.get('title', '')} {doc.get('content', '')}"
                    new_embedding = self.model.encode([text])
                    self.embeddings[idx] = new_embedding[0]
                except:
                    pass
        
        self.save_documents()
        self.build_indices()
        return True
    
    def remove_document(self, doc_id: str) -> bool:
        """Remove documento e seus embeddings"""
        if doc_id not in self.document_index:
            return False
        
        idx = self.document_index[doc_id]
        
        # Remover documento
        self.documents.pop(idx)
        
        # Remover embedding correspondente
        if self.embeddings is not None and idx < len(self.embeddings):
            self.embeddings = np.delete(self.embeddings, idx, axis=0)
        
        self.save_documents()
        self.build_indices()
        return True
    
    def list_documents(self, filters: Optional[Dict] = None) -> List[Dict]:
        """Lista documentos com filtros opcionais"""
        results = []
        
        for doc in self.documents:
            # Aplicar filtros
            if filters:
                if 'category' in filters and doc.get('category') != filters['category']:
                    continue
                if 'tags' in filters:
                    doc_tags = set(doc.get('tags', []))
                    filter_tags = set(filters['tags'])
                    if not filter_tags.intersection(doc_tags):
                        continue
                if 'source' in filters and doc.get('source') != filters['source']:
                    continue
            
            # Resumo do documento
            results.append({
                'id': doc.get('id'),
                'title': doc.get('title'),
                'category': doc.get('category'),
                'tags': doc.get('tags', []),
                'source': doc.get('source'),
                'created_at': doc.get('created_at'),
                'updated_at': doc.get('updated_at'),
                'version': doc.get('version', 1),
                'content_preview': doc.get('content', '')[:100] + '...' if len(doc.get('content', '')) > 100 else doc.get('content', '')
            })
        
        return results
    
    def get_stats(self) -> Dict:
        """Estatísticas detalhadas do cache"""
        total_size = 0
        categories = defaultdict(int)
        sources = defaultdict(int)
        tags_count = defaultdict(int)
        
        oldest_doc = None
        newest_doc = None
        
        for doc in self.documents:
            # Tamanho
            content = doc.get('content', '')
            total_size += len(content.encode('utf-8'))
            
            # Categorias
            categories[doc.get('category', 'uncategorized')] += 1
            
            # Sources
            sources[doc.get('source', 'unknown')] += 1
            
            # Tags
            for tag in doc.get('tags', []):
                tags_count[tag] += 1
            
            # Datas
            created_at = doc.get('created_at', doc.get('timestamp'))
            if created_at:
                if not oldest_doc or created_at < oldest_doc:
                    oldest_doc = created_at
                if not newest_doc or created_at > newest_doc:
                    newest_doc = created_at
        
        return {
            'total_documents': len(self.documents),
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'cache_file': str(CACHE_FILE),
            'cache_dir': str(CACHE_PATH),
            'has_embeddings': self.embeddings is not None,
            'embedding_model': 'all-MiniLM-L6-v2' if self.model else None,
            'has_tfidf': self.tfidf_matrix is not None,
            'categories': dict(categories),
            'sources': dict(sources),
            'top_tags': dict(sorted(tags_count.items(), key=lambda x: x[1], reverse=True)[:10]),
            'oldest_doc': oldest_doc,
            'newest_doc': newest_doc,
            'unique_hashes': len(set(doc.get('hash', '') for doc in self.documents))
        }

# Instância global
server = RAGServerV2()

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
                'name': 'rag-server-v2',
                'version': '2.0.0'
            }
        }
    
    elif method == 'initialized':
        return None
    
    elif method == 'tools/list':
        return {
            'tools': [
                {
                    'name': 'search',
                    'description': 'Busca semântica avançada no cache RAG',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'query': {'type': 'string'},
                            'limit': {'type': 'number', 'default': 5},
                            'use_semantic': {'type': 'boolean', 'default': True}
                        },
                        'required': ['query']
                    }
                },
                {
                    'name': 'search_by_tags',
                    'description': 'Busca documentos por tags',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'tags': {'type': 'array', 'items': {'type': 'string'}},
                            'limit': {'type': 'number', 'default': 10}
                        },
                        'required': ['tags']
                    }
                },
                {
                    'name': 'search_by_category',
                    'description': 'Busca documentos por categoria',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'category': {'type': 'string'},
                            'limit': {'type': 'number', 'default': 10}
                        },
                        'required': ['category']
                    }
                },
                {
                    'name': 'add',
                    'description': 'Adiciona documento com tags e categoria',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'title': {'type': 'string'},
                            'content': {'type': 'string'},
                            'type': {'type': 'string'},
                            'source': {'type': 'string'},
                            'tags': {'type': 'array', 'items': {'type': 'string'}},
                            'category': {'type': 'string'}
                        },
                        'required': ['title', 'content']
                    }
                },
                {
                    'name': 'update',
                    'description': 'Atualiza documento existente',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'id': {'type': 'string'},
                            'title': {'type': 'string'},
                            'content': {'type': 'string'},
                            'tags': {'type': 'array', 'items': {'type': 'string'}},
                            'category': {'type': 'string'}
                        },
                        'required': ['id']
                    }
                },
                {
                    'name': 'remove',
                    'description': 'Remove documento do cache',
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
                    'description': 'Lista documentos com filtros',
                    'inputSchema': {
                        'type': 'object',
                        'properties': {
                            'category': {'type': 'string'},
                            'tags': {'type': 'array', 'items': {'type': 'string'}},
                            'source': {'type': 'string'}
                        }
                    }
                },
                {
                    'name': 'stats',
                    'description': 'Estatísticas detalhadas do cache',
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
                use_semantic = args.get('use_semantic', True)
                if use_semantic:
                    results = server.semantic_search(args['query'], args.get('limit', 5))
                else:
                    results = server.simple_search(args['query'], args.get('limit', 5))
                
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'results': results,
                            'query': args['query'],
                            'total': len(results),
                            'search_type': 'semantic' if use_semantic else 'text'
                        }, ensure_ascii=False)
                    }]
                }
            
            elif tool_name == 'search_by_tags':
                results = server.search_by_tags(args['tags'], args.get('limit', 10))
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'results': results,
                            'tags': args['tags'],
                            'total': len(results)
                        }, ensure_ascii=False)
                    }]
                }
            
            elif tool_name == 'search_by_category':
                results = server.search_by_category(args['category'], args.get('limit', 10))
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'results': results,
                            'category': args['category'],
                            'total': len(results)
                        }, ensure_ascii=False)
                    }]
                }
            
            elif tool_name == 'add':
                doc = server.add_document({
                    'title': args['title'],
                    'content': args['content'],
                    'type': args.get('type', 'text'),
                    'source': args.get('source', 'manual'),
                    'tags': args.get('tags', []),
                    'category': args.get('category', 'uncategorized')
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
            
            elif tool_name == 'update':
                success = server.update_document(args['id'], args)
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'success': success,
                            'id': args['id']
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
                results = server.list_documents(args if args else None)
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'documents': results,
                            'total': len(results)
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
            
        except Exception as e:
            return {
                'error': {
                    'code': -32603,
                    'message': str(e)
                }
            }
    
    return {
        'error': {
            'code': -32601,
            'message': f'Method not found: {method}'
        }
    }

def main():
    """Loop principal do servidor MCP"""
    while True:
        try:
            # Ler linha do stdin
            line = sys.stdin.readline()
            if not line:
                break
            
            # Parse JSON-RPC request
            request = json.loads(line)
            
            # Processar requisição
            response = handle_request(request)
            
            # Construir resposta JSON-RPC
            if response is not None:
                if 'error' in response:
                    output = {
                        'jsonrpc': '2.0',
                        'id': request.get('id'),
                        'error': response['error']
                    }
                else:
                    output = {
                        'jsonrpc': '2.0',
                        'id': request.get('id'),
                        'result': response
                    }
                
                # Enviar resposta
                print(json.dumps(output))
                sys.stdout.flush()
        
        except json.JSONDecodeError:
            # Erro de parsing
            error_response = {
                'jsonrpc': '2.0',
                'id': None,
                'error': {
                    'code': -32700,
                    'message': 'Parse error'
                }
            }
            print(json.dumps(error_response))
            sys.stdout.flush()
        
        except Exception as e:
            # Erro interno
            error_response = {
                'jsonrpc': '2.0',
                'id': request.get('id') if 'request' in locals() else None,
                'error': {
                    'code': -32603,
                    'message': f'Internal error: {str(e)}'
                }
            }
            print(json.dumps(error_response))
            sys.stdout.flush()

if __name__ == '__main__':
    main()