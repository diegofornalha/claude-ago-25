#!/bin/bash

# Script de setup do banco de dados PostgreSQL local

echo "🚀 Configurando banco de dados local..."

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verifica se PostgreSQL está rodando
if ! pg_isready -q; then
    echo -e "${RED}❌ PostgreSQL não está rodando!${NC}"
    echo "Por favor, inicie o PostgreSQL primeiro:"
    echo "  macOS: brew services start postgresql@14"
    echo "  Linux: sudo systemctl start postgresql"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL está rodando${NC}"

# Cria o banco de dados se não existir
echo "📦 Criando banco de dados 'electric'..."
createdb electric 2>/dev/null || echo "Banco 'electric' já existe"

# Verifica conexão
if psql -d electric -c '\q' 2>/dev/null; then
    echo -e "${GREEN}✓ Conexão com banco estabelecida${NC}"
else
    echo -e "${RED}❌ Erro ao conectar ao banco${NC}"
    exit 1
fi

# Executa migrations
echo "🔄 Executando migrations..."
pnpm db:migrate

# Pergunta se deseja popular o banco
read -p "Deseja popular o banco com dados de exemplo? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Populando banco de dados..."
    pnpm db:seed
fi

echo -e "${GREEN}✅ Setup concluído com sucesso!${NC}"
echo ""
echo "Para iniciar o servidor, execute:"
echo "  pnpm dev"