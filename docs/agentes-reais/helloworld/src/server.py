#!/usr/bin/env python3
"""
Servidor A2A para o HelloWorld Agent
Porta: 9999
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

from agent import HelloWorldAgent
from agent_executor import HelloWorldAgentExecutor
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill


def get_agent_card(host: str, port: int) -> AgentCard:
    """Retorna o Agent Card para o HelloWorld Agent - Padrão A2A Oficial"""
    
    capabilities = AgentCapabilities(
        streaming=False,
        pushNotifications=False,
        max_concurrent_tasks=5,
        supported_content_types=["text/plain", "application/json"]
    )
    
    skills = [
        AgentSkill(
            id="hello_world",
            name="Hello World",
            description="Returns a simple hello world greeting",
            tags=["greeting", "basic", "hello"],
            parameters={
                "name": "string",
                "language": "string"
            }
        ),
        AgentSkill(
            id="super_hello_world",
            name="Super Hello World",
            description="Returns an enthusiastic hello world greeting with extra data",
            tags=["greeting", "advanced", "hello", "enthusiasm"],
            parameters={
                "name": "string",
                "language": "string",
                "excitement_level": "number"
            }
        )
    ]
    
    return AgentCard(
        name="helloworld-agent",
        description="Agente simples que cumprimenta pessoas em múltiplos idiomas",
        url=f"http://{host}:{port}",
        version="1.0.0",
        defaultInputModes=["text", "text/plain", "application/json"],
        defaultOutputModes=["text", "text/plain", "application/json"],
        capabilities=capabilities,
        skills=skills
    )


def main():
    """Iniciar o servidor HelloWorld Agent no padrão A2A"""
    
    # Configurações
    host = os.getenv("HOST", "localhost")
    port = int(os.getenv("PORT", 9999))
    
    print(f"🚀 Iniciando HelloWorld Agent (A2A) em {host}:{port}...")
    print(f"📦 Usando padrão A2A com SDK oficial")
    
    # Criar o executor do agente
    agent_executor = HelloWorldAgentExecutor()
    
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
    
    # Iniciar o servidor
    uvicorn.run(
        server.build(),
        host=host,
        port=port,
        log_level="info"
    )


if __name__ == "__main__":
    main()