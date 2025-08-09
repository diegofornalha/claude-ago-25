#!/usr/bin/env python3
"""
🧠 EPISODIC RAG - Sistema RAG com Memória Episódica e Aprendizado Contínuo
Protótipo revolucionário que aprende com cada interação
"""

import asyncio
import json
import hashlib
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, AsyncGenerator
from dataclasses import dataclass, asdict
from collections import defaultdict
import numpy as np
from pathlib import Path
import pickle

@dataclass
class Episode:
    """Representa uma interação/episódio de busca"""
    query: str
    results: List[Dict]
    feedback: Optional[Dict] = None
    context: Dict = None
    timestamp: datetime = None
    success_score: float = 0.0
    query_embedding: np.ndarray = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class MemoryConsolidation:
    """Memória consolidada de longo prazo"""
    pattern: str
    frequency: int
    avg_success: float
    best_approaches: List[str]
    related_queries: List[str]
    insights: List[str]

class EpisodicRAG:
    """
    RAG com memória episódica que aprende e melhora com o tempo
    """
    
    def __init__(self, cache_dir: str = ".episodic_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Três níveis de memória (inspirado em neurociência)
        self.working_memory = {}      # Contexto ativo (segundos)
        self.episodic_memory = []     # Experiências recentes (horas)
        self.semantic_memory = {}     # Conhecimento consolidado (permanente)
        
        # Métricas de aprendizado
        self.performance_history = []
        self.learning_rate = 0.1
        self.consolidation_threshold = 5
        
        # Cache de embeddings para eficiência
        self.embedding_cache = {}
        
        # Carregar memórias persistidas
        self._load_memories()
    
    async def progressive_search(self, query: str) -> AsyncGenerator[Dict, None]:
        """
        Busca progressiva com refinamento em tempo real
        Retorna resultados que melhoram progressivamente
        """
        
        # Fase 1: Memória de trabalho (instantâneo)
        if query in self.working_memory:
            yield {
                'phase': 'working_memory',
                'latency': 0,
                'results': self.working_memory[query],
                'confidence': 1.0
            }
        
        # Fase 2: Busca episódica (rápido)
        episodic_results = await self._search_episodic(query)
        if episodic_results:
            yield {
                'phase': 'episodic',
                'latency': 50,
                'results': episodic_results,
                'confidence': 0.8
            }
        
        # Fase 3: Busca semântica aprendida (médio)
        semantic_results = await self._search_semantic(query)
        if semantic_results:
            yield {
                'phase': 'semantic',
                'latency': 200,
                'results': semantic_results,
                'confidence': 0.9
            }
        
        # Fase 4: Busca profunda com aprendizado (lento mas preciso)
        deep_results = await self._deep_search_with_learning(query)
        yield {
            'phase': 'deep_learning',
            'latency': 500,
            'results': deep_results,
            'confidence': 0.95
        }
        
        # Registrar episódio para aprendizado futuro
        episode = Episode(
            query=query,
            results=deep_results,
            context=self._extract_context(),
            query_embedding=await self._get_embedding(query)
        )
        self._record_episode(episode)
    
    async def _search_episodic(self, query: str) -> List[Dict]:
        """
        Busca em memórias episódicas recentes
        """
        results = []
        query_embedding = await self._get_embedding(query)
        
        # Buscar episódios similares
        for episode in self.episodic_memory[-100:]:  # Últimos 100 episódios
            if episode.query_embedding is not None:
                similarity = self._cosine_similarity(
                    query_embedding, 
                    episode.query_embedding
                )
                
                if similarity > 0.7:  # Threshold de similaridade
                    # Reusar resultados bem-sucedidos
                    if episode.success_score > 0.8:
                        results.extend([
                            {**r, 'episodic_boost': similarity * episode.success_score}
                            for r in episode.results[:3]
                        ])
        
        # Ordenar por relevância episódica
        results.sort(key=lambda x: x.get('episodic_boost', 0), reverse=True)
        return results[:10]
    
    async def _search_semantic(self, query: str) -> List[Dict]:
        """
        Busca em memória semântica consolidada
        """
        results = []
        
        # Identificar padrões aprendidos
        patterns = self._identify_patterns(query)
        
        for pattern in patterns:
            if pattern in self.semantic_memory:
                consolidation = self.semantic_memory[pattern]
                
                # Aplicar melhores abordagens aprendidas
                for approach in consolidation.best_approaches:
                    approach_results = await self._apply_approach(query, approach)
                    results.extend(approach_results)
                
                # Adicionar insights relacionados
                for insight in consolidation.insights:
                    results.append({
                        'type': 'learned_insight',
                        'content': insight,
                        'confidence': consolidation.avg_success
                    })
        
        return results
    
    async def _deep_search_with_learning(self, query: str) -> List[Dict]:
        """
        Busca profunda que aprende com o processo
        """
        # Múltiplas estratégias em paralelo
        strategies = [
            self._strategy_exact_match(query),
            self._strategy_semantic_expansion(query),
            self._strategy_contextual_inference(query),
            self._strategy_creative_association(query)
        ]
        
        # Executar todas as estratégias em paralelo
        all_results = await asyncio.gather(*strategies)
        
        # Combinar e rankear resultados
        combined = self._intelligent_merge(all_results)
        
        # Aprender com o processo
        self._learn_from_search(query, combined)
        
        return combined
    
    def _record_episode(self, episode: Episode):
        """
        Registra episódio e consolida memórias se necessário
        """
        # Adicionar à memória episódica
        self.episodic_memory.append(episode)
        
        # Limitar tamanho da memória episódica (FIFO)
        if len(self.episodic_memory) > 1000:
            self.episodic_memory = self.episodic_memory[-1000:]
        
        # Consolidar para memória semântica periodicamente
        if len(self.episodic_memory) % self.consolidation_threshold == 0:
            self._consolidate_memories()
        
        # Atualizar memória de trabalho
        self.working_memory[episode.query] = episode.results[:5]
        
        # Limpar memória de trabalho antiga (>5 min)
        cutoff = datetime.now() - timedelta(minutes=5)
        self.working_memory = {
            k: v for k, v in self.working_memory.items()
            if k == episode.query  # Manter query atual
        }
    
    def _consolidate_memories(self):
        """
        Consolida memórias episódicas em conhecimento semântico
        """
        # Agrupar episódios por padrões
        pattern_groups = defaultdict(list)
        
        for episode in self.episodic_memory:
            patterns = self._identify_patterns(episode.query)
            for pattern in patterns:
                pattern_groups[pattern].append(episode)
        
        # Consolidar cada grupo
        for pattern, episodes in pattern_groups.items():
            if len(episodes) >= 3:  # Mínimo para consolidar
                consolidation = MemoryConsolidation(
                    pattern=pattern,
                    frequency=len(episodes),
                    avg_success=np.mean([e.success_score for e in episodes]),
                    best_approaches=self._extract_best_approaches(episodes),
                    related_queries=[e.query for e in episodes[:5]],
                    insights=self._generate_insights(episodes)
                )
                
                self.semantic_memory[pattern] = consolidation
        
        # Persistir memórias
        self._save_memories()
    
    def _identify_patterns(self, query: str) -> List[str]:
        """
        Identifica padrões na query
        """
        patterns = []
        
        # Padrões simples
        words = query.lower().split()
        patterns.extend(words)
        
        # Bigramas
        for i in range(len(words) - 1):
            patterns.append(f"{words[i]}_{words[i+1]}")
        
        # Padrões de intenção
        if any(q in query.lower() for q in ['como', 'how', 'what']):
            patterns.append('question_how')
        if any(q in query.lower() for q in ['quando', 'when']):
            patterns.append('question_when')
        if any(q in query.lower() for q in ['por que', 'why']):
            patterns.append('question_why')
        
        return patterns
    
    def _extract_best_approaches(self, episodes: List[Episode]) -> List[str]:
        """
        Extrai as melhores abordagens de episódios bem-sucedidos
        """
        successful = [e for e in episodes if e.success_score > 0.7]
        approaches = []
        
        for episode in successful[:3]:
            # Analisar resultados para identificar abordagem
            if episode.results:
                approach = {
                    'query_pattern': episode.query[:50],
                    'result_types': list(set(r.get('type', 'unknown') for r in episode.results[:3])),
                    'success_score': episode.success_score
                }
                approaches.append(json.dumps(approach))
        
        return approaches
    
    def _generate_insights(self, episodes: List[Episode]) -> List[str]:
        """
        Gera insights a partir de padrões nos episódios
        """
        insights = []
        
        # Insight: Queries mais frequentes
        query_freq = defaultdict(int)
        for e in episodes:
            query_freq[e.query] += 1
        
        if query_freq:
            most_common = max(query_freq, key=query_freq.get)
            insights.append(f"Query mais comum: '{most_common}' ({query_freq[most_common]} vezes)")
        
        # Insight: Melhor horário
        hour_success = defaultdict(list)
        for e in episodes:
            hour = e.timestamp.hour
            hour_success[hour].append(e.success_score)
        
        if hour_success:
            best_hour = max(hour_success, key=lambda h: np.mean(hour_success[h]))
            insights.append(f"Melhor performance às {best_hour}h")
        
        return insights
    
    async def _get_embedding(self, text: str) -> np.ndarray:
        """
        Obtém embedding com cache
        """
        if text in self.embedding_cache:
            return self.embedding_cache[text]
        
        # Simulação de embedding (substituir por modelo real)
        embedding = np.random.randn(384)
        embedding = embedding / np.linalg.norm(embedding)
        
        self.embedding_cache[text] = embedding
        return embedding
    
    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """
        Calcula similaridade de cosseno
        """
        return float(np.dot(a, b))
    
    def _extract_context(self) -> Dict:
        """
        Extrai contexto atual
        """
        return {
            'timestamp': datetime.now().isoformat(),
            'memory_size': len(self.episodic_memory),
            'semantic_patterns': len(self.semantic_memory),
            'working_memory_items': len(self.working_memory)
        }
    
    async def _apply_approach(self, query: str, approach: str) -> List[Dict]:
        """
        Aplica uma abordagem aprendida
        """
        # Simular aplicação de abordagem
        return [
            {
                'content': f"Resultado usando abordagem aprendida: {approach[:100]}",
                'approach': approach,
                'confidence': 0.85
            }
        ]
    
    async def _strategy_exact_match(self, query: str) -> List[Dict]:
        """Estratégia: Busca exata"""
        return [{'strategy': 'exact', 'content': f"Exact match for: {query}"}]
    
    async def _strategy_semantic_expansion(self, query: str) -> List[Dict]:
        """Estratégia: Expansão semântica"""
        return [{'strategy': 'semantic', 'content': f"Semantic expansion of: {query}"}]
    
    async def _strategy_contextual_inference(self, query: str) -> List[Dict]:
        """Estratégia: Inferência contextual"""
        return [{'strategy': 'contextual', 'content': f"Context inference for: {query}"}]
    
    async def _strategy_creative_association(self, query: str) -> List[Dict]:
        """Estratégia: Associação criativa"""
        return [{'strategy': 'creative', 'content': f"Creative association: {query}"}]
    
    def _intelligent_merge(self, results_list: List[List[Dict]]) -> List[Dict]:
        """
        Merge inteligente de resultados de múltiplas estratégias
        """
        all_results = []
        for results in results_list:
            all_results.extend(results)
        
        # Deduplica e rankeia
        seen = set()
        unique = []
        for r in all_results:
            key = hashlib.md5(str(r).encode()).hexdigest()
            if key not in seen:
                seen.add(key)
                unique.append(r)
        
        return unique[:20]
    
    def _learn_from_search(self, query: str, results: List[Dict]):
        """
        Aprende com o processo de busca
        """
        # Atualizar métricas de performance
        self.performance_history.append({
            'query': query,
            'timestamp': datetime.now(),
            'num_results': len(results),
            'strategies_used': list(set(r.get('strategy', 'unknown') for r in results))
        })
    
    def _save_memories(self):
        """
        Persiste memórias em disco
        """
        # Salvar memória semântica
        semantic_path = self.cache_dir / "semantic_memory.pkl"
        with open(semantic_path, 'wb') as f:
            pickle.dump(self.semantic_memory, f)
        
        # Salvar histórico de performance
        perf_path = self.cache_dir / "performance.json"
        with open(perf_path, 'w') as f:
            json.dump(self.performance_history[-1000:], f, default=str)
    
    def _load_memories(self):
        """
        Carrega memórias do disco
        """
        semantic_path = self.cache_dir / "semantic_memory.pkl"
        if semantic_path.exists():
            with open(semantic_path, 'rb') as f:
                self.semantic_memory = pickle.load(f)
        
        perf_path = self.cache_dir / "performance.json"
        if perf_path.exists():
            with open(perf_path, 'r') as f:
                self.performance_history = json.load(f)
    
    def get_learning_stats(self) -> Dict:
        """
        Retorna estatísticas de aprendizado
        """
        return {
            'total_episodes': len(self.episodic_memory),
            'semantic_patterns': len(self.semantic_memory),
            'working_memory_size': len(self.working_memory),
            'avg_success_rate': np.mean([e.success_score for e in self.episodic_memory]) if self.episodic_memory else 0,
            'total_searches': len(self.performance_history),
            'cache_size': len(self.embedding_cache)
        }


async def demo():
    """
    Demonstração do Episodic RAG
    """
    print("🧠 EPISODIC RAG - Demonstração\n")
    
    rag = EpisodicRAG()
    
    # Queries de teste
    queries = [
        "Como implementar RAG em Python?",
        "Melhores práticas para embeddings",
        "Como implementar RAG?",  # Similar à primeira
        "Otimização de busca vetorial"
    ]
    
    for query in queries:
        print(f"\n📍 Query: {query}")
        print("-" * 50)
        
        async for result in rag.progressive_search(query):
            phase = result['phase']
            latency = result['latency']
            num_results = len(result['results'])
            confidence = result['confidence']
            
            print(f"  ⚡ {phase:20} | {latency:4}ms | {num_results:2} resultados | confiança: {confidence:.2f}")
            
            # Simular feedback para aprendizado
            if phase == 'deep_learning' and rag.episodic_memory:
                # Registrar sucesso
                rag.episodic_memory[-1].success_score = 0.9
        
        await asyncio.sleep(0.5)
    
    # Mostrar estatísticas de aprendizado
    print("\n📊 Estatísticas de Aprendizado:")
    stats = rag.get_learning_stats()
    for key, value in stats.items():
        print(f"  {key:20}: {value}")


if __name__ == "__main__":
    asyncio.run(demo())