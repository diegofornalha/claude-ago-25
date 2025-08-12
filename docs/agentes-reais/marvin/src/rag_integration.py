#!/usr/bin/env python3
"""
Integração do Marvin Agent com MCP RAG Server
Permite ao Marvin acessar a base de conhecimento sobre A2A Protocol
"""

import os
import sys
import json
import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RAGIntegration:
    """
    Integra o Marvin Agent com o MCP RAG Server
    """
    
    def __init__(self):
        self.rag_server_path = Path("/Users/agents/.claude/mcp-rag-server")
        self.rag_venv_python = self.rag_server_path / "venv" / "bin" / "python"
        self.rag_server_script = self.rag_server_path / "rag_server.py"
        self.rag_process = None
        self.is_rag_running = False
        
        # Adicionar o path do RAG server ao PYTHONPATH
        if str(self.rag_server_path) not in sys.path:
            sys.path.insert(0, str(self.rag_server_path))
    
    def check_rag_server(self) -> bool:
        """
        Verifica se o RAG server está rodando
        """
        try:
            # Verificar se o processo está rodando
            result = subprocess.run(
                ["pgrep", "-f", "rag_server.py"],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Erro ao verificar RAG server: {e}")
            return False
    
    def start_rag_server(self) -> bool:
        """
        Inicia o RAG server se não estiver rodando
        """
        if self.check_rag_server():
            logger.info("RAG server já está rodando")
            self.is_rag_running = True
            return True
        
        try:
            logger.info("Iniciando RAG server...")
            
            # Configurar ambiente
            env = os.environ.copy()
            env['RAG_MODEL'] = "all-MiniLM-L6-v2"
            env['RAG_CACHE_DIR'] = str(Path.home() / ".claude" / "mcp-rag-cache")
            env['RAG_LOG_LEVEL'] = "INFO"
            env['PYTHONPATH'] = str(self.rag_server_path)
            
            # Iniciar processo
            self.rag_process = subprocess.Popen(
                [str(self.rag_venv_python), str(self.rag_server_script)],
                cwd=str(self.rag_server_path),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Aguardar inicialização
            import time
            time.sleep(3)
            
            if self.check_rag_server():
                logger.info("✅ RAG server iniciado com sucesso")
                self.is_rag_running = True
                return True
            else:
                logger.error("❌ Falha ao iniciar RAG server")
                return False
                
        except Exception as e:
            logger.error(f"Erro ao iniciar RAG server: {e}")
            return False
    
    async def query_rag(self, query: str, category: Optional[str] = None) -> Dict[str, Any]:
        """
        Consulta o RAG server para obter informações
        """
        try:
            # Importar módulos do RAG server
            import sys
            sys.path.insert(0, str(self.rag_server_path))
            
            from a2a_content_manager import A2AContentManager
            
            # Criar instância do content manager
            manager = A2AContentManager()
            
            # Fazer a busca
            if category:
                results = manager.search_by_category(query, category)
            else:
                results = manager.search(query)
            
            return {
                "success": True,
                "results": results,
                "timestamp": datetime.now().isoformat()
            }
            
        except ImportError as e:
            logger.error(f"Erro ao importar RAG modules: {e}")
            return {
                "success": False,
                "error": "RAG modules not available",
                "message": str(e)
            }
        except Exception as e:
            logger.error(f"Erro ao consultar RAG: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_a2a_info(self, topic: str) -> Dict[str, Any]:
        """
        Obtém informações específicas sobre A2A Protocol
        """
        logger.info(f"Buscando informações sobre A2A: {topic}")
        
        # Tópicos conhecidos de A2A
        a2a_topics = {
            "agent_cards": "Agent Cards estrutura metadados JSON",
            "protocol": "A2A Protocol comunicação agentes",
            "skills": "Skills habilidades agentes A2A",
            "tasks": "Tasks tarefas estados A2A",
            "streaming": "Streaming SSE Server-Sent Events A2A",
            "discovery": "Discovery descoberta agentes well-known",
            "conformance": "Conformidade padrões A2A checklist",
            "implementation": "Implementação servidor A2A SDK",
            "examples": "Exemplos código A2A Python FastAPI",
            "vs_mcp": "A2A vs MCP diferença horizontal vertical"
        }
        
        # Buscar query apropriada
        search_query = a2a_topics.get(topic.lower(), topic)
        
        # Consultar RAG
        result = await self.query_rag(search_query, category="a2a_protocol")
        
        if result["success"] and result.get("results"):
            # Formatar resposta
            formatted_results = []
            for item in result["results"][:5]:  # Top 5 resultados
                formatted_results.append({
                    "title": item.get("title", ""),
                    "content": item.get("content", ""),
                    "relevance": item.get("score", 0)
                })
            
            return {
                "topic": topic,
                "results": formatted_results,
                "total_found": len(result["results"]),
                "timestamp": datetime.now().isoformat()
            }
        else:
            return {
                "topic": topic,
                "results": [],
                "error": result.get("error", "No results found"),
                "timestamp": datetime.now().isoformat()
            }
    
    async def enhance_response_with_rag(self, query: str, base_response: str) -> str:
        """
        Enriquece uma resposta com informações do RAG
        """
        # Buscar informações relevantes
        rag_result = await self.query_rag(query)
        
        if rag_result["success"] and rag_result.get("results"):
            # Adicionar contexto do RAG à resposta
            enhanced = f"{base_response}\n\n📚 **Informações Adicionais do RAG:**\n"
            
            for item in rag_result["results"][:3]:
                enhanced += f"\n• {item.get('title', 'Info')}: {item.get('summary', '')[:200]}..."
            
            return enhanced
        else:
            return base_response
    
    def stop_rag_server(self):
        """
        Para o RAG server se foi iniciado por esta integração
        """
        if self.rag_process:
            logger.info("Parando RAG server...")
            self.rag_process.terminate()
            self.rag_process = None
            self.is_rag_running = False


class MarvinRAGAgent:
    """
    Versão do Marvin Agent com integração RAG
    """
    
    def __init__(self):
        self.rag = RAGIntegration()
        self.knowledge_cache = {}
        
    async def process_with_rag(self, query: str) -> Dict[str, Any]:
        """
        Processa uma query usando conhecimento do RAG
        """
        logger.info(f"Processando com RAG: {query}")
        
        # Verificar cache
        cache_key = query.lower().strip()
        if cache_key in self.knowledge_cache:
            logger.info("Usando cache de conhecimento")
            return self.knowledge_cache[cache_key]
        
        # Identificar tipo de consulta
        query_lower = query.lower()
        
        # Consultas sobre A2A
        if any(term in query_lower for term in ["a2a", "agent card", "protocol", "skill"]):
            # Buscar no RAG
            if "agent card" in query_lower:
                result = await self.rag.get_a2a_info("agent_cards")
            elif "skill" in query_lower:
                result = await self.rag.get_a2a_info("skills")
            elif "task" in query_lower:
                result = await self.rag.get_a2a_info("tasks")
            elif "vs mcp" in query_lower or "diferença" in query_lower:
                result = await self.rag.get_a2a_info("vs_mcp")
            else:
                result = await self.rag.get_a2a_info("protocol")
            
            # Formatar resposta
            if result.get("results"):
                response = self.format_rag_response(result)
            else:
                response = {
                    "response": "Não encontrei informações específicas sobre isso no RAG.",
                    "source": "default"
                }
        else:
            # Query genérica
            rag_result = await self.rag.query_rag(query)
            if rag_result["success"] and rag_result.get("results"):
                response = {
                    "response": self.format_generic_response(rag_result),
                    "source": "rag",
                    "results_count": len(rag_result["results"])
                }
            else:
                response = {
                    "response": "Processando sua solicitação...",
                    "source": "default"
                }
        
        # Adicionar ao cache
        self.knowledge_cache[cache_key] = response
        
        return response
    
    def format_rag_response(self, result: Dict) -> Dict[str, Any]:
        """
        Formata resposta do RAG sobre A2A
        """
        if not result.get("results"):
            return {"response": "Sem resultados", "source": "rag"}
        
        # Construir resposta
        response_text = f"**{result['topic'].upper()}**\n\n"
        
        for item in result["results"]:
            if item.get("content"):
                response_text += f"{item['content'][:500]}\n\n"
        
        return {
            "response": response_text,
            "source": "rag",
            "topic": result["topic"],
            "results_count": result["total_found"]
        }
    
    def format_generic_response(self, rag_result: Dict) -> str:
        """
        Formata resposta genérica do RAG
        """
        if not rag_result.get("results"):
            return "Sem informações disponíveis."
        
        response = "Baseado na base de conhecimento:\n\n"
        for item in rag_result["results"][:3]:
            if item.get("content"):
                response += f"• {item['content'][:200]}...\n"
        
        return response


# Exemplo de uso
if __name__ == "__main__":
    async def test_integration():
        # Criar agente com RAG
        agent = MarvinRAGAgent()
        
        # Testar consultas
        queries = [
            "O que são Agent Cards no A2A?",
            "Como implementar um agente A2A?",
            "Qual a diferença entre A2A e MCP?",
            "Como funciona o discovery de agentes?"
        ]
        
        for query in queries:
            print(f"\n📝 Query: {query}")
            result = await agent.process_with_rag(query)
            print(f"📚 Resposta: {result['response'][:500]}...")
            print(f"🔍 Fonte: {result.get('source', 'unknown')}")
    
    # Executar teste
    asyncio.run(test_integration())