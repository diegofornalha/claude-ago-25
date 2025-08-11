#!/usr/bin/env python3
"""
HelloWorld Agent Server - Com TaskStatusUpdateEvent implementado
"""

import uvicorn
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentSkill,
)
from agent_executor import HelloWorldAgentExecutor

# HelloWorld Skills Definition
skill_hello = AgentSkill(
    id="hello_world",
    name="Hello World",
    description="Returns a simple hello world greeting",
    tags=["hello", "world", "greeting", "basic"],
    examples=[
        "hello",
        "hi",
        "hello world",
        "say hello"
    ],
)

skill_super = AgentSkill(
    id="super_hello_world",
    name="Super Hello World",
    description="Returns an enthusiastic hello world greeting with extra data",
    tags=["hello", "world", "super", "advanced"],
    examples=[
        "super hello",
        "super hi",
        "give me a super hello",
        "super hello world"
    ],
)

# HelloWorld Agent Card
public_agent_card = AgentCard(
    name="Hello World Agent",
    description="Just a hello world agent",
    url="http://localhost:9999/",
    version="1.0.0",
    defaultInputModes=["text"],
    defaultOutputModes=["text"],
    capabilities=AgentCapabilities(streaming=True),
    skills=[skill_hello, skill_super],
)

request_handler = DefaultRequestHandler(
    agent_executor=HelloWorldAgentExecutor(),
    task_store=InMemoryTaskStore(),
)

server = A2AStarletteApplication(
    agent_card=public_agent_card,
    http_handler=request_handler,
)

app = server.build()

if __name__ == "__main__":
    print("🤖 Iniciando HelloWorld Agent na porta 9999...")
    print("✅ Com suporte completo a TaskStatusUpdateEvent")
    print("🌐 URL: http://localhost:9999/")
    uvicorn.run(app, host="localhost", port=9999)