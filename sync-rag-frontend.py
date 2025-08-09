#!/usr/bin/env python3
"""
Script de Sincronização MCP RAG Server -> Frontend RAG
Sincroniza documentos do cache MCP para o frontend
"""

import json
import os
import sys
import hashlib
from datetime import datetime
from typing import Dict, List, Any
import requests

# Caminhos dos caches
MCP_CACHE_PATH = "/Users/agents/.claude/mcp-rag-cache/documents.json"
SCRAPED_URLS_PATH = "/Users/agents/.claude/mcp-rag-cache/scraped_urls.json"
FRONTEND_API_URL = "http://localhost:5173/api/rag"

# Lista completa de URLs A2A para indexar
A2A_URLS = [
    "https://a2aprotocol.ai/blog/adk-a2a-guide",
    "https://a2aprotocol.ai/blog/a2a-adk-expense-reimbursement",
    "https://a2aprotocol.ai/blog/agent2agent-protocol-win",
    "https://a2aprotocol.ai/blog/a2a-acp",
    "https://a2aprotocol.ai/blog/a2a-dotnet-sdk",
    "https://a2aprotocol.ai/blog/a2a-mcp-ag2-sample",
    "https://a2aprotocol.ai/blog/a2a-crewai-analysis-chart-agent",
    "https://a2aprotocol.ai/blog/impact-analysis-google-donating-a2a-protocol-linux-foundation",
    "https://a2aprotocol.ai/blog/geo-seo-a2a",
    "https://a2aprotocol.ai/blog/a2a-inspector",
    "https://a2aprotocol.ai/blog/a2a-js-movie-agent",
    "https://a2aprotocol.ai/blog/a2a-python-github-agent",
    "https://a2aprotocol.ai/blog/a2a-mcp-ai-protocol-winner",
    "https://a2aprotocol.ai/blog/a2a-javascript-sdk",
    "https://a2aprotocol.ai/blog/a2a-travel-planner-openrouter",
    "https://a2aprotocol.ai/blog/a2a-java-sample",
    "https://a2aprotocol.ai/blog/a2a-mcp-integration",
    "https://a2aprotocol.ai/blog/how-to-use-a2a-protocol-validator",
    "https://a2aprotocol.ai/blog/a2a-samples-llama-index-file-chat-openrouter",
    "https://a2aprotocol.ai/blog/a2a-samples-hello-world",
    "https://a2aprotocol.ai/blog/a2a-sdk-currency-agent-tutorial",
    "https://a2aprotocol.ai/blog/google-a2a-python-sdk-tutorial",
    "https://a2aprotocol.ai/blog/alphaevolve-vs-codex-agent",
    "https://a2aprotocol.ai/blog/a2a-mcp-ag-ui",
    "https://a2aprotocol.ai/blog/alphaenvolve-with-a2a",
    "https://a2aprotocol.ai/blog/a2a-langraph-tutorial-20250513",
    "https://a2aprotocol.ai/blog/python-a2a-tutorial-20250513",
    "https://a2aprotocol.ai/blog/a2a-sdk-python",
    "https://a2aprotocol.ai/blog/ai-protocols-analysis-report-a2a-mcp-and-acp",
    "https://a2aprotocol.ai/blog/python-a2a-tutorial-with-source-code",
    "https://a2aprotocol.ai/blog/a2a-implementations",
    "https://a2aprotocol.ai/blog/python-a2a-tutorial",
    "https://a2aprotocol.ai/blog/awesome-a2a",
    "https://a2aprotocol.ai/blog/openai-codex-cli",
    "https://a2aprotocol.ai/blog/python-a2a",
    "https://a2aprotocol.ai/blog/a2a-sample-methods-and-json-responses",
    "https://a2aprotocol.ai/blog/a2a-typescript-guide",
    "https://a2aprotocol.ai/blog/a2a-vs-mcp",
    "https://a2aprotocol.ai/blog/understanding-a2a-protocol"
]

def categorize_url(url: str) -> str:
    """Categoriza URL baseado no conteúdo"""
    url_lower = url.lower()
    
    if any(x in url_lower for x in ['sdk', 'adk', 'dotnet', 'javascript', 'java', 'python', 'typescript']):
        return 'a2a:sdk'
    elif any(x in url_lower for x in ['example', 'sample', 'hello-world', 'tutorial', 'guide']):
        return 'a2a:tutorials'
    elif any(x in url_lower for x in ['mcp', 'integration', 'crewai', 'langraph', 'llama']):
        return 'a2a:integration'
    elif any(x in url_lower for x in ['analysis', 'report', 'vs', 'comparison', 'impact']):
        return 'a2a:analysis'
    elif any(x in url_lower for x in ['inspector', 'validator', 'tool', 'cli']):
        return 'a2a:tools'
    elif any(x in url_lower for x in ['agent', 'movie', 'github', 'travel', 'expense']):
        return 'a2a:examples'
    else:
        return 'a2a:docs'

def extract_tags(url: str, title: str = "") -> List[str]:
    """Extrai tags relevantes da URL e título"""
    tags = ['a2a']
    url_lower = url.lower()
    title_lower = title.lower()
    combined = url_lower + " " + title_lower
    
    # SDKs e linguagens
    if 'python' in combined: tags.append('python')
    if 'javascript' in combined or 'js' in combined: tags.append('javascript')
    if 'typescript' in combined: tags.append('typescript')
    if 'java' in combined and 'javascript' not in combined: tags.append('java')
    if 'dotnet' in combined or '.net' in combined: tags.append('dotnet')
    if 'sdk' in combined: tags.append('sdk')
    if 'adk' in combined: tags.append('adk')
    
    # Integrações
    if 'mcp' in combined: tags.append('mcp')
    if 'crewai' in combined: tags.append('crewai')
    if 'langraph' in combined: tags.append('langraph')
    if 'llama' in combined: tags.append('llamaindex')
    
    # Tipos
    if 'tutorial' in combined: tags.append('tutorial')
    if 'guide' in combined: tags.append('guide')
    if 'example' in combined or 'sample' in combined: tags.append('example')
    if 'analysis' in combined: tags.append('analysis')
    if 'tool' in combined or 'inspector' in combined: tags.append('tool')
    
    return list(set(tags))

def load_mcp_documents() -> List[Dict]:
    """Carrega documentos do cache MCP"""
    if not os.path.exists(MCP_CACHE_PATH):
        print(f"❌ Cache MCP não encontrado: {MCP_CACHE_PATH}")
        return []
    
    with open(MCP_CACHE_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
        # O arquivo pode conter uma lista ou um dict com 'documents'
        if isinstance(data, dict) and 'documents' in data:
            return data['documents']
        elif isinstance(data, list):
            # Filtrar apenas dicts válidos
            return [doc for doc in data if isinstance(doc, dict)]
        else:
            return []

def load_scraped_urls() -> List[str]:
    """Carrega URLs já processadas"""
    if not os.path.exists(SCRAPED_URLS_PATH):
        return []
    
    with open(SCRAPED_URLS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_scraped_urls(urls: List[str]):
    """Salva lista de URLs processadas"""
    with open(SCRAPED_URLS_PATH, 'w', encoding='utf-8') as f:
        json.dump(urls, f, indent=2)

def format_for_frontend(doc: Dict) -> Dict:
    """Formata documento do MCP para padrão do frontend"""
    
    # Extrair URL do source ou content
    url = None
    if 'source' in doc and doc['source'].startswith('http'):
        url = doc['source']
    elif 'content' in doc and 'Fonte:' in doc['content']:
        # Extrair URL do conteúdo
        lines = doc['content'].split('\n')
        for line in lines:
            if line.startswith('Fonte:'):
                url = line.replace('Fonte:', '').strip()
                break
    
    # Determinar categoria e tags
    category = doc.get('category', categorize_url(url or ''))
    tags = doc.get('tags', extract_tags(url or '', doc.get('title', '')))
    
    return {
        'id': doc.get('id', hashlib.md5(doc.get('content', '').encode()).hexdigest()),
        'title': doc.get('title', 'Documento sem título'),
        'content': doc.get('content', ''),
        'source': doc.get('source', 'unknown'),
        'type': doc.get('type', 'webpage'),
        'tags': tags,
        'category': category,
        'metadata': {
            'url': url,
            'capturedVia': 'MCP-RAG-Sync',
            'timestamp': doc.get('created_at', datetime.now().isoformat()),
            'hash': doc.get('hash'),
            'version': doc.get('version', 1)
        }
    }

def sync_to_frontend_api(documents: List[Dict]) -> int:
    """Sincroniza documentos com o frontend via API"""
    success_count = 0
    
    for doc in documents:
        try:
            response = requests.post(
                f"{FRONTEND_API_URL}/documents",
                json=doc,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
            if response.status_code in [200, 201]:
                success_count += 1
                print(f"✅ Sincronizado: {doc['title'][:50]}...")
            else:
                print(f"⚠️ Erro ao sincronizar: {doc['title'][:50]}... - Status: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Erro de conexão: {e}")
            print("💡 Tentando salvar localmente...")
            return save_to_local_cache(documents)
    
    return success_count

def save_to_local_cache(documents: List[Dict]) -> int:
    """Salva documentos em cache local quando API não está disponível"""
    cache_file = "/Users/agents/.claude/frontend-rag-cache.json"
    
    try:
        # Carregar cache existente
        existing = []
        if os.path.exists(cache_file):
            with open(cache_file, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        
        # Adicionar novos documentos
        existing.extend(documents)
        
        # Salvar cache atualizado
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
        
        print(f"💾 {len(documents)} documentos salvos em cache local: {cache_file}")
        return len(documents)
        
    except Exception as e:
        print(f"❌ Erro ao salvar cache local: {e}")
        return 0

def main():
    print("🔄 Iniciando sincronização MCP RAG -> Frontend RAG")
    print("=" * 60)
    
    # Carregar documentos do MCP
    mcp_docs = load_mcp_documents()
    print(f"📚 {len(mcp_docs)} documentos encontrados no cache MCP")
    
    # Filtrar apenas documentos A2A
    a2a_docs = [doc for doc in mcp_docs if 'a2a' in str(doc.get('tags', [])).lower() or 
                'a2a' in str(doc.get('category', '')).lower()]
    print(f"🎯 {len(a2a_docs)} documentos A2A para sincronizar")
    
    # Formatar para o frontend
    formatted_docs = [format_for_frontend(doc) for doc in a2a_docs]
    
    # Sincronizar com frontend
    if formatted_docs:
        synced = sync_to_frontend_api(formatted_docs)
        print(f"\n✨ {synced} documentos sincronizados com sucesso!")
    
    # Atualizar lista de URLs processadas
    scraped = load_scraped_urls()
    new_urls = [url for url in A2A_URLS if url not in scraped]
    
    if new_urls:
        print(f"\n📋 {len(new_urls)} URLs ainda não processadas")
        print("Execute o script de indexação para capturar essas URLs primeiro.")
        
        # Salvar lista para referência
        with open("/Users/agents/.claude/pending-urls.json", 'w') as f:
            json.dump(new_urls, f, indent=2)
    
    print("\n✅ Sincronização concluída!")

if __name__ == "__main__":
    main()