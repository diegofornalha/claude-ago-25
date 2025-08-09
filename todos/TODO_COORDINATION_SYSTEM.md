# 🔧 SISTEMA DE COORDENAÇÃO DE TODOS - SOLUÇÃO DEFINITIVA

## 📋 PROBLEMA IDENTIFICADO
- Múltiplas sessões do Claude editando os mesmos arquivos de todos
- Conflitos ao salvar alterações simultâneas
- Falta de organização por contexto/projeto
- Ausência de sistema de lock entre sessões

## ✅ SOLUÇÃO PROPOSTA

### 1. ESTRUTURA DE DIRETÓRIOS
```
/Users/agents/.claude/todos/
├── sessions/                      # Todos por sessão (isolados)
│   ├── {session-id}/
│   │   ├── main.json             # Todos principais da sessão
│   │   ├── context.json          # Contexto e metadados
│   │   └── lock.json             # Arquivo de lock
│   └── ...
├── projects/                      # Todos compartilhados por projeto
│   ├── app_todos_bd_tasks/
│   │   ├── frontend.json         # Todos do frontend
│   │   ├── backend.json          # Todos do backend
│   │   ├── rag.json              # Todos do sistema RAG
│   │   └── shared.lock           # Lock compartilhado
│   └── ...
├── global/                        # Todos globais (raramente usados)
│   └── system.json
└── coordination.json              # Arquivo de coordenação central

```

### 2. SISTEMA DE LOCK SIMPLES

#### Arquivo de Lock (`lock.json`)
```json
{
  "sessionId": "uuid-da-sessao",
  "lockedAt": "2025-01-09T10:00:00Z",
  "expiresAt": "2025-01-09T10:05:00Z",
  "context": "frontend|backend|rag|general",
  "operation": "read|write|delete"
}
```

### 3. REGRAS DE COORDENAÇÃO

#### ANTES de qualquer operação com todos:
1. **VERIFICAR** se existe lock ativo
2. **AGUARDAR** se lock não expirou (máx 5 min)
3. **CRIAR** lock antes de escrever
4. **LIBERAR** lock após operação

#### PRIORIDADES:
- Sessões trabalhando em **contextos diferentes** = SEM conflito
- Sessões no **mesmo contexto** = Usar sistema de lock
- Operações de **leitura** = Sempre permitidas
- Operações de **escrita** = Requerem lock exclusivo

### 4. ALGORITMO DE RESOLUÇÃO

```typescript
interface TodoOperation {
  sessionId: string
  projectPath: string
  context: 'frontend' | 'backend' | 'rag' | 'general'
  operation: 'read' | 'write' | 'delete'
}

async function executeTodoOperation(op: TodoOperation) {
  // 1. Determinar arquivo alvo
  const targetFile = getTargetFile(op)
  
  // 2. Verificar lock
  const lock = await checkLock(targetFile)
  
  // 3. Se tem lock e não é nosso
  if (lock && lock.sessionId !== op.sessionId) {
    if (lock.expired) {
      await removeLock(targetFile)
    } else if (op.operation === 'write') {
      // Aguardar ou falhar
      return await waitOrFail(lock, op)
    }
  }
  
  // 4. Criar lock se necessário
  if (op.operation === 'write') {
    await createLock(targetFile, op)
  }
  
  // 5. Executar operação
  const result = await performOperation(op)
  
  // 6. Liberar lock
  if (op.operation === 'write') {
    await releaseLock(targetFile, op)
  }
  
  return result
}
```

### 5. IMPLEMENTAÇÃO PRÁTICA

#### A. Script de Validação (`check_todo_conflicts.sh`)
```bash
#!/bin/bash
# Verificar conflitos antes de operações

TODO_DIR="$HOME/.claude/todos"
SESSION_ID=$1
CONTEXT=$2

# Verificar locks ativos
find "$TODO_DIR" -name "*.lock" -mmin -5 | while read lock; do
  if [ "$(jq -r .sessionId $lock)" != "$SESSION_ID" ]; then
    echo "CONFLITO: Lock ativo em $(basename $(dirname $lock))"
    exit 1
  fi
done

echo "OK: Sem conflitos detectados"
```

#### B. Hook de Pre-Operation
```javascript
// Executar antes de qualquer operação com todos
async function preTodoOperation(sessionId, operation) {
  const conflicts = await checkConflicts(sessionId)
  
  if (conflicts.length > 0) {
    console.warn('Conflitos detectados:', conflicts)
    
    // Estratégias de resolução
    if (operation.type === 'read') {
      return 'proceed' // Leitura sempre permitida
    }
    
    if (operation.context !== conflicts[0].context) {
      return 'proceed' // Contextos diferentes
    }
    
    // Aguardar ou abortar
    return await resolveConflict(conflicts[0])
  }
  
  return 'proceed'
}
```

### 6. MIGRAÇÃO DOS ARQUIVOS EXISTENTES

```bash
#!/bin/bash
# Script de migração para nova estrutura

OLD_DIR="$HOME/.claude/todos"
NEW_DIR="$HOME/.claude/todos/sessions"

# Criar nova estrutura
mkdir -p "$NEW_DIR"
mkdir -p "$OLD_DIR/projects"
mkdir -p "$OLD_DIR/global"

# Migrar arquivos de sessão
for file in "$OLD_DIR"/*-agent-*.json; do
  if [ -f "$file" ]; then
    session_id=$(basename "$file" | cut -d'-' -f1)
    mkdir -p "$NEW_DIR/$session_id"
    mv "$file" "$NEW_DIR/$session_id/main.json"
    echo "Migrado: $file"
  fi
done

# Criar arquivo de coordenação
cat > "$OLD_DIR/coordination.json" << EOF
{
  "version": "1.0.0",
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "rules": {
    "lockTimeout": 300,
    "maxRetries": 3,
    "conflictResolution": "lock-based"
  }
}
EOF
```

### 7. BENEFÍCIOS DA SOLUÇÃO

✅ **Isolamento por Sessão**: Cada sessão tem seu espaço próprio
✅ **Compartilhamento Controlado**: Projetos podem ter todos compartilhados
✅ **Prevenção de Conflitos**: Sistema de lock evita escritas simultâneas
✅ **Recuperação Automática**: Locks expiram após timeout
✅ **Contexto Preservado**: Separação por frontend/backend/rag
✅ **Escalável**: Funciona com N sessões simultâneas

### 8. CASOS DE USO

#### Caso 1: Sessão Única
- Usa `sessions/{session-id}/main.json`
- Sem necessidade de locks
- Isolamento total

#### Caso 2: Múltiplas Sessões - Mesmo Projeto
- Usam `projects/{project}/` com contextos separados
- Lock apenas no mesmo contexto
- Colaboração permitida

#### Caso 3: Operação Global
- Usa `global/system.json`
- Lock obrigatório
- Acesso sequencial

### 9. MONITORAMENTO

```javascript
// Dashboard de status dos todos
function getTodoSystemStatus() {
  return {
    activeSessions: countActiveSessions(),
    activeLocks: getActiveLocks(),
    conflicts: detectConflicts(),
    health: checkSystemHealth()
  }
}
```

### 10. ROLLBACK EM CASO DE ERRO

Se houver problemas:
1. Remover todos os locks: `find ~/.claude/todos -name "*.lock" -delete`
2. Restaurar backup: `cp -r ~/.claude/todos.backup ~/.claude/todos`
3. Recriar estrutura: `~/.claude/setup_todo_structure.sh`