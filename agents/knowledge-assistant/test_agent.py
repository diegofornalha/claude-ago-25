#!/usr/bin/env python3
"""
Script de teste para o Knowledge Assistant A2A Agent
"""

import requests
import json
import time
import sys

BASE_URL = "http://localhost:9999"

def test_agent_card():
    """Testa obtenção do Agent Card"""
    print("1. Testando Agent Card...")
    response = requests.get(f"{BASE_URL}/.well-known/agent.json")
    
    if response.status_code == 200:
        card = response.json()
        print(f"   ✓ Agent: {card['name']} v{card['version']}")
        print(f"   ✓ Skills disponíveis: {len(card['skills'])}")
        for skill in card['skills']:
            print(f"     - {skill['id']}: {skill['name']}")
        return True
    else:
        print(f"   ✗ Erro: {response.status_code}")
        return False

def test_create_search_task():
    """Testa criação de tarefa de busca"""
    print("\n2. Testando criação de tarefa de busca...")
    
    payload = {
        "skill": "search_knowledge",
        "parameters": {
            "query": "O que é o protocolo A2A?",
            "use_semantic": True,
            "limit": 3
        }
    }
    
    response = requests.post(f"{BASE_URL}/tasks", json=payload)
    
    if response.status_code == 201:
        task = response.json()
        print(f"   ✓ Tarefa criada: {task['id']}")
        print(f"   ✓ Estado: {task['state']}")
        return task['id']
    else:
        print(f"   ✗ Erro: {response.status_code}")
        return None

def test_get_task_status(task_id):
    """Testa obtenção de status da tarefa"""
    print(f"\n3. Verificando status da tarefa {task_id}...")
    
    # Aguardar processamento
    time.sleep(2)
    
    response = requests.get(f"{BASE_URL}/tasks/{task_id}")
    
    if response.status_code == 200:
        task = response.json()
        print(f"   ✓ Estado: {task['state']}")
        
        if task['result']:
            print(f"   ✓ Resultado obtido:")
            print(f"     {json.dumps(task['result'], indent=2)}")
        
        return True
    else:
        print(f"   ✗ Erro: {response.status_code}")
        return False

def test_add_knowledge():
    """Testa adição de conhecimento"""
    print("\n4. Testando adição de conhecimento...")
    
    payload = {
        "skill": "add_knowledge",
        "parameters": {
            "title": "Teste de Conhecimento A2A",
            "content": "Este é um documento de teste para o agente A2A Knowledge Assistant.",
            "tags": ["teste", "a2a", "knowledge"],
            "category": "testing"
        }
    }
    
    response = requests.post(f"{BASE_URL}/tasks", json=payload)
    
    if response.status_code == 201:
        task = response.json()
        print(f"   ✓ Tarefa criada: {task['id']}")
        
        # Aguardar e verificar resultado
        time.sleep(2)
        response = requests.get(f"{BASE_URL}/tasks/{task['id']}")
        
        if response.status_code == 200:
            task = response.json()
            if task['result']:
                print(f"   ✓ Documento adicionado: {task['result'].get('document_id')}")
            return True
    
    print(f"   ✗ Erro ao adicionar conhecimento")
    return False

def test_analyze_topic():
    """Testa análise de tópico"""
    print("\n5. Testando análise de tópico...")
    
    payload = {
        "skill": "analyze_topic",
        "parameters": {
            "topic": "Protocolo A2A e integração com MCP",
            "depth": "advanced"
        }
    }
    
    response = requests.post(f"{BASE_URL}/tasks", json=payload)
    
    if response.status_code == 201:
        task = response.json()
        print(f"   ✓ Análise iniciada: {task['id']}")
        
        # Aguardar processamento
        time.sleep(2)
        response = requests.get(f"{BASE_URL}/tasks/{task['id']}")
        
        if response.status_code == 200:
            task = response.json()
            if task['result'] and 'analysis' in task['result']:
                analysis = task['result']['analysis']
                print(f"   ✓ Análise concluída:")
                print(f"     - Confiança: {analysis.get('confidence', 0)}")
                print(f"     - Pontos principais: {len(analysis.get('key_points', []))}")
            return True
    
    return False

def test_statistics():
    """Testa obtenção de estatísticas"""
    print("\n6. Testando estatísticas...")
    
    payload = {
        "skill": "get_statistics",
        "parameters": {}
    }
    
    response = requests.post(f"{BASE_URL}/tasks", json=payload)
    
    if response.status_code == 201:
        task = response.json()
        
        # Aguardar processamento
        time.sleep(1)
        response = requests.get(f"{BASE_URL}/tasks/{task['id']}")
        
        if response.status_code == 200:
            task = response.json()
            if task['result']:
                stats = task['result']
                print(f"   ✓ Estatísticas obtidas:")
                print(f"     - Total de documentos: {stats.get('total_documents', 0)}")
                print(f"     - Total de categorias: {stats.get('total_categories', 0)}")
                print(f"     - Total de tags: {stats.get('total_tags', 0)}")
            return True
    
    return False

def main():
    """Executa todos os testes"""
    print("=" * 60)
    print("TESTE DO KNOWLEDGE ASSISTANT A2A AGENT")
    print("=" * 60)
    
    # Verificar se o servidor está rodando
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code != 200:
            print("❌ Servidor não está respondendo!")
            print("Execute primeiro: python app.py")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print("❌ Não foi possível conectar ao servidor!")
        print("Execute primeiro: python app.py")
        sys.exit(1)
    
    print("✅ Servidor está online!\n")
    
    # Executar testes
    tests_passed = 0
    total_tests = 6
    
    if test_agent_card():
        tests_passed += 1
    
    task_id = test_create_search_task()
    if task_id:
        tests_passed += 1
        
        if test_get_task_status(task_id):
            tests_passed += 1
    
    if test_add_knowledge():
        tests_passed += 1
    
    if test_analyze_topic():
        tests_passed += 1
    
    if test_statistics():
        tests_passed += 1
    
    # Resumo
    print("\n" + "=" * 60)
    print(f"RESULTADO: {tests_passed}/{total_tests} testes passaram")
    
    if tests_passed == total_tests:
        print("✅ Todos os testes passaram com sucesso!")
    else:
        print(f"⚠️  {total_tests - tests_passed} testes falharam")
    
    print("=" * 60)

if __name__ == "__main__":
    main()