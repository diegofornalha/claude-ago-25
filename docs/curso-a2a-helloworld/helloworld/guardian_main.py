import uvicorn
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import (
    AgentCapabilities,
    AgentCard,
    AgentSkill,
)
from agent_executor import GuardianAgentExecutor

# Guardian Skill Definition
skill = AgentSkill(
    id="sustainability_monitor",
    name="Sustainability Monitor",
    description="Monitors system sustainability, carbon budget, entropy control, and Jevons paradox prevention. Provides real-time health checks and sustainability reports.",
    tags=["sustainability", "carbon", "entropy", "monitoring", "guardian", "a2a"],
    examples=[
        "status do guardian",
        "health check", 
        "verificar sustentabilidade",
        "relatório de carbon budget",
        "nível de entropia do sistema",
        "análise jevons paradox",
        "listar agentes monitorados"
    ],
)

# Guardian Agent Card
public_agent_card = AgentCard(
    name="Guardian Agent",
    description="Sistema avançado de monitoramento de sustentabilidade para A2A",
    url="http://localhost:10102/",
    version="1.0.0",
    defaultInputModes=["text"],
    defaultOutputModes=["text"],
    capabilities=AgentCapabilities(streaming=True),
    skills=[skill],
)

request_handler = DefaultRequestHandler(
    agent_executor=GuardianAgentExecutor(),
    task_store=InMemoryTaskStore(),
)

server = A2AStarletteApplication(
    agent_card=public_agent_card,
    http_handler=request_handler,
)

app = server.build()

if __name__ == "__main__":
    print("🛡️ Iniciando Guardian Agent na porta 10102...")
    print("🌐 URL: http://localhost:10102/")
    print("📊 Monitoramento: Sustentabilidade A2A")
    uvicorn.run(app, host="localhost", port=10102)