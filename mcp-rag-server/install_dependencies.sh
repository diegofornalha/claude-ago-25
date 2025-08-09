#!/bin/bash
# Instalar dependências para o servidor RAG melhorado

echo "Instalando dependências para RAG Server Improved..."

# Criar ambiente virtual se não existir
if [ ! -d "venv" ]; then
    echo "Criando ambiente virtual..."
    python3 -m venv venv
fi

# Ativar ambiente
source venv/bin/activate

# Atualizar pip
pip install --upgrade pip

# Instalar dependências
echo "Instalando pacotes necessários..."
pip install scikit-learn numpy scipy

echo "Dependências instaladas com sucesso!"
echo ""
echo "Para usar o servidor melhorado:"
echo "1. Edite seu arquivo de configuração MCP para usar rag_server_improved.py"
echo "2. Reinicie o Claude Code ou recarregue a configuração"
echo ""
echo "Recursos adicionados:"
echo "- Busca vetorial com TF-IDF"
echo "- Validação de dados com dataclasses"
echo "- Cache de índices para performance"
echo "- Busca semântica inteligente"