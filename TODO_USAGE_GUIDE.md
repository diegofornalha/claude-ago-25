# 📚 GUIA DE USO - SISTEMA DE COORDENAÇÃO DE TODOS

## 🎯 Visão Geral
Sistema desenvolvido para prevenir conflitos entre múltiplas sessões do Claude trabalhando simultaneamente.

## 🏗️ Estrutura Implementada

```
/Users/agents/.claude/
├── todos/
│   ├── sessions/           # Todos isolados por sessão
│   │   ├── {session-id}/
│   │   │   ├── main.json
│   │   │   └── context.json
│   ├── projects/           # Todos compartilhados
│   │   └── app_todos_bd_tasks/
│   │       ├── frontend/
│   │       ├── backend/
│   │       └── rag/
│   └── coordination.json   # Configuração central
├── hooks/                  # Scripts automáticos
│   ├── pre-todo-operation.sh
│   └── post-todo-operation.sh
├── session_contexts.json   # Mapeamento de contextos
└── TODO_COORDINATION_SYSTEM.md # Documentação técnica
```

## 🚀 Como Usar

### 1️⃣ **Verificar Conflitos (ANTES de trabalhar)**
```bash
~/.claude/check_todo_conflicts.sh [session-id] [contexto]

# Exemplo:
~/.claude/check_todo_conflicts.sh 8cf4c91c-1e55-4522 frontend
```

### 2️⃣ **Organizar Estrutura (quando necessário)**
```bash
# Migrar e limpar
~/.claude/organize_todos.sh --migrate --cleanup

# Apenas limpar locks expirados
~/.claude/organize_todos.sh --cleanup
```

### 3️⃣ **Executar Hooks (automático no futuro)**
```bash
# Antes de operação
~/.claude/hooks/pre-todo-operation.sh [session-id] write frontend

# Após operação
~/.claude/hooks/post-todo-operation.sh [session-id] write frontend
```

## 📊 Status das Sessões Atuais

| Session ID | Contexto | Descrição | Status |
|------------|----------|-----------|--------|
| `11f81066` | shell | Shell snapshots e DevOps | ✅ Migrado |
| `6720f65d` | rag | Sistema RAG e busca vetorial | ✅ Migrado |
| `8cf4c91c` | frontend | Frontend React e UI | ✅ Migrado |
| `f4bfdc54` | backend | Backend e APIs | ✅ Migrado |

## 🔒 Regras de Isolamento

### ✅ PERMITIDO:
- Cada sessão editar seu próprio arquivo
- Múltiplas sessões em contextos diferentes
- Leitura simultânea de qualquer arquivo
- Sessões em projetos diferentes

### ❌ BLOQUEADO:
- Duas sessões editando o mesmo arquivo
- Escrita sem verificar conflitos
- Modificar arquivos de outras sessões
- Criar todos sem contexto definido

## 🛠️ Comandos Úteis

### Verificar sessão atual:
```bash
# Ver todas as sessões ativas
ls -la ~/.claude/todos/sessions/

# Ver contexto de uma sessão
cat ~/.claude/todos/sessions/{session-id}/context.json
```

### Limpar problemas:
```bash
# Remover todos os locks
find ~/.claude/todos -name "*.lock" -delete

# Ver arquivos modificados recentemente
find ~/.claude/todos -name "*.json" -mmin -10 -ls
```

### Monitorar atividade:
```bash
# Ver log de operações
tail -f ~/.claude/todos/operations.log

# Verificar conflitos em tempo real
watch -n 5 ~/.claude/check_todo_conflicts.sh
```

## 🎨 Melhores Práticas

1. **Sempre verificar conflitos** antes de iniciar trabalho
2. **Usar contextos específicos** (frontend, backend, rag)
3. **Não editar arquivos** de outras sessões
4. **Limpar locks** periodicamente
5. **Fazer backup** antes de grandes mudanças

## 🚨 Resolução de Problemas

### Problema: "Lock ativo detectado"
**Solução:**
```bash
# Verificar quem tem o lock
~/.claude/check_todo_conflicts.sh

# Se lock expirado (> 5 min), remover
find ~/.claude/todos -name "*.lock" -mmin +5 -delete
```

### Problema: "Conflito entre sessões"
**Solução:**
1. Cada sessão usar contexto diferente
2. Ou aguardar outra sessão terminar
3. Ou trabalhar em arquivo isolado

### Problema: "Arquivo não encontrado"
**Solução:**
```bash
# Reorganizar estrutura
~/.claude/organize_todos.sh --migrate
```

## 📈 Monitoramento

### Dashboard de Status:
```bash
# Script de status completo
cat << 'EOF' > /tmp/todo_status.sh
#!/bin/bash
echo "=== STATUS DO SISTEMA DE TODOS ==="
echo "Sessões ativas: $(ls -d ~/.claude/todos/sessions/*/ 2>/dev/null | wc -l)"
echo "Locks ativos: $(find ~/.claude/todos -name "*.lock" -mmin -5 2>/dev/null | wc -l)"
echo "Modificações recentes: $(find ~/.claude/todos -name "*.json" -mmin -10 2>/dev/null | wc -l)"
echo "=================================="
EOF
bash /tmp/todo_status.sh
```

## 🔄 Integração com Playbooks

No frontend (`http://localhost:5173/playbooks`):
1. Cada sessão aparece com seu contexto
2. Cores indicam status de lock
3. Conflitos são destacados
4. Auto-refresh a cada 30 segundos

## 📝 Notas Importantes

- **Backup automático** antes de cada migração
- **Locks expiram** após 5 minutos
- **Contextos detectados** automaticamente
- **Logs mantidos** para auditoria

## 🆘 Suporte

Em caso de problemas:
1. Verificar este guia
2. Consultar `TODO_COORDINATION_SYSTEM.md`
3. Verificar logs em `~/.claude/todos/operations.log`
4. Restaurar backup se necessário

---

**Última atualização:** 2025-08-09
**Versão:** 1.0.0
**Status:** ✅ Sistema Operacional