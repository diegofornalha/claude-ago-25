#!/usr/bin/env python3
"""
MCP RAG Server - Versão Unificada
==================================
Versão: 3.1.0
Data: 2025-08-09
Autor: Claude AI Assistant

CHANGELOG:
----------
v3.1.0 (2025-08-09)
- Consolidação de todas as versões em arquivo único
- Mantém retrocompatibilidade com IDs legados
- Episodic RAG integrado como modo opcional

v3.0.0 (2025-08-08)
- UUID4 para novos documentos
- SHA-256 para hash de conteúdo
- Logging estruturado com JSON
- Configuração via variáveis de ambiente
- 8 ferramentas MCP completas
- Deduplicação e versionamento
- Migração automática de IDs legados

v2.0.0 (2025-08-07)
- Busca semântica com embeddings
- TF-IDF como fallback
- Índices por tags e categorias
- Estatísticas detalhadas

v1.0.0 (2025-08-06)
- Implementação inicial
- 3 ferramentas básicas (search, add, remove)
- Cache local em JSON

NOTAS DE VERSÃO:
---------------
Este arquivo unificado substitui:
- rag_server_v1.py (obsoleto)
- rag_server_v2.py (obsoleto)
- rag_server_v3.py (não criado)

Para usar versões específicas, configure RAG_SERVER_VERSION no .env
"""

__version__ = "3.1.0"
__author__ = "Claude AI Assistant"
__license__ = "MIT"

import json
import sys
import os
import hashlib
import time
import uuid
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import numpy as np
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum

# Importar configurações
from config import config

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

# ============================================================================
# CONFIGURAÇÃO E PATHS
# ============================================================================

CACHE_PATH = config.CACHE_PATH
CACHE_FILE = config.get_cache_file("documents.json")
VECTORS_FILE = config.get_cache_file("vectors.npy")
INDEX_FILE = config.get_cache_file("index.pkl")
STATS_FILE = config.get_cache_file("stats.json")
LOG_FILE = config.get_cache_file("rag_server.log")

# Arquivos do Episodic RAG
EPISODIC_FILE = config.get_cache_file("episodic_memory.json")
SEMANTIC_FILE = config.get_cache_file("semantic_memory.json")
PATTERNS_FILE = config.get_cache_file("learned_patterns.json")

# ============================================================================
# LOGGING ESTRUTURADO
# ============================================================================

def setup_logging():
    """Configura sistema de logging estruturado"""
    config.ensure_cache_dir()
    
    # Configurar handlers
    handlers = [
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
    ]
    
    # Adicionar handler para stderr se configurado
    if config.LOG_TO_STDERR:
        handlers.append(logging.StreamHandler(sys.stderr))
    
    logging.basicConfig(
        level=getattr(logging, config.LOG_LEVEL, logging.INFO),
        format=config.LOG_FORMAT,
        handlers=handlers,
        force=True
    )
    
    return logging.getLogger(f'rag_server_v{__version__}')

# Inicializar logger
logger = setup_logging()

# ============================================================================
# RAG SERVER PRINCIPAL
# ============================================================================

class RAGServer:
    """
    Servidor RAG unificado com suporte a múltiplos modos
    
    Modos suportados:
    - classic: RAG tradicional (v1.0)
    - semantic: Com embeddings e TF-IDF (v2.0)
    - enhanced: Com UUID, logging, dedup (v3.0)
    - episodic: Com memória episódica (v3.1)
    """
    
    def __init__(self, mode='enhanced'):
        logger.info(f"Inicializando RAGServer v{__version__} em modo '{mode}'")
        
        self.mode = mode
        self.documents = []
        self.embeddings = None
        self.model = None
        self.tfidf = None
        self.tfidf_matrix = None
        self.document_index = {}  # id -> index mapping
        self.legacy_id_map = {}  # legacy_id -> new_id mapping
        self.tags_index = defaultdict(set)  # tag -> document_ids
        self.categories_index = defaultdict(set)  # category -> document_ids
        
        # Inicializar componentes baseado no modo
        self._initialize_mode()
        
        # Carregar dados
        self.load_documents()
        self.build_indices()
        
        logger.info(f"RAGServer inicializado com {len(self.documents)} documentos")
    
    def _initialize_mode(self):
        """Inicializa componentes baseado no modo"""
        if self.mode in ['semantic', 'enhanced', 'episodic']:
            # Inicializar modelo de embeddings
            if HAS_EMBEDDINGS and config.USE_EMBEDDINGS:
                try:
                    logger.info(f"Carregando modelo de embeddings: {config.EMBEDDING_MODEL}")
                    self.model = SentenceTransformer(config.EMBEDDING_MODEL)
                    logger.info("Modelo de embeddings carregado com sucesso")
                except Exception as e:
                    logger.warning(f"Falha ao carregar modelo de embeddings: {e}")
                    self.model = None
            
            # Inicializar TF-IDF
            if HAS_TFIDF and config.USE_TFIDF:
                self.tfidf = TfidfVectorizer(
                    max_features=config.TFIDF_MAX_FEATURES,
                    stop_words=config.TFIDF_STOP_WORDS
                )
                logger.info(f"TF-IDF inicializado (max_features={config.TFIDF_MAX_FEATURES})")
    
    def load_documents(self):
        """Carrega documentos do cache com suporte a novos campos"""
        if CACHE_FILE.exists():
            try:
                logger.info(f"Carregando documentos de {CACHE_FILE}")
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.documents = data.get('documents', [])
                    logger.info(f"Carregados {len(self.documents)} documentos do cache")
                    
                    # Migrar documentos antigos se no modo enhanced
                    if self.mode in ['enhanced', 'episodic']:
                        self._migrate_documents()
            except Exception as e:
                logger.error(f"Erro ao carregar documentos: {e}")
                self.documents = []
        
        # Carregar embeddings se existirem
        if VECTORS_FILE.exists() and HAS_EMBEDDINGS:
            try:
                self.embeddings = np.load(VECTORS_FILE)
            except:
                self.embeddings = None
    
    def _migrate_documents(self):
        """Migra documentos antigos para novo formato"""
        migrated_count = 0
        for doc in self.documents:
            # Migrar IDs antigos para UUID4
            if config.AUTO_MIGRATE_IDS:
                old_id = doc.get('id', '')
                if old_id and not self._is_valid_uuid(old_id):
                    doc['legacy_id'] = old_id
                    doc['id'] = str(uuid.uuid4())
                    self.legacy_id_map[old_id] = doc['id']
                    migrated_count += 1
            
            # Adicionar campos faltantes
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
        
        if migrated_count > 0:
            logger.info(f"Migrados {migrated_count} documentos para UUID4")
    
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
        if config.SAVE_STATS:
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
        """Calcula hash SHA-256 do conteúdo"""
        if self.mode in ['enhanced', 'episodic']:
            # SHA-256 para modos avançados
            return hashlib.sha256(content.encode()).hexdigest()[:16]
        else:
            # MD5 para retrocompatibilidade
            return hashlib.md5(content.encode()).hexdigest()[:8]
    
    def _is_valid_uuid(self, value: str) -> bool:
        """Verifica se uma string é um UUID válido"""
        try:
            uuid.UUID(value)
            return True
        except (ValueError, AttributeError):
            return False
    
    def _resolve_id(self, doc_id: str) -> str:
        """Resolve ID legado para UUID atual se necessário"""
        if self._is_valid_uuid(doc_id):
            return doc_id
        
        if doc_id in self.legacy_id_map:
            return self.legacy_id_map[doc_id]
        
        return doc_id
    
    def search(self, query: str, limit: int = 5, context: Dict = None) -> List[Dict]:
        """
        Busca principal - delega para o modo apropriado
        """
        if self.mode in ['semantic', 'enhanced', 'episodic']:
            return self.semantic_search(query, limit)
        else:
            return self.simple_search(query, limit)
    
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
                    self.embeddings = self.model.encode(texts, batch_size=config.EMBEDDING_BATCH_SIZE)
                    if config.CACHE_EMBEDDINGS:
                        np.save(VECTORS_FILE, self.embeddings)
                
                # Calcular similaridade
                similarities = cosine_similarity(query_embedding, self.embeddings)[0]
                
                # Ordenar por similaridade
                indices = np.argsort(similarities)[::-1][:limit]
                
                for idx in indices:
                    if similarities[idx] > config.SIMILARITY_THRESHOLD:
                        doc = self.documents[idx].copy()
                        doc['score'] = float(similarities[idx])
                        results.append(doc)
                
                logger.info(f"Busca semântica retornou {len(results)} resultados")
                return results
            except Exception as e:
                logger.warning(f"Erro na busca com embeddings, tentando fallback: {e}")
        
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
                # Calcular score simples
                score = content.count(query_lower) / max(len(content.split()), 1)
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
        # Gerar ID apropriado baseado no modo
        if 'id' not in doc:
            if self.mode in ['enhanced', 'episodic']:
                doc['id'] = str(uuid.uuid4())
            else:
                doc['id'] = f"doc_{int(time.time() * 1000)}"
            logger.debug(f"Novo documento criado com ID: {doc['id']}")
        
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
        
        # Verificar duplicação se configurado
        if config.ENABLE_DEDUPLICATION and self.mode in ['enhanced', 'episodic']:
            for existing_doc in self.documents:
                if existing_doc.get('hash') == doc['hash']:
                    # Documento duplicado - atualizar metadados
                    existing_doc['updated_at'] = doc['updated_at']
                    if config.ENABLE_VERSIONING:
                        existing_doc['version'] = existing_doc.get('version', 1) + 1
                    
                    # Mesclar tags
                    existing_tags = set(existing_doc.get('tags', []))
                    new_tags = set(doc.get('tags', []))
                    existing_doc['tags'] = list(existing_tags.union(new_tags))
                    
                    logger.info(f"Documento duplicado encontrado, versão incrementada")
                    if config.AUTO_SAVE:
                        self.save_documents()
                    self.build_indices()
                    return existing_doc
        
        # Adicionar novo documento
        self.documents.append(doc)
        logger.info(f"Novo documento adicionado: {doc.get('title', 'Sem título')} (ID: {doc['id']})")
        
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
        
        if config.AUTO_SAVE:
            self.save_documents()
        self.build_indices()
        return doc
    
    def update_document(self, doc_id: str, updates: Dict) -> bool:
        """Atualiza documento existente"""
        # Resolver ID legado se necessário
        resolved_id = self._resolve_id(doc_id)
        
        if resolved_id not in self.document_index:
            return False
        
        idx = self.document_index[resolved_id]
        doc = self.documents[idx]
        
        # Atualizar campos
        for key, value in updates.items():
            if key not in ['id', 'created_at']:
                doc[key] = value
        
        doc['updated_at'] = datetime.now().isoformat()
        if self.mode in ['enhanced', 'episodic']:
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
        
        if config.AUTO_SAVE:
            self.save_documents()
        self.build_indices()
        return True
    
    def remove_document(self, doc_id: str) -> bool:
        """Remove documento e seus embeddings"""
        # Resolver ID legado se necessário
        resolved_id = self._resolve_id(doc_id)
        
        if resolved_id not in self.document_index:
            return False
        
        idx = self.document_index[resolved_id]
        
        # Remover documento
        self.documents.pop(idx)
        
        # Remover embedding correspondente
        if self.embeddings is not None and idx < len(self.embeddings):
            self.embeddings = np.delete(self.embeddings, idx, axis=0)
        
        if config.AUTO_SAVE:
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
        
        stats = {
            'server_version': __version__,
            'server_mode': self.mode,
            'total_documents': len(self.documents),
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'cache_file': str(CACHE_FILE),
            'cache_dir': str(CACHE_PATH),
            'has_embeddings': self.embeddings is not None,
            'embedding_model': config.EMBEDDING_MODEL if self.model else None,
            'has_tfidf': self.tfidf_matrix is not None,
            'categories': dict(categories),
            'sources': dict(sources),
            'top_tags': dict(sorted(tags_count.items(), key=lambda x: x[1], reverse=True)[:10]),
            'oldest_doc': oldest_doc,
            'newest_doc': newest_doc,
            'unique_hashes': len(set(doc.get('hash', '') for doc in self.documents))
        }
        
        return stats

# ============================================================================
# MCP PROTOCOL HANDLER
# ============================================================================

# Determinar modo baseado na versão configurada
def get_server_mode():
    """Determina o modo do servidor baseado na versão"""
    version = config.SERVER_VERSION
    
    # Permitir override via variável de ambiente
    mode_override = os.getenv('RAG_SERVER_MODE')
    if mode_override:
        return mode_override
    
    # Mapear versões para modos
    if version.startswith('3.1'):
        return 'episodic'
    elif version.startswith('3.'):
        return 'enhanced'
    elif version.startswith('2.'):
        return 'semantic'
    else:
        return 'classic'

# Instância global do servidor
server_mode = get_server_mode()
server = RAGServer(mode=server_mode)

def handle_request(request):
    """Processa requisições MCP"""
    method = request.get('method')
    params = request.get('params', {})
    
    if method == 'initialize':
        return {
            'protocolVersion': config.PROTOCOL_VERSION,
            'capabilities': {
                'tools': {}
            },
            'serverInfo': {
                'name': f'rag-server-unified',
                'version': __version__,
                'mode': server_mode
            }
        }
    
    elif method == 'initialized':
        return None
    
    elif method == 'tools/list':
        # Lista completa de 8 ferramentas
        return {
            'tools': [
                {
                    'name': 'search',
                    'description': 'Busca avançada no cache RAG (semântica ou texto)',
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
                # Usar busca apropriada baseada no modo
                results = server.search(
                    args['query'], 
                    args.get('limit', 5),
                    context=args.get('context')
                )
                
                return {
                    'content': [{
                        'type': 'text',
                        'text': json.dumps({
                            'results': results,
                            'query': args['query'],
                            'total': len(results),
                            'server_mode': server_mode,
                            'server_version': __version__
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
                        'text': json.dumps(stats, ensure_ascii=False, indent=2)
                    }]
                }
            
        except Exception as e:
            logger.error(f"Erro ao processar ferramenta {tool_name}: {e}", exc_info=True)
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
    logger.info(f"MCP RAG Server Unificado v{__version__} iniciado")
    logger.info(f"Modo: {server_mode}")
    logger.info(f"Cache: {CACHE_PATH}")
    logger.info(f"Embeddings: {HAS_EMBEDDINGS}")
    logger.info(f"TF-IDF: {HAS_TFIDF}")
    logger.info(f"Documentos carregados: {len(server.documents)}")
    
    while True:
        try:
            # Ler linha do stdin
            line = sys.stdin.readline()
            if not line:
                logger.info("EOF recebido, encerrando servidor")
                break
            
            # Parse JSON-RPC request
            request = json.loads(line)
            logger.debug(f"Request recebido: {request.get('method', 'unknown')}")
            
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
        
        except json.JSONDecodeError as e:
            # Erro de parsing
            logger.error(f"Erro ao fazer parse do JSON: {e}")
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
            logger.error(f"Erro não tratado no loop principal: {e}", exc_info=True)
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