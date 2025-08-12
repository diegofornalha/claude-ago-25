#!/usr/bin/env python3
"""
Integração simplificada com documentação A2A local
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class SimpleRAG:
    """
    RAG simplificado que lê documentação A2A local
    """
    
    def __init__(self):
        self.docs_path = Path("/Users/agents/.claude/docs")
        self.a2a_docs = self.load_a2a_docs()
        logger.info(f"SimpleRAG inicializado com {len(self.a2a_docs)} documentos")
    
    def load_a2a_docs(self) -> Dict[str, str]:
        """
        Carrega documentação A2A dos arquivos locais
        """
        docs = {}
        
        # Documentos A2A principais
        doc_files = [
            "01-introducao/aula-01-a2a-fundamentos-tecnicos.md",
            "agentes-reais/CONFORMIDADE-A2A.md",
            "agentes-reais/marvin/A2A-PADRONIZACAO.md",
            "agentes-reais/marvin/TUTORIAL-CURL-A2A.md"
        ]
        
        for doc_file in doc_files:
            file_path = self.docs_path / doc_file
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        docs[doc_file] = f.read()
                except Exception as e:
                    logger.error(f"Erro ao ler {doc_file}: {e}")
        
        return docs
    
    def search(self, query: str) -> List[Dict[str, Any]]:
        """
        Busca simples na documentação
        """
        query_lower = query.lower()
        results = []
        
        for doc_name, content in self.a2a_docs.items():
            content_lower = content.lower()
            
            # Calcular relevância simples
            relevance = 0
            for word in query_lower.split():
                if word in content_lower:
                    relevance += content_lower.count(word)
            
            if relevance > 0:
                # Extrair trecho relevante
                lines = content.split('\n')
                relevant_lines = []
                
                for line in lines:
                    if any(word in line.lower() for word in query_lower.split()):
                        relevant_lines.append(line)
                        if len(relevant_lines) >= 5:
                            break
                
                results.append({
                    "doc": doc_name,
                    "relevance": relevance,
                    "excerpt": '\n'.join(relevant_lines)[:500]
                })
        
        # Ordenar por relevância
        results.sort(key=lambda x: x['relevance'], reverse=True)
        
        return results[:5]  # Top 5 resultados
    
    def get_a2a_info(self, topic: str) -> Dict[str, Any]:
        """
        Obtém informações específicas sobre A2A
        """
        # Mapeamento de tópicos para termos de busca
        topic_queries = {
            "agent_cards": "Agent Card name skills capabilities",
            "protocol": "A2A Protocol JSON-RPC",
            "skills": "skills parameters description",
            "tasks": "task states CREATED RUNNING COMPLETED",
            "streaming": "streaming SSE Server-Sent Events",
            "discovery": "well-known agent.json discovery",
            "vs_mcp": "A2A vs MCP horizontal vertical",
            "implementation": "FastAPI uvicorn a2a-sdk"
        }
        
        search_query = topic_queries.get(topic.lower(), topic)
        results = self.search(search_query)
        
        if results:
            # Formatar resposta baseada nos resultados de forma mais limpa
            response = f"📖 **{topic.replace('_', ' ').title()}**\n\n"
            
            # Processar e limpar os excerpts
            for result in results[:3]:
                if result['excerpt']:
                    # Limpar caracteres especiais e formatar melhor
                    excerpt = result['excerpt']
                    # Remover múltiplas quebras de linha
                    excerpt = '\n'.join(line for line in excerpt.split('\n') if line.strip())
                    # Limitar tamanho
                    if len(excerpt) > 300:
                        excerpt = excerpt[:300] + "..."
                    response += f"{excerpt}\n\n"
            
            return {
                "topic": topic,
                "response": response,
                "results_count": len(results),
                "source": "local_docs"
            }
        
        return {
            "topic": topic,
            "response": f"Sem informações sobre {topic}",
            "results_count": 0,
            "source": "local_docs"
        }


class MarvinWithRAG:
    """
    Marvin com integração RAG simplificada
    """
    
    def __init__(self):
        self.rag = SimpleRAG()
        self.cache = {}
    
    async def process_query(self, query: str) -> Dict[str, Any]:
        """
        Processa uma query usando o RAG
        """
        # Verificar cache
        if query in self.cache:
            return self.cache[query]
        
        # Identificar tipo de consulta
        query_lower = query.lower()
        
        # Palavras-chave A2A
        a2a_keywords = ["a2a", "agent card", "protocol", "skill", "task", "streaming", 
                       "discovery", "mcp", "json-rpc", "well-known"]
        
        if any(keyword in query_lower for keyword in a2a_keywords):
            # Buscar informação específica
            if "agent card" in query_lower:
                result = self.rag.get_a2a_info("agent_cards")
            elif "skill" in query_lower:
                result = self.rag.get_a2a_info("skills")
            elif "task" in query_lower:
                result = self.rag.get_a2a_info("tasks")
            elif "streaming" in query_lower or "sse" in query_lower:
                result = self.rag.get_a2a_info("streaming")
            elif "discovery" in query_lower or "well-known" in query_lower:
                result = self.rag.get_a2a_info("discovery")
            elif "mcp" in query_lower:
                result = self.rag.get_a2a_info("vs_mcp")
            elif "implement" in query_lower or "fastapi" in query_lower:
                result = self.rag.get_a2a_info("implementation")
            else:
                # Busca genérica
                search_results = self.rag.search(query)
                if search_results:
                    response = "Baseado na documentação A2A:\n\n"
                    for res in search_results[:3]:
                        response += f"• {res['excerpt'][:200]}...\n\n"
                    
                    result = {
                        "response": response,
                        "source": "rag_search",
                        "results_count": len(search_results)
                    }
                else:
                    result = {
                        "response": "Não encontrei informações específicas sobre isso.",
                        "source": "not_found"
                    }
        else:
            # Query não relacionada a A2A
            result = {
                "response": "Essa consulta não parece ser sobre A2A Protocol.",
                "source": "out_of_scope"
            }
        
        # Adicionar ao cache
        self.cache[query] = result
        
        return result