#!/bin/bash

# Hook para executar após operações com todos
# Limpa locks e faz manutenção

SESSION_ID="${1:-unknown}"
OPERATION="${2:-write}"
CONTEXT="${3:-general}"

TODO_DIR="$HOME/.claude/todos"
LOG_FILE="$TODO_DIR/operations.log"

# Cores
GREEN='\033[0;32m'
NC='\033[0m'

# Remover lock da sessão
remove_lock() {
    local lock_file="$TODO_DIR/sessions/$SESSION_ID/$SESSION_ID.lock"
    if [ -f "$lock_file" ]; then
        rm "$lock_file"
        echo -e "${GREEN}🔓 Lock removido para sessão $SESSION_ID${NC}"
    fi
}

# Log de conclusão
log_completion() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SESSION=$SESSION_ID OPERATION=$OPERATION STATUS=completed" >> "$LOG_FILE"
}

# Limpeza de locks expirados
cleanup_expired_locks() {
    local cleaned=0
    
    if [ -d "$TODO_DIR" ]; then
        while IFS= read -r lock_file; do
            if [ -f "$lock_file" ]; then
                rm "$lock_file"
                cleaned=$((cleaned + 1))
            fi
        done < <(find "$TODO_DIR" -name "*.lock" -mmin +5 2>/dev/null)
    fi
    
    if [ $cleaned -gt 0 ]; then
        echo -e "${GREEN}🧹 $cleaned lock(s) expirado(s) removido(s)${NC}"
    fi
}

# Main
main() {
    echo "=== POST-TODO OPERATION HOOK ==="
    
    # Remover lock se foi uma operação de escrita
    if [ "$OPERATION" = "write" ] || [ "$OPERATION" = "delete" ]; then
        remove_lock
    fi
    
    # Log de conclusão
    log_completion
    
    # Limpeza periódica
    cleanup_expired_locks
    
    echo -e "${GREEN}✅ Operação concluída${NC}"
    echo "================================"
    
    exit 0
}

main