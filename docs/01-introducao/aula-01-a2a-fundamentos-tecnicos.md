# A2A Protocol: Quick Start

## Setup (30 segundos)
```bash
pip install a2a-sdk httpx fastapi uvicorn
```

## Agente Mínimo Funcional
```python
# agent.py
from fastapi import FastAPI
app = FastAPI()

@app.get("/.well-known/agent.json")
def agent_card():
    return {
        "name": "hello-agent",
        "skills": [{
            "name": "greet",
            "parameters": {"name": "string"}
        }]
    }

@app.post("/tasks")
async def create_task(req: dict):
    return {
        "jsonrpc": "2.0",
        "result": {
            "id": "task-123",
            "status": "completed",
            "result": f"Hello {req['params']['name']}!"
        }
    }

# Rodar: uvicorn agent:app --port 8000
```

## Cliente para Testar
```python
# client.py
import httpx, asyncio

async def test():
    async with httpx.AsyncClient() as client:
        # Descobrir agente
        agent = await client.get("http://localhost:8000/.well-known/agent.json")
        print(f"Skills: {agent.json()['skills']}")
        
        # Executar tarefa
        result = await client.post("http://localhost:8000/tasks", json={
            "jsonrpc": "2.0",
            "method": "greet",
            "params": {"name": "World"},
            "id": 1
        })
        print(result.json()['result']['result'])

asyncio.run(test())
```

## Componentes A2A

### Agent Card
```json
{
  "name": "agent-id",           // Identificador único
  "skills": [{                  // O que o agente faz
    "name": "skill-name",
    "parameters": {}
  }],
  "capabilities": {              // Recursos suportados
    "streaming": true,           // SSE
    "pushNotifications": true    // Webhooks
  }
}
```

### Task States
```
CREATED → RUNNING → COMPLETED
          ↓     ↓
        FAILED  CANCELLED
```

### Message Format
```json
{
  "messageId": "uuid",
  "role": "user|agent",
  "parts": [{"text": "..."}]
}
```

## A2A vs MCP (1 minuto)

```
A2A:  [Agent A] ←→ [Agent B] ←→ [Agent C]
      Colaboração horizontal entre IAs

MCP:  [Agent] → [Database/API/Tool]
      Acesso vertical a recursos
```

## Streaming (SSE)
```python
@app.get("/tasks/{id}/stream")
async def stream(id: str):
    async def generate():
        for i in range(5):
            yield f"data: Progress {i*20}%\n\n"
            await asyncio.sleep(1)
        yield f"data: Complete!\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
```

## Webhooks (Push)
```python
# Cliente registra webhook
webhook_config = {
    "url": "https://myapp.com/webhook",
    "events": ["completed", "failed"]
}

# Servidor notifica
async def notify_webhook(url, data):
    await httpx.post(url, json=data, headers={
        "Authorization": "Bearer token"
    })
```

## Segurança Básica

### JWT Auth
```python
@app.post("/tasks")
async def create_task(req: dict, auth: str = Header(None)):
    if not verify_jwt(auth):
        raise HTTPException(401)
    # processar...
```

### Rate Limiting
```python
from slowapi import Limiter
limiter = Limiter(key_func=lambda: "global")

@app.post("/tasks")
@limiter.limit("100/minute")
async def create_task(req: dict):
    # processar...
```

## Deploy Rápido

### Local
```bash
uvicorn agent:app --reload
```

### Docker
```dockerfile
FROM python:3.11
COPY . /app
RUN pip install -r requirements.txt
CMD ["uvicorn", "agent:app", "--host", "0.0.0.0"]
```

### Google Cloud Run
```bash
gcloud run deploy agent \
  --source . \
  --allow-unauthenticated
```

## Integração com Frameworks

### CrewAI
```python
from crewai import Agent
from a2a_sdk import A2AAdapter

agent = Agent(name="researcher")
a2a_agent = A2AAdapter(agent)
a2a_agent.serve(port=8000)
```

### LangChain
```python
from langchain.agents import create_openai_agent
from a2a_sdk import wrap_langchain

agent = create_openai_agent(...)
a2a_app = wrap_langchain(agent)
```

## Erros Comuns

| Erro | Solução |
|------|---------|
| `Skill not found` | Verificar Agent Card |
| `Task timeout` | Aumentar timeout ou usar streaming |
| `401 Unauthorized` | Verificar token/API key |
| `Connection refused` | Checar URL e porta |
| `CORS error` | Adicionar `CORSMiddleware` |

## Debug

### Logs
```python
import logging
logging.basicConfig(level=logging.DEBUG)

@app.post("/tasks")
async def create_task(req: dict):
    logger.debug(f"Request: {req}")
    # processar...
```

### Test Discovery
```bash
curl http://localhost:8000/.well-known/agent.json | jq
```

### Test Task
```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"greet","params":{"name":"Test"},"id":1}'
```

## Extensões Úteis

### Health Check
```python
@app.get("/health")
def health():
    return {"status": "ok"}
```

### Metrics
```python
@app.get("/metrics")
def metrics():
    return {
        "tasks_total": task_counter,
        "tasks_active": len(active_tasks),
        "uptime": time.time() - start_time
    }
```

## Produção Checklist

- [ ] HTTPS configurado
- [ ] Rate limiting ativo
- [ ] Autenticação implementada
- [ ] Logs estruturados
- [ ] Monitoring (Prometheus)
- [ ] Error handling
- [ ] Timeout configurado
- [ ] Load testing feito

## Links Diretos

- **Spec**: https://a2a-protocol.org/dev/specification/
- **SDK**: https://pypi.org/project/a2a-sdk/
- **Examples**: https://github.com/google/a2a-samples
- **Discord**: https://discord.gg/a2a-protocol

---
**Start coding in 5 minutes** → Copie o código acima e rode!