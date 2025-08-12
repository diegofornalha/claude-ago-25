#!/usr/bin/env python3
"""
Exemplo de uso do HelloWorld Agent
"""

import asyncio
from helloworld_agent import HelloWorldAgent


async def main():
    """Demonstra uso do HelloWorld Agent"""
    
    # Criar instância do agente
    agent = HelloWorldAgent()
    
    print("🤖 HelloWorld Agent - Exemplos de Uso")
    print("=" * 50)
    
    # Exemplo 1: Saudação simples
    print("\n1. Saudação Simples:")
    result = await agent.process_request({
        "type": "hello_world",
        "data": {
            "name": "João",
            "language": "português"
        }
    })
    print(f"   {result['greeting']}")
    
    # Exemplo 2: Saudação em inglês
    print("\n2. Saudação em Inglês:")
    result = await agent.process_request({
        "type": "hello_world",
        "data": {
            "name": "Alice",
            "language": "english"
        }
    })
    print(f"   {result['greeting']}")
    
    # Exemplo 3: Super saudação
    print("\n3. Super Saudação (nível 8):")
    result = await agent.process_request({
        "type": "super_hello_world",
        "data": {
            "name": "Maria",
            "language": "português",
            "excitement_level": 8
        }
    })
    print(f"   {result['greeting']}")
    print(f"   Mensagem especial: {result['special_message']}")
    
    # Exemplo 4: Descoberta de capacidades
    print("\n4. Descoberta de Capacidades:")
    result = await agent.process_request({
        "type": "discover"
    })
    print(f"   Agente: {result['name']}")
    print(f"   Versão: {result['version']}")
    print(f"   Capacidades:")
    for cap in result['capabilities']:
        print(f"      - {cap['name']}: {cap['description']}")
    
    # Exemplo 5: Status de saúde
    print("\n5. Status de Saúde:")
    result = await agent.process_request({
        "type": "health"
    })
    print(f"   Status: {result['status']}")
    print(f"   Uptime: {result['uptime']:.2f} segundos")
    
    # Exemplo 6: Múltiplos idiomas
    print("\n6. Saudações em Múltiplos Idiomas:")
    languages = ["español", "français", "deutsch", "日本語", "中文"]
    for lang in languages:
        result = await agent.process_request({
            "type": "hello_world",
            "data": {
                "name": "A2A",
                "language": lang
            }
        })
        print(f"   {lang}: {result['greeting']}")
    
    # Exemplo 7: Agent Card
    print("\n7. Agent Card A2A:")
    card = agent.get_agent_card()
    print(f"   Nome: {card['name']}")
    print(f"   Descrição: {card['description']}")
    print(f"   Skills disponíveis:")
    for skill in card['skills']:
        print(f"      - {skill['name']}")
        print(f"        Parâmetros: {skill['parameters']}")
    
    print("\n" + "=" * 50)
    print("✅ Todos os exemplos executados com sucesso!")


if __name__ == "__main__":
    asyncio.run(main())