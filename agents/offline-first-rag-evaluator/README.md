# 🚀 Offline-First RAG Evaluator Agent

## Visão Geral

Agente especializado em avaliar e otimizar sistemas RAG (Retrieval-Augmented Generation) para funcionamento offline-first, **seguindo completamente o padrão A2A Protocol v0.2.5**.

## 🎯 Características

### Conformidade A2A Protocol
- ✅ **JSON-RPC 2.0** para comunicação
- ✅ **Agent Card** em `/.well-known/agent-card`
- ✅ **Gerenciamento de Tarefas Stateful**
- ✅ **Mensagens Multi-parte**
- ✅ **Streaming via SSE**
- ✅ **Descoberta Dinâmica de Capacidades**

### Skills Disponíveis

#### 1. `evaluate_rag_system`
Avaliação completa de sistemas RAG para capacidades offline-first
- **Parâmetros**: target_system, evaluation_depth, focus_areas
- **Retorno**: score (0-100), report (markdown), recommendations

#### 2. `test_offline_functionality`
Testa funcionalidades específicas em modo offline
- **Parâmetros**: feature, test_scenarios
- **Retorno**: passed (boolean), results, issues

#### 3. `optimize_cache_strategy`
Otimiza estratégias de cache para performance offline
- **Parâmetros**: current_strategy, constraints
- **Retorno**: optimized_strategy, expected_improvements, implementation_code

## 📦 Instalação

### Requisitos
- Python 3.8+
- pip

### Setup
```bash
# Clone ou navegue até o diretório
cd /Users/agents/.claude/agents/offline-first-rag-evaluator

# Instalar dependências (se necessário)
pip install fastapi uvicorn pydantic httpx

# Tornar executável
chmod +x start.sh
```

## 🚀 Como Usar

### 1. Iniciar o Servidor A2A

```bash
# Método 1: Script de inicialização
./start.sh

# Método 2: Direto com Python
python3 a2a-server.py
```

O servidor será iniciado em `http://localhost:8800`

### 2. Verificar Agent Card

```bash
curl http://localhost:8800/.well-known/agent-card
```

### 3. Usar o Cliente A2A

```python
# Executar cliente de teste
python3 a2a-client.py
```

### 4. Integrar com seu Sistema

```python
from a2a_client import A2AClient

async def evaluate_my_rag():
    client = A2AClient("http://localhost:8800")
    
    # Descobrir capacidades
    agent_card = await client.get_agent_card()
    print(f"Agent: {agent_card['name']}")
    
    # Criar tarefa de avaliação
    task = await client.create_task(
        skill="evaluate_rag_system",
        parameters={
            "target_system": "/path/to/your/rag",
            "evaluation_depth": "comprehensive"
        }
    )
    
    # Aguardar resultado
    result = await client.wait_for_completion(task['id'])
    print(f"Score: {result['result']['score']}/100")
```

## 📊 Estrutura A2A Protocol

### Endpoints Principais

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/.well-known/agent-card` | GET | Capacidades do agente |
| `/a2a` | POST | Endpoint principal JSON-RPC |
| `/a2a/tasks/{id}` | GET | Detalhes da tarefa |
| `/a2a/tasks/{id}/status` | GET | Status da tarefa |
| `/a2a/tasks/{id}/messages` | POST | Enviar mensagem |
| `/a2a/tasks/{id}/stream` | GET | Stream SSE |

### Formato de Mensagem JSON-RPC

```json
{
  "jsonrpc": "2.0",
  "method": "a2a.createTask",
  "params": {
    "skill": "evaluate_rag_system",
    "parameters": {
      "target_system": "/path/to/rag"
    }
  },
  "id": "unique-request-id"
}
```

### Estados de Tarefa

- `created`: Tarefa criada
- `running`: Em execução
- `paused`: Pausada
- `completed`: Concluída com sucesso
- `failed`: Falhou
- `cancelled`: Cancelada

## 🔍 Critérios de Avaliação

### 1. Cache Efficiency (Eficiência do Cache)
- Taxa de hit do cache
- Uso de armazenamento
- Estratégias de expiração

### 2. Sync Reliability (Confiabilidade da Sincronização)
- Taxa de sucesso
- Resolução de conflitos
- Retry mechanisms

### 3. Offline Performance (Performance Offline)
- Tempo de resposta
- Funcionalidades disponíveis
- Degradação graceful

### 4. Data Consistency (Consistência de Dados)
- Integridade dos dados
- Versionamento
- Merge strategies

### 5. User Experience (Experiência do Usuário)
- Indicadores de estado
- Feedback visual
- Transparência

## 🛠️ Tecnologias Utilizadas

- **FastAPI**: Framework web assíncrono
- **Pydantic**: Validação de dados
- **JSON-RPC 2.0**: Protocolo de comunicação
- **A2A Protocol v0.2.5**: Especificação de agentes
- **Python 3.8+**: Linguagem base

## 📈 Métricas de Avaliação

O agente avalia sistemas RAG com base em:

- **Score Geral**: 0-100 pontos
- **Relatório Detalhado**: Markdown formatado
- **Recomendações Prioritárias**: Alta/Média/Baixa
- **Código de Implementação**: Exemplos práticos

## 🔗 Integração com MCP

Este agente pode ser integrado com MCP (Model Context Protocol) para fornecer avaliações como ferramenta:

```json
{
  "name": "evaluate_rag",
  "description": "Evaluate RAG system for offline-first capabilities",
  "input_schema": {
    "type": "object",
    "properties": {
      "target": {"type": "string"}
    }
  }
}
```

## 📝 Exemplo de Relatório

```markdown
# Relatório de Avaliação RAG Offline-First

## Score: 85/100

### ✅ Pontos Fortes
- IndexedDB implementado corretamente
- Service Worker configurado
- WebSocket sync funcional

### ⚠️ Áreas de Melhoria
- Implementar queue de sincronização offline
- Adicionar indicadores visuais de estado
- Otimizar estratégia de cache

### 💡 Recomendações
1. [HIGH] Implementar offline queue
2. [MEDIUM] Adicionar compressão de dados
3. [LOW] Melhorar logs de debug
```

## 🐛 Troubleshooting

### Porta 8800 em uso
```bash
lsof -i:8800
kill $(lsof -t -i:8800)
```

### Dependências faltando
```bash
pip install -r requirements.txt
```

### Erro de importação
```bash
pip install --user fastapi uvicorn pydantic httpx
```

## 📚 Referências

- [A2A Protocol Specification](https://a2aprotocol.ai/docs)
- [JSON-RPC 2.0](https://www.jsonrpc.org/specification)
- [Offline-First Design](https://offlinefirst.org)

## 📄 Licença

MIT License - Use livremente em seus projetos

## 🤝 Contribuições

Contribuições são bem-vindas! Este agente segue os padrões:
- A2A Protocol v0.2.5
- JSON-RPC 2.0
- Python PEP 8

---

**Desenvolvido com ❤️ seguindo o padrão A2A Protocol**