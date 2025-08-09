# Makefile para desenvolvimento do projeto Node Local DB
# Uso: make [comando]

.PHONY: help start stop restart clean clean-start status logs install db-reset test lint format check

# Comando padrão
.DEFAULT_GOAL := help

# Cores para output
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
RED := \033[0;31m
NC := \033[0m # No Color

# Diretórios
BACKEND_DIR := backend
FRONTEND_DIR := frontend

## help: Mostra esta mensagem de ajuda
help:
	@echo "$(BLUE)=== Node Local DB - Comandos Make ===$(NC)"
	@echo ""
	@echo "Uso: make [comando]"
	@echo ""
	@grep -E '^##' Makefile | sed 's/## //'
	@echo ""

## start: Inicia backend e frontend
start:
	@./dev.sh start

## stop: Para todos os serviços
stop:
	@./dev.sh stop

## restart: Reinicia todos os serviços
restart:
	@./dev.sh restart

## clean: Limpa caches e arquivos temporários
clean:
	@./dev.sh clean

## clean-start: Limpa caches e reinicia os serviços
clean-start:
	@./dev.sh clean-start

## status: Verifica status dos serviços
status:
	@./dev.sh status

## logs: Mostra logs dos serviços
logs:
	@./dev.sh logs

## install: Instala todas as dependências
install:
	@./dev.sh install

## db-reset: Reseta banco de dados (migrate + seed)
db-reset:
	@./dev.sh db-reset

## test: Executa testes do backend
test:
	@echo "$(YELLOW)🧪 Executando testes...$(NC)"
	@cd $(BACKEND_DIR) && pnpm test

## test-ui: Executa testes com interface visual
test-ui:
	@echo "$(YELLOW)🧪 Abrindo interface de testes...$(NC)"
	@cd $(BACKEND_DIR) && pnpm test:ui

## test-coverage: Executa testes com cobertura
test-coverage:
	@echo "$(YELLOW)📊 Gerando relatório de cobertura...$(NC)"
	@cd $(BACKEND_DIR) && pnpm test:coverage

## lint: Verifica código com linter
lint:
	@echo "$(YELLOW)🔍 Verificando código...$(NC)"
	@echo "$(BLUE)Backend:$(NC)"
	@cd $(BACKEND_DIR) && pnpm lint
	@echo "$(BLUE)Frontend:$(NC)"
	@cd $(FRONTEND_DIR) && pnpm lint

## lint-fix: Corrige problemas de lint automaticamente
lint-fix:
	@echo "$(YELLOW)🔧 Corrigindo código...$(NC)"
	@echo "$(BLUE)Backend:$(NC)"
	@cd $(BACKEND_DIR) && pnpm lint:fix
	@echo "$(BLUE)Frontend:$(NC)"
	@cd $(FRONTEND_DIR) && pnpm lint --fix

## format: Formata código com prettier
format:
	@echo "$(YELLOW)✨ Formatando código...$(NC)"
	@cd $(BACKEND_DIR) && pnpm format

## format-check: Verifica formatação do código
format-check:
	@echo "$(YELLOW)🔍 Verificando formatação...$(NC)"
	@cd $(BACKEND_DIR) && pnpm format:check

## build: Compila o projeto para produção
build:
	@echo "$(YELLOW)🏗️  Compilando projeto...$(NC)"
	@echo "$(BLUE)Backend:$(NC)"
	@cd $(BACKEND_DIR) && pnpm build
	@echo "$(BLUE)Frontend:$(NC)"
	@cd $(FRONTEND_DIR) && pnpm build

## typecheck: Verifica tipos TypeScript
typecheck:
	@echo "$(YELLOW)🔍 Verificando tipos...$(NC)"
	@cd $(BACKEND_DIR) && pnpm typecheck

## db-generate: Gera migrations do schema
db-generate:
	@echo "$(YELLOW)🗄️  Gerando migrations...$(NC)"
	@cd $(BACKEND_DIR) && pnpm db:generate

## db-migrate: Aplica migrations
db-migrate:
	@echo "$(YELLOW)🗄️  Aplicando migrations...$(NC)"
	@cd $(BACKEND_DIR) && pnpm db:migrate

## db-seed: Popula banco com dados de exemplo
db-seed:
	@echo "$(YELLOW)🌱 Populando banco de dados...$(NC)"
	@cd $(BACKEND_DIR) && pnpm db:seed

## api-docs: Abre documentação da API
api-docs:
	@echo "$(BLUE)📚 Abrindo documentação da API...$(NC)"
	@open http://localhost:3344/docs || xdg-open http://localhost:3344/docs

## dev: Atalho para desenvolvimento (clean-start + logs em nova janela)
dev:
	@make clean-start
	@echo ""
	@echo "$(GREEN)✅ Projeto iniciado!$(NC)"
	@echo ""
	@echo "$(BLUE)URLs:$(NC)"
	@echo "  Frontend: http://localhost:5173"
	@echo "  Backend:  http://localhost:3344"
	@echo "  API Docs: http://localhost:3344/docs"
	@echo ""
	@echo "$(YELLOW)💡 Para ver logs em tempo real:$(NC)"
	@echo "  make logs"

## check: Executa todas as verificações (lint, format, typecheck, test)
check:
	@echo "$(YELLOW)🔍 Executando todas as verificações...$(NC)"
	@make lint
	@make format-check
	@make typecheck
	@make test
	@echo "$(GREEN)✅ Todas as verificações passaram!$(NC)"

## update: Atualiza dependências
update:
	@echo "$(YELLOW)📦 Atualizando dependências...$(NC)"
	@echo "$(BLUE)Backend:$(NC)"
	@cd $(BACKEND_DIR) && pnpm update
	@echo "$(BLUE)Frontend:$(NC)"
	@cd $(FRONTEND_DIR) && pnpm update

## docker-up: Inicia containers Docker (futuro)
docker-up:
	@echo "$(RED)❌ Docker ainda não configurado$(NC)"
	@echo "   Esta funcionalidade será implementada em breve"

## docker-down: Para containers Docker (futuro)
docker-down:
	@echo "$(RED)❌ Docker ainda não configurado$(NC)"
	@echo "   Esta funcionalidade será implementada em breve"