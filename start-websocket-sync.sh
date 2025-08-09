#!/bin/bash

# Script para iniciar o servidor WebSocket de sincronização

echo "🔄 Iniciando Servidor WebSocket de Sincronização"
echo "================================================"

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não encontrado"
    exit 1
fi

# Verificar dependências
echo "📦 Verificando dependências..."

check_package() {
    python3 -c "import $1" 2>/dev/null
    return $?
}

MISSING_DEPS=""

if ! check_package "websockets"; then
    MISSING_DEPS="$MISSING_DEPS websockets"
fi

if ! check_package "watchdog"; then
    MISSING_DEPS="$MISSING_DEPS watchdog"
fi

# Se faltar dependências, oferecer instalação
if [ ! -z "$MISSING_DEPS" ]; then
    echo "⚠️ Dependências faltando: $MISSING_DEPS"
    echo ""
    echo "Opções:"
    echo "1) Instalar dependências (pip install $MISSING_DEPS)"
    echo "2) Usar servidor simples (sem detecção automática)"
    echo "3) Cancelar"
    echo ""
    read -p "Escolha [1/2/3]: " choice
    
    case $choice in
        1)
            echo "📦 Instalando dependências..."
            pip3 install $MISSING_DEPS
            if [ $? -ne 0 ]; then
                echo "❌ Erro ao instalar dependências"
                echo "Tente: pip3 install --user $MISSING_DEPS"
                exit 1
            fi
            ;;
        2)
            echo "🚀 Iniciando servidor simples..."
            python3 /Users/agents/.claude/simple-sync-server.py
            exit 0
            ;;
        *)
            echo "❌ Cancelado"
            exit 1
            ;;
    esac
fi

# Verificar se servidor simples está rodando
if lsof -i:8765 > /dev/null 2>&1; then
    echo "⚠️ Porta 8765 já está em uso (servidor simples rodando?)"
    echo "Parando processo existente..."
    kill $(lsof -t -i:8765) 2>/dev/null
    sleep 2
fi

# Verificar se WebSocket já está rodando
if lsof -i:8766 > /dev/null 2>&1; then
    echo "⚠️ Porta 8766 já está em uso"
    echo "WebSocket server já está rodando?"
    echo ""
    read -p "Deseja parar o processo existente? [s/n]: " stop
    if [ "$stop" = "s" ]; then
        kill $(lsof -t -i:8766) 2>/dev/null
        echo "✅ Processo parado"
        sleep 2
    else
        echo "❌ Cancelado"
        exit 1
    fi
fi

# Iniciar servidor
echo ""
echo "🚀 Iniciando WebSocket Sync Server..."
echo "📡 WebSocket: ws://localhost:8766"
echo "📁 Cache: ~/.claude/mcp-rag-cache/"
echo ""
echo "Funcionalidades:"
echo "• Detecção instantânea de mudanças"
echo "• Sincronização em tempo real"
echo "• Reconexão automática"
echo "• Zero latência"
echo ""
echo "Pressione Ctrl+C para parar"
echo ""

# Executar servidor
python3 /Users/agents/.claude/websocket-sync-server.py