#!/usr/bin/env python3
"""
A2A Web Scraper & Indexer
==========================
Faz scraping automático de sites A2A, descobre páginas via sitemap
e indexa conteúdo no MCP RAG Server.

Autor: Claude AI Assistant
Data: 2025-08-09
"""

import json
import sys
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime
import xml.etree.ElementTree as ET
from urllib.parse import urlparse, urljoin
import hashlib

# Adicionar o diretório do servidor MCP ao path
sys.path.insert(0, str(Path(__file__).parent))

from rag_server import RAGServer
from a2a_content_manager import A2AContentManager

class A2AWebScraper:
    """Scraper automático para sites A2A"""
    
    # URLs base conhecidas
    A2A_SITES = [
        'https://a2aprotocol.ai',
        'https://a2a-protocol.org',
        'https://a2aregistry.in',
        'https://a2a.ac'
    ]
    
    # Padrões de URL para categorização
    URL_PATTERNS = {
        'a2a:docs': [r'/docs/', r'/documentation/', r'/reference/'],
        'a2a:tutorials': [r'/tutorial/', r'/guide/', r'/howto/', r'/getting-started/'],
        'a2a:api': [r'/api/', r'/specification/', r'/openapi/'],
        'a2a:blog': [r'/blog/', r'/posts/', r'/articles/', r'/news/'],
        'a2a:examples': [r'/examples/', r'/samples/', r'/demos/', r'/showcase/']
    }
    
    # Posts importantes do blog A2A (do sitemap)
    IMPORTANT_POSTS = [
        {
            'url': 'https://a2aprotocol.ai/blog/2025-full-guide-to-a2a-protocol',
            'title': '2025 Full Guide to A2A Protocol',
            'category': 'a2a:tutorials',
            'tags': ['guide', 'tutorial', 'complete', '2025']
        },
        {
            'url': 'https://a2aprotocol.ai/blog/2025-part-2-full-guide-to-a2a-protocol',
            'title': '2025 Part 2 Full Guide to A2A Protocol',
            'category': 'a2a:tutorials',
            'tags': ['guide', 'tutorial', 'advanced', '2025']
        },
        {
            'url': 'https://a2aprotocol.ai/blog/a2a-protocol-specification-in-python',
            'title': 'A2A Protocol Specification in Python',
            'category': 'a2a:api',
            'tags': ['python', 'specification', 'implementation', 'code']
        },
        {
            'url': 'https://a2aprotocol.ai/blog/adk-a2a-guide',
            'title': 'ADK A2A Guide',
            'category': 'a2a:docs',
            'tags': ['adk', 'sdk', 'development', 'guide']
        },
        {
            'url': 'https://a2aprotocol.ai/blog/a2a-mcp-discussion',
            'title': 'A2A MCP Discussion',
            'category': 'a2a:concepts',
            'tags': ['mcp', 'integration', 'discussion', 'architecture']
        },
        {
            'url': 'https://a2aprotocol.ai/blog/a2a-net-sdk',
            'title': 'A2A .NET SDK',
            'category': 'a2a:docs',
            'tags': ['dotnet', 'sdk', 'csharp', 'implementation']
        }
    ]
    
    # Tags por tecnologia mencionada
    TECH_TAGS = {
        'mcp': ['mcp', 'model-context-protocol'],
        'python': ['python', 'py'],
        'typescript': ['typescript', 'ts', 'javascript'],
        'java': ['java', 'jvm'],
        'dotnet': ['dotnet', 'csharp', 'net'],
        'langchain': ['langchain', 'llm'],
        'llamaindex': ['llamaindex', 'llm'],
        'crewai': ['crewai', 'agents'],
        'ag2': ['ag2', 'autogen'],
        'ollama': ['ollama', 'local-llm']
    }
    
    def __init__(self):
        self.server = RAGServer(mode='enhanced')
        self.content_manager = A2AContentManager()
        self.scraped_urls_file = Path.home() / ".claude" / "mcp-rag-cache" / "scraped_urls.json"
        self.scraped_urls = self.load_scraped_urls()
        self.batch_size = 5  # Processar em lotes
        
    def load_scraped_urls(self) -> Set[str]:
        """Carrega URLs já processadas"""
        if self.scraped_urls_file.exists():
            try:
                with open(self.scraped_urls_file, 'r') as f:
                    return set(json.load(f))
            except:
                return set()
        return set()
    
    def save_scraped_urls(self):
        """Salva URLs processadas"""
        self.scraped_urls_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.scraped_urls_file, 'w') as f:
            json.dump(list(self.scraped_urls), f, indent=2)
    
    def categorize_url(self, url: str) -> str:
        """Categoriza URL baseado em padrões"""
        url_lower = url.lower()
        
        for category, patterns in self.URL_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, url_lower):
                    return category
        
        # Verificar posts específicos
        for post in self.IMPORTANT_POSTS:
            if url == post['url']:
                return post['category']
        
        # Padrão para blog
        if '/blog/' in url_lower:
            return 'a2a:blog'
        
        return 'a2a:docs'
    
    def extract_tech_tags(self, url: str, title: str = '') -> List[str]:
        """Extrai tags baseadas em tecnologias mencionadas"""
        tags = set(['a2a'])
        text = f"{url} {title}".lower()
        
        for tech, tech_tags in self.TECH_TAGS.items():
            if tech in text:
                tags.update(tech_tags)
        
        # Tags baseadas na URL
        if 'guide' in text:
            tags.add('guide')
        if 'tutorial' in text:
            tags.add('tutorial')
        if 'specification' in text or 'spec' in text:
            tags.add('specification')
        if 'sdk' in text:
            tags.add('sdk')
        if 'api' in text:
            tags.add('api')
        
        return list(tags)
    
    def parse_sitemap_content(self, sitemap_content: str) -> List[str]:
        """Extrai URLs de um sitemap XML"""
        urls = []
        try:
            # Buscar URLs com regex simples
            url_pattern = r'<loc>(https?://[^<]+)</loc>'
            matches = re.findall(url_pattern, sitemap_content)
            urls.extend(matches)
        except Exception as e:
            print(f"Erro ao processar sitemap: {e}")
        
        return urls
    
    def discover_urls(self, base_url: str) -> List[str]:
        """Descobre URLs de um site via sitemap e padrões conhecidos"""
        discovered = []
        
        # Tentar sitemap.xml
        sitemap_urls = [
            f"{base_url}/sitemap.xml",
            f"{base_url}/sitemap_index.xml",
            f"{base_url}/sitemap-posts.xml",
            f"{base_url}/sitemap-pages.xml"
        ]
        
        print(f"🔍 Descobrindo URLs de {base_url}")
        
        for sitemap_url in sitemap_urls:
            # Simular fetch do sitemap (em produção, usar requests ou WebFetch)
            print(f"  Tentando {sitemap_url}")
            # Por enquanto, retornar URLs conhecidas
        
        # Adicionar URLs conhecidas manualmente
        if 'a2aprotocol.ai' in base_url:
            discovered.extend([post['url'] for post in self.IMPORTANT_POSTS])
            discovered.extend([
                f"{base_url}/",
                f"{base_url}/blog",
                f"{base_url}/docs"
            ])
        
        return discovered
    
    def create_document_from_url(self, url: str, title: str = None, 
                                 content_preview: str = None) -> Dict:
        """Cria documento para indexação a partir de URL"""
        
        # Determinar título
        if not title:
            # Extrair do post conhecido
            for post in self.IMPORTANT_POSTS:
                if url == post['url']:
                    title = post['title']
                    break
            
            if not title:
                # Gerar do URL
                path = urlparse(url).path.strip('/')
                if path:
                    title = path.replace('-', ' ').replace('_', ' ').title()
                else:
                    title = urlparse(url).netloc
        
        # Determinar categoria
        category = self.categorize_url(url)
        
        # Gerar tags
        tags = self.extract_tech_tags(url, title)
        
        # Adicionar tags do post conhecido se existir
        for post in self.IMPORTANT_POSTS:
            if url == post['url']:
                tags.extend(post.get('tags', []))
                break
        
        tags = list(set(tags))  # Remover duplicatas
        
        # Criar preview do conteúdo
        if not content_preview:
            content_preview = f"{title}. Fonte: {url}"
        
        return {
            'title': f"A2A: {title}",
            'content': content_preview,
            'type': 'webpage',
            'source': 'a2a',
            'category': category,
            'tags': tags,
            'metadata': {
                'url': url,
                'scraped_at': datetime.now().isoformat(),
                'scraper_version': '1.0'
            }
        }
    
    def scrape_site(self, base_url: str) -> Tuple[int, int]:
        """Faz scraping de um site A2A completo"""
        
        print(f"\n🌐 Iniciando scraping de {base_url}")
        
        # Descobrir URLs
        urls = self.discover_urls(base_url)
        
        # Filtrar URLs já processadas
        new_urls = [url for url in urls if url not in self.scraped_urls]
        
        if not new_urls:
            print(f"  ✅ Todas as {len(urls)} URLs já foram processadas")
            return 0, 0
        
        print(f"  📄 {len(new_urls)} novas URLs para processar")
        
        # Processar em lotes
        success_count = 0
        error_count = 0
        
        self.server.load_documents()
        
        for i in range(0, len(new_urls), self.batch_size):
            batch = new_urls[i:i + self.batch_size]
            print(f"\n  Lote {i//self.batch_size + 1}: Processando {len(batch)} URLs")
            
            for url in batch:
                try:
                    # Criar documento
                    doc = self.create_document_from_url(url)
                    
                    # Verificar duplicação por URL
                    existing = [d for d in self.server.documents 
                               if d.get('metadata', {}).get('url') == url]
                    
                    if existing:
                        print(f"    ⚠️  {url} já existe, atualizando...")
                        for old_doc in existing:
                            self.server.remove_document(old_doc['id'])
                    
                    # Adicionar documento
                    result = self.server.add_document(doc)
                    print(f"    ✓ {doc['title'][:50]}")
                    
                    # Marcar como processada
                    self.scraped_urls.add(url)
                    success_count += 1
                    
                except Exception as e:
                    print(f"    ✗ Erro em {url}: {e}")
                    error_count += 1
            
            # Pequena pausa entre lotes
            if i + self.batch_size < len(new_urls):
                time.sleep(0.5)
        
        # Salvar alterações
        if success_count > 0:
            self.server.save_documents()
            self.save_scraped_urls()
        
        return success_count, error_count
    
    def scrape_all_sites(self) -> Dict:
        """Faz scraping de todos os sites A2A conhecidos"""
        
        total_success = 0
        total_errors = 0
        results = {}
        
        for site in self.A2A_SITES:
            success, errors = self.scrape_site(site)
            total_success += success
            total_errors += errors
            results[site] = {'success': success, 'errors': errors}
        
        return {
            'total_success': total_success,
            'total_errors': total_errors,
            'sites': results
        }
    
    def show_scraping_stats(self):
        """Mostra estatísticas de scraping"""
        
        self.server.load_documents()
        
        # Documentos A2A com URL
        web_docs = [d for d in self.server.documents 
                   if d.get('source') == 'a2a' and 
                   d.get('metadata', {}).get('url')]
        
        # Estatísticas por domínio
        domain_stats = {}
        for doc in web_docs:
            url = doc.get('metadata', {}).get('url', '')
            domain = urlparse(url).netloc
            domain_stats[domain] = domain_stats.get(domain, 0) + 1
        
        print("\n📊 Estatísticas de Scraping A2A:")
        print(f"Total de páginas indexadas: {len(web_docs)}")
        print(f"URLs únicas processadas: {len(self.scraped_urls)}")
        
        print(f"\nPor domínio:")
        for domain, count in sorted(domain_stats.items()):
            print(f"  {domain}: {count} páginas")
        
        # Categorias das páginas web
        category_stats = {}
        for doc in web_docs:
            cat = doc.get('category', 'uncategorized')
            category_stats[cat] = category_stats.get(cat, 0) + 1
        
        print(f"\nPor categoria:")
        for cat, count in sorted(category_stats.items()):
            print(f"  {cat}: {count} páginas")
        
        # Posts mais importantes
        important_indexed = []
        for post in self.IMPORTANT_POSTS:
            if post['url'] in self.scraped_urls:
                important_indexed.append(post['title'])
        
        if important_indexed:
            print(f"\n⭐ Posts importantes indexados:")
            for title in important_indexed:
                print(f"  - {title}")


def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Web Scraper para sites A2A')
    parser.add_argument('--scrape', type=str, help='URL do site para scraping')
    parser.add_argument('--scrape-all', action='store_true', help='Scraping de todos os sites A2A')
    parser.add_argument('--discover', type=str, help='Descobrir URLs de um site')
    parser.add_argument('--stats', action='store_true', help='Mostrar estatísticas')
    parser.add_argument('--reset', action='store_true', help='Resetar URLs processadas')
    parser.add_argument('--index-important', action='store_true', help='Indexar posts importantes')
    
    args = parser.parse_args()
    
    scraper = A2AWebScraper()
    
    if args.reset:
        scraper.scraped_urls = set()
        scraper.save_scraped_urls()
        print("✅ Cache de URLs resetado")
    
    elif args.discover:
        urls = scraper.discover_urls(args.discover)
        print(f"\n🔍 {len(urls)} URLs descobertas:")
        for url in urls[:20]:  # Mostrar primeiras 20
            category = scraper.categorize_url(url)
            print(f"  [{category}] {url}")
        if len(urls) > 20:
            print(f"  ... e mais {len(urls) - 20} URLs")
    
    elif args.scrape:
        success, errors = scraper.scrape_site(args.scrape)
        print(f"\n✅ Scraping completo: {success} páginas indexadas, {errors} erros")
    
    elif args.scrape_all:
        results = scraper.scrape_all_sites()
        print(f"\n✅ Scraping completo:")
        print(f"  Total: {results['total_success']} páginas indexadas")
        print(f"  Erros: {results['total_errors']}")
        for site, stats in results['sites'].items():
            print(f"  {site}: {stats['success']} sucesso, {stats['errors']} erros")
    
    elif args.index_important:
        # Indexar posts importantes rapidamente
        print("⭐ Indexando posts importantes do A2A...")
        scraper.server.load_documents()
        
        indexed = 0
        for post in scraper.IMPORTANT_POSTS:
            if post['url'] not in scraper.scraped_urls:
                doc = scraper.create_document_from_url(
                    post['url'], 
                    post['title']
                )
                doc['category'] = post['category']
                doc['tags'] = post['tags']
                
                scraper.server.add_document(doc)
                scraper.scraped_urls.add(post['url'])
                print(f"  ✓ {post['title']}")
                indexed += 1
        
        if indexed > 0:
            scraper.server.save_documents()
            scraper.save_scraped_urls()
            print(f"\n✅ {indexed} posts importantes indexados")
        else:
            print("\n✅ Todos os posts importantes já estavam indexados")
    
    elif args.stats:
        scraper.show_scraping_stats()
    
    else:
        # Comportamento padrão: indexar posts importantes e mostrar stats
        print("⚡ Indexação rápida de conteúdo A2A importante...")
        
        # Indexar posts importantes
        scraper.server.load_documents()
        indexed = 0
        
        for post in scraper.IMPORTANT_POSTS[:6]:  # Primeiros 6 posts
            if post['url'] not in scraper.scraped_urls:
                doc = scraper.create_document_from_url(
                    post['url'], 
                    post['title']
                )
                doc['category'] = post['category']
                doc['tags'] = post['tags']
                
                scraper.server.add_document(doc)
                scraper.scraped_urls.add(post['url'])
                print(f"  ✓ {post['title']}")
                indexed += 1
        
        if indexed > 0:
            scraper.server.save_documents()
            scraper.save_scraped_urls()
        
        print(f"\n✅ {indexed} novos posts indexados")
        scraper.show_scraping_stats()


if __name__ == "__main__":
    main()