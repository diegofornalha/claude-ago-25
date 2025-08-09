#!/usr/bin/env python3
"""
Script para ingerir documentos A2A Protocol no servidor MCP RAG
"""

import json
import sys
import os

# Adicionar o diretório do servidor MCP ao path
sys.path.insert(0, '/Users/agents/.claude/mcp-rag-server')

from rag_server import RAGServer

def main():
    # Documentos A2A para adicionar
    a2a_documents = [
        {
            "title": "A2A Protocol Documentation",
            "content": """A2A Protocol Documentation Skip to content A2A Protocol Documentation Search K Main Navigation Home Appearance Menu Return to top Sidebar Navigation...""",
            "type": "webpage",
            "source": "a2a",
            "metadata": {
                "url": "https://a2aprotocol.ai/docs/",
                "tags": ["a2a", "protocol", "documentation"],
                "category": "documentation"
            }
        },
        {
            "title": "A2A Protocol Blog",
            "content": """Blog | A2A Protocol A2A Protocol About Features How it Works Developers Tools Blog 8/7 Learn More Blog Explore the latest insights, tutorials, and best...""",
            "type": "webpage", 
            "source": "a2a",
            "metadata": {
                "url": "https://a2aprotocol.ai/blog",
                "tags": ["a2a", "blog", "updates"],
                "category": "blog"
            }
        },
        {
            "title": "Key Concepts - Agent2Agent (A2A) Protocol",
            "content": """Key Concepts - Agent2Agent (A2A) Protocol Skip to content Agent2Agent (A2A) Protocol Key Concepts Initializing search a2aproject/A2A Home Topics Speci...""",
            "type": "webpage",
            "source": "a2a",
            "metadata": {
                "url": "https://a2a-protocol.org/latest/topics/key-concepts/",
                "tags": ["a2a", "concepts", "agent2agent"],
                "category": "documentation"
            }
        }
    ]
    
    # Inicializar servidor RAG
    print("Inicializando servidor RAG...")
    server = RAGServer(mode='enhanced')
    
    # Carregar documentos existentes
    server.load_documents()
    print(f"Documentos existentes: {len(server.documents)}")
    
    # Adicionar documentos A2A
    added_count = 0
    for doc in a2a_documents:
        try:
            # Verificar se já existe
            existing = any(
                d.get('metadata', {}).get('url') == doc['metadata']['url']
                for d in server.documents
            )
            
            if existing:
                print(f"Documento já existe: {doc['title']}")
                continue
            
            result = server.add_document(doc)
            print(f"Adicionado: {doc['title']} (ID: {result['id']})")
            added_count += 1
            
        except Exception as e:
            print(f"Erro ao adicionar {doc['title']}: {e}")
    
    # Salvar cache atualizado
    if added_count > 0:
        server.save_documents()
        print(f"\n✅ {added_count} documentos A2A adicionados com sucesso!")
        print(f"Total de documentos: {len(server.documents)}")
        
        # Verificar busca
        print("\nTestando busca por 'a2a'...")
        results = server.search_documents("a2a", limit=5)
        if results:
            print(f"Encontrados {len(results)} resultados:")
            for r in results:
                print(f"  - {r.get('title', 'Sem título')} (score: {r.get('score', 0):.2f})")
        else:
            print("Nenhum resultado encontrado")
    else:
        print("\n✅ Todos os documentos A2A já estavam no cache")

if __name__ == "__main__":
    main()