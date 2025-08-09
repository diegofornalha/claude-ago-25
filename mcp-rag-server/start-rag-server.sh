#!/bin/bash
# start-rag-server.sh - Script wrapper para iniciar MCP RAG Server com variáveis de ambiente

echo "🚀 Iniciando MCP RAG Server com configuração correta..."

# Definir variáveis de ambiente para o RAG Server
export RAG_MODEL="all-MiniLM-L6-v2"
export RAG_CACHE_DIR="$HOME/.claude/mcp-rag-cache"
export RAG_LOG_LEVEL="INFO"
export RAG_MAX_DOCUMENTS="10000"
export RAG_EMBEDDING_BATCH_SIZE="32"
export PYTHONPATH="/Users/agents/.claude/mcp-rag-server"

echo "📊 Variáveis de ambiente configuradas:"
echo "RAG_MODEL: $RAG_MODEL"
echo "RAG_CACHE_DIR: $RAG_CACHE_DIR"
echo "RAG_LOG_LEVEL: $RAG_LOG_LEVEL"
echo "RAG_MAX_DOCUMENTS: $RAG_MAX_DOCUMENTS"
echo "PYTHONPATH: $PYTHONPATH"

# Mudar para o diretório correto
cd "$(dirname "$0")"

# Verificar se o ambiente virtual existe
if [ ! -d "venv" ]; then
    echo "⚠️  Ambiente virtual não encontrado. Criando..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    echo "✅ Usando ambiente virtual existente"
fi

# Verificar se o diretório de cache existe
if [ ! -d "$RAG_CACHE_DIR" ]; then
    echo "📁 Criando diretório de cache..."
    mkdir -p "$RAG_CACHE_DIR"
fi

# Iniciar o MCP RAG Server diretamente
echo "🔄 Iniciando servidor..."
exec /Users/agents/.claude/mcp-rag-server/venv/bin/python /Users/agents/.claude/mcp-rag-server/rag_server.py