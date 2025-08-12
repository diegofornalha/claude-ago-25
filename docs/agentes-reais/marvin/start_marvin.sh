#!/bin/bash
# Script simplificado para iniciar o Marvin Agent

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🧠 Iniciando Marvin Agent..."
echo ""

# Verificar se Python está disponível
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não encontrado!"
    exit 1
fi

# Executar Marvin
./marvin serve --daemon

echo ""
echo "✅ Marvin Agent iniciado com sucesso!"
echo ""
echo "📊 Para verificar status: ./marvin status"
echo "🛑 Para parar: ./marvin stop"
echo "📋 Para ver logs: ./marvin logs"
echo "🔍 Para extrair dados: ./marvin extract 'seu texto aqui'"