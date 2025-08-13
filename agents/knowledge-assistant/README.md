# Knowledge Assistant A2A Agent

Agente inteligente compatível com protocolo A2A (Agent-to-Agent) para assistência de conhecimento com integração RAG.

## 🚀 Características

- **Protocolo A2A Completo**: Implementa todos os endpoints padrão do protocolo A2A
- **Agent Card Discovery**: Descoberta automática de capacidades via `/.well-known/agent.json`
- **Skills Especializadas**:
  - `search_knowledge`: Busca semântica/textual na base de conhecimento
  - `add_knowledge`: Adiciona novos documentos ao RAG
  - `analyze_topic`: Análise aprofundada de tópicos
  - `get_statistics`: Estatísticas da base de conhecimento
- **Processamento Assíncrono**: Tarefas executadas de forma não-bloqueante
- **Streaming Support**: Server-Sent Events para atualizações em tempo real
- **Estado de Tarefas**: Rastreamento completo do ciclo de vida das tarefas

## 📋 Pré-requisitos

- Python 3.8+
- pip ou conda para gerenciamento de pacotes

## 🛠️ Instalação

1. **Navegue até o diretório do agente:**
```bash
cd /Users/agents/.claude/agents/knowledge-assistant
```

2. **Crie um ambiente virtual (recomendado):**
```bash
python3 -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
```

3. **Instale as dependências:**
```bash
pip install -r requirements.txt
```

## 🏃 Execução

### Iniciar o servidor:
```bash
python app.py
```

O servidor iniciará na porta 9999. Você verá:
```
Iniciando Knowledge Assistant A2A Agent na porta 9999
 * Running on http://0.0.0.0:9999
```

### Testar o agente:
```bash
python test_agent.py
```

## 📡 Endpoints A2A

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/.well-known/agent.json` | GET | Agent Card com capacidades |
| `/health` | GET | Health check do serviço |
| `/tasks` | POST | Criar nova tarefa |
| `/tasks` | GET | Listar todas as tarefas |
| `/tasks/{id}` | GET | Obter status da tarefa |
| `/tasks/{id}/messages` | POST | Enviar mensagem para tarefa |
| `/tasks/{id}/cancel` | POST | Cancelar tarefa |
| `/tasks/{id}/stream` | GET | Stream de eventos (SSE) |

## 💡 Exemplos de Uso

### 1. Descobrir Agent Card:
```bash
curl http://localhost:9999/.well-known/agent.json
```

### 2. Criar tarefa de busca:
```bash
curl -X POST http://localhost:9999/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "search_knowledge",
    "parameters": {
      "query": "A2A protocol",
      "use_semantic": true,
      "limit": 5
    }
  }'
```

### 3. Adicionar conhecimento:
```bash
curl -X POST http://localhost:9999/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "add_knowledge",
    "parameters": {
      "title": "Meu Documento",
      "content": "Conteúdo importante sobre A2A...",
      "tags": ["a2a", "protocolo"],
      "category": "documentation"
    }
  }'
```

### 4. Analisar tópico:
```bash
curl -X POST http://localhost:9999/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "analyze_topic",
    "parameters": {
      "topic": "Integração A2A com MCP",
      "depth": "advanced"
    }
  }'
```

## 🔧 Configuração

O Agent Card pode ser customizado editando o arquivo `agent_card.json`:

```json
{
  "name": "knowledge-assistant",
  "version": "1.0.0",
  "description": "Seu agente personalizado",
  "skills": [...]
}
```

## 🏗️ Arquitetura

```
knowledge-assistant/
├── agent_card.json     # Metadados e capacidades do agente
├── server.py          # Lógica core do agente e handlers
├── app.py            # Servidor HTTP Flask com endpoints A2A
├── test_agent.py     # Suite de testes automatizados
├── requirements.txt  # Dependências Python
└── README.md        # Este arquivo
```

## 🔄 Estados de Tarefa

- `created`: Tarefa criada mas não iniciada
- `running`: Tarefa em processamento
- `paused`: Tarefa pausada (futuro)
- `completed`: Tarefa concluída com sucesso
- `failed`: Tarefa falhou com erro
- `cancelled`: Tarefa cancelada pelo usuário

## 🔗 Integração com outros Agentes

Este agente pode se comunicar com outros agentes A2A. Exemplo usando Python:

```python
import requests

# Descobrir agente
response = requests.get("http://localhost:9999/.well-known/agent.json")
agent_card = response.json()

# Usar skills disponíveis
for skill in agent_card['skills']:
    print(f"Skill: {skill['id']} - {skill['description']}")
```

## 🐛 Troubleshooting

### Porta já em uso:
Altere a porta em `app.py`:
```python
app.run(host='0.0.0.0', port=8888)  # Use outra porta
```

### Erro de importação:
Certifique-se de que todas as dependências estão instaladas:
```bash
pip install -r requirements.txt --upgrade
```

## 📚 Documentação A2A

- [Protocolo A2A Official](https://a2aprotocol.ai)
- [Google A2A Codelab](https://codelabs.developers.google.com/intro-a2a)
- [Linux Foundation A2A](https://www.linuxfoundation.org/projects)

## 🤝 Contribuindo

Este é um agente exemplo. Sinta-se livre para:
- Adicionar novas skills
- Integrar com RAG Server real via MCP
- Implementar autenticação
- Adicionar persistência de tarefas
- Melhorar o tratamento de erros

## 📄 Licença

MIT License - Use livremente em seus projetos!

---

**Desenvolvido com ❤️ usando o protocolo A2A**