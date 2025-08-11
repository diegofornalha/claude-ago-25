# 🔧 Como Reativar o MCP RAG Server

## Problema Comum
O servidor RAG pode aparecer como "failed" no status do MCP mesmo estando rodando em background. Isso geralmente indica um problema de conexão, não do servidor em si.

## Solução Rápida

### 1. Verificar se o processo está rodando
```bash
ps aux | grep -i rag | grep -v grep
```

Se aparecer algo como:
```
python /Users/agents/.claude/mcp-rag-server/rag_server.py
```
O servidor está ativo, apenas a conexão MCP está com problema.

### 2. Reestabelecer a conexão MCP
Execute os comandos em sequência:

```bash
# Remove a configuração antiga
claude mcp remove rag-server

# Adiciona novamente o servidor
claude mcp add rag-server /Users/agents/.claude/mcp-rag-server/start-rag-server.sh
```

### 3. Verificar o status
```bash
claude mcp list
```

Deve aparecer:
```
rag-server: /Users/agents/.claude/mcp-rag-server/start-rag-server.sh  - ✓ Connected
```

## Por que isso funciona?

- **Remove configuração problemática**: Limpa qualquer estado corrompido da conexão
- **Força reconexão**: O Claude Code estabelece uma nova conexão limpa com o servidor
- **Mantém os dados**: O cache de documentos em `/Users/agents/.claude/mcp-rag-cache/` permanece intacto

## Informações Técnicas

- **Processo Python**: O servidor roda como um processo Python independente
- **Consumo de recursos**: Aproximadamente 18MB de RAM
- **Persistência**: Os documentos indexados são mantidos entre reinicializações
- **Auto-restart**: O script `start-rag-server.sh` gerencia o ciclo de vida do servidor

## Quando NÃO precisa reativar

Se o `claude mcp list` mostrar:
- ✓ Connected: Está funcionando normalmente
- ⚠ Warning: Pode estar com problema de conexão temporário
- ✘ Failed: Precisa reativar usando os passos acima

## Troubleshooting Adicional

Se continuar com problemas após reativar:

1. **Verificar logs**:
```bash
tail -f ~/.claude/mcp-rag-server/rag_server.log
```

2. **Matar processo travado**:
```bash
pkill -f rag_server.py
```

3. **Reiniciar manualmente**:
```bash
~/.claude/mcp-rag-server/start-rag-server.sh
```

## Dica Pro

Você pode criar um alias para reativar rapidamente:

```bash
echo "alias rag-restart='claude mcp remove rag-server && claude mcp add rag-server ~/.claude/mcp-rag-server/start-rag-server.sh'" >> ~/.zshrc
source ~/.zshrc
```

Depois é só usar:
```bash
rag-restart
```