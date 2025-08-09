#!/usr/bin/env python3
"""
MCP RAG Server - Versão com UUID4 e SHA-256 completo
Melhorias de segurança e performance
"""
import json
import sys
import os
import hashlib
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict

# Importações para busca vetorial
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import pickle

# Cache paths
CACHE_PATH = Path.home() / ".claude" / "mcp-rag-cache"
CACHE_FILE = CACHE_PATH / "documents.json"
INDEX_FILE = CACHE_PATH / "index.pkl"
VECTORS_FILE = CACHE_PATH / "vectors.npy"

@dataclass
class Document:
    """Documento com UUID4 e hash SHA-256 completo"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    content: str = ""
    type: str = "text"
    source: str = "manual"
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    content_hash: str = ""
    version: int = 1
    
    def __post_init__(self):
        # Calcular hash SHA-256 completo do conteúdo
        if self.content and not self.content_hash:
            self.content_hash = hashlib.sha256(
                f"{self.title}{self.content}".encode()
            ).hexdigest()
    
    def to_dict(self) -> Dict:
        """Serializa documento"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Document':
        """Deserializa documento"""
        return cls(**data)

class ImprovedRAGServerUUID:
    """Servidor RAG com IDs UUID4 e hash SHA-256"""
    
    def __init__(self):
        self.documents: List[Document] = []
        self.document_index: Dict[str, Document] = {}  # Índice por ID para O(1) lookup
        self.hash_index: Dict[str, str] = {}  # Índice por hash para deduplicação
        self.vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words='english'
        )
        self.vectors = None
        self.version = "4.0.0"
        
        # Garantir diretórios
        CACHE_PATH.mkdir(parents=True, exist_ok=True)
        
        # Carregar dados
        self.load_documents()
        self.rebuild_index()
    
    def load_documents(self):
        """Carrega documentos com validação de UUID"""
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    raw_docs = data.get('documents', [])
                    
                    for raw_doc in raw_docs:
                        try:
                            doc = Document.from_dict(raw_doc)
                            # Validar UUID
                            try:
                                uuid.UUID(doc.id)
                            except ValueError:
                                # Migrar IDs antigos para UUID4
                                doc.id = str(uuid.uuid4())
                            
                            self.documents.append(doc)
                            self.document_index[doc.id] = doc
                            if doc.content_hash:
                                self.hash_index[doc.content_hash] = doc.id
                                
                        except Exception as e:
                            print(f"Documento inválido ignorado: {e}", file=sys.stderr)
                            
            except Exception as e:
                print(f"Erro ao carregar documentos: {e}", file=sys.stderr)
    
    def save_documents(self):
        """Salva documentos com metadados completos"""
        try:
            docs_data = [doc.to_dict() for doc in self.documents]
            
            # Adicionar metadados do servidor
            data = {
                'documents': docs_data,
                'metadata': {
                    'version': self.version,
                    'last_updated': datetime.now().isoformat(),
                    'total_documents': len(self.documents),
                    'index_type': 'tfidf',
                    'features': {
                        'uuid4_ids': True,
                        'sha256_hash': True,
                        'deduplication': True,
                        'vector_search': True
                    }
                }
            }
            
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            print(f"Erro ao salvar documentos: {e}", file=sys.stderr)
    
    def add_document(self, data: Dict) -> Document:
        """Adiciona documento com deduplicação por hash"""
        # Criar documento com UUID4
        doc = Document(
            title=data.get('title', 'Sem título'),
            content=data.get('content', ''),
            type=data.get('type', 'text'),
            source=data.get('source', 'manual'),
            metadata=data.get('metadata', {})
        )
        
        # Verificar duplicação por hash
        if doc.content_hash in self.hash_index:
            existing_id = self.hash_index[doc.content_hash]
            existing_doc = self.document_index[existing_id]
            # Atualizar versão do documento existente
            existing_doc.version += 1
            existing_doc.updated_at = datetime.now().isoformat()
            self.save_documents()
            return existing_doc
        
        # Adicionar novo documento
        self.documents.append(doc)
        self.document_index[doc.id] = doc
        self.hash_index[doc.content_hash] = doc.id
        
        self.save_documents()
        self.rebuild_index()
        
        return doc
    
    def remove_document(self, doc_id: str) -> bool:
        """Remove documento por UUID"""
        try:
            # Validar UUID
            uuid.UUID(doc_id)
            
            if doc_id in self.document_index:
                doc = self.document_index[doc_id]
                
                # Remover de todos os índices
                self.documents.remove(doc)
                del self.document_index[doc_id]
                if doc.content_hash in self.hash_index:
                    del self.hash_index[doc.content_hash]
                
                self.save_documents()
                self.rebuild_index()
                return True
                
        except ValueError:
            print(f"ID inválido (não é UUID4): {doc_id}", file=sys.stderr)
            
        return False
    
    def search(self, query: str, limit: int = 5) -> List[Dict]:
        """Busca com ranking melhorado"""
        if not self.vectors or not self.documents:
            return []
        
        try:
            # Vetorizar query
            query_vector = self.vectorizer.transform([query])
            
            # Calcular similaridade
            similarities = cosine_similarity(query_vector, self.vectors).flatten()
            
            # Ordenar por relevância
            top_indices = similarities.argsort()[-limit:][::-1]
            
            # Preparar resultados com metadados ricos
            results = []
            for idx in top_indices:
                score = similarities[idx]
                if score > 0.01:  # Threshold mínimo
                    doc = self.documents[idx]
                    results.append({
                        'id': doc.id,
                        'title': doc.title,
                        'content': doc.content[:500] + '...' if len(doc.content) > 500 else doc.content,
                        'type': doc.type,
                        'source': doc.source,
                        'score': float(score),
                        'content_hash': doc.content_hash[:8],  # Primeiros 8 chars do hash
                        'version': doc.version,
                        'created_at': doc.created_at,
                        'metadata': doc.metadata
                    })
            
            return results
            
        except Exception as e:
            print(f"Erro na busca: {e}", file=sys.stderr)
            return []
    
    def rebuild_index(self):
        """Reconstrói índice vetorial com cache persistente"""
        if not self.documents:
            return
        
        # Tentar carregar índice do cache
        try:
            if INDEX_FILE.exists() and VECTORS_FILE.exists():
                with open(INDEX_FILE, 'rb') as f:
                    saved_data = pickle.load(f)
                    # Verificar se o índice está atualizado
                    if saved_data.get('doc_count') == len(self.documents):
                        self.vectorizer = saved_data['vectorizer']
                        self.vectors = np.load(VECTORS_FILE)
                        return
        except Exception:
            pass
        
        # Reconstruir índice
        texts = [f"{doc.title} {doc.content}" for doc in self.documents]
        self.vectors = self.vectorizer.fit_transform(texts)
        
        # Salvar índice
        try:
            with open(INDEX_FILE, 'wb') as f:
                pickle.dump({
                    'vectorizer': self.vectorizer,
                    'doc_count': len(self.documents)
                }, f)
            np.save(VECTORS_FILE, self.vectors.toarray())
        except Exception as e:
            print(f"Erro ao salvar índice: {e}", file=sys.stderr)
    
    def get_stats(self) -> Dict:
        """Estatísticas detalhadas do sistema"""
        cache_size = CACHE_FILE.stat().st_size if CACHE_FILE.exists() else 0
        index_size = INDEX_FILE.stat().st_size if INDEX_FILE.exists() else 0
        vectors_size = VECTORS_FILE.stat().st_size if VECTORS_FILE.exists() else 0
        
        # Análise de tipos
        type_counts = {}
        for doc in self.documents:
            type_counts[doc.type] = type_counts.get(doc.type, 0) + 1
        
        # Análise de versões
        version_stats = {
            'single_version': sum(1 for d in self.documents if d.version == 1),
            'multi_version': sum(1 for d in self.documents if d.version > 1),
            'max_version': max((d.version for d in self.documents), default=0)
        }
        
        return {
            'total_documents': len(self.documents),
            'unique_hashes': len(self.hash_index),
            'types': type_counts,
            'version_stats': version_stats,
            'cache_size_bytes': cache_size,
            'index_size_bytes': index_size,
            'vectors_size_bytes': vectors_size,
            'total_size_bytes': cache_size + index_size + vectors_size,
            'server_version': self.version,
            'features': {
                'uuid4_ids': True,
                'sha256_hash': True,
                'deduplication': True,
                'vector_search': True,
                'persistent_index': True
            }
        }

# MCP Protocol handler
def handle_request(request: Dict) -> Dict:
    """Processa requisições MCP com schemas mais estritos"""
    global server
    
    method = request.get('method')
    params = request.get('params', {})
    request_id = request.get('id')
    
    try:
        if method == 'initialize':
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'protocolVersion': '2024-11-05',
                    'serverInfo': {
                        'name': 'rag-uuid',
                        'version': server.version
                    },
                    'capabilities': {
                        'tools': {'listChanged': True}
                    }
                }
            }
        
        elif method == 'tools/list':
            return {
                'jsonrpc': '2.0',
                'id': request_id,
                'result': {
                    'tools': [
                        {
                            'name': 'rag_search',
                            'description': 'Busca vetorial com UUID4',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'query': {
                                        'type': 'string',
                                        'minLength': 1,
                                        'maxLength': 500
                                    },
                                    'limit': {
                                        'type': 'number',
                                        'minimum': 1,
                                        'maximum': 50,
                                        'default': 5
                                    }
                                },
                                'required': ['query'],
                                'additionalProperties': False
                            }
                        },
                        {
                            'name': 'rag_add',
                            'description': 'Adiciona documento com deduplicação',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'title': {
                                        'type': 'string',
                                        'minLength': 1,
                                        'maxLength': 200
                                    },
                                    'content': {
                                        'type': 'string',
                                        'minLength': 1,
                                        'maxLength': 50000
                                    },
                                    'type': {
                                        'type': 'string',
                                        'enum': ['text', 'documentation', 'code', 'webpage', 'markdown']
                                    },
                                    'source': {
                                        'type': 'string',
                                        'maxLength': 100
                                    },
                                    'metadata': {
                                        'type': 'object'
                                    }
                                },
                                'required': ['title', 'content'],
                                'additionalProperties': False
                            }
                        },
                        {
                            'name': 'rag_remove',
                            'description': 'Remove documento por UUID',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'id': {
                                        'type': 'string',
                                        'pattern': '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                                    }
                                },
                                'required': ['id'],
                                'additionalProperties': False
                            }
                        },
                        {
                            'name': 'rag_stats',
                            'description': 'Estatísticas detalhadas',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {},
                                'additionalProperties': False
                            }
                        }
                    ]
                }
            }
        
        elif method == 'tools/call':
            tool_name = params.get('name')
            args = params.get('arguments', {})
            
            if tool_name == 'rag_search':
                results = server.search(args.get('query'), args.get('limit', 5))
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {'content': [{'type': 'text', 'text': json.dumps(results, indent=2)}]}
                }
            
            elif tool_name == 'rag_add':
                doc = server.add_document(args)
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {'content': [{'type': 'text', 'text': f"Documento {doc.id} adicionado (v{doc.version})"}]}
                }
            
            elif tool_name == 'rag_remove':
                success = server.remove_document(args.get('id'))
                message = "Documento removido" if success else "Documento não encontrado"
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {'content': [{'type': 'text', 'text': message}]}
                }
            
            elif tool_name == 'rag_stats':
                stats = server.get_stats()
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {'content': [{'type': 'text', 'text': json.dumps(stats, indent=2)}]}
                }
        
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {'code': -32601, 'message': f'Método não suportado: {method}'}
        }
        
    except Exception as e:
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {'code': -32603, 'message': str(e)}
        }

# Inicializar servidor
server = ImprovedRAGServerUUID()

if __name__ == '__main__':
    print(f"MCP RAG Server UUID v{server.version} iniciado", file=sys.stderr)
    
    for line in sys.stdin:
        try:
            request = json.loads(line)
            response = handle_request(request)
            print(json.dumps(response))
            sys.stdout.flush()
        except json.JSONDecodeError:
            continue
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Erro: {e}", file=sys.stderr)