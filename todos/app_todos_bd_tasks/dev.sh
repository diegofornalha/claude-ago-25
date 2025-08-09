#!/bin/bash

# Script de desenvolvimento para gerenciar backend e frontend
# Uso: ./dev.sh [comando]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretórios
BACKEND_DIR="./backend"
FRONTEND_DIR="./frontend"

# Função para exibir ajuda
show_help() {
    echo -e "${BLUE}=== Script de Desenvolvimento ===${NC}"
    echo ""
    echo "Uso: ./dev.sh [comando]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  start         - Inicia backend e frontend"
    echo "  stop          - Para todos os serviços"
    echo "  restart       - Reinicia todos os serviços"
    echo "  clean         - Limpa caches e arquivos temporários"
    echo "  clean-start   - Limpa e inicia os serviços"
    echo "  status        - Verifica status dos serviços"
    echo "  logs          - Mostra logs dos serviços"
    echo "  install       - Instala dependências"
    echo "  db-reset      - Reseta banco de dados (migrate + seed)"
    echo "  help          - Mostra esta ajuda"
    echo ""
}

# Função para verificar se um processo está rodando
check_process() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Função para limpar caches
clean_caches() {
    echo -e "${YELLOW}🧹 Limpando caches e arquivos temporários...${NC}"
    
    # Backend
    echo -e "${BLUE}Backend:${NC}"
    rm -rf $BACKEND_DIR/dist
    rm -rf $BACKEND_DIR/.tsbuildinfo
    rm -rf $BACKEND_DIR/node_modules/.cache
    rm -rf $BACKEND_DIR/node_modules/.vite
    echo "  ✓ Cache do backend limpo"
    
    # Frontend
    echo -e "${BLUE}Frontend:${NC}"
    rm -rf $FRONTEND_DIR/dist
    rm -rf $FRONTEND_DIR/node_modules/.cache
    rm -rf $FRONTEND_DIR/node_modules/.vite
    rm -rf $FRONTEND_DIR/.vite
    echo "  ✓ Cache do frontend limpo"
    
    # Limpar cache do navegador (IndexedDB)
    echo -e "${YELLOW}⚠️  Para limpar o IndexedDB do navegador:${NC}"
    echo "  1. Abra o DevTools (F12)"
    echo "  2. Application > Storage > Clear site data"
    
    echo -e "${GREEN}✅ Limpeza concluída!${NC}"
}

# Função para parar serviços
stop_services() {
    echo -e "${YELLOW}🛑 Parando serviços...${NC}"
    
    # Para processos nas portas específicas
    if check_process 3344; then
        echo "  Parando backend (porta 3344)..."
        kill $(lsof -t -i:3344) 2>/dev/null || true
    fi
    
    if check_process 5173; then
        echo "  Parando frontend (porta 5173)..."
        kill $(lsof -t -i:5173) 2>/dev/null || true
    fi
    
    # Para processos node específicos do projeto
    pkill -f "node.*server.ts" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    sleep 2
    echo -e "${GREEN}✅ Serviços parados!${NC}"
}

# Função para iniciar serviços
start_services() {
    echo -e "${YELLOW}🚀 Iniciando serviços...${NC}"
    
    # Verifica se as portas estão livres
    if check_process 3344; then
        echo -e "${RED}❌ Backend já está rodando na porta 3344${NC}"
        echo "   Use './dev.sh restart' para reiniciar"
        exit 1
    fi
    
    if check_process 5173; then
        echo -e "${RED}❌ Frontend já está rodando na porta 5173${NC}"
        echo "   Use './dev.sh restart' para reiniciar"
        exit 1
    fi
    
    # Inicia backend
    echo -e "${BLUE}Iniciando backend...${NC}"
    cd $BACKEND_DIR
    pnpm dev > ../backend.log 2>&1 &
    cd ..
    
    # Inicia frontend
    echo -e "${BLUE}Iniciando frontend...${NC}"
    cd $FRONTEND_DIR
    pnpm dev > ../frontend.log 2>&1 &
    cd ..
    
    # Aguarda inicialização
    sleep 3
    
    # Verifica se iniciaram corretamente
    if check_process 3344; then
        echo -e "  ${GREEN}✓ Backend rodando em http://localhost:3344${NC}"
    else
        echo -e "  ${RED}✗ Falha ao iniciar backend${NC}"
    fi
    
    if check_process 5173; then
        echo -e "  ${GREEN}✓ Frontend rodando em http://localhost:5173${NC}"
    else
        echo -e "  ${RED}✗ Falha ao iniciar frontend${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}💡 Dica: Use './dev.sh logs' para ver os logs${NC}"
}

# Função para mostrar status
show_status() {
    echo -e "${BLUE}=== Status dos Serviços ===${NC}"
    echo ""
    
    if check_process 3344; then
        echo -e "Backend:  ${GREEN}● Rodando${NC} (porta 3344)"
    else
        echo -e "Backend:  ${RED}○ Parado${NC}"
    fi
    
    if check_process 5173; then
        echo -e "Frontend: ${GREEN}● Rodando${NC} (porta 5173)"
    else
        echo -e "Frontend: ${RED}○ Parado${NC}"
    fi
    
    # Verifica PostgreSQL
    if pg_isready -q 2>/dev/null; then
        echo -e "Postgres: ${GREEN}● Rodando${NC}"
    else
        echo -e "Postgres: ${YELLOW}○ Não detectado${NC} (verifique sua instalação)"
    fi
}

# Função para mostrar logs
show_logs() {
    echo -e "${BLUE}=== Logs dos Serviços ===${NC}"
    echo ""
    echo "Mostrando últimas 20 linhas de cada log..."
    echo ""
    
    if [ -f backend.log ]; then
        echo -e "${BLUE}--- Backend ---${NC}"
        tail -20 backend.log
    fi
    
    echo ""
    
    if [ -f frontend.log ]; then
        echo -e "${BLUE}--- Frontend ---${NC}"
        tail -20 frontend.log
    fi
    
    echo ""
    echo -e "${YELLOW}💡 Para acompanhar em tempo real use:${NC}"
    echo "   tail -f backend.log"
    echo "   tail -f frontend.log"
}

# Função para instalar dependências
install_deps() {
    echo -e "${YELLOW}📦 Instalando dependências...${NC}"
    
    echo -e "${BLUE}Backend:${NC}"
    cd $BACKEND_DIR
    pnpm install
    cd ..
    
    echo -e "${BLUE}Frontend:${NC}"
    cd $FRONTEND_DIR
    pnpm install
    pnpm compile-migrations
    cd ..
    
    echo -e "${GREEN}✅ Dependências instaladas!${NC}"
}

# Função para resetar banco de dados
reset_db() {
    echo -e "${YELLOW}🗄️  Resetando banco de dados...${NC}"
    
    cd $BACKEND_DIR
    
    echo "  Executando migrations..."
    pnpm db:migrate
    
    echo "  Populando com dados de exemplo..."
    pnpm db:seed
    
    cd ..
    
    echo -e "${GREEN}✅ Banco de dados resetado!${NC}"
}

# Main - processar comando
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        start_services
        ;;
    clean)
        clean_caches
        ;;
    clean-start)
        stop_services
        clean_caches
        start_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    install)
        install_deps
        ;;
    db-reset)
        reset_db
        ;;
    help|"")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Comando inválido: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac