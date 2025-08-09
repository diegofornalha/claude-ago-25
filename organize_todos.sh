#!/bin/bash

# Script para organizar e migrar estrutura de todos
# Uso: ./organize_todos.sh [--migrate] [--cleanup]

TODO_DIR="$HOME/.claude/todos"
BACKUP_DIR="$HOME/.claude/todos.backup.$(date +%Y%m%d_%H%M%S)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========================================="
echo "🗂️  ORGANIZADOR DE TODOS"
echo "========================================="

# Função para fazer backup
backup_todos() {
    echo -e "\n${YELLOW}📦 Criando backup...${NC}"
    
    if [ -d "$TODO_DIR" ]; then
        cp -r "$TODO_DIR" "$BACKUP_DIR"
        echo -e "${GREEN}✅ Backup criado em: $BACKUP_DIR${NC}"
    else
        echo -e "${RED}❌ Diretório de todos não encontrado${NC}"
        exit 1
    fi
}

# Função para criar nova estrutura
create_structure() {
    echo -e "\n${YELLOW}🏗️  Criando nova estrutura...${NC}"
    
    # Criar diretórios principais
    mkdir -p "$TODO_DIR/sessions"
    mkdir -p "$TODO_DIR/projects"
    mkdir -p "$TODO_DIR/global"
    
    # Criar estrutura para projetos conhecidos
    if [ -d "$TODO_DIR/app_todos_bd_tasks" ]; then
        mkdir -p "$TODO_DIR/projects/app_todos_bd_tasks/frontend"
        mkdir -p "$TODO_DIR/projects/app_todos_bd_tasks/backend"
        mkdir -p "$TODO_DIR/projects/app_todos_bd_tasks/rag"
    fi
    
    echo -e "${GREEN}✅ Estrutura criada${NC}"
}

# Função para migrar arquivos existentes
migrate_files() {
    echo -e "\n${YELLOW}🚚 Migrando arquivos...${NC}"
    
    local migrated=0
    
    # Migrar arquivos de sessão (padrão: *-agent-*.json)
    for file in "$TODO_DIR"/*-agent-*.json; do
        if [ -f "$file" ]; then
            local filename=$(basename "$file")
            local session_id=$(echo "$filename" | grep -oE '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
            
            if [ ! -z "$session_id" ]; then
                mkdir -p "$TODO_DIR/sessions/$session_id"
                
                # Não mover, copiar (para segurança)
                cp "$file" "$TODO_DIR/sessions/$session_id/main.json"
                
                # Criar arquivo de contexto
                cat > "$TODO_DIR/sessions/$session_id/context.json" <<EOF
{
  "sessionId": "$session_id",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "originalFile": "$filename",
  "context": "general"
}
EOF
                echo -e "${GREEN}  ✓ Migrado: $filename${NC}"
                migrated=$((migrated + 1))
            fi
        fi
    done
    
    echo -e "${BLUE}📊 Total migrado: $migrated arquivos${NC}"
}

# Função para detectar e separar por contexto
detect_context() {
    echo -e "\n${YELLOW}🔍 Detectando contextos...${NC}"
    
    for file in "$TODO_DIR"/sessions/*/main.json; do
        if [ -f "$file" ]; then
            local session_dir=$(dirname "$file")
            local content=$(cat "$file" 2>/dev/null)
            local context="general"
            
            # Detectar contexto baseado no conteúdo
            if echo "$content" | grep -qi "frontend\|react\|component\|ui"; then
                context="frontend"
            elif echo "$content" | grep -qi "backend\|api\|server\|database"; then
                context="backend"
            elif echo "$content" | grep -qi "rag\|embedding\|vector\|search"; then
                context="rag"
            fi
            
            # Atualizar arquivo de contexto
            if [ -f "$session_dir/context.json" ]; then
                jq ".context = \"$context\"" "$session_dir/context.json" > "$session_dir/context.json.tmp"
                mv "$session_dir/context.json.tmp" "$session_dir/context.json"
                echo -e "${GREEN}  ✓ Contexto detectado: $(basename $session_dir) -> $context${NC}"
            fi
        fi
    done
}

# Função para limpar locks antigos
cleanup_locks() {
    echo -e "\n${YELLOW}🧹 Limpando locks antigos...${NC}"
    
    local removed=0
    
    # Remover locks mais antigos que 5 minutos
    while IFS= read -r lock_file; do
        if [ -f "$lock_file" ]; then
            rm "$lock_file"
            echo -e "${GREEN}  ✓ Removido: $(basename $lock_file)${NC}"
            removed=$((removed + 1))
        fi
    done < <(find "$TODO_DIR" -name "*.lock" -mmin +5 2>/dev/null)
    
    echo -e "${BLUE}📊 Total removido: $removed locks${NC}"
}

# Função para criar arquivo de coordenação
create_coordination_file() {
    echo -e "\n${YELLOW}📝 Criando arquivo de coordenação...${NC}"
    
    cat > "$TODO_DIR/coordination.json" <<EOF
{
  "version": "1.0.0",
  "created": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "structure": {
    "sessions": "Todos isolados por sessão",
    "projects": "Todos compartilhados por projeto",
    "global": "Todos globais do sistema"
  },
  "rules": {
    "lockTimeout": 300,
    "maxRetries": 3,
    "conflictResolution": "lock-based",
    "cleanupInterval": "weekly"
  },
  "stats": {
    "totalSessions": $(find "$TODO_DIR/sessions" -type d -mindepth 1 2>/dev/null | wc -l | tr -d ' '),
    "totalProjects": $(find "$TODO_DIR/projects" -type d -mindepth 1 2>/dev/null | wc -l | tr -d ' '),
    "lastOrganized": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  }
}
EOF
    
    echo -e "${GREEN}✅ Arquivo de coordenação criado${NC}"
}

# Função para mostrar estatísticas
show_stats() {
    echo -e "\n${BLUE}📊 ESTATÍSTICAS:${NC}"
    echo "========================================="
    
    if [ -f "$TODO_DIR/coordination.json" ]; then
        if command -v jq &> /dev/null; then
            jq -r '.stats | to_entries[] | "  \(.key): \(.value)"' "$TODO_DIR/coordination.json"
        fi
    fi
    
    echo "  Arquivos JSON: $(find "$TODO_DIR" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')"
    echo "  Arquivos Lock: $(find "$TODO_DIR" -name "*.lock" 2>/dev/null | wc -l | tr -d ' ')"
    echo "  Tamanho total: $(du -sh "$TODO_DIR" 2>/dev/null | cut -f1)"
    echo "========================================="
}

# Função principal
main() {
    local do_migrate=false
    local do_cleanup=false
    
    # Processar argumentos
    for arg in "$@"; do
        case $arg in
            --migrate)
                do_migrate=true
                ;;
            --cleanup)
                do_cleanup=true
                ;;
            --help)
                echo "Uso: $0 [--migrate] [--cleanup]"
                echo "  --migrate  : Migrar arquivos para nova estrutura"
                echo "  --cleanup  : Limpar locks e arquivos vazios"
                exit 0
                ;;
        esac
    done
    
    # Sempre fazer backup primeiro
    backup_todos
    
    # Executar operações solicitadas
    if [ "$do_migrate" = true ]; then
        create_structure
        migrate_files
        detect_context
        create_coordination_file
    fi
    
    if [ "$do_cleanup" = true ]; then
        cleanup_locks
    fi
    
    # Sempre mostrar estatísticas
    show_stats
    
    echo -e "\n${GREEN}✅ Organização concluída!${NC}"
    
    if [ "$do_migrate" = false ] && [ "$do_cleanup" = false ]; then
        echo -e "${YELLOW}ℹ️  Use --migrate para migrar para nova estrutura${NC}"
        echo -e "${YELLOW}ℹ️  Use --cleanup para limpar locks antigos${NC}"
    fi
}

# Tornar executável e executar
main "$@"