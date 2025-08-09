#!/usr/bin/env python3
"""
Teste de evolução da memória episódica
Demonstra como o sistema aprende com repetições
"""

import asyncio
from episodic_rag_prototype import EpisodicRAG

async def test_memory_evolution():
    """Testa evolução da memória com queries repetidas"""
    
    print("🧠 TESTE DE EVOLUÇÃO DA MEMÓRIA EPISÓDICA\n")
    print("=" * 60)
    
    rag = EpisodicRAG()
    
    # Queries para testar aprendizado
    test_queries = [
        # Primeira rodada - aprendendo
        ("Como implementar RAG?", "primeira vez"),
        ("Como implementar RAG?", "repetição imediata"),
        ("Busca vetorial", "novo tópico"),
        ("Como implementar RAG?", "terceira vez"),
        ("Busca vetorial", "repetição"),
        
        # Forçar consolidação (threshold = 5)
        ("Embeddings", "trigger consolidation"),
        
        # Testar memória consolidada
        ("Como implementar RAG?", "após consolidação"),
        ("Busca vetorial", "após consolidação"),
    ]
    
    print("📊 Executando queries e observando aprendizado:\n")
    
    for i, (query, context) in enumerate(test_queries, 1):
        print(f"\n🔍 Query {i}: '{query}' ({context})")
        print("-" * 50)
        
        phases_seen = []
        latencies = []
        
        async for result in rag.progressive_search(query):
            phase = result['phase']
            latency = result['latency']
            confidence = result['confidence']
            num_results = len(result['results'])
            
            phases_seen.append(phase)
            latencies.append(latency)
            
            # Mostrar apenas a fase final para clareza
            if phase == 'deep_learning':
                print(f"  📍 Fase final: {latency}ms, {num_results} resultados, confiança: {confidence:.2f}")
        
        # Análise especial para queries repetidas
        if "repetição" in context or "após" in context:
            avg_latency = sum(latencies) / len(latencies) if latencies else 0
            print(f"  ⚡ Latência média: {avg_latency:.0f}ms")
            
            # Verificar se houve melhoria
            if 'working_memory' in phases_seen:
                print(f"  ✅ CACHE HIT! Resposta instantânea da memória de trabalho")
            elif 'episodic' in phases_seen:
                print(f"  ✅ Memória episódica ativada - aprendizado em ação")
            elif 'semantic' in phases_seen:
                print(f"  ✅ Padrão consolidado na memória semântica")
        
        # Simular feedback positivo para queries sobre RAG
        if "RAG" in query and rag.episodic_memory:
            rag.episodic_memory[-1].success_score = 0.9
            print(f"  👍 Feedback positivo registrado")
        
        # Pequena pausa para simular uso real
        await asyncio.sleep(0.2)
    
    print("\n" + "=" * 60)
    print("📈 ESTATÍSTICAS FINAIS DE APRENDIZADO:")
    print("=" * 60)
    
    stats = rag.get_learning_stats()
    
    print(f"""
  Total de episódios: {stats['total_episodes']}
  Padrões semânticos: {stats['semantic_patterns']}
  Itens em memória de trabalho: {stats['working_memory_size']}
  Taxa média de sucesso: {stats['avg_success_rate']:.2%}
  Total de buscas: {stats['total_searches']}
  Cache de embeddings: {stats['cache_size']}
    """)
    
    # Verificar consolidação
    if stats['semantic_patterns'] > 0:
        print("  🎯 CONSOLIDAÇÃO DETECTADA!")
        print(f"  {stats['semantic_patterns']} padrões aprendidos e consolidados")
    
    # Análise de performance
    print("\n📊 ANÁLISE DE PERFORMANCE:")
    print("-" * 40)
    
    if stats['total_episodes'] >= 5:
        print("  ✅ Sistema com memória episódica ativa")
    
    if stats['cache_size'] > 3:
        print(f"  ✅ Cache eficiente: {stats['cache_size']} embeddings reutilizáveis")
    
    if stats['avg_success_rate'] > 0.5:
        print(f"  ✅ Alta taxa de sucesso: {stats['avg_success_rate']:.0%}")
    
    # Salvar estatísticas para análise
    import json
    with open('.episodic_cache/test_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print("\n💾 Estatísticas salvas em .episodic_cache/test_stats.json")
    
    return stats

def main():
    """Executa teste de evolução"""
    print("\n" + "🚀 " * 20)
    print("INICIANDO TESTE DE EVOLUÇÃO DA MEMÓRIA EPISÓDICA")
    print("🚀 " * 20 + "\n")
    
    stats = asyncio.run(test_memory_evolution())
    
    # Verificar sucesso
    success = (
        stats['total_episodes'] >= 5 and
        stats['cache_size'] >= 3 and
        stats['avg_success_rate'] > 0.3
    )
    
    print("\n" + "=" * 60)
    if success:
        print("✅ TESTE CONCLUÍDO COM SUCESSO!")
        print("O sistema demonstrou capacidade de aprendizado e memória")
    else:
        print("⚠️ TESTE CONCLUÍDO COM OBSERVAÇÕES")
        print("O sistema precisa de mais interações para demonstrar aprendizado completo")
    print("=" * 60)
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())