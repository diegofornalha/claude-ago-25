#!/usr/bin/env python3
"""
Script de teste para integração A2A + RAG Server
"""

import requests
import json
import time

# Configuração
A2A_URL = "http://localhost:9998"

def test_rag_search():
    """Testa busca real no RAG Server"""
    print("1. Testando busca no RAG Server via A2A...")
    
    payload = {
        "skill": "search_knowledge",
        "parameters": {
            "query": "A2A protocol implementação python",
            "use_semantic": True,
            "limit": 5
        }
    }
    
    response = requests.post(f"{A2A_URL}/tasks", json=payload)
    if response.status_code == 201:
        task = response.json()
        task_id = task['id']
        print(f"   ✓ Tarefa criada: {task_id}")
        
        # Aguardar processamento
        time.sleep(3)
        
        # Obter resultado
        response = requests.get(f"{A2A_URL}/tasks/{task_id}")
        if response.status_code == 200:
            task = response.json()
            print(f"   ✓ Estado: {task['state']}")
            
            if task.get('result'):
                result = task['result']
                print(f"   ✓ Resultados encontrados: {len(result.get('results', []))}")
                
                for idx, doc in enumerate(result.get('results', [])[:3], 1):
                    print(f"\n   {idx}. {doc.get('title', 'Sem título')}")
                    print(f"      Score: {doc.get('score', 0):.3f}")
                    print(f"      Categoria: {doc.get('category', 'N/A')}")
                    print(f"      Tags: {', '.join(doc.get('tags', []))}")
                    content = doc.get('content', '')[:150]
                    print(f"      Conteúdo: {content}...")
            else:
                print("   ⚠️  Nenhum resultado retornado")
    else:
        print(f"   ✗ Erro: {response.status_code}")

def test_add_document():
    """Testa adição de documento ao RAG"""
    print("\n2. Testando adição de documento ao RAG...")
    
    payload = {
        "skill": "add_knowledge",
        "parameters": {
            "title": "Integração A2A com Claude Code - Tutorial",
            "content": """
            Este tutorial demonstra como integrar o protocolo A2A com Claude Code.
            
            Passos principais:
            1. Criar Agent Card com capacidades
            2. Implementar servidor A2A em Python
            3. Integrar com RAG Server via MCP
            4. Testar comunicação entre agentes
            
            O resultado é um sistema multi-agente inteligente com memória persistente.
            """,
            "tags": ["a2a", "claude", "tutorial", "integration", "mcp", "rag"],
            "category": "a2a:tutorials",
            "source": "a2a-agent-test"
        }
    }
    
    response = requests.post(f"{A2A_URL}/tasks", json=payload)
    if response.status_code == 201:
        task = response.json()
        task_id = task['id']
        print(f"   ✓ Tarefa criada: {task_id}")
        
        time.sleep(2)
        
        response = requests.get(f"{A2A_URL}/tasks/{task_id}")
        if response.status_code == 200:
            task = response.json()
            
            if task.get('result') and task['result'].get('success'):
                print(f"   ✓ Documento adicionado com sucesso!")
                print(f"   ✓ ID do documento: {task['result'].get('document_id')}")
            else:
                print(f"   ⚠️  Erro ao adicionar: {task.get('error')}")

def test_analyze_topic():
    """Testa análise de tópico"""
    print("\n3. Testando análise de tópico...")
    
    payload = {
        "skill": "analyze_topic",
        "parameters": {
            "topic": "Benefícios do protocolo A2A para sistemas multi-agente",
            "depth": "advanced"
        }
    }
    
    response = requests.post(f"{A2A_URL}/tasks", json=payload)
    if response.status_code == 201:
        task = response.json()
        task_id = task['id']
        print(f"   ✓ Tarefa criada: {task_id}")
        
        time.sleep(4)
        
        response = requests.get(f"{A2A_URL}/tasks/{task_id}")
        if response.status_code == 200:
            task = response.json()
            
            if task.get('result') and 'analysis' in task['result']:
                analysis = task['result']['analysis']
                print(f"   ✓ Análise concluída")
                print(f"   ✓ Fontes consultadas: {analysis.get('sources_consulted', 0)}")
                print(f"   ✓ Confiança: {analysis.get('confidence', 0):.2%}")
                
                print("\n   Pontos principais:")
                for point in analysis.get('key_points', [])[:3]:
                    print(f"   {point[:100]}...")

def test_statistics():
    """Testa estatísticas do RAG"""
    print("\n4. Testando estatísticas do RAG...")
    
    payload = {
        "skill": "get_statistics",
        "parameters": {}
    }
    
    response = requests.post(f"{A2A_URL}/tasks", json=payload)
    if response.status_code == 201:
        task = response.json()
        task_id = task['id']
        
        time.sleep(2)
        
        response = requests.get(f"{A2A_URL}/tasks/{task_id}")
        if response.status_code == 200:
            task = response.json()
            
            if task.get('result'):
                stats = task['result']
                print(f"   ✓ Total de documentos: {stats.get('total_documents', 0)}")
                print(f"   ✓ Total de categorias: {stats.get('total_categories', 0)}")
                print(f"   ✓ Total de tags: {stats.get('total_tags', 0)}")
                print(f"   ✓ Modo do servidor: {stats.get('server_mode', 'N/A')}")
                
                if stats.get('top_categories'):
                    print("\n   Top categorias:")
                    for cat in stats['top_categories'][:3]:
                        print(f"   - {cat['name']}: {cat['count']} docs")

def main():
    print("=" * 60)
    print("TESTE DE INTEGRAÇÃO A2A + RAG SERVER")
    print("=" * 60)
    
    # Verificar servidor A2A
    try:
        response = requests.get(f"{A2A_URL}/health")
        if response.status_code == 200:
            print("✅ Servidor A2A está online!")
        else:
            print("❌ Servidor A2A não está respondendo corretamente")
            return
    except:
        print("❌ Não foi possível conectar ao servidor A2A")
        print("Execute: python app.py")
        return
    
    print()
    
    # Executar testes
    test_rag_search()
    test_add_document()
    test_analyze_topic()
    test_statistics()
    
    print("\n" + "=" * 60)
    print("✅ Testes de integração concluídos!")
    print("=" * 60)

if __name__ == "__main__":
    main()