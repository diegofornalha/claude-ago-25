#!/usr/bin/env python3
"""
A2A Content Manager para MCP RAG Server
========================================
Gerencia ingestão, sincronização e organização de conteúdos A2A Protocol.

Features:
- Ingestão em lote de URLs, markdown e texto
- Sincronização frontend → MCP
- Padronização de tags e categorias
- Buscas salvas e queries predefinidas

Autor: Claude AI Assistant
Data: 2025-08-09
"""

import json
import sys
import os
import re
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import requests
from urllib.parse import urlparse

# Adicionar o diretório do servidor MCP ao path
sys.path.insert(0, str(Path(__file__).parent))

from rag_server import RAGServer
from config import Config

class A2AContentManager:
    """Gerenciador de conteúdos A2A para o RAG Server"""
    
    # Taxonomia padronizada A2A
    CATEGORIES = {
        'a2a:docs': 'Documentação oficial A2A',
        'a2a:tutorials': 'Tutoriais e guias A2A',
        'a2a:api': 'Referência de API A2A',
        'a2a:examples': 'Exemplos de código A2A',
        'a2a:blog': 'Posts e artigos do blog A2A',
        'a2a:registry': 'Registry de implementações A2A',
        'a2a:agents': 'Agentes e ferramentas A2A',
        'a2a:concepts': 'Conceitos e arquitetura A2A'
    }
    
    # Tags padrão por categoria
    DEFAULT_TAGS = {
        'a2a:docs': ['a2a', 'protocol', 'documentation', 'reference'],
        'a2a:tutorials': ['a2a', 'tutorial', 'guide', 'howto'],
        'a2a:api': ['a2a', 'api', 'reference', 'specification'],
        'a2a:examples': ['a2a', 'example', 'code', 'implementation'],
        'a2a:blog': ['a2a', 'blog', 'article', 'news'],
        'a2a:registry': ['a2a', 'registry', 'implementation', 'catalog'],
        'a2a:agents': ['a2a', 'agent', 'tool', 'integration'],
        'a2a:concepts': ['a2a', 'concept', 'architecture', 'design']
    }
    
    # URLs conhecidas A2A
    A2A_URLS = {
        'https://a2aprotocol.ai/docs/': 'a2a:docs',
        'https://a2aprotocol.ai/blog': 'a2a:blog',
        'https://a2a-protocol.org/latest/topics/key-concepts/': 'a2a:concepts',
        'https://a2aregistry.in/': 'a2a:registry',
        'https://a2a.ac/#agents': 'a2a:agents'
    }
    
    def __init__(self):
        self.config = Config()
        self.server = RAGServer(mode='enhanced')
        self.sync_state_file = Path.home() / ".claude" / "mcp-rag-cache" / "a2a_sync_state.json"
        self.saved_searches_file = Path.home() / ".claude" / "mcp-rag-cache" / "a2a_saved_searches.json"
        self.frontend_cache_dir = Path.home() / ".claude" / "todos" / "app_todos_bd_tasks" / "frontend"
        
        # Carregar estado de sincronização
        self.sync_state = self.load_sync_state()
        
        # Inicializar buscas salvas
        self.init_saved_searches()
    
    def load_sync_state(self) -> Dict:
        """Carrega estado de sincronização"""
        if self.sync_state_file.exists():
            try:
                with open(self.sync_state_file, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {'last_sync': None, 'synced_items': {}}
    
    def save_sync_state(self):
        """Salva estado de sincronização"""
        self.sync_state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.sync_state_file, 'w') as f:
            json.dump(self.sync_state, f, indent=2)
    
    def init_saved_searches(self):
        """Inicializa buscas salvas padrão"""
        default_searches = {
            'a2a_all': {
                'query': 'a2a',
                'description': 'Todos os documentos A2A',
                'filters': {'source': 'a2a'}
            },
            'a2a_docs': {
                'query': 'documentation reference',
                'description': 'Documentação oficial A2A',
                'filters': {'category': 'a2a:docs'}
            },
            'a2a_tutorials': {
                'query': 'tutorial guide howto',
                'description': 'Tutoriais e guias A2A',
                'filters': {'category': 'a2a:tutorials'}
            },
            'a2a_recent': {
                'query': 'a2a',
                'description': 'Conteúdos A2A recentes',
                'filters': {'source': 'a2a', 'sort': 'date_desc'}
            },
            'a2a_api': {
                'query': 'api specification interface',
                'description': 'Referência de API A2A',
                'filters': {'category': 'a2a:api'}
            },
            'a2a_implementation': {
                'query': 'implementation example code',
                'description': 'Exemplos e implementações A2A',
                'filters': {'tags': ['example', 'implementation']}
            }
        }
        
        if not self.saved_searches_file.exists():
            self.saved_searches_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.saved_searches_file, 'w') as f:
                json.dump(default_searches, f, indent=2)
        
        return default_searches
    
    def categorize_content(self, url: str = None, content: str = None) -> str:
        """Determina categoria baseada em URL ou conteúdo"""
        
        # Por URL conhecida
        if url:
            for known_url, category in self.A2A_URLS.items():
                if url.startswith(known_url):
                    return category
            
            # Por padrões na URL
            url_lower = url.lower()
            if 'doc' in url_lower:
                return 'a2a:docs'
            elif 'tutorial' in url_lower or 'guide' in url_lower:
                return 'a2a:tutorials'
            elif 'api' in url_lower:
                return 'a2a:api'
            elif 'example' in url_lower or 'demo' in url_lower:
                return 'a2a:examples'
            elif 'blog' in url_lower or 'article' in url_lower:
                return 'a2a:blog'
            elif 'registry' in url_lower or 'catalog' in url_lower:
                return 'a2a:registry'
        
        # Por conteúdo
        if content:
            content_lower = content.lower()
            if 'api' in content_lower and 'endpoint' in content_lower:
                return 'a2a:api'
            elif 'tutorial' in content_lower or 'step by step' in content_lower:
                return 'a2a:tutorials'
            elif 'example' in content_lower and 'code' in content_lower:
                return 'a2a:examples'
            elif 'concept' in content_lower or 'architecture' in content_lower:
                return 'a2a:concepts'
        
        # Padrão
        return 'a2a:docs'
    
    def extract_tags_from_content(self, content: str) -> List[str]:
        """Extrai tags relevantes do conteúdo"""
        tags = set()
        content_lower = content.lower()
        
        # Palavras-chave técnicas
        tech_keywords = [
            'agent', 'protocol', 'api', 'implementation', 'interface',
            'authentication', 'authorization', 'endpoint', 'sdk',
            'typescript', 'python', 'javascript', 'rust', 'go'
        ]
        
        for keyword in tech_keywords:
            if keyword in content_lower:
                tags.add(keyword)
        
        # Conceitos A2A
        if 'agent2agent' in content_lower or 'agent to agent' in content_lower:
            tags.add('agent2agent')
        if 'discovery' in content_lower:
            tags.add('discovery')
        if 'communication' in content_lower:
            tags.add('communication')
        if 'registry' in content_lower:
            tags.add('registry')
        
        return list(tags)
    
    def ingest_url(self, url: str, category: str = None, tags: List[str] = None) -> Dict:
        """Ingere conteúdo de uma URL"""
        
        print(f"Ingerindo URL: {url}")
        
        try:
            # Simular fetch (em produção, usar WebFetch ou requests)
            # Por ora, criar documento placeholder
            parsed = urlparse(url)
            domain = parsed.netloc
            
            # Determinar categoria
            if not category:
                category = self.categorize_content(url=url)
            
            # Gerar tags
            if not tags:
                tags = self.DEFAULT_TAGS.get(category, ['a2a'])
            else:
                # Adicionar tags padrão às fornecidas
                tags = list(set(tags + self.DEFAULT_TAGS.get(category, ['a2a'])))
            
            # Criar documento
            doc = {
                'title': f"A2A Content from {domain}",
                'content': f"Conteúdo A2A de {url}",
                'type': 'webpage',
                'source': 'a2a',
                'category': category,
                'tags': tags,
                'metadata': {
                    'url': url,
                    'domain': domain,
                    'ingested_at': datetime.now().isoformat(),
                    'ingestion_method': 'url'
                }
            }
            
            return doc
            
        except Exception as e:
            print(f"Erro ao ingerir URL {url}: {e}")
            return None
    
    def ingest_markdown(self, file_path: str, category: str = None, tags: List[str] = None) -> Dict:
        """Ingere conteúdo de arquivo Markdown"""
        
        path = Path(file_path)
        if not path.exists():
            print(f"Arquivo não encontrado: {file_path}")
            return None
        
        print(f"Ingerindo Markdown: {file_path}")
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extrair título do markdown
            title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            title = title_match.group(1) if title_match else path.stem
            
            # Determinar categoria
            if not category:
                category = self.categorize_content(content=content)
            
            # Gerar tags
            extracted_tags = self.extract_tags_from_content(content)
            if not tags:
                tags = self.DEFAULT_TAGS.get(category, ['a2a']) + extracted_tags
            else:
                tags = list(set(tags + self.DEFAULT_TAGS.get(category, ['a2a']) + extracted_tags))
            
            # Criar documento
            doc = {
                'title': f"A2A: {title}",
                'content': content[:2000],  # Limitar tamanho
                'type': 'markdown',
                'source': 'a2a',
                'category': category,
                'tags': tags,
                'metadata': {
                    'file_path': str(path),
                    'file_name': path.name,
                    'ingested_at': datetime.now().isoformat(),
                    'ingestion_method': 'markdown'
                }
            }
            
            return doc
            
        except Exception as e:
            print(f"Erro ao ingerir Markdown {file_path}: {e}")
            return None
    
    def ingest_text(self, text: str, title: str, category: str = None, tags: List[str] = None) -> Dict:
        """Ingere texto direto"""
        
        print(f"Ingerindo texto: {title}")
        
        # Determinar categoria
        if not category:
            category = self.categorize_content(content=text)
        
        # Gerar tags
        extracted_tags = self.extract_tags_from_content(text)
        if not tags:
            tags = self.DEFAULT_TAGS.get(category, ['a2a']) + extracted_tags
        else:
            tags = list(set(tags + self.DEFAULT_TAGS.get(category, ['a2a']) + extracted_tags))
        
        # Criar documento
        doc = {
            'title': f"A2A: {title}",
            'content': text[:2000],  # Limitar tamanho
            'type': 'text',
            'source': 'a2a',
            'category': category,
            'tags': tags,
            'metadata': {
                'ingested_at': datetime.now().isoformat(),
                'ingestion_method': 'text'
            }
        }
        
        return doc
    
    def batch_ingest(self, items: List[Dict]) -> Tuple[int, int]:
        """
        Ingestão em lote de múltiplos itens
        
        items: Lista de dicionários com:
            - type: 'url', 'markdown', 'text'
            - content: URL, caminho do arquivo ou texto
            - title: (opcional para text)
            - category: (opcional)
            - tags: (opcional)
        """
        
        self.server.load_documents()
        success_count = 0
        error_count = 0
        
        for item in items:
            doc = None
            item_type = item.get('type')
            
            if item_type == 'url':
                doc = self.ingest_url(
                    item['content'],
                    item.get('category'),
                    item.get('tags')
                )
            elif item_type == 'markdown':
                doc = self.ingest_markdown(
                    item['content'],
                    item.get('category'),
                    item.get('tags')
                )
            elif item_type == 'text':
                doc = self.ingest_text(
                    item['content'],
                    item.get('title', 'Untitled'),
                    item.get('category'),
                    item.get('tags')
                )
            
            if doc:
                try:
                    # Verificar duplicação por hash de conteúdo
                    content_hash = hashlib.md5(doc['content'].encode()).hexdigest()[:8]
                    
                    # Remover versão antiga se existir
                    old_docs = [d for d in self.server.documents 
                               if d.get('metadata', {}).get('content_hash') == content_hash]
                    for old_doc in old_docs:
                        self.server.remove_document(old_doc['id'])
                    
                    # Adicionar hash ao metadata
                    doc['metadata']['content_hash'] = content_hash
                    
                    # Adicionar ao servidor
                    result = self.server.add_document(doc)
                    print(f"  ✓ {doc['title'][:50]}")
                    success_count += 1
                    
                    # Atualizar estado de sincronização
                    self.sync_state['synced_items'][content_hash] = {
                        'title': doc['title'],
                        'category': doc['category'],
                        'synced_at': datetime.now().isoformat()
                    }
                    
                except Exception as e:
                    print(f"  ✗ Erro: {e}")
                    error_count += 1
            else:
                error_count += 1
        
        # Salvar alterações
        if success_count > 0:
            self.server.save_documents()
            self.sync_state['last_sync'] = datetime.now().isoformat()
            self.save_sync_state()
        
        return success_count, error_count
    
    def sync_from_frontend(self) -> Tuple[int, int]:
        """Sincroniza documentos A2A do frontend para o MCP"""
        
        print(f"Sincronizando do frontend: {self.frontend_cache_dir}")
        
        # Procurar por arquivos relacionados a A2A
        items_to_sync = []
        
        # Verificar se existe arquivo de cache do frontend
        frontend_docs_file = self.frontend_cache_dir / "document-names.json"
        if frontend_docs_file.exists():
            try:
                with open(frontend_docs_file, 'r') as f:
                    frontend_docs = json.load(f)
                    
                for doc in frontend_docs:
                    if 'a2a' in str(doc).lower():
                        # Adicionar à lista de sincronização
                        if 'url' in doc:
                            items_to_sync.append({
                                'type': 'url',
                                'content': doc['url']
                            })
                        elif 'content' in doc:
                            items_to_sync.append({
                                'type': 'text',
                                'content': doc['content'],
                                'title': doc.get('title', 'A2A Document')
                            })
            except Exception as e:
                print(f"Erro ao ler cache do frontend: {e}")
        
        # URLs A2A conhecidas para sincronizar
        default_a2a_content = [
            {'type': 'url', 'content': 'https://a2aprotocol.ai/docs/', 'category': 'a2a:docs'},
            {'type': 'url', 'content': 'https://a2aprotocol.ai/blog', 'category': 'a2a:blog'},
            {'type': 'url', 'content': 'https://a2a-protocol.org/latest/topics/key-concepts/', 'category': 'a2a:concepts'},
            {'type': 'url', 'content': 'https://a2aregistry.in/', 'category': 'a2a:registry'},
            {'type': 'url', 'content': 'https://a2a.ac/#agents', 'category': 'a2a:agents'}
        ]
        
        # Adicionar conteúdo padrão se não houver itens do frontend
        if not items_to_sync:
            items_to_sync = default_a2a_content
        
        # Executar sincronização
        return self.batch_ingest(items_to_sync)
    
    def execute_saved_search(self, search_name: str, limit: int = 10) -> List[Dict]:
        """Executa uma busca salva"""
        
        # Carregar buscas salvas
        if self.saved_searches_file.exists():
            with open(self.saved_searches_file, 'r') as f:
                saved_searches = json.load(f)
        else:
            saved_searches = self.init_saved_searches()
        
        if search_name not in saved_searches:
            print(f"Busca '{search_name}' não encontrada")
            return []
        
        search_config = saved_searches[search_name]
        query = search_config['query']
        filters = search_config.get('filters', {})
        
        # Carregar documentos
        self.server.load_documents()
        
        # Aplicar filtros
        filtered_docs = self.server.documents
        
        if 'source' in filters:
            filtered_docs = [d for d in filtered_docs if d.get('source') == filters['source']]
        
        if 'category' in filters:
            filtered_docs = [d for d in filtered_docs if d.get('category') == filters['category']]
        
        if 'tags' in filters:
            required_tags = filters['tags']
            filtered_docs = [d for d in filtered_docs 
                           if any(tag in d.get('tags', []) for tag in required_tags)]
        
        # Executar busca
        results = []
        for doc in filtered_docs[:limit]:
            # Adicionar score simples baseado em relevância
            content = f"{doc.get('title', '')} {doc.get('content', '')}".lower()
            score = sum(1 for word in query.split() if word.lower() in content) / len(query.split())
            doc['score'] = score
            results.append(doc)
        
        # Ordenar por score
        results.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        return results[:limit]
    
    def show_stats(self):
        """Mostra estatísticas dos conteúdos A2A"""
        
        self.server.load_documents()
        
        # Filtrar documentos A2A
        a2a_docs = [d for d in self.server.documents if d.get('source') == 'a2a']
        
        # Estatísticas por categoria
        category_stats = {}
        for doc in a2a_docs:
            cat = doc.get('category', 'uncategorized')
            category_stats[cat] = category_stats.get(cat, 0) + 1
        
        print("\n📊 Estatísticas A2A:")
        print(f"Total de documentos A2A: {len(a2a_docs)}")
        print(f"Última sincronização: {self.sync_state.get('last_sync', 'Nunca')}")
        print(f"\nPor categoria:")
        for cat, count in sorted(category_stats.items()):
            desc = self.CATEGORIES.get(cat, cat)
            print(f"  {cat}: {count} - {desc}")
        
        # Tags mais comuns
        all_tags = []
        for doc in a2a_docs:
            all_tags.extend(doc.get('tags', []))
        
        from collections import Counter
        tag_counts = Counter(all_tags)
        
        print(f"\nTop 10 tags:")
        for tag, count in tag_counts.most_common(10):
            print(f"  #{tag}: {count}")


def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Gerenciador de conteúdos A2A')
    parser.add_argument('--sync', action='store_true', help='Sincronizar do frontend')
    parser.add_argument('--ingest-url', type=str, help='Ingerir URL específica')
    parser.add_argument('--ingest-markdown', type=str, help='Ingerir arquivo Markdown')
    parser.add_argument('--ingest-text', type=str, help='Ingerir texto (usar com --title)')
    parser.add_argument('--title', type=str, help='Título para ingestão de texto')
    parser.add_argument('--category', type=str, help='Categoria (ex: a2a:docs)')
    parser.add_argument('--tags', type=str, help='Tags separadas por vírgula')
    parser.add_argument('--search', type=str, help='Executar busca salva')
    parser.add_argument('--stats', action='store_true', help='Mostrar estatísticas')
    parser.add_argument('--batch', type=str, help='Arquivo JSON com itens para ingestão em lote')
    
    args = parser.parse_args()
    
    manager = A2AContentManager()
    
    # Processar tags se fornecidas
    tags = args.tags.split(',') if args.tags else None
    
    if args.sync:
        success, errors = manager.sync_from_frontend()
        print(f"\n✅ Sincronização completa: {success} sucesso, {errors} erros")
    
    elif args.ingest_url:
        doc = manager.ingest_url(args.ingest_url, args.category, tags)
        if doc:
            manager.server.load_documents()
            manager.server.add_document(doc)
            manager.server.save_documents()
            print(f"✅ URL ingerida com sucesso")
    
    elif args.ingest_markdown:
        doc = manager.ingest_markdown(args.ingest_markdown, args.category, tags)
        if doc:
            manager.server.load_documents()
            manager.server.add_document(doc)
            manager.server.save_documents()
            print(f"✅ Markdown ingerido com sucesso")
    
    elif args.ingest_text and args.title:
        doc = manager.ingest_text(args.ingest_text, args.title, args.category, tags)
        if doc:
            manager.server.load_documents()
            manager.server.add_document(doc)
            manager.server.save_documents()
            print(f"✅ Texto ingerido com sucesso")
    
    elif args.batch:
        # Carregar arquivo de lote
        batch_file = Path(args.batch)
        if batch_file.exists():
            with open(batch_file, 'r') as f:
                items = json.load(f)
            success, errors = manager.batch_ingest(items)
            print(f"\n✅ Ingestão em lote: {success} sucesso, {errors} erros")
        else:
            print(f"Arquivo não encontrado: {args.batch}")
    
    elif args.search:
        results = manager.execute_saved_search(args.search)
        print(f"\n🔍 Busca '{args.search}': {len(results)} resultados")
        for r in results[:5]:
            print(f"\n📄 {r.get('title', 'Sem título')}")
            print(f"   Categoria: {r.get('category', 'N/A')}")
            print(f"   Tags: {', '.join(r.get('tags', [])[:5])}")
            print(f"   Score: {r.get('score', 0):.2f}")
    
    elif args.stats:
        manager.show_stats()
    
    else:
        # Comportamento padrão: sincronizar e mostrar stats
        success, errors = manager.sync_from_frontend()
        print(f"\n✅ Sincronização: {success} sucesso, {errors} erros")
        manager.show_stats()


if __name__ == "__main__":
    main()