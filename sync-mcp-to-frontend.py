#!/usr/bin/env python3
"""
Sincronização Direta: MCP RAG Cache -> Frontend Cache
Copia documentos do MCP RAG diretamente para o cache do frontend
"""

import json
import os
import shutil
from datetime import datetime
from typing import Dict, List, Any

# Caminhos dos caches
MCP_CACHE = "/Users/agents/.claude/mcp-rag-cache/documents.json"
FRONTEND_CACHE = "/Users/agents/.claude/mcp-rag-cache/frontend-documents.json"

def load_mcp_documents() -> List[Dict]:
    """Carrega documentos do MCP RAG"""
    if not os.path.exists(MCP_CACHE):
        print(f"❌ Cache MCP não encontrado: {MCP_CACHE}")
        return []
    
    with open(MCP_CACHE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, dict) and 'documents' in data:
            return data['documents']
        return []

def format_for_frontend(docs: List[Dict]) -> List[Dict]:
    """Formata documentos para o padrão do frontend"""
    formatted = []
    
    for doc in docs:
        # Extrair URL
        url = None
        content = doc.get('content', '')
        
        # Tentar extrair URL do conteúdo
        if 'Fonte:' in content:
            lines = content.split('\n')
            for line in lines:
                if line.startswith('Fonte:'):
                    url = line.replace('Fonte:', '').strip()
                    break
        
        # Se não encontrou URL no conteúdo, usar source
        if not url and 'source' in doc:
            if doc['source'].startswith('http'):
                url = doc['source']
            elif doc['source'] == 'a2aprotocol.ai/blog':
                # Construir URL baseado no título
                title_slug = doc.get('title', '').lower().replace(' ', '-')
                url = f"https://a2aprotocol.ai/blog/{title_slug}"
        
        # Criar documento formatado
        formatted_doc = {
            'id': doc.get('id', ''),
            'url': url or 'https://a2aprotocol.ai/blog',
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
                'version': doc.get('version', 1)
            }
        }
        
        formatted.append(formatted_doc)
    
    return formatted

def save_frontend_cache(documents: List[Dict]):
    """Salva documentos no formato do frontend"""
    output = {
        'documents': documents,
        'metadata': {
            'total': len(documents),
            'lastSync': datetime.now().isoformat(),
            'source': 'mcp-rag-sync'
        }
    }
    
    # Backup do cache existente
    if os.path.exists(FRONTEND_CACHE):
        backup = FRONTEND_CACHE.replace('.json', f'-backup-{datetime.now().strftime("%Y%m%d-%H%M%S")}.json')
        shutil.copy2(FRONTEND_CACHE, backup)
        print(f"📦 Backup criado: {backup}")
    
    # Salvar novo cache
    with open(FRONTEND_CACHE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Cache salvo: {FRONTEND_CACHE}")

def create_frontend_integration():
    """Cria arquivo de integração para o frontend React"""
    integration_code = '''// Frontend Integration for MCP RAG Cache
// Add this to your React component

import { useEffect, useState } from 'react';

const RAG_CACHE_URL = '/mcp-rag-cache/frontend-documents.json';

export function useMCPDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(RAG_CACHE_URL)
      .then(res => res.json())
      .then(data => {
        setDocuments(data.documents || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading MCP documents:', err);
        setLoading(false);
      });
  }, []);
  
  return { documents, loading };
}

// Usage in component:
// const { documents, loading } = useMCPDocuments();
'''
    
    integration_file = "/Users/agents/.claude/frontend-integration.tsx"
    with open(integration_file, 'w') as f:
        f.write(integration_code)
    
    print(f"🔧 Código de integração salvo: {integration_file}")

def main():
    print("🚀 Sincronização MCP RAG -> Frontend Cache")
    print("=" * 60)
    
    # Carregar documentos do MCP
    mcp_docs = load_mcp_documents()
    print(f"📚 {len(mcp_docs)} documentos encontrados no MCP RAG")
    
    # Filtrar documentos A2A
    a2a_docs = [doc for doc in mcp_docs if 
                isinstance(doc, dict) and 
                ('a2a' in str(doc.get('tags', [])).lower() or 
                 'a2a' in str(doc.get('category', '')).lower() or
                 'a2aprotocol' in str(doc.get('source', '')).lower())]
    
    print(f"🎯 {len(a2a_docs)} documentos A2A identificados")
    
    # Formatar para o frontend
    formatted = format_for_frontend(a2a_docs)
    
    # Salvar cache do frontend
    save_frontend_cache(formatted)
    
    # Criar código de integração
    create_frontend_integration()
    
    # Estatísticas
    print("\n📊 Resumo da Sincronização:")
    print(f"   ✅ Total de documentos: {len(formatted)}")
    
    # Contar por categoria
    categories = {}
    for doc in formatted:
        cat = doc.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\n📁 Documentos por Categoria:")
    for cat, count in sorted(categories.items()):
        print(f"   - {cat}: {count}")
    
    print("\n✨ Sincronização concluída com sucesso!")
    print("\n💡 Próximos passos:")
    print("   1. Configure o frontend para ler de: " + FRONTEND_CACHE)
    print("   2. Ou use o código em: frontend-integration.tsx")
    print("   3. Reinicie o servidor de desenvolvimento")

if __name__ == "__main__":
    main()