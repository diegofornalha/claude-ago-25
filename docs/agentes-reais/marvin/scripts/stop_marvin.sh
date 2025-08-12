#!/bin/bash
# Script automático para parar Marvin

echo "🛑 Parando Marvin A2A Agent..."

# Configurações
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MARVIN_DIR="$(dirname "$SCRIPT_DIR")"
PORT=9998
LOG_DIR="$MARVIN_DIR/logs"
PID_FILE="$LOG_DIR/marvin.pid"

# Parar processo usando PID file
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "⏳ Aguardando processo terminar..."
        sleep 2
        
        # Forçar se ainda estiver rodando
        if ps -p $PID > /dev/null 2>&1; then
            kill -9 $PID 2>/dev/null || true
        fi
        
        rm -f "$PID_FILE"
        echo "✅ Marvin parado com sucesso"
    else
        echo "⚠️  Processo não encontrado (PID: $PID)"
        rm -f "$PID_FILE"
    fi
else
    echo "⚠️  Marvin não está rodando (PID file não encontrado)"
fi

# Garantir que a porta está liberada
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "🔧 Liberando porta $PORT..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    echo "✅ Porta $PORT liberada"
fi

echo ""
echo "🎯 Marvin foi parado completamente"
echo "   Para iniciar novamente: ./start_marvin.sh"