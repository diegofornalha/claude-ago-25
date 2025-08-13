#!/bin/bash

# Script de inicialização do Knowledge Assistant A2A Agent

echo "=========================================="
echo "  Knowledge Assistant A2A Agent"
echo "  Protocolo A2A v1.0"
echo "=========================================="
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não encontrado!"
    echo "Por favor, instale Python 3.8 ou superior."
    exit 1
fi

echo "✓ Python encontrado: $(python3 --version)"

# Criar ambiente virtual se não existir
if [ ! -d "venv" ]; then
    echo ""
    echo "📦 Criando ambiente virtual..."
    python3 -m venv venv
    
    if [ $? -eq 0 ]; then
        echo "✓ Ambiente virtual criado"
    else
        echo "❌ Erro ao criar ambiente virtual"
        exit 1
    fi
fi

# Ativar ambiente virtual
echo ""
echo "🔧 Ativando ambiente virtual..."
source venv/bin/activate

# Instalar/atualizar dependências
echo ""
echo "📚 Instalando dependências..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✓ Dependências instaladas"
else
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

# Iniciar servidor
echo ""
echo "🚀 Iniciando servidor A2A..."
echo ""
echo "Endpoints disponíveis:"
echo "  - Agent Card: http://localhost:9999/.well-known/agent.json"
echo "  - Health:     http://localhost:9999/health"
echo "  - Tasks:      http://localhost:9999/tasks"
echo ""
echo "Para testar o agente, execute em outro terminal:"
echo "  python test_agent.py"
echo ""
echo "Pressione Ctrl+C para parar o servidor"
echo "=========================================="
echo ""

# Executar servidor
python app.py