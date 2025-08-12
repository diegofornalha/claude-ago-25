#!/usr/bin/env python3
"""
Marvin Agent Executor - Executor para o protocolo A2A
"""

import logging
import asyncio
from typing import AsyncIterable

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events.event_queue import EventQueue
from a2a.types import (
    TaskArtifactUpdateEvent,
    TaskState,
    TaskStatus,
    TaskStatusUpdateEvent,
)
from a2a.utils import (
    new_agent_text_message,
    new_data_artifact,
    new_task,
    new_text_artifact,
)

from agent import MarvinAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MarvinAgentExecutor(AgentExecutor):
    """
    Executor do Marvin Agent para o protocolo A2A
    """

    def __init__(self):
        self.agent = MarvinAgent()
        logger.info("MarvinAgentExecutor inicializado")

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        """
        Executa uma requisição do usuário
        """
        query = context.get_user_input()
        task = context.current_task
        
        if not task:
            task = new_task(context.message)
            await event_queue.enqueue_event(task)
        
        try:
            # Processar requisição com o Marvin Agent
            request = {
                "type": "assist",
                "data": {"query": query}
            }
            
            # Determinar tipo de requisição baseado na query
            query_lower = query.lower()
            if any(word in query_lower for word in ["analise", "analyze"]):
                request["type"] = "analyze"
                request["data"] = query
            elif any(word in query_lower for word in ["execute", "executa"]):
                request["type"] = "execute"
                request["data"] = {"task": query}
            elif any(word in query_lower for word in ["lembre", "aprenda"]):
                request["type"] = "learn"
                parts = query.split(":", 1)
                if len(parts) == 2:
                    request["data"] = {"key": parts[0].strip(), "value": parts[1].strip()}
            elif any(word in query_lower for word in ["recupere", "recall"]):
                request["type"] = "recall"
                words = query.split()
                if len(words) > 1:
                    request["data"] = {"key": words[-1]}
            
            # Status: trabalhando
            await event_queue.enqueue_event(
                TaskStatusUpdateEvent(
                    status=TaskStatus(
                        state=TaskState.working,
                        message=new_agent_text_message(
                            "🤖 Marvin processando...",
                            task.context_id,
                            task.id,
                        ),
                    ),
                    final=False,
                    contextId=task.context_id,
                    taskId=task.id,
                )
            )
            
            # Processar com o agente
            result = await self.agent.process_request(request)
            
            # Preparar resposta
            if isinstance(result, dict):
                if "error" in result:
                    text_content = f"❌ Erro: {result['error']}"
                elif "response" in result:
                    # Extrair apenas a resposta formatada
                    text_content = result.get("response", "")
                    
                    # Adicionar sugestões se houver
                    if result.get("suggestions"):
                        text_content += "\n\n💡 **Sugestões:**"
                        for sugg in result["suggestions"]:
                            text_content += f"\n• {sugg}"
                    
                    # Adicionar fonte se for do RAG
                    if result.get("source") == "rag" or result.get("source") == "local_docs":
                        text_content += "\n\n📚 _Fonte: Base de conhecimento A2A_"
                else:
                    # Fallback para JSON se não houver campo response
                    import json
                    text_content = json.dumps(result, indent=2, ensure_ascii=False)
                    
                # Criar artifact com texto formatado
                artifact = new_text_artifact(
                    name="marvin_result",
                    description="Resposta do Marvin Agent",
                    text=text_content,
                )
            else:
                text_content = str(result)
                artifact = new_text_artifact(
                    name="marvin_result",
                    description="Resultado do Marvin Agent",
                    text=text_content,
                )
            
            # Enviar resultado
            await event_queue.enqueue_event(
                TaskArtifactUpdateEvent(
                    append=False,
                    contextId=task.context_id,
                    taskId=task.id,
                    lastChunk=True,
                    artifact=artifact,
                )
            )
            
            # Status: completo
            await event_queue.enqueue_event(
                TaskStatusUpdateEvent(
                    status=TaskStatus(state=TaskState.completed),
                    final=True,
                    contextId=task.context_id,
                    taskId=task.id,
                )
            )
            
        except Exception as e:
            logger.error(f"Erro ao executar: {e}")
            
            # Status: erro
            await event_queue.enqueue_event(
                TaskStatusUpdateEvent(
                    status=TaskStatus(
                        state=TaskState.failed,
                        message=new_agent_text_message(
                            f"❌ Erro: {str(e)}",
                            task.context_id,
                            task.id,
                        ),
                    ),
                    final=True,
                    contextId=task.context_id,
                    taskId=task.id,
                )
            )

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        raise Exception("cancel not supported")