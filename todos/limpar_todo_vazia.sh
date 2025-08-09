#!/bin/bash
# Script para limpar arquivos vazios ou com apenas um array vazio no diretório todos
# Agora com verificação de projetos órfãos

# Cores para saída
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

TODOS_DIR="${HOME}/.claude/todos"
PROJECTS_DIR="${HOME}/.claude/projects"

echo -e "${CYAN}=== Limpeza Inteligente de Arquivos de Tarefas (Todos) ===${NC}\n"

# Verifica se o diretório existe
if [ ! -d "$TODOS_DIR" ]; then
  echo -e "${YELLOW}Diretório $TODOS_DIR não encontrado.${NC}"
  exit 1
fi

# Contador de arquivos removidos
removed_count=0
empty_array_count=0
preserved_count=0
orphaned_count=0

# Função para verificar se o arquivo contém apenas "[]"
is_empty_array() {
  local file="$1"
  local content=$(cat "$file" | tr -d '[:space:]')
  if [ "$content" = "[]" ]; then
    return 0  # Verdadeiro (é um array vazio)
  else
    return 1  # Falso (não é um array vazio)
  fi
}

# Função para verificar se o arquivo tem tarefas válidas
has_valid_tasks() {
  local file="$1"
  # Verifica se o arquivo contém pelo menos uma tarefa com content, status e id
  if grep -q "\"content\":" "$file" && grep -q "\"status\":" "$file" && grep -q "\"id\":" "$file"; then
    return 0  # Verdadeiro (tem tarefas válidas)
  else
    return 1  # Falso (não tem tarefas válidas)
  fi
}

# Função para extrair ID do projeto do nome do arquivo
get_project_id() {
  local filename="$1"
  # Extrai o primeiro UUID do nome do arquivo (projeto principal)
  echo "$filename" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1
}

# Função para verificar se o projeto existe
project_exists() {
  local project_id="$1"
  if [ -z "$project_id" ]; then
    return 1  # Falso (ID vazio)
  fi
  
  # Verifica se existe algum arquivo .jsonl com esse ID nos projetos
  if [ -d "$PROJECTS_DIR" ]; then
    find "$PROJECTS_DIR" -name "*${project_id}*.jsonl" -type f | grep -q .
    return $?
  fi
  
  return 1  # Falso (diretório de projetos não existe)
}

# Lista todos os arquivos JSON no diretório
echo -e "Procurando arquivos de tarefas...\n"

for file in "$TODOS_DIR"/*.json; do
  # Verifica se o padrão expandiu para arquivos reais
  if [ ! -f "$file" ]; then
    continue
  fi
  
  filename=$(basename "$file")
  
  # Pula arquivos que não são de todos (não contêm "agent" no nome)
  if [[ ! "$filename" =~ agent ]]; then
    echo -e "${CYAN}Ignorando arquivo não relacionado a agentes:${NC} $filename"
    continue
  fi
  
  # Verifica se é um arquivo vazio
  if [ ! -s "$file" ]; then
    echo -e "${YELLOW}Removendo arquivo vazio:${NC} $filename"
    rm "$file"
    ((removed_count++))
    continue
  fi
  
  # Verifica se é um array vazio
  if is_empty_array "$file"; then
    echo -e "${YELLOW}Removendo arquivo com array vazio:${NC} $filename"
    rm "$file"
    ((empty_array_count++))
    continue
  fi
  
  # Extrai ID do projeto
  project_id=$(get_project_id "$filename")
  
  # Verifica se tem tarefas válidas
  if has_valid_tasks "$file"; then
    # Verifica se o projeto ainda existe
    if project_exists "$project_id"; then
      echo -e "${GREEN}Preservando arquivo com tarefas válidas (projeto ativo):${NC} $filename"
      ((preserved_count++))
    else
      echo -e "${RED}Removendo arquivo órfão (projeto inexistente):${NC} $filename [ID: $project_id]"
      rm "$file"
      ((orphaned_count++))
    fi
  else
    echo -e "${YELLOW}Removendo arquivo sem tarefas válidas:${NC} $filename"
    rm "$file"
    ((removed_count++))
  fi
done

# Lida com o arquivo todos.md separadamente
if [ -f "$TODOS_DIR/todos.md" ]; then
  echo -e "\n${GREEN}Preservando arquivo de documentação:${NC} todos.md"
fi

# Resumo da operação
echo -e "\n${CYAN}=== Resumo da Limpeza Inteligente ===${NC}"
echo -e "${GREEN}Arquivos preservados (projetos ativos):${NC} $preserved_count"
echo -e "${YELLOW}Arquivos vazios removidos:${NC} $removed_count"
echo -e "${YELLOW}Arquivos com array vazio removidos:${NC} $empty_array_count"
echo -e "${RED}Arquivos órfãos removidos (projetos inexistentes):${NC} $orphaned_count"
echo -e "${YELLOW}Total de arquivos removidos:${NC} $((removed_count + empty_array_count + orphaned_count))"

# Mostra projetos órfãos encontrados
if [ $orphaned_count -gt 0 ]; then
  echo -e "\n${CYAN}Projetos órfãos detectados e removidos:${NC}"
  echo -e "${RED}→ Todos relacionados a projetos que não existem mais em $PROJECTS_DIR${NC}"
fi

# Criação de hook para execução automática
HOOKS_DIR="${HOME}/.claude/hooks"
mkdir -p "$HOOKS_DIR"

cat > "${HOOKS_DIR}/post_cleanup.sh" << EOF
#!/bin/bash
# Hook executado periodicamente para limpeza
${HOME}/.claude/clean_todos.sh
EOF

chmod +x "${HOOKS_DIR}/post_cleanup.sh"

# Adicionar entrada de cron para execução periódica (semanal)
CRON_JOB="0 0 * * 0 ${HOME}/.claude/clean_todos.sh > ${HOME}/.claude/clean_todos.log 2>&1"

# Verifica se o cron job já existe
(crontab -l 2>/dev/null | grep -q "clean_todos.sh") || {
  # Adiciona o cron job apenas se não existir
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo -e "\n${GREEN}Limpeza automática semanal configurada.${NC}"
}

echo -e "\n${GREEN}Para executar a limpeza manualmente:${NC}"
echo -e "${CYAN}~/.claude/clean_todos.sh${NC}"

# Adicionar ao CLAUDE.md
if ! grep -q "## Limpeza Automática de Todos" "${HOME}/.claude/CLAUDE.md"; then
  cat >> "${HOME}/.claude/CLAUDE.md" << EOF

## Limpeza Automática de Todos

O sistema agora realiza limpeza automática semanal dos arquivos de tarefas (todos), removendo:
- Arquivos vazios
- Arquivos contendo apenas um array vazio "[]"
- Arquivos sem tarefas válidas
- **Arquivos órfãos de projetos que não existem mais**

Para limpar manualmente a qualquer momento:
\`\`\`bash
~/.claude/clean_todos.sh
\`\`\`

A limpeza preserva todos os arquivos com tarefas válidas relacionados a projetos ativos em \`~/.claude/projects\` e o arquivo de documentação todos.md.
EOF
fi