#!/bin/bash

# Script para verificar conflitos entre sessões de todos
# Uso: ./check_todo_conflicts.sh [session-id] [context]

TODO_DIR="$HOME/.claude/todos"
SESSION_ID="${1:-$(uuidgen)}"
CONTEXT="${2:-general}"
TIMESTAMP=$(date +%s)

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "📋 VERIFICADOR DE CONFLITOS DE TODOS"
echo "========================================="
echo "Sessão: $SESSION_ID"
echo "Contexto: $CONTEXT"
echo "Timestamp: $(date)"
echo "-----------------------------------------"

# Função para verificar locks ativos
check_active_locks() {
    echo -e "\n${YELLOW}🔍 Verificando locks ativos...${NC}"
    
    # Procurar por arquivos .lock criados nos últimos 5 minutos
    local lock_count=0
    
    if [ -d "$TODO_DIR" ]; then
        while IFS= read -r lock_file; do
            if [ -f "$lock_file" ]; then
                lock_count=$((lock_count + 1))
                echo -e "${RED}⚠️  Lock encontrado: $(basename $lock_file)${NC}"
                
                # Tentar ler conteúdo do lock se for JSON
                if command -v jq &> /dev/null; then
                    jq -r '. | "   Sessão: \(.sessionId // "unknown")\n   Contexto: \(.context // "unknown")\n   Criado: \(.lockedAt // "unknown")"' "$lock_file" 2>/dev/null || cat "$lock_file"
                else
                    cat "$lock_file"
                fi
            fi
        done < <(find "$TODO_DIR" -name "*.lock" -mmin -5 2>/dev/null)
    fi
    
    if [ $lock_count -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhum lock ativo encontrado${NC}"
        return 0
    else
        echo -e "${RED}❌ $lock_count lock(s) ativo(s) encontrado(s)${NC}"
        return 1
    fi
}

# Função para verificar arquivos de todos recentemente modificados
check_recent_modifications() {
    echo -e "\n${YELLOW}🔍 Verificando modificações recentes...${NC}"
    
    local mod_count=0
    
    if [ -d "$TODO_DIR" ]; then
        while IFS= read -r todo_file; do
            if [ -f "$todo_file" ]; then
                mod_count=$((mod_count + 1))
                local filename=$(basename "$todo_file")
                local mod_time=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$todo_file" 2>/dev/null || stat -c "%y" "$todo_file" 2>/dev/null | cut -d' ' -f1,2)
                
                # Verificar se é de outra sessão
                if [[ ! "$filename" =~ "$SESSION_ID" ]]; then
                    echo -e "${YELLOW}⚠️  Arquivo de outra sessão: $filename${NC}"
                    echo "   Modificado: $mod_time"
                    
                    # Extrair sessão do nome do arquivo
                    local other_session=$(echo "$filename" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
                    if [ ! -z "$other_session" ] && [ "$other_session" != "$SESSION_ID" ]; then
                        echo -e "   ${RED}Sessão: $other_session${NC}"
                    fi
                fi
            fi
        done < <(find "$TODO_DIR" -name "*.json" -mmin -10 2>/dev/null)
    fi
    
    if [ $mod_count -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhuma modificação recente${NC}"
    else
        echo -e "${YELLOW}⚠️  $mod_count arquivo(s) modificado(s) nos últimos 10 minutos${NC}"
    fi
}

# Função para sugerir arquivo seguro para usar
suggest_safe_file() {
    echo -e "\n${YELLOW}💡 Sugestão de arquivo seguro:${NC}"
    
    local safe_file=""
    
    # Para projetos conhecidos
    if [[ "$PWD" == *"app_todos_bd_tasks"* ]]; then
        safe_file="$TODO_DIR/app_todos_bd_tasks/${CONTEXT}/${SESSION_ID}.json"
        echo -e "${GREEN}Projeto detectado: app_todos_bd_tasks${NC}"
    else
        safe_file="$TODO_DIR/${SESSION_ID}-agent-${SESSION_ID}.json"
    fi
    
    echo -e "${GREEN}📁 Use: $safe_file${NC}"
    
    # Criar diretório se necessário
    local dir=$(dirname "$safe_file")
    if [ ! -d "$dir" ]; then
        echo "   Criando diretório: $dir"
        mkdir -p "$dir"
    fi
}

# Função para criar lock
create_lock() {
    local lock_file="$1"
    local lock_data=$(cat <<EOF
{
  "sessionId": "$SESSION_ID",
  "lockedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "expiresAt": "$(date -u -d '+5 minutes' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+5M +"%Y-%m-%dT%H:%M:%SZ")",
  "context": "$CONTEXT",
  "operation": "write"
}
EOF
)
    echo "$lock_data" > "$lock_file"
    echo -e "${GREEN}🔒 Lock criado: $(basename $lock_file)${NC}"
}

# Função principal
main() {
    local has_conflicts=false
    
    # Verificar locks
    if ! check_active_locks; then
        has_conflicts=true
    fi
    
    # Verificar modificações recentes
    check_recent_modifications
    
    # Sugerir arquivo seguro
    suggest_safe_file
    
    # Resumo
    echo -e "\n========================================="
    if [ "$has_conflicts" = true ]; then
        echo -e "${RED}⚠️  CONFLITOS DETECTADOS${NC}"
        echo "Recomendação: Aguarde os locks expirarem ou use contexto diferente"
    else
        echo -e "${GREEN}✅ SISTEMA LIVRE DE CONFLITOS${NC}"
        echo "Seguro para prosseguir com operações de todos"
    fi
    echo "========================================="
    
    # Retornar código de saída apropriado
    if [ "$has_conflicts" = true ]; then
        exit 1
    else
        exit 0
    fi
}

# Executar
main