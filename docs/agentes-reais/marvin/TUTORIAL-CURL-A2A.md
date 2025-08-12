# 📚 Tutorial Completo: Usando Marvin Agent via cURL e A2A Protocol

## 📋 Índice
1. [Pré-requisitos](#-pré-requisitos)
2. [Iniciando o Marvin](#-iniciando-o-marvin)
3. [Verificando o Agent Card](#-verificando-o-agent-card)
4. [Enviando Mensagens via A2A](#-enviando-mensagens-via-a2a)
5. [Exemplos Práticos](#-exemplos-práticos)
6. [Troubleshooting](#-troubleshooting)

---

## 🔧 Pré-requisitos

### 1. Verificar se o Marvin está instalado
```bash
cd /Users/agents/.claude/docs/agentes-reais/marvin
ls -la scripts/
```

### 2. Verificar dependências
```bash
# Python 3.12+
python3 --version

# cURL
curl --version

# jq (opcional, para formatar JSON)
brew install jq  # macOS
```

---

## 🚀 Iniciando o Marvin

### Passo 1: Iniciar o servidor
```bash
cd /Users/agents/.claude/docs/agentes-reais/marvin/scripts
./start_marvin.sh
```

**Saída esperada:**
```
🤖 Iniciando Marvin A2A Agent...
================================
📦 Preparando ambiente...
🚀 Iniciando servidor na porta 9998...
⏳ Aguardando servidor iniciar...
.
✅ Marvin iniciado com sucesso!

📊 Informações:
   • Nome: Marvin A2A Agent
   • Porta: 9998
   • URL: http://localhost:9998
```

---

## 🔍 Verificando o Agent Card

### Passo 2: Verificar se o Marvin está respondendo

#### Opção 1: Agent Card (endpoint novo - recomendado)
```bash
curl -s http://localhost:9998/.well-known/agent-card.json | python3 -m json.tool
```

#### Opção 2: Agent Card (endpoint antigo - compatibilidade)
```bash
curl -s http://localhost:9998/.well-known/agent.json | python3 -m json.tool
```

**Resposta esperada:**
```json
{
    "name": "marvin-agent",
    "description": "Agente auxiliar inteligente...",
    "version": "1.0.0",
    "url": "http://localhost:9998",
    "capabilities": {
        "streaming": true,
        "pushNotifications": false
    },
    "skills": [
        {
            "id": "analyze",
            "name": "Análise de Dados",
            "description": "Analisa dados e fornece insights"
        },
        {
            "id": "execute",
            "name": "Execução de Tarefas",
            "description": "Executa tarefas e comandos"
        },
        {
            "id": "assist",
            "name": "Assistência Geral",
            "description": "Fornece assistência e suporte"
        }
    ]
}
```

---

## 📨 Enviando Mensagens via A2A

### Estrutura Básica da Requisição A2A

```json
{
    "jsonrpc": "2.0",              // Versão do protocolo (obrigatório)
    "method": "message/send",       // Método A2A (usar / não .)
    "params": {
        "message": {
            "messageId": "msg-001",  // ID único da mensagem (obrigatório)
            "role": "user",          // Papel: user ou agent
            "parts": [               // Array de partes da mensagem
                {
                    "text": "Sua mensagem aqui"
                }
            ]
        }
    },
    "id": 1                         // ID da requisição JSON-RPC
}
```

---

## 💡 Exemplos Práticos

### Exemplo 1: Teste Simples - "Você está ativo?"

```bash
curl -X POST http://localhost:9998/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "test-001",
        "role": "user",
        "parts": [{"text": "Você está ativo?"}]
      }
    },
    "id": 1
  }'
```

**Formatado com jq:**
```bash
curl -X POST http://localhost:9998/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "test-001",
        "role": "user",
        "parts": [{"text": "Você está ativo?"}]
      }
    },
    "id": 1
  }' 2>/dev/null | python3 -m json.tool
```

---

### Exemplo 2: Extração de Dados - Caso Diego Alcantara

```bash
curl -X POST http://localhost:9998/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "extract-001",
        "role": "user",
        "parts": [{
          "text": "Extraia as seguintes informações: Diego Alcantara, trabalha nos agentes integrados é CEO lá e telefone 213456789 email diego@coflow.com"
        }]
      }
    },
    "id": 1
  }' 2>/dev/null | python3 -m json.tool
```

**Resposta esperada (resumida):**
```json
{
    "result": {
        "artifacts": [{
            "parts": [{
                "data": {
                    "extracted_data": {
                        "nome": "Diego Alcantara",
                        "email": "diego@coflow.com",
                        "telefone": "213456789",
                        "cargo": "CEO"
                    }
                }
            }]
        }]
    }
}
```

---

### Exemplo 3: Extração de Múltiplos Contatos

```bash
curl -X POST http://localhost:9998/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "extract-002",
        "role": "user",
        "parts": [{
          "text": "Extraia: João Silva, CTO da TechCorp, joao@tech.com, (11)98765-4321 e Maria Santos, CEO, maria@startup.com"
        }]
      }
    },
    "id": 1
  }' 2>/dev/null | python3 -m json.tool
```

---

### Exemplo 4: Assistência Geral

```bash
curl -X POST http://localhost:9998/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "help-001",
        "role": "user",
        "parts": [{
          "text": "Como posso melhorar meu código Python?"
        }]
      }
    },
    "id": 1
  }' 2>/dev/null | python3 -m json.tool
```

---

### Exemplo 5: Salvando Resposta em Arquivo

```bash
# Enviar requisição e salvar resposta
curl -X POST http://localhost:9998/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "save-001",
        "role": "user",
        "parts": [{
          "text": "Extraia: Pedro Costa, gerente, pedro@empresa.com, 11999887766"
        }]
      }
    },
    "id": 1
  }' > resposta.json

# Visualizar resposta formatada
cat resposta.json | python3 -m json.tool
```

---

### Exemplo 6: Script Bash para Múltiplas Requisições

Crie um arquivo `test_marvin.sh`:

```bash
#!/bin/bash

# Função para enviar mensagem ao Marvin
send_message() {
    local message="$1"
    local msg_id="$2"
    
    curl -s -X POST http://localhost:9998/ \
      -H "Content-Type: application/json" \
      -d "{
        \"jsonrpc\": \"2.0\",
        \"method\": \"message/send\",
        \"params\": {
          \"message\": {
            \"messageId\": \"$msg_id\",
            \"role\": \"user\",
            \"parts\": [{\"text\": \"$message\"}]
          }
        },
        \"id\": 1
      }" | python3 -m json.tool
}

# Testar extração de dados
echo "=== Teste 1: Extração de Dados ==="
send_message "Extraia: Ana Lima, designer, ana@design.com" "test-001"

echo -e "\n=== Teste 2: Assistência ==="
send_message "Como organizar meu projeto?" "test-002"

echo -e "\n=== Teste 3: Status ==="
send_message "Você está funcionando?" "test-003"
```

Executar:
```bash
chmod +x test_marvin.sh
./test_marvin.sh
```

---

## 🔄 Usando com Pipe e jq

### Extrair apenas dados específicos

```bash
# Extrair apenas o campo extracted_data
curl -s -X POST http://localhost:9998/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "jq-001",
        "role": "user",
        "parts": [{
          "text": "Extraia: Carlos Silva, CEO, carlos@empresa.com, 11987654321"
        }]
      }
    },
    "id": 1
  }' | jq '.result.artifacts[0].parts[0].data.extracted_data'
```

**Saída:**
```json
{
  "nome": "Carlos Silva",
  "email": "carlos@empresa.com",
  "telefone": "11987654321",
  "cargo": "CEO"
}
```

---

## 🐛 Troubleshooting

### Erro: Connection refused
```bash
# Verificar se o Marvin está rodando
ps aux | grep marvin

# Verificar porta
lsof -i:9998

# Reiniciar Marvin
./stop_marvin.sh
./start_marvin.sh
```

### Erro: ERR_UNSAFE_PORT (no browser)
```bash
# Porta 6669 é bloqueada pelo Chrome
# Use porta 9998 ou 8080
```

### Erro: Field required: messageId
```bash
# SEMPRE inclua messageId na mensagem
"message": {
  "messageId": "único-id-aqui",  # OBRIGATÓRIO
  "role": "user",
  "parts": [...]
}
```

### Erro: Input should be 'message/send'
```bash
# Use barra / não ponto .
"method": "message/send"   # ✅ CORRETO
"method": "message.send"   # ❌ ERRADO
```

---

## 📊 Estrutura Completa da Resposta

Uma resposta A2A completa contém:

```json
{
  "id": 1,                          // ID da requisição
  "jsonrpc": "2.0",                 // Versão do protocolo
  "result": {
    "id": "task-uuid",              // ID da tarefa
    "kind": "task",                 // Tipo de resultado
    "contextId": "context-uuid",    // ID do contexto
    "status": {
      "state": "completed"          // Estado: completed, failed, etc
    },
    "artifacts": [{                 // Artefatos de resposta
      "artifactId": "uuid",
      "name": "marvin_result",
      "description": "...",
      "parts": [{
        "kind": "data",             // Tipo: data, text, etc
        "data": {                   // Dados estruturados
          "extracted_data": {...},  // Dados extraídos
          "entities": {...},        // Entidades encontradas
          "statistics": {...}       // Estatísticas
        }
      }]
    }],
    "history": [...]                // Histórico de mensagens
  }
}
```

---

## 🛑 Parando o Marvin

```bash
cd /Users/agents/.claude/docs/agentes-reais/marvin/scripts
./stop_marvin.sh
```

**Saída esperada:**
```
🛑 Parando Marvin A2A Agent...
⏳ Aguardando processo terminar...
✅ Marvin parado com sucesso

🎯 Marvin foi parado completamente
   Para iniciar novamente: ./start_marvin.sh
```

---

## 📚 Referências

- **Protocolo A2A**: https://a2aprotocol.ai/docs/
- **JSON-RPC 2.0**: https://www.jsonrpc.org/specification
- **Documentação do Marvin**: `/Users/agents/.claude/docs/agentes-reais/marvin/A2A-PADRONIZACAO.md`
- **Exemplos Python**: `/Users/agents/.claude/docs/agentes-reais/marvin/example_usage.py`

---

**Última Atualização:** 2025-08-11  
**Versão:** 1.0.0  
**Porta Padrão:** 9998