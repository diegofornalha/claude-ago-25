# 📋 Padronização A2A Protocol - Marvin Agent

## ⚠️ IMPORTANTE: Padrões Críticos para Funcionamento

Este documento define os padrões **OBRIGATÓRIOS** do protocolo A2A que devem ser mantidos para garantir a compatibilidade e funcionamento correto do agente.

---

## 🔴 Campos Críticos que NÃO PODEM ser Alterados

### 1. **Estrutura do Agent Card**

```json
{
  "name": "string",                    // OBRIGATÓRIO
  "description": "string",              // OBRIGATÓRIO
  "version": "string",                  // OBRIGATÓRIO
  "url": "string",                      // OBRIGATÓRIO
  "defaultInputModes": ["text"],        // OBRIGATÓRIO
  "defaultOutputModes": ["text"],       // OBRIGATÓRIO
  "capabilities": {                     // OBRIGATÓRIO
    "streaming": boolean,
    "pushNotifications": boolean
  },
  "skills": [                           // OBRIGATÓRIO
    {
      "id": "string",                  // OBRIGATÓRIO
      "name": "string",                // OBRIGATÓRIO
      "description": "string",         // OBRIGATÓRIO
      "tags": ["string"]               // OBRIGATÓRIO
    }
  ]
}
```

### 2. **Endpoints Padrão A2A**

| Endpoint | Método | Descrição | Status |
|----------|--------|-----------|--------|
| `/.well-known/agent-card.json` | GET | Agent Card (novo) | ✅ RECOMENDADO |
| `/.well-known/agent.json` | GET | Agent Card (deprecado) | ⚠️ MANTER COMPATIBILIDADE |
| `/` | POST | Recebe mensagens JSON-RPC | ✅ OBRIGATÓRIO |

### 3. **Métodos JSON-RPC Obrigatórios**

```javascript
// Formato CORRETO (usar barra /)
"message/send"     ✅ CORRETO
"message/stream"   ✅ CORRETO
"tasks/get"        ✅ CORRETO
"tasks/cancel"     ✅ CORRETO

// Formato INCORRETO (não usar ponto .)
"message.send"     ❌ ERRADO
"message.stream"   ❌ ERRADO
```

### 4. **Estrutura de Mensagem A2A**

```json
{
  "jsonrpc": "2.0",                    // OBRIGATÓRIO
  "method": "message/send",            // OBRIGATÓRIO (usar /)
  "params": {
    "message": {
      "messageId": "string",           // OBRIGATÓRIO
      "role": "user|agent",            // OBRIGATÓRIO
      "parts": [                       // OBRIGATÓRIO
        {
          "text": "string"             // ou "kind": "text"
        }
      ]
    }
  },
  "id": number                         // OBRIGATÓRIO
}
```

---

## 🟡 Atributos Python vs JSON

### ⚠️ ATENÇÃO: Conversão de Nomes

| Python (snake_case) | JSON (camelCase) | Uso |
|---------------------|------------------|-----|
| `context_id` | `contextId` | Interno Python |
| `task_id` | `taskId` | Interno Python |
| `message_id` | `messageId` | Interno Python |
| `artifact_id` | `artifactId` | Interno Python |

**REGRA:** O SDK A2A converte automaticamente entre os formatos:
- **No código Python:** usar `task.context_id`
- **No JSON da resposta:** será convertido para `contextId`

---

## 🟢 Melhorias Recomendadas (do marvin-ref)

### 1. **Agent Card Completo**
```json
{
  "skills": [
    {
      "id": "analyze",
      "name": "Análise de Dados",
      "description": "Analisa dados e fornece insights",
      "tags": ["analysis", "data", "insights"],
      "examples": [                    // RECOMENDADO: Adicionar exemplos
        "analise estes dados",
        "o que você acha disso"
      ]
    }
  ],
  "defaultInputModes": [               // RECOMENDADO: Múltiplos formatos
    "text",
    "text/plain",
    "application/json"
  ],
  "defaultOutputModes": [
    "text",
    "text/plain", 
    "application/json"
  ]
}
```

### 2. **Configuração A2A (a2a-config.json)**
```json
{
  "a2a_configuration": {
    "enabled": true,
    "agent_name": "marvin_agent",
    "protocol_version": "1.0",
    "discovery": {
      "auto_register": true,
      "heartbeat_interval": 30000
    },
    "communication": {
      "transport": "http",
      "format": "json",
      "timeout": 30000
    },
    "cooperation": {
      "task_delegation": true,
      "result_sharing": true,
      "skill_advertisement": true
    },
    "monitoring": {
      "metrics": true,
      "logging": true,
      "health_checks": true
    }
  }
}
```

---

## 🔧 Configuração de Porta

### Portas Seguras (Acessíveis via Browser)
```python
# RECOMENDADO - Portas seguras
PORT = 9998  # ✅ Atual (funciona no browser)
PORT = 8080  # ✅ Alternativa
PORT = 3000  # ✅ Alternativa

# EVITAR - Portas bloqueadas pelo Chrome
PORT = 6669  # ❌ ERR_UNSAFE_PORT
PORT = 6666  # ❌ ERR_UNSAFE_PORT
```

---

## 📝 Checklist de Validação A2A

### Antes de Fazer Deploy:

- [ ] Agent Card acessível em `/.well-known/agent-card.json`
- [ ] Agent Card contém todos campos obrigatórios
- [ ] Skills têm `id`, `name`, `description` e `tags`
- [ ] Métodos JSON-RPC usam `/` não `.`
- [ ] Mensagens incluem `messageId` obrigatório
- [ ] Python usa `context_id`, JSON retorna `contextId`
- [ ] Porta configurada para valor seguro (não 6669)
- [ ] Servidor responde a `message/send` corretamente

### Teste de Validação:
```bash
# 1. Verificar Agent Card
curl http://localhost:9998/.well-known/agent-card.json

# 2. Testar mensagem A2A
curl -X POST http://localhost:9998/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "test-001",
        "role": "user",
        "parts": [{"text": "Teste A2A"}]
      }
    },
    "id": 1
  }'
```

---

## 🚨 Erros Comuns e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| `'Task' object has no attribute 'contextId'` | Usando camelCase no Python | Usar `task.context_id` |
| `Input should be 'message/send'` | Usando ponto em vez de barra | Mudar para `message/send` |
| `Field required: messageId` | Faltando messageId | Adicionar `"messageId": "uuid"` |
| `ERR_UNSAFE_PORT` | Porta 6669 bloqueada | Mudar para 9998 ou 8080 |
| `defaultInputModes required` | Faltando no AgentCard | Adicionar campo obrigatório |

---

## 📚 Referências

- **Especificação Oficial A2A:** https://a2aprotocol.ai/docs/
- **GitHub A2A Samples:** https://github.com/a2aproject/a2a-samples
- **Exemplo Original Marvin:** https://github.com/a2aproject/a2a-samples/tree/main/samples/python/agents/marvin

---

## ✅ Resumo: Regras de Ouro

1. **NUNCA** altere campos obrigatórios do Agent Card
2. **SEMPRE** use `/` em métodos JSON-RPC (não `.`)
3. **SEMPRE** inclua `messageId` nas mensagens
4. **USE** `context_id` no Python, será convertido para `contextId` no JSON
5. **EVITE** porta 6669, use 9998 ou 8080
6. **MANTENHA** compatibilidade com ambos endpoints de Agent Card
7. **TESTE** sempre com curl antes de integrar com outros agentes

---

**Última Atualização:** 2025-08-11
**Versão do Protocolo:** A2A v0.3.0
**Status:** ✅ Funcionando em Produção na porta 9998