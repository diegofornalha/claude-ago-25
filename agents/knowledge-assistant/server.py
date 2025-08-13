#!/usr/bin/env python3
"""
Knowledge Assistant A2A Agent Server
Servidor de agente A2A com integração ao RAG Server via MCP
"""

import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
from pathlib import Path

# Importar cliente MCP
from mcp_client import MCPRAGClient, MCPConfig, get_mcp_client

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Estados de Tarefa
class TaskState(Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class Message:
    """Mensagem trocada entre agentes"""
    id: str
    timestamp: str
    role: str  # user, assistant, system
    content: str
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class Task:
    """Tarefa A2A"""
    id: str
    skill: str
    state: TaskState
    parameters: Dict[str, Any]
    created_at: str
    updated_at: str
    messages: List[Message]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class KnowledgeAssistantAgent:
    """Agente Assistente de Conhecimento A2A com integração MCP/RAG"""
    
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.agent_card = self._load_agent_card()
        self.mcp_client: Optional[MCPRAGClient] = None
        
    def _load_agent_card(self) -> Dict[str, Any]:
        """Carrega o Agent Card do arquivo JSON"""
        card_path = Path(__file__).parent / "agent_card.json"
        with open(card_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    async def _get_mcp_client(self) -> MCPRAGClient:
        """Obtém cliente MCP, criando se necessário"""
        if not self.mcp_client:
            self.mcp_client = await get_mcp_client()
        return self.mcp_client
    
    async def create_task(self, skill: str, parameters: Dict[str, Any]) -> Task:
        """Cria uma nova tarefa"""
        task_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        task = Task(
            id=task_id,
            skill=skill,
            state=TaskState.CREATED,
            parameters=parameters,
            created_at=now,
            updated_at=now,
            messages=[]
        )
        
        self.tasks[task_id] = task
        logger.info(f"Tarefa criada: {task_id} - Skill: {skill}")
        
        # Iniciar processamento assíncrono
        asyncio.create_task(self._process_task(task))
        
        return task
    
    async def _process_task(self, task: Task):
        """Processa uma tarefa de forma assíncrona"""
        try:
            task.state = TaskState.RUNNING
            task.updated_at = datetime.utcnow().isoformat()
            
            # Mapear skill para método correspondente
            skill_handlers = {
                "search_knowledge": self._handle_search_mcp,
                "add_knowledge": self._handle_add_knowledge_mcp,
                "analyze_topic": self._handle_analyze_mcp,
                "get_statistics": self._handle_statistics_mcp,
                "search_by_tags": self._handle_search_by_tags,
                "search_by_category": self._handle_search_by_category,
                "list_documents": self._handle_list_documents
            }
            
            handler = skill_handlers.get(task.skill)
            if not handler:
                raise ValueError(f"Skill não suportada: {task.skill}")
            
            # Executar handler
            result = await handler(task.parameters)
            
            # Atualizar tarefa com resultado
            task.result = result
            task.state = TaskState.COMPLETED
            task.updated_at = datetime.utcnow().isoformat()
            
            # Adicionar mensagem de conclusão
            message = Message(
                id=str(uuid.uuid4()),
                timestamp=datetime.utcnow().isoformat(),
                role="assistant",
                content=f"Tarefa concluída com sucesso",
                metadata={"result_summary": self._summarize_result(result)}
            )
            task.messages.append(message)
            
            logger.info(f"Tarefa {task.id} concluída com sucesso")
            
        except Exception as e:
            task.state = TaskState.FAILED
            task.error = str(e)
            task.updated_at = datetime.utcnow().isoformat()
            logger.error(f"Erro ao processar tarefa {task.id}: {e}")
    
    async def _handle_search_mcp(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para busca de conhecimento via MCP/RAG"""
        query = params.get("query", "")
        use_semantic = params.get("use_semantic", True)
        limit = params.get("limit", 5)
        
        logger.info(f"Buscando no RAG: '{query}' (semantic={use_semantic}, limit={limit})")
        
        try:
            # Usar cliente MCP para buscar no RAG Server
            client = await self._get_mcp_client()
            result = await client.search(query, use_semantic, limit)
            
            logger.info(f"Busca retornou {len(result.get('results', []))} resultados")
            return result
            
        except Exception as e:
            logger.error(f"Erro na busca MCP: {e}")
            # Retornar resultado de erro estruturado
            return {
                "query": query,
                "results": [],
                "total": 0,
                "search_type": "semantic" if use_semantic else "text",
                "error": str(e),
                "message": "Erro ao conectar com RAG Server. Verifique se o servidor MCP está rodando."
            }
    
    async def _handle_add_knowledge_mcp(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para adicionar conhecimento via MCP/RAG"""
        title = params.get("title", "")
        content = params.get("content", "")
        tags = params.get("tags", [])
        category = params.get("category", "general")
        source = params.get("source", "a2a-agent")
        
        logger.info(f"Adicionando documento ao RAG: '{title}'")
        
        try:
            # Usar cliente MCP para adicionar ao RAG Server
            client = await self._get_mcp_client()
            result = await client.add_document(
                title=title,
                content=content,
                tags=tags,
                category=category,
                source=source
            )
            
            logger.info(f"Documento adicionado: {result.get('document_id')}")
            return result
            
        except Exception as e:
            logger.error(f"Erro ao adicionar documento via MCP: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Erro ao adicionar documento. Verifique conexão com RAG Server."
            }
    
    async def _handle_analyze_mcp(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para análise de tópico usando RAG + Claude"""
        topic = params.get("topic", "")
        depth = params.get("depth", "intermediate")
        
        logger.info(f"Analisando tópico: '{topic}' (depth={depth})")
        
        try:
            # Primeiro, buscar informações relevantes no RAG
            client = await self._get_mcp_client()
            
            # Fazer múltiplas buscas para coletar contexto
            search_queries = [
                topic,  # Busca direta
                f"{topic} definição conceitos",  # Conceitos básicos
                f"{topic} implementação prática",  # Aspectos práticos
                f"{topic} benefícios vantagens",  # Benefícios
                f"{topic} desafios problemas"  # Desafios
            ]
            
            all_results = []
            sources_consulted = 0
            
            for query in search_queries[:3 if depth == "basic" else 5]:
                result = await client.search(query, use_semantic=True, limit=3)
                all_results.extend(result.get("results", []))
                sources_consulted += len(result.get("results", []))
            
            # Compilar informações encontradas
            key_points = []
            seen_content = set()
            
            for result in all_results[:10]:  # Limitar a 10 resultados mais relevantes
                content_preview = result.get("content", "")[:200]
                if content_preview and content_preview not in seen_content:
                    key_points.append(f"• {result.get('title', 'Info')}: {content_preview}...")
                    seen_content.add(content_preview)
            
            # Calcular confiança baseada na quantidade e qualidade dos resultados
            avg_score = sum(r.get("score", 0) for r in all_results[:5]) / min(5, len(all_results)) if all_results else 0
            confidence = min(0.95, avg_score * 1.2)  # Normalizar confiança
            
            analysis = {
                "topic": topic,
                "depth": depth,
                "analysis": {
                    "summary": f"Análise {depth} do tópico '{topic}' baseada em {sources_consulted} fontes do conhecimento",
                    "key_points": key_points[:5] if key_points else [
                        "• Informações limitadas disponíveis sobre este tópico",
                        "• Considere adicionar mais documentos relacionados ao RAG"
                    ],
                    "sources_consulted": sources_consulted,
                    "confidence": round(confidence, 2),
                    "recommendations": [
                        "Para análise mais profunda, integre com Claude Code ou outro LLM",
                        "Adicione mais documentos sobre este tópico ao RAG para melhorar resultados"
                    ] if sources_consulted < 3 else []
                }
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Erro na análise via MCP: {e}")
            return {
                "topic": topic,
                "depth": depth,
                "error": str(e),
                "analysis": {
                    "summary": "Erro ao analisar tópico",
                    "key_points": [],
                    "sources_consulted": 0,
                    "confidence": 0
                }
            }
    
    async def _handle_statistics_mcp(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para estatísticas via MCP/RAG"""
        logger.info("Obtendo estatísticas do RAG Server")
        
        try:
            # Usar cliente MCP para obter estatísticas reais
            client = await self._get_mcp_client()
            stats = await client.get_statistics()
            
            logger.info(f"Estatísticas obtidas: {stats.get('total_documents', 0)} documentos")
            
            # Adicionar timestamp atual
            stats["last_update"] = datetime.utcnow().isoformat()
            
            return stats
            
        except Exception as e:
            logger.error(f"Erro ao obter estatísticas via MCP: {e}")
            return {
                "total_documents": 0,
                "total_categories": 0,
                "total_tags": 0,
                "error": str(e),
                "message": "RAG Server não disponível. Estatísticas não puderam ser obtidas.",
                "last_update": datetime.utcnow().isoformat()
            }
    
    async def _handle_search_by_tags(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para busca por tags"""
        tags = params.get("tags", [])
        limit = params.get("limit", 10)
        
        logger.info(f"Buscando por tags: {tags}")
        
        try:
            client = await self._get_mcp_client()
            result = await client.search_by_tags(tags, limit)
            return result
        except Exception as e:
            logger.error(f"Erro na busca por tags: {e}")
            return {"error": str(e), "results": [], "total": 0}
    
    async def _handle_search_by_category(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para busca por categoria"""
        category = params.get("category", "")
        limit = params.get("limit", 10)
        
        logger.info(f"Buscando por categoria: {category}")
        
        try:
            client = await self._get_mcp_client()
            result = await client.search_by_category(category, limit)
            return result
        except Exception as e:
            logger.error(f"Erro na busca por categoria: {e}")
            return {"error": str(e), "results": [], "total": 0}
    
    async def _handle_list_documents(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handler para listar documentos"""
        category = params.get("category")
        source = params.get("source")
        tags = params.get("tags")
        
        logger.info(f"Listando documentos (category={category}, source={source})")
        
        try:
            client = await self._get_mcp_client()
            result = await client.list_documents(category, source, tags)
            return result
        except Exception as e:
            logger.error(f"Erro ao listar documentos: {e}")
            return {"error": str(e), "documents": [], "total": 0}
    
    def _summarize_result(self, result: Dict[str, Any]) -> str:
        """Cria um resumo do resultado"""
        if "results" in result:
            count = len(result.get('results', []))
            return f"Encontrados {count} resultados"
        elif "analysis" in result:
            confidence = result.get('analysis', {}).get('confidence', 0)
            sources = result.get('analysis', {}).get('sources_consulted', 0)
            return f"Análise concluída com {sources} fontes e confiança de {confidence}"
        elif "success" in result:
            if result.get("success"):
                return "Operação concluída com sucesso"
            else:
                return f"Operação falhou: {result.get('message', 'Erro desconhecido')}"
        elif "total_documents" in result:
            total = result.get('total_documents', 0)
            return f"Estatísticas obtidas: {total} documentos no total"
        else:
            return "Tarefa processada"
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Obtém uma tarefa pelo ID"""
        return self.tasks.get(task_id)
    
    async def send_message(self, task_id: str, content: str, role: str = "user") -> Optional[Message]:
        """Envia mensagem para uma tarefa"""
        task = self.tasks.get(task_id)
        if not task:
            return None
        
        message = Message(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow().isoformat(),
            role=role,
            content=content
        )
        
        task.messages.append(message)
        task.updated_at = datetime.utcnow().isoformat()
        
        return message
    
    async def cancel_task(self, task_id: str) -> bool:
        """Cancela uma tarefa"""
        task = self.tasks.get(task_id)
        if not task or task.state in [TaskState.COMPLETED, TaskState.FAILED]:
            return False
        
        task.state = TaskState.CANCELLED
        task.updated_at = datetime.utcnow().isoformat()
        logger.info(f"Tarefa {task_id} cancelada")
        
        return True
    
    def get_agent_card(self) -> Dict[str, Any]:
        """Retorna o Agent Card"""
        return self.agent_card

# Inicialização global do agente
agent = KnowledgeAssistantAgent()

if __name__ == "__main__":
    # Teste básico do agente com integração MCP
    async def test():
        print("=== Teste de Integração A2A + MCP/RAG ===\n")
        
        # Testar busca via MCP
        print("1. Testando busca no RAG Server...")
        task = await agent.create_task(
            skill="search_knowledge",
            parameters={"query": "A2A protocol", "use_semantic": True, "limit": 3}
        )
        
        print(f"   Tarefa criada: {task.id}")
        await asyncio.sleep(2)
        
        updated_task = await agent.get_task(task.id)
        if updated_task:
            print(f"   Estado: {updated_task.state.value}")
            if updated_task.result:
                print(f"   Resultados: {len(updated_task.result.get('results', []))} documentos encontrados")
                for r in updated_task.result.get('results', [])[:2]:
                    print(f"     - {r.get('title', 'Sem título')}: Score {r.get('score', 0):.2f}")
        
        # Testar estatísticas via MCP
        print("\n2. Testando estatísticas do RAG...")
        task = await agent.create_task(
            skill="get_statistics",
            parameters={}
        )
        
        await asyncio.sleep(1)
        updated_task = await agent.get_task(task.id)
        if updated_task and updated_task.result:
            stats = updated_task.result
            print(f"   Total de documentos: {stats.get('total_documents', 0)}")
            print(f"   Total de categorias: {stats.get('total_categories', 0)}")
            print(f"   Total de tags: {stats.get('total_tags', 0)}")
            print(f"   Modo do servidor: {stats.get('server_mode', 'unknown')}")
        
        print("\n=== Teste concluído ===")
    
    # Executar teste
    asyncio.run(test())