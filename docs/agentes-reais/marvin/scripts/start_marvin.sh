#!/bin/bash
# Script automático para iniciar Marvin - Sem comandos, apenas executa

echo "🤖 Iniciando Marvin A2A Agent..."
echo "================================"

# Configurações
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MARVIN_DIR="$(dirname "$SCRIPT_DIR")"
PORT=9998
LOG_DIR="$MARVIN_DIR/logs"
PID_FILE="$LOG_DIR/marvin.pid"
LOG_FILE="$LOG_DIR/marvin.log"

# Criar diretório de logs
mkdir -p "$LOG_DIR"

# Verificar se já está rodando
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Marvin já está rodando (PID: $PID)"
        echo "   URL: http://localhost:$PORT"
        echo "   Logs: tail -f $LOG_FILE"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

# Verificar se a porta está em uso
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Porta $PORT já está em uso. Liberando..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

cd "$MARVIN_DIR"

# Configurar ambiente Python
echo "📦 Preparando ambiente..."
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif command -v uv &> /dev/null; then
    uv venv
    source .venv/bin/activate
    uv pip install -e . > /dev/null 2>&1
else
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -e . > /dev/null 2>&1
fi

# Exportar variáveis
export PORT=$PORT
export A2A_PORT=$PORT
export MARVIN_PORT=$PORT

# Iniciar servidor
echo "🚀 Iniciando servidor na porta $PORT..."
if command -v uv &> /dev/null && [ -f "pyproject.toml" ]; then
    nohup uv run python src/server.py > "$LOG_FILE" 2>&1 &
else
    nohup python src/server.py > "$LOG_FILE" 2>&1 &
fi

PID=$!
echo $PID > "$PID_FILE"

# Aguardar inicialização
echo "⏳ Aguardando servidor iniciar..."
for i in {1..10}; do
    if curl -s --max-time 1 "http://localhost:$PORT/.well-known/agent.json" >/dev/null 2>&1; then
        echo ""
        echo "✅ Marvin iniciado com sucesso!"
        echo ""
        echo "📊 Informações:"
        echo "   • Nome: Marvin A2A Agent"
        echo "   • Porta: $PORT"
        echo "   • PID: $PID"
        echo "   • URL: http://localhost:$PORT"
        echo ""
        echo "🔗 Endpoints A2A:"
        echo "   • Discovery: http://localhost:$PORT/.well-known/agent.json"
        echo "   • Tasks: http://localhost:$PORT/tasks"
        echo ""
        echo "📋 Para ver logs: tail -f $LOG_FILE"
        echo "🛑 Para parar: ./stop_marvin.sh"
        exit 0
    fi
    sleep 1
    echo -n "."
done

# Se não conseguiu iniciar
echo ""
echo "❌ Falha ao iniciar Marvin"
echo "   Verifique os logs: cat $LOG_FILE"
rm -f "$PID_FILE"
exit 1