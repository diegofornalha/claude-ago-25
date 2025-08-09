#!/usr/bin/env python3
"""
Script de teste para o servidor RAG melhorado
"""
import sys
import json
from pathlib import Path

# Adicionar path do servidor
sys.path.insert(0, str(Path(__file__).parent))

from rag_server_improved import ImprovedRAGServer, Document, DocumentType

def test_server():
    """Testa funcionalidades do servidor melhorado"""
    print("=== Testando RAG Server Improved ===\n")
    
    # Criar instância
    server = ImprovedRAGServer()
    
    # 1. Verificar estatísticas iniciais
    print("1. Estatísticas iniciais:")
    stats = server.get_stats()
    print(f"   - Total de documentos: {stats['total_documents']}")
    print(f"   - Tamanho do cache: {stats['cache_size_bytes']} bytes")
    print(f"   - Features: {stats['features']}")
    print()
    
    # 2. Adicionar documento de teste
    print("2. Adicionando documento de teste...")
    test_doc = {
        'title': 'Claude Code Documentation',
        'content': '''Claude Code is an AI-powered coding assistant that helps developers write, debug, and understand code. 
        It supports multiple programming languages including Python, JavaScript, TypeScript, Java, and more.
        Key features include: code generation, debugging assistance, code review, and documentation generation.
        Claude Code can also help with testing, refactoring, and optimizing code performance.''',
        'type': 'documentation',
        'source': 'test',
        'metadata': {'category': 'AI tools', 'language': 'en'}
    }
    
    doc = server.add_document(test_doc)
    print(f"   Documento adicionado: {doc.id}")
    print()
    
    # 3. Testar busca vetorial
    print("3. Testando busca vetorial:")
    queries = [
        "Claude Code features",
        "debugging assistant",
        "Python programming",
        "código AI"
    ]
    
    for query in queries:
        print(f"\n   Query: '{query}'")
        results = server.search(query, limit=3)
        for i, result in enumerate(results, 1):
            print(f"   {i}. {result['title']} (score: {result.get('score', 0):.3f})")
            print(f"      {result['content'][:100]}...")
    
    print()
    
    # 4. Adicionar mais documentos para testar a busca
    print("4. Adicionando documentos adicionais...")
    docs_to_add = [
        {
            'title': 'MCP Protocol Guide',
            'content': 'Model Context Protocol (MCP) enables communication between AI models and external tools.',
            'type': 'documentation'
        },
        {
            'title': 'Python Best Practices',
            'content': 'Follow PEP 8 for code style. Use type hints for better code documentation.',
            'type': 'code'
        },
        {
            'title': 'Web Development with React',
            'content': 'React is a JavaScript library for building user interfaces with component-based architecture.',
            'type': 'webpage'
        }
    ]
    
    for doc_data in docs_to_add:
        server.add_document(doc_data)
    
    print(f"   Total de documentos agora: {len(server.documents)}")
    print()
    
    # 5. Testar busca após adicionar mais documentos
    print("5. Busca após múltiplos documentos:")
    test_query = "Python"
    results = server.search(test_query, limit=5)
    print(f"   Query: '{test_query}'")
    print(f"   Encontrados {len(results)} resultados:")
    for result in results:
        print(f"   - {result['title']} (score: {result.get('score', 0):.3f})")
    
    print()
    
    # 6. Verificar estatísticas finais
    print("6. Estatísticas finais:")
    final_stats = server.get_stats()
    print(f"   - Total de documentos: {final_stats['total_documents']}")
    print(f"   - Tipos de documentos: {final_stats['types']}")
    print(f"   - Tamanho total: {final_stats['total_size_bytes']} bytes")
    
    print("\n=== Teste concluído com sucesso! ===")

if __name__ == "__main__":
    test_server()