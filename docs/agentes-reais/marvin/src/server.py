#!/usr/bin/env python3
"""
Servidor A2A para o Marvin Agent
Porta: 9998
"""

import asyncio
import uvicorn
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Adicionar o diretório pai ao path se necessário
sys.path.append(str(Path(__file__).parent.parent.parent))

from agent import MarvinAgent
from agent_executor import MarvinAgentExecutor
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill


def get_agent_card(host: str, port: int) -> AgentCard:
    """Retorna o Agent Card para o Marvin Agent - Padrão A2A Oficial"""
    
    capabilities = AgentCapabilities(
        streaming=True,
        pushNotifications=False,
        max_concurrent_tasks=10,
        supported_content_types=["text/plain", "application/json"]
    )
    
    skills = [
        AgentSkill(
            id="analyze",
            name="Análise de Dados",
            description="Analisa dados e fornece insights detalhados",
            tags=["analysis", "data", "insights", "intelligence"],
            parameters={
                "data": "string|object",
                "type": "string"
            },
            examples=[
                "analise estes dados",
                "o que você acha disso",
                "me ajude a entender",
                "interprete estes resultados"
            ]
        ),
        AgentSkill(
            id="execute",
            name="Execução de Tarefas",
            description="Executa tarefas e comandos específicos de forma inteligente",
            tags=["execution", "tasks", "commands", "automation"],
            parameters={
                "task": "string",
                "context": "object"
            },
            examples=[
                "execute este comando",
                "faça isso para mim",
                "automatize esta tarefa",
                "processe esta requisição"
            ]
        ),
        AgentSkill(
            id="assist",
            name="Assistência Geral",
            description="Fornece assistência e suporte geral com inteligência contextual",
            tags=["assistance", "support", "help", "guidance"],
            parameters={
                "query": "string",
                "options": "object"
            },
            examples=[
                "me ajude com",
                "preciso de ajuda",
                "como faço para",
                "você está ativo?"
            ]
        )
    ]
    
    return AgentCard(
        name="marvin-agent",
        description="Agente auxiliar inteligente com capacidades de análise e execução de tarefas",
        url=f"http://{host}:{port}",
        version="1.0.0",
        defaultInputModes=["text", "text/plain", "application/json"],
        defaultOutputModes=["text", "text/plain", "application/json"],
        capabilities=capabilities,
        skills=skills
    )


def main():
    """Iniciar o servidor Marvin Agent no padrão A2A"""
    
    # Configurações
    host = os.getenv("HOST", "localhost")
    port = int(os.getenv("PORT", 9998))
    
    print(f"🚀 Iniciando Marvin Agent (A2A) em {host}:{port}...")
    print(f"📦 Usando padrão A2A com SDK oficial")
    print(f"🧠 Inteligência avançada ativada")
    
    # Criar o executor do agente
    agent_executor = MarvinAgentExecutor()
    
    # Criar o handler de requisições A2A
    request_handler = DefaultRequestHandler(
        agent_executor=agent_executor,
        task_store=InMemoryTaskStore(),
    )
    
    # Criar o servidor A2A
    server = A2AStarletteApplication(
        agent_card=get_agent_card(host, port),
        http_handler=request_handler
    )
    
    print("✅ Servidor configurado com padrão A2A")
    print("🔄 Suporte a streaming habilitado")
    print("⚡ Execução assíncrona ativada")
    
    # Iniciar o servidor
    uvicorn.run(
        server.build(),
        host=host,
        port=port,
        log_level="info"
    )


if __name__ == "__main__":
    main()