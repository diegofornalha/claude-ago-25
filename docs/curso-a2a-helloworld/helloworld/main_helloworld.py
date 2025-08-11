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

# HelloWorld Skill Definition
skill = AgentSkill(
    id="hello_world",
    name="Hello World",
    description="Simple Hello World agent for testing A2A protocol communication.",
    tags=["hello", "world", "test", "a2a"],
    examples=[
        "hello",
        "hi", 
        "hello world",
        "test"
    ],
)

# HelloWorld Agent Card
public_agent_card = AgentCard(
    name="Hello World Agent",
    description="Simple test agent for A2A protocol",
    url="http://localhost:9999/",
    version="1.0.0",
    defaultInputModes=["text"],
    defaultOutputModes=["text"],
    capabilities=AgentCapabilities(streaming=True),
    skills=[skill],
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
    print("👋 Iniciando Hello World Agent na porta 9999...")
    print("🌐 URL: http://localhost:9999/")
    print("📊 Testing: A2A Protocol")
    uvicorn.run(app, host="localhost", port=9999)