#!/usr/bin/env python3
"""
MCP RAG Server - Versão Melhorada com Busca Vetorial
Implementa busca semântica eficiente usando TF-IDF e validação de dados
"""
import json
import sys
import os
import time
import hashlib
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum
import logging

# Importações para busca vetorial
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("rag-server-improved")

# Cache paths
CACHE_PATH = Path.home() / ".claude" / "mcp-rag-cache"
CACHE_FILE = CACHE_PATH / "documents.json"
INDEX_FILE = CACHE_PATH / "index.pkl"
VECTORS_FILE = CACHE_PATH / "vectors.npy"

# Validação de esquemas
class DocumentType(Enum):
    WEBPAGE = "webpage"
    DOCUMENTATION = "documentation"
    CODE = "code"
    MARKDOWN = "markdown"
    TEXT = "text"

@dataclass
class Document:
    """Estrutura validada para documentos"""
    id: str
    title: str
    content: str
    type: DocumentType = DocumentType.TEXT
    source: str = "manual"
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    embedding_id: Optional[int] = None
    
    def __post_init__(self):
        # Gerar ID se não fornecido
        if not self.id:
            content_hash = hashlib.md5(self.content.encode()).hexdigest()[:8]
            self.id = f"doc_{int(time.time())}_{content_hash}"
        
        # Converter tipo string para enum
        if isinstance(self.type, str):
            try:
                self.type = DocumentType(self.type)
            except ValueError:
                self.type = DocumentType.TEXT
    
    def to_dict(self) -> Dict:
        """Converte para dicionário serializável"""
        data = asdict(self)
        data['type'] = self.type.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Document':
        """Cria documento a partir de dicionário"""
        return cls(**data)

class VectorSearchEngine:
    """Motor de busca vetorial usando TF-IDF"""
    
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words='english',
            min_df=1,
            max_df=0.95
        )
        self.vectors = None
        self.documents = []
        self.document_ids = []
        
    def fit(self, documents: List[Document]):
        """Treina o modelo com os documentos"""
        if not documents:
            logger.warning("Nenhum documento para indexar")
            return
        
        # Preparar textos
        texts = []
        self.documents = documents
        self.document_ids = []
        
        for doc in documents:
            # Combinar título e conteúdo para melhor indexação
            text = f"{doc.title} {doc.content}"
            texts.append(text)
            self.document_ids.append(doc.id)
        
        # Vetorizar
        try:
            self.vectors = self.vectorizer.fit_transform(texts)
            logger.info(f"Indexados {len(documents)} documentos com {self.vectors.shape[1]} features")
        except Exception as e:
            logger.error(f"Erro ao vetorizar documentos: {e}")
            self.vectors = None
    
    def search(self, query: str, limit: int = 5, threshold: float = 0.1) -> List[Dict]:
        """Busca documentos similares"""
        if self.vectors is None or len(self.documents) == 0:
            logger.warning("Índice vazio, retornando busca textual simples")
            return self._fallback_search(query, limit)
        
        try:
            # Vetorizar query
            query_vector = self.vectorizer.transform([query])
            
            # Calcular similaridade
            similarities = cosine_similarity(query_vector, self.vectors).flatten()
            
            # Ordenar por relevância
            top_indices = similarities.argsort()[-limit:][::-1]
            
            # Filtrar por threshold e preparar resultados
            results = []
            for idx in top_indices:
                score = similarities[idx]
                if score >= threshold:
                    doc = self.documents[idx]
                    results.append({
                        'id': doc.id,
                        'title': doc.title,
                        'content': doc.content[:500] + '...' if len(doc.content) > 500 else doc.content,
                        'type': doc.type.value,
                        'source': doc.source,
                        'score': float(score),
                        'metadata': doc.metadata
                    })
            
            logger.info(f"Busca por '{query}' retornou {len(results)} resultados")
            return results
            
        except Exception as e:
            logger.error(f"Erro na busca vetorial: {e}")
            return self._fallback_search(query, limit)
    
    def _fallback_search(self, query: str, limit: int) -> List[Dict]:
        """Busca textual simples como fallback"""
        query_lower = query.lower()
        results = []
        
        for doc in self.documents[:limit]:
            if query_lower in doc.title.lower() or query_lower in doc.content.lower():
                results.append({
                    'id': doc.id,
                    'title': doc.title,
                    'content': doc.content[:500] + '...' if len(doc.content) > 500 else doc.content,
                    'type': doc.type.value,
                    'source': doc.source,
                    'score': 0.5,  # Score fixo para fallback
                    'metadata': doc.metadata
                })
        
        return results
    
    def save(self):
        """Salva índice em disco"""
        try:
            with open(INDEX_FILE, 'wb') as f:
                pickle.dump({
                    'vectorizer': self.vectorizer,
                    'document_ids': self.document_ids
                }, f)
            
            if self.vectors is not None:
                np.save(VECTORS_FILE, self.vectors.toarray())
            
            logger.info("Índice salvo com sucesso")
        except Exception as e:
            logger.error(f"Erro ao salvar índice: {e}")
    
    def load(self):
        """Carrega índice do disco"""
        try:
            if INDEX_FILE.exists() and VECTORS_FILE.exists():
                with open(INDEX_FILE, 'rb') as f:
                    data = pickle.load(f)
                    self.vectorizer = data['vectorizer']
                    self.document_ids = data['document_ids']
                
                vectors_array = np.load(VECTORS_FILE)
                from scipy.sparse import csr_matrix
                self.vectors = csr_matrix(vectors_array)
                
                logger.info("Índice carregado com sucesso")
                return True
        except Exception as e:
            logger.error(f"Erro ao carregar índice: {e}")
        
        return False

class ImprovedRAGServer:
    """Servidor RAG melhorado com busca vetorial e validação"""
    
    def __init__(self):
        self.documents: List[Document] = []
        self.search_engine = VectorSearchEngine()
        self.version = "3.0.0"
        
        # Garantir diretórios
        CACHE_PATH.mkdir(parents=True, exist_ok=True)
        
        # Carregar dados
        self.load_documents()
        
        # Construir índice
        self.rebuild_index()
        
        logger.info(f"RAG Server Improved v{self.version} inicializado")
    
    def load_documents(self):
        """Carrega documentos do cache com validação"""
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    raw_docs = data.get('documents', [])
                    
                    # Validar e converter documentos
                    self.documents = []
                    for raw_doc in raw_docs:
                        try:
                            doc = Document.from_dict(raw_doc)
                            self.documents.append(doc)
                        except Exception as e:
                            logger.warning(f"Documento inválido ignorado: {e}")
                    
                    logger.info(f"Carregados {len(self.documents)} documentos válidos")
            except Exception as e:
                logger.error(f"Erro ao carregar documentos: {e}")
                self.documents = []
        else:
            logger.info("Arquivo de cache não encontrado, iniciando vazio")
            self.documents = []
    
    def save_documents(self):
        """Salva documentos no cache"""
        try:
            docs_data = [doc.to_dict() for doc in self.documents]
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump({'documents': docs_data}, f, ensure_ascii=False, indent=2)
            logger.info(f"Salvos {len(self.documents)} documentos")
        except Exception as e:
            logger.error(f"Erro ao salvar documentos: {e}")
    
    def rebuild_index(self):
        """Reconstrói índice de busca"""
        if self.documents:
            # Tentar carregar índice existente
            if not self.search_engine.load():
                # Se falhar, reconstruir
                logger.info("Reconstruindo índice de busca...")
                self.search_engine.fit(self.documents)
                self.search_engine.save()
            else:
                # Verificar se índice está atualizado
                if len(self.search_engine.document_ids) != len(self.documents):
                    logger.info("Índice desatualizado, reconstruindo...")
                    self.search_engine.fit(self.documents)
                    self.search_engine.save()
                else:
                    # Recarregar documentos no engine
                    self.search_engine.documents = self.documents
    
    def add_document(self, data: Dict) -> Document:
        """Adiciona documento validado"""
        try:
            # Criar documento validado
            doc = Document(
                id=data.get('id', ''),
                title=data.get('title', 'Sem título'),
                content=data.get('content', ''),
                type=data.get('type', 'text'),
                source=data.get('source', 'manual'),
                metadata=data.get('metadata', {})
            )
            
            # Adicionar à lista
            self.documents.append(doc)
            
            # Salvar
            self.save_documents()
            
            # Reconstruir índice
            self.rebuild_index()
            
            logger.info(f"Documento {doc.id} adicionado com sucesso")
            return doc
            
        except Exception as e:
            logger.error(f"Erro ao adicionar documento: {e}")
            raise
    
    def search(self, query: str, limit: int = 5) -> List[Dict]:
        """Busca documentos usando busca vetorial"""
        return self.search_engine.search(query, limit)
    
    def remove_document(self, doc_id: str) -> bool:
        """Remove documento por ID"""
        for i, doc in enumerate(self.documents):
            if doc.id == doc_id:
                self.documents.pop(i)
                self.save_documents()
                self.rebuild_index()
                logger.info(f"Documento {doc_id} removido")
                return True
        return False
    
    def get_stats(self) -> Dict:
        """Retorna estatísticas do sistema"""
        cache_size = CACHE_FILE.stat().st_size if CACHE_FILE.exists() else 0
        index_size = INDEX_FILE.stat().st_size if INDEX_FILE.exists() else 0
        vectors_size = VECTORS_FILE.stat().st_size if VECTORS_FILE.exists() else 0
        
        # Estatísticas por tipo
        type_counts = {}
        for doc in self.documents:
            doc_type = doc.type.value
            type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
        
        return {
            'total_documents': len(self.documents),
            'types': type_counts,
            'cache_size_bytes': cache_size,
            'index_size_bytes': index_size,
            'vectors_size_bytes': vectors_size,
            'total_size_bytes': cache_size + index_size + vectors_size,
            'version': self.version,
            'features': {
                'vector_search': True,
                'validation': True,
                'auto_indexing': True,
                'tf_idf': True
            }
        }

# MCP Protocol Handler
def handle_request(request: Dict) -> Dict:
    """Processa requisições MCP"""
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
                        'name': 'rag-improved',
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
                            'description': 'Busca vetorial em documentos',
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
                            'name': 'rag_add',
                            'description': 'Adiciona documento ao índice',
                            'inputSchema': {
                                'type': 'object',
                                'properties': {
                                    'title': {'type': 'string'},
                                    'content': {'type': 'string'},
                                    'type': {'type': 'string'},
                                    'source': {'type': 'string'},
                                    'metadata': {'type': 'object'}
                                },
                                'required': ['title', 'content']
                            }
                        },
                        {
                            'name': 'rag_stats',
                            'description': 'Estatísticas do sistema RAG',
                            'inputSchema': {'type': 'object'}
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
                    'result': {'content': [{'type': 'text', 'text': f"Documento {doc.id} adicionado"}]}
                }
            
            elif tool_name == 'rag_stats':
                stats = server.get_stats()
                return {
                    'jsonrpc': '2.0',
                    'id': request_id,
                    'result': {'content': [{'type': 'text', 'text': json.dumps(stats, indent=2)}]}
                }
        
        # Método não suportado
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {'code': -32601, 'message': f'Método não suportado: {method}'}
        }
        
    except Exception as e:
        logger.error(f"Erro ao processar requisição: {e}")
        return {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': {'code': -32603, 'message': str(e)}
        }

# Inicializar servidor
server = ImprovedRAGServer()

# Main loop
if __name__ == '__main__':
    logger.info("Servidor RAG Improved iniciado, aguardando requisições...")
    
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
            logger.error(f"Erro fatal: {e}")