#!/usr/bin/env python3
"""
Exemplo de uso do Marvin Agent com A2A Protocol
Demonstra extração de dados e comunicação via protocolo A2A
"""

import asyncio
import json
import httpx
from typing import Dict, Any


async def send_a2a_message(message: str, message_id: str = "test-001") -> Dict[str, Any]:
    """
    Envia uma mensagem para o Marvin Agent via protocolo A2A
    """
    url = "http://localhost:9998/"
    
    payload = {
        "jsonrpc": "2.0",
        "method": "message/send",
        "params": {
            "message": {
                "messageId": message_id,
                "role": "user",
                "parts": [{"text": message}]
            }
        },
        "id": 1
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        return response.json()


async def example_extraction():
    """
    Exemplo de extração de dados estruturados
    """
    print("=" * 60)
    print("🔍 EXEMPLO 1: Extração de Dados de Contato")
    print("=" * 60)
    
    # Texto de exemplo com informações de contato
    text = """
    Extraia as informações de: João Silva, trabalha na TechCorp Brasil 
    como CTO, telefone (11) 98765-4321 e email joao.silva@techcorp.com.br
    """
    
    print(f"\n📝 Texto original:\n{text.strip()}\n")
    
    # Enviar para o Marvin
    result = await send_a2a_message(text, "extract-001")
    
    # Processar resposta
    if "result" in result and "artifacts" in result["result"]:
        artifact = result["result"]["artifacts"][0]
        data = artifact["parts"][0]["data"]
        
        print("✅ Dados Extraídos:")
        print("-" * 40)
        
        if "extracted_data" in data:
            for key, value in data["extracted_data"].items():
                print(f"  • {key.capitalize()}: {value}")
        
        print("\n📊 Estatísticas:")
        if "statistics" in data:
            stats = data["statistics"]
            print(f"  • Total de entidades: {stats['total_entities_found']}")
            print(f"  • Tipos encontrados: {stats['entity_types_found']}")
    
    return result


async def example_multi_extraction():
    """
    Exemplo de extração múltipla de dados
    """
    print("\n" + "=" * 60)
    print("🔍 EXEMPLO 2: Extração de Múltiplos Contatos")
    print("=" * 60)
    
    text = """
    Extraia as informações: 
    1. Maria Santos - CEO da StartupX - maria@startupx.com - 213456789
    2. Pedro Costa, gerente de projetos, pedro.costa@empresa.com, tel 987654321
    3. Ana Lima trabalha como designer na Creative Agency, ana@creative.io
    """
    
    print(f"\n📝 Texto original:\n{text.strip()}\n")
    
    result = await send_a2a_message(text, "extract-002")
    
    if "result" in result and "artifacts" in result["result"]:
        artifact = result["result"]["artifacts"][0]
        data = artifact["parts"][0]["data"]
        
        print("✅ Entidades Encontradas:")
        print("-" * 40)
        
        if "entities" in data:
            entities = data["entities"]
            
            if entities["names"]:
                print(f"  👤 Nomes: {', '.join(entities['names'])}")
            
            if entities["emails"]:
                print(f"  📧 Emails: {', '.join(entities['emails'])}")
            
            if entities["phones"]:
                print(f"  📱 Telefones: {', '.join(entities['phones'])}")
            
            if entities["positions"]:
                print(f"  💼 Cargos: {', '.join(entities['positions'])}")
            
            if entities["companies"]:
                print(f"  🏢 Empresas: {', '.join(entities['companies'])}")
    
    return result


async def example_assistance():
    """
    Exemplo de assistência geral
    """
    print("\n" + "=" * 60)
    print("💡 EXEMPLO 3: Assistência Geral")
    print("=" * 60)
    
    queries = [
        "Você está ativo?",
        "Como posso melhorar meu código?",
        "O que é um protocolo A2A?"
    ]
    
    for i, query in enumerate(queries, 1):
        print(f"\n❓ Pergunta {i}: {query}")
        
        result = await send_a2a_message(query, f"assist-{i:03d}")
        
        if "result" in result and "artifacts" in result["result"]:
            artifact = result["result"]["artifacts"][0]
            data = artifact["parts"][0]["data"]
            
            if "response" in data:
                print(f"💬 Resposta: {data['response']}")
            
            if "suggestions" in data and data["suggestions"]:
                print("📌 Sugestões:")
                for suggestion in data["suggestions"]:
                    print(f"   • {suggestion}")


async def main():
    """
    Executa todos os exemplos
    """
    print("\n")
    print("🤖 MARVIN AGENT - EXEMPLOS DE USO")
    print("=" * 60)
    print("Demonstração de capacidades via protocolo A2A")
    print("Porta: 9998")
    print("=" * 60)
    
    try:
        # Verificar se o Marvin está rodando
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:9998/.well-known/agent-card.json")
            if response.status_code == 200:
                print("✅ Marvin Agent está ativo e respondendo\n")
            else:
                print("❌ Erro ao conectar com Marvin Agent")
                return
    except Exception as e:
        print(f"❌ Marvin Agent não está rodando na porta 9998")
        print(f"   Execute: ./scripts/start_marvin.sh")
        return
    
    # Executar exemplos
    await example_extraction()
    await example_multi_extraction()
    await example_assistance()
    
    print("\n" + "=" * 60)
    print("✅ Todos os exemplos foram executados com sucesso!")
    print("=" * 60)


if __name__ == "__main__":
    # Executar exemplos
    asyncio.run(main())