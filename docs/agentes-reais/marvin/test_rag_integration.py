#!/usr/bin/env python3
"""
Teste da integração do Marvin com MCP RAG Server
"""

import asyncio
import sys
from pathlib import Path

# Adicionar src ao path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from agent import MarvinAgent

async def test_rag_integration():
    """
    Testa a integração com RAG
    """
    print("🧪 Testando integração Marvin + RAG Server\n")
    
    # Criar agente
    agent = MarvinAgent()
    
    # Verificar se RAG está disponível
    if agent.rag_agent:
        print("✅ RAG integrado com sucesso!\n")
    else:
        print("⚠️ RAG não está disponível\n")
        return
    
    # Testar consultas sobre A2A
    queries = [
        "O que são Agent Cards no protocolo A2A?",
        "Como implementar um agente A2A?",
        "Qual a diferença entre A2A e MCP?",
        "Quais são os estados de uma task no A2A?",
        "Como funciona o discovery de agentes no A2A?"
    ]
    
    for query in queries:
        print(f"📝 Query: {query}")
        
        # Usar método assist que detecta automaticamente se deve usar RAG
        result = await agent.provide_assistance(query)
        
        print(f"📚 Resposta: {result.get('response', 'Sem resposta')[:300]}...")
        print(f"🔍 Fonte: {result.get('source', 'default')}")
        print(f"💡 Sugestões: {result.get('suggestions', [])}")
        print("-" * 80 + "\n")
    
    # Testar consulta direta ao RAG
    print("🔍 Teste de consulta direta ao RAG:")
    rag_result = await agent.query_knowledge_base("Estrutura completa de um Agent Card A2A")
    if "error" not in rag_result:
        print(f"✅ Resultado: {rag_result.get('response', 'Sem dados')[:500]}...")
    else:
        print(f"❌ Erro: {rag_result['error']}")

if __name__ == "__main__":
    asyncio.run(test_rag_integration())