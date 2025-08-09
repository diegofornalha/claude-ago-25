#!/bin/bash

# Hook para executar antes de operações com todos
# Este script deve ser chamado automaticamente pelo Claude

SESSION_ID="${1:-unknown}"
OPERATION="${2:-write}"
CONTEXT="${3:-general}"

# Diretório base
TODO_DIR="$HOME/.claude/todos"
CONTEXTS_FILE="$HOME/.claude/session_contexts.json"
LOG_FILE="$TODO_DIR/operations.log"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Função de log
log_operation() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SESSION=$SESSION_ID OPERATION=$OPERATION CONTEXT=$CONTEXT" >> "$LOG_FILE"
}

# Verificar se sessão tem contexto definido
get_session_context() {
    if [ -f "$CONTEXTS_FILE" ] && command -v jq &> /dev/null; then
        local ctx=$(jq -r ".sessions.\"$SESSION_ID\".context // \"general\"" "$CONTEXTS_FILE" 2>/dev/null)
        echo "$ctx"
    else
        echo "general"
    fi
}

# Verificar conflitos
check_conflicts() {
    local has_conflict=false
    
    # Procurar locks ativos de outras sessões
    if [ -d "$TODO_DIR" ]; then
        while IFS= read -r lock_file; do
            if [ -f "$lock_file" ]; then
                local lock_session=$(basename "$lock_file" .lock)
                if [ "$lock_session" != "$SESSION_ID" ]; then
                    echo -e "${YELLOW}⚠️  Conflito detectado: Sessão $lock_session tem lock ativo${NC}"
                    has_conflict=true
                fi
            fi
        done < <(find "$TODO_DIR" -name "*.lock" -mmin -5 2>/dev/null)
    fi
    
    if [ "$has_conflict" = true ]; then
        return 1
    fi
    return 0
}

# Criar lock se necessário
create_lock() {
    if [ "$OPERATION" = "write" ] || [ "$OPERATION" = "delete" ]; then
        local lock_file="$TODO_DIR/sessions/$SESSION_ID/$SESSION_ID.lock"
        mkdir -p "$(dirname "$lock_file")"
        
        cat > "$lock_file" <<EOF
{
  "sessionId": "$SESSION_ID",
  "lockedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "context": "$CONTEXT",
  "operation": "$OPERATION"
}
EOF
        echo -e "${GREEN}🔒 Lock criado para sessão $SESSION_ID${NC}"
    fi
}

# Main
main() {
    echo "=== PRE-TODO OPERATION HOOK ==="
    echo "Sessão: $SESSION_ID"
    echo "Operação: $OPERATION"
    echo "Contexto: $CONTEXT"
    
    # Log da operação
    log_operation
    
    # Obter contexto da sessão
    DETECTED_CONTEXT=$(get_session_context)
    if [ "$DETECTED_CONTEXT" != "$CONTEXT" ]; then
        echo -e "${YELLOW}ℹ️  Contexto ajustado: $CONTEXT -> $DETECTED_CONTEXT${NC}"
        CONTEXT="$DETECTED_CONTEXT"
    fi
    
    # Verificar conflitos
    if ! check_conflicts; then
        echo -e "${RED}❌ Operação bloqueada devido a conflitos${NC}"
        echo "Aguarde o lock ser liberado ou use contexto diferente"
        exit 1
    fi
    
    # Criar lock se necessário
    create_lock
    
    echo -e "${GREEN}✅ Operação autorizada${NC}"
    echo "==============================="
    
    exit 0
}

main