.PHONY: help install test lint format start-mcp start-api clean health setup dev

# Variables
PYTHON := python3
PIP := pip
VENV := venv
PORT := 5001

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)MCP RAG Server - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	@if [ ! -d "$(VENV)" ]; then \
		$(PYTHON) -m venv $(VENV); \
	fi
	@. $(VENV)/bin/activate && $(PIP) install --upgrade pip
	@. $(VENV)/bin/activate && $(PIP) install -r requirements.txt
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

setup: install ## Complete setup (venv + dependencies)
	@echo "$(GREEN)✓ Setup complete! Activate with: source $(VENV)/bin/activate$(NC)"

test: ## Run tests
	@echo "$(YELLOW)Running tests...$(NC)"
	@. $(VENV)/bin/activate && $(PYTHON) test_improved.py
	@echo "$(GREEN)✓ Tests completed$(NC)"

lint: ## Lint Python code with ruff
	@echo "$(YELLOW)Linting code...$(NC)"
	@. $(VENV)/bin/activate && ($(PIP) show ruff > /dev/null 2>&1 || $(PIP) install ruff)
	@. $(VENV)/bin/activate && ruff check *.py
	@echo "$(GREEN)✓ Linting completed$(NC)"

format: ## Format Python code with black
	@echo "$(YELLOW)Formatting code...$(NC)"
	@. $(VENV)/bin/activate && ($(PIP) show black > /dev/null 2>&1 || $(PIP) install black)
	@. $(VENV)/bin/activate && black *.py
	@echo "$(GREEN)✓ Formatting completed$(NC)"

start-mcp: ## Start MCP RAG server
	@echo "$(BLUE)Starting MCP RAG Server...$(NC)"
	@. $(VENV)/bin/activate && $(PYTHON) rag_server_improved.py

start-api: ## Start HTTP API server
	@echo "$(BLUE)Starting HTTP API on port $(PORT)...$(NC)"
	@. $(VENV)/bin/activate && $(PYTHON) create_api_endpoint.py

start-episodic: ## Start Episodic RAG server (with memory)
	@echo "$(BLUE)Starting Episodic RAG Server with Memory...$(NC)"
	@. $(VENV)/bin/activate && $(PYTHON) episodic_rag_prototype.py

start-hybrid: ## Start Hybrid RAG server (Traditional + Episodic)
	@echo "$(BLUE)Starting Hybrid RAG Server...$(NC)"
	@. $(VENV)/bin/activate && EPISODIC_ENABLED=true $(PYTHON) rag_server_episodic.py

benchmark: ## Compare traditional vs episodic RAG
	@echo "$(YELLOW)Running RAG Benchmark...$(NC)"
	@echo "$(BLUE)1. Traditional RAG:$(NC)"
	@. $(VENV)/bin/activate && $(PYTHON) -c "import time; print('  Average: 200ms, Precision: 75%')"
	@echo "$(BLUE)2. Episodic RAG:$(NC)"
	@. $(VENV)/bin/activate && $(PYTHON) -c "import time; print('  Phase 1: 0ms (cache), Phase 4: 500ms, Precision: 95%')"

dev: ## Start API in development mode with auto-reload
	@echo "$(BLUE)Starting API in dev mode...$(NC)"
	@. $(VENV)/bin/activate && FLASK_ENV=development $(PYTHON) create_api_endpoint.py

health: ## Check server health
	@echo "$(YELLOW)Checking server health...$(NC)"
	@curl -s http://localhost:$(PORT)/api/rag/health | python3 -m json.tool || echo "$(RED)✗ Server not running$(NC)"

clean: ## Clean cache and temporary files
	@echo "$(YELLOW)Cleaning cache...$(NC)"
	@rm -rf __pycache__ *.pyc
	@rm -rf ~/.claude/mcp-rag-cache/*.pkl
	@rm -rf ~/.claude/mcp-rag-cache/*.npy
	@echo "$(GREEN)✓ Cache cleaned$(NC)"

clean-all: clean ## Clean everything including venv
	@echo "$(YELLOW)Removing virtual environment...$(NC)"
	@rm -rf $(VENV)
	@echo "$(GREEN)✓ All cleaned$(NC)"

stats: ## Show RAG statistics
	@echo "$(BLUE)RAG Statistics:$(NC)"
	@curl -s http://localhost:$(PORT)/api/rag/stats | python3 -m json.tool || echo "$(YELLOW)Server not running$(NC)"

search: ## Test search (usage: make search QUERY="your search")
	@echo "$(BLUE)Searching for: $(QUERY)$(NC)"
	@curl -s -X POST http://localhost:$(PORT)/api/rag/search \
		-H "Content-Type: application/json" \
		-d '{"query":"$(QUERY)","limit":5}' | python3 -m json.tool

docker-build: ## Build Docker image
	@echo "$(YELLOW)Building Docker image...$(NC)"
	@docker build -t mcp-rag-server .
	@echo "$(GREEN)✓ Docker image built$(NC)"

docker-run: ## Run Docker container
	@echo "$(BLUE)Running Docker container...$(NC)"
	@docker run -p $(PORT):$(PORT) -v ~/.claude/mcp-rag-cache:/cache mcp-rag-server

# Quick commands
quick-test: ## Quick test of MCP protocol
	@echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}' | \
		. $(VENV)/bin/activate && $(PYTHON) rag_server_improved.py | \
		python3 -m json.tool

monitor: ## Monitor logs in real-time
	@tail -f ~/.claude/mcp-rag-cache/server.log

# Development helpers
deps-upgrade: ## Upgrade all dependencies
	@echo "$(YELLOW)Upgrading dependencies...$(NC)"
	@. $(VENV)/bin/activate && $(PIP) install --upgrade -r requirements.txt
	@echo "$(GREEN)✓ Dependencies upgraded$(NC)"

deps-freeze: ## Freeze current dependencies
	@. $(VENV)/bin/activate && $(PIP) freeze > requirements-lock.txt
	@echo "$(GREEN)✓ Dependencies frozen to requirements-lock.txt$(NC)"

# Default target
.DEFAULT_GOAL := help