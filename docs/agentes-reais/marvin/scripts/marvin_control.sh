#!/bin/bash
# Script de controle para o Marvin Agent Daemon
# Uso: ./marvin_control.sh [start|stop|restart|status|logs]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MARVIN_DIR="$(dirname "$SCRIPT_DIR")"
DAEMON_SCRIPT="$MARVIN_DIR/src/marvin_daemon.py"
LOG_FILE="$MARVIN_DIR/logs/marvin_daemon.log"

cd "$MARVIN_DIR"

case "$1" in
    start)
        echo "🚀 Iniciando Marvin Daemon..."
        python3 "$DAEMON_SCRIPT" start &
        sleep 2
        python3 "$DAEMON_SCRIPT" status
        ;;
    stop)
        echo "🛑 Parando Marvin Daemon..."
        python3 "$DAEMON_SCRIPT" stop
        ;;
    restart)
        echo "🔄 Reiniciando Marvin Daemon..."
        python3 "$DAEMON_SCRIPT" restart &
        sleep 2
        python3 "$DAEMON_SCRIPT" status
        ;;
    status)
        python3 "$DAEMON_SCRIPT" status
        ;;
    logs)
        echo "📋 Logs do Marvin Daemon:"
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "❌ Arquivo de log não encontrado: $LOG_FILE"
        fi
        ;;
    *)
        echo "Uso: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Comandos:"
        echo "  start   - Inicia o daemon do Marvin (auto-restart)"
        echo "  stop    - Para o daemon do Marvin"
        echo "  restart - Reinicia o daemon do Marvin"
        echo "  status  - Mostra o status atual"
        echo "  logs    - Mostra os logs em tempo real"
        exit 1
        ;;
esac