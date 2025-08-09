#!/bin/bash

echo "🚀 Iniciando integração Claude Sessions..."

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Diretório base
BASE_DIR="/Users/agents/.claude/todos/app_todos_bd_tasks"

echo -e "${BLUE}📦 Instalando dependências...${NC}"

# Backend
echo -e "${YELLOW}Backend:${NC}"
cd "$BASE_DIR/backend"
if [ ! -d "node_modules" ]; then
    pnpm install
fi

# Frontend
echo -e "${YELLOW}Frontend:${NC}"
cd "$BASE_DIR/frontend"
if [ ! -d "node_modules" ]; then
    pnpm install
    pnpm add date-fns
fi

echo -e "${GREEN}✅ Dependências instaladas!${NC}"

# Função para verificar se porta está em uso
check_port() {
    lsof -i :$1 >/dev/null 2>&1
    return $?
}

# Função para matar processo em uma porta
kill_port() {
    lsof -i :$1 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null
}

# Iniciar serviços
echo -e "${BLUE}🔧 Iniciando serviços...${NC}"

# Backend
cd "$BASE_DIR/backend"
if check_port 3344; then
    echo -e "${YELLOW}Porta 3344 já está em uso. Liberando...${NC}"
    kill_port 3344
    sleep 2
fi
echo -e "${YELLOW}Iniciando backend na porta 3344...${NC}"
pnpm dev &
BACKEND_PID=$!

sleep 3

# Frontend
cd "$BASE_DIR/frontend"
if check_port 5173; then
    echo -e "${YELLOW}Porta 5173 já está em uso. Liberando...${NC}"
    kill_port 5173
    sleep 2
fi
echo -e "${YELLOW}Iniciando frontend na porta 5173...${NC}"
pnpm dev &
FRONTEND_PID=$!

echo -e "${GREEN}✅ Serviços iniciados!${NC}"
echo ""
echo -e "${BLUE}URLs:${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3344"
echo "  Claude Sessions: http://localhost:5173/claude-sessions"
echo ""
echo -e "${YELLOW}PIDs dos processos:${NC}"
echo "  Backend: $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo -e "${RED}Para parar os serviços, execute:${NC}"
echo "  kill $BACKEND_PID $FRONTEND_PID"

# Manter script rodando
wait