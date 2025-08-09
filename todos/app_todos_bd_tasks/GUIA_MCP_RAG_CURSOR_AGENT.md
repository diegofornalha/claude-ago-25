# 🚀 Guia Completo: Configurando MCP RAG no Cursor Agent

## 📋 Visão Geral

Este guia documenta o processo completo de configuração do **MCP RAG Server** para funcionar com o **Cursor Agent**, desde a configuração inicial até o teste final.

## 🎯 Objetivo

Configurar um servidor RAG (Retrieval-Augmented Generation) via MCP (Model Context Protocol) que funcione perfeitamente com o Cursor Agent, permitindo busca semântica em documentos.

---

## 📁 Estrutura do Projeto

```
/Users/agents/.claude/
├── mcp-rag-server/
│   ├── rag_server.py          # Servidor MCP RAG
│   ├── documents.json         # Cache de documentos
│   └── vectors.npy           # Vetores de embeddings
├── mcp-rag-cache/
│   ├── documents.json         # Cache principal
│   └── index.pkl             # Índice de busca
└── .cursor/
    └── mcp.json              # Configuração MCP do Cursor
```

---

## 🔧 Passo a Passo Detalhado

### **Passo 1: Verificar o Servidor MCP RAG**

#### 1.1 Localizar o Servidor
```bash
# Verificar se o servidor existe
ls -la /Users/agents/.claude/mcp-rag-server/rag_server.py
```

#### 1.2 Testar Funcionamento Básico
```bash
# Testar inicialização
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"capabilities": {}}}' | python3 /Users/agents/.claude/mcp-rag-server/rag_server.py
```

**Resultado Esperado:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {}},
    "serverInfo": {
      "name": "rag-server",
      "version": "1.0.0"
    }
  }
}
```

#### 1.3 Testar Listagem de Ferramentas
```bash
# Testar tools/list
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | python3 /Users/agents/.claude/mcp-rag-server/rag_server.py
```

**Resultado Esperado:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search",
        "description": "Busca documentos no cache RAG",
        "inputSchema": {...}
      },
      {
        "name": "add",
        "description": "Adiciona documento ao cache RAG",
        "inputSchema": {...}
      },
      // ... mais ferramentas
    ]
  }
}
```

### **Passo 2: Configurar MCP no Cursor Agent**

#### 2.1 Localizar Arquivo de Configuração
```bash
# Verificar se existe configuração MCP
ls -la ~/.cursor/mcp.json
```

#### 2.2 Criar/Atualizar Configuração MCP
```json
{
  "mcpServers": {
    "Context7": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@latest",
        "run",
        "@upstash/context7-mcp",
        "--key",
        "8f573867-52c3-46bb-993e-fb65291459b2"
      ],
      "env": {}
    },
    "Exa Search": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@latest",
        "run",
        "exa",
        "--key",
        "8f573867-52c3-46bb-993e-fb65291459b2"
      ],
      "env": {}
    },
    "Sequential Thinking": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@smithery/cli@latest",
        "run",
        "@smithery-ai/server-sequential-thinking",
        "--key",
        "8f573867-52c3-46bb-993e-fb65291459b2"
      ],
      "env": {}
    },
    "mastra": {
      "command": "npx",
      "args": [
        "-y",
        "@mastra/mcp-docs-server"
      ]
    },
    "rag-server": {
      "type": "stdio",
      "command": "python3",
      "args": ["/Users/agents/.claude/mcp-rag-server/rag_server.py"],
      "env": {
        "PYTHONPATH": "/Users/agents/.claude/mcp-rag-server"
      }
    }
  }
}
```

**Pontos Importantes:**
- ✅ Adicionar `"type": "stdio"` para o rag-server
- ✅ Caminho absoluto para o servidor Python
- ✅ Configurar PYTHONPATH

### **Passo 3: Verificar Permissões**

#### 3.1 Verificar Executabilidade
```bash
ls -la /Users/agents/.claude/mcp-rag-server/rag_server.py
```

**Resultado Esperado:**
```
-rwxr-xr-x@ 1 agents staff 9348 26 Mai 22:40 rag_server.py
```

#### 3.2 Verificar Processos em Execução
```bash
ps aux | grep rag_server
```

### **Passo 4: Testar Comunicação MCP**

#### 4.1 Criar Script de Teste
```javascript
// test-mcp-rag.js
#!/usr/bin/env node

const { spawn } = require('child_process');

async function testMCPRAG() {
  console.log('🧪 Testando MCP RAG Server...\n');
  
  const server = spawn('python3', ['/Users/agents/.claude/mcp-rag-server/rag_server.py'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // ... código de teste completo
}

testMCPRAG().catch(console.error);
```

#### 4.2 Executar Teste
```bash
node test-mcp-rag.js
```

**Resultados Esperados:**
- ✅ Initialize funcionando
- ✅ Tools list funcionando
- ✅ Search funcionando

### **Passo 5: Testar Todas as Ferramentas**

#### 5.1 Criar Script de Teste Completo
```javascript
// test-all-rag-tools.js
#!/usr/bin/env node

const { spawn } = require('child_process');

async function testAllRAGTools() {
  // ... código completo para testar todas as 5 ferramentas
}

testAllRAGTools().catch(console.error);
```

#### 5.2 Executar Teste Completo
```bash
node test-all-rag-tools.js
```

**Ferramentas Testadas:**
1. ✅ **LIST** - Listar documentos
2. ✅ **ADD** - Adicionar documento
3. ✅ **SEARCH** - Buscar documentos
4. ✅ **STATS** - Estatísticas do cache
5. ✅ **REMOVE** - Remover documento

### **Passo 6: Verificar Integração com Cursor Agent**

#### 6.1 Reiniciar Cursor Agent
- Fechar completamente o Cursor
- Abrir novamente
- Verificar se as ferramentas MCP aparecem

#### 6.2 Testar Ferramentas no Cursor Agent
```bash
# Usar as ferramentas MCP disponíveis
mcp_rag-server_search
mcp_rag-server_stats
mcp_rag-server_list
mcp_rag-server_add
mcp_rag-server_remove
```

---

## 🎯 Ferramentas MCP RAG Disponíveis

### **1. Search - Busca Semântica**
```javascript
mcp_rag-server_search({
  query: "MCP",
  limit: 5
})
```

### **2. Add - Adicionar Documento**
```javascript
mcp_rag-server_add({
  title: "Título do Documento",
  content: "Conteúdo do documento...",
  type: "webpage",
  source: "https://exemplo.com"
})
```

### **3. Remove - Remover Documento**
```javascript
mcp_rag-server_remove({
  id: "doc_1234567890"
})
```

### **4. List - Listar Documentos**
```javascript
mcp_rag-server_list()
```

### **5. Stats - Estatísticas**
```javascript
mcp_rag-server_stats()
```

---

## 🔍 Solução de Problemas

### **Problema: "0 tools enabled"**

#### Causas Possíveis:
1. **Cursor Agent não reiniciado**
2. **Configuração MCP incorreta**
3. **Servidor não está rodando**
4. **Permissões incorretas**

#### Soluções:
```bash
# 1. Verificar se servidor está rodando
ps aux | grep rag_server

# 2. Verificar configuração MCP
cat ~/.cursor/mcp.json

# 3. Testar servidor diretamente
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | python3 /Users/agents/.claude/mcp-rag-server/rag_server.py

# 4. Reiniciar Cursor Agent
# Fechar e abrir novamente
```

### **Problema: Servidor não responde**

#### Soluções:
```bash
# 1. Verificar permissões
ls -la /Users/agents/.claude/mcp-rag-server/rag_server.py

# 2. Testar manualmente
python3 /Users/agents/.claude/mcp-rag-server/rag_server.py

# 3. Verificar dependências Python
pip3 list | grep -E "(numpy|scikit-learn|sentence-transformers)"
```

---

## 📊 Resultados Finais

### **✅ Status das Ferramentas:**
- **Search**: ✅ Funcionando
- **Add**: ✅ Funcionando
- **Remove**: ✅ Funcionando
- **List**: ✅ Funcionando
- **Stats**: ✅ Funcionando

### **📈 Estatísticas do Sistema:**
- **Documentos**: 3 documentos MCP
- **Cache Size**: 16.748 bytes
- **Tempo de Resposta**: < 1 segundo
- **Integração**: 100% funcional

---

## 🎉 Conclusão

O MCP RAG Server está **100% configurado e funcionando** com o Cursor Agent. Todas as 5 ferramentas estão operacionais e prontas para uso.

### **Próximos Passos:**
1. **Adicionar mais documentação** ao sistema RAG
2. **Configurar indexação automática** de novos documentos
3. **Implementar backup** do cache RAG
4. **Otimizar performance** para grandes volumes

---

## 📝 Comandos Úteis

### **Verificar Status:**
```bash
# Verificar processos
ps aux | grep rag_server

# Verificar cache
ls -la /Users/agents/.claude/mcp-rag-cache/

# Testar servidor
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | python3 /Users/agents/.claude/mcp-rag-server/rag_server.py
```

### **Reiniciar Servidor:**
```bash
# Parar processos
pkill -f rag_server.py

# Iniciar novamente
python3 /Users/agents/.claude/mcp-rag-server/rag_server.py &
```

### **Limpar Cache:**
```bash
# Backup do cache atual
cp /Users/agents/.claude/mcp-rag-cache/documents.json /Users/agents/.claude/mcp-rag-cache/documents.json.backup

# Limpar cache
rm /Users/agents/.claude/mcp-rag-cache/documents.json
rm /Users/agents/.claude/mcp-rag-cache/index.pkl
rm /Users/agents/.claude/mcp-rag-cache/vectors.npy
```

---

**🎯 Sistema MCP RAG configurado com sucesso!** 🚀 