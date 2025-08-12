#!/bin/bash
# Script simplificado para parar o Marvin Agent

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🛑 Parando Marvin Agent..."
echo ""

# Executar comando de parada
./marvin stop

echo ""
echo "✅ Marvin Agent parado!"