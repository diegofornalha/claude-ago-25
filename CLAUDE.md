sempre consulte no mcp rag para responder sobre A2A
responda sempre em pt br
pr oibido criar algo na raiz dessa sendo pasta ou arquivo sem autolização expressa do usuario, quando for criar algum arquivo se certificar de estar criando em sua devida pasta

## 🔒 SISTEMA DE COORDENAÇÃO DE TODOS - REGRAS DEFINITIVAS

### ANTES DE QUALQUER OPERAÇÃO COM TODOS:

1. **VERIFICAR CONTEXTO**
   - Identificar qual sessão está ativa: `{session-id}`
   - Determinar contexto de trabalho: `frontend`, `backend`, `rag` ou `general`
   - Verificar se há projeto ativo: `/todos/app_todos_bd_tasks/` ou outro

2. **VERIFICAR CONFLITOS**
   ```bash
   # Antes de criar ou editar todos, verificar locks ativos:
   find ~/.claude/todos -name "*.lock" -mmin -5 -exec cat {} \;
   ```

3. **USAR ISOLAMENTO POR SESSÃO**
   - Cada sessão deve trabalhar em seu próprio arquivo:
     - Padrão: `todos/{session-id}-agent-{session-id}.json`
   - Para projetos compartilhados, usar contexto específico:
     - Frontend: `todos/app_todos_bd_tasks/frontend/{session-id}.json`
     - Backend: `todos/app_todos_bd_tasks/backend/{session-id}.json`
     - RAG: `todos/app_todos_bd_tasks/rag/{session-id}.json`

4. **EVITAR CONFLITOS**
   - ❌ NUNCA editar arquivos de outras sessões
   - ❌ NUNCA criar todos genéricos sem contexto
   - ✅ SEMPRE usar prefixo de contexto: `[FRONTEND]`, `[BACKEND]`, `[RAG]`
   - ✅ SEMPRE verificar se arquivo já existe antes de criar

5. **RESOLUÇÃO DE CONFLITOS**
   - Se detectar lock ativo de outra sessão:
     - Aguardar até 5 
     - Ou trabalhar em contexto diferente
     - Ou criar arquivo específico da sessão

### ESTRUTURA DE ARQUIVOS:
- **Arquivos .json**: Todos de sessões/projetos (podem conflitar)
- **Arquivos .md**: Documentação (não conflitam)
- **Arquivos .lock**: Controle de acesso (temporários)

## Limpeza Automática de Todos

O sistema agora realiza limpeza automática semanal dos arquivos de tarefas (todos), removendo:
- Arquivos vazios
- Arquivos contendo apenas um array vazio "[]"
- Arquivos sem tarefas válidas
- **Arquivos órfãos de projetos que não existem mais**
- Arquivos .lock expirados (mais de 5 )

Para limpar manualmente a qualquer momento:
```bash
~/.claude/clean_todos.sh
```

A limpeza preserva todos os arquivos com tarefas válidas relacionados a projetos ativos em `~/.claude/projects` e o arquivo de documentação todos.md.
