# 📚 RAG Server MCP - Guia Completo

## 🎯 O que é o RAG Server MCP?

O RAG Server MCP é um servidor de Recuperação Aumentada por Geração (RAG) integrado ao Claude Code via Model Context Protocol (MCP). Ele permite armazenar, indexar e buscar documentos usando embeddings semânticos locais, sem necessidade de APIs externas.

## ✨ Características Principais

### 🧠 Embeddings Locais
- **Modelo**: all-MiniLM-L6-v2 (dimensão 384)
- **100% Local**: Nenhum dado sai da sua máquina
- **Gratuito**: Sem custos de API
- **Rápido**: ~50ms por busca

### 🔍 Capacidades de Busca
- **Busca Semântica**: Usando embeddings vetoriais
- **Busca por Palavras-chave**: TF-IDF integrado
- **Busca Híbrida**: Combina semântica + keywords
- **Filtros**: Por categoria, tags, fonte

### 📂 Organização de Dados
- **Categorias Hierárquicas**: Ex: `tech:embeddings`, `a2a:sdk`
- **Sistema de Tags**: Múltiplas tags por documento
- **Metadados**: Fonte, timestamp, versão
- **Cache Persistente**: JSON em `~/.claude/mcp-rag-cache/`

## 🚀 Como Usar

### 1. Verificar Status

```python
# Via MCP no Claude Code
mcp__rag-server__stats
```

**Resposta esperada:**
```json
{
  "server_version": "3.1.0",
  "total_documents": 34,
  "has_embeddings": true,
  "embedding_model": "all-MiniLM-L6-v2",
  "categories": {...},
  "top_tags": {...}
}
```

### 2. Adicionar Documentos

```python
mcp__rag-server__add(
    title="Título do Documento",
    content="Conteúdo completo do documento...",
    category="categoria:subcategoria",
    tags=["tag1", "tag2", "tag3"],
    source="origem-do-documento"
)
```

**Exemplo prático:**
```python
mcp__rag-server__add(
    title="Guia de Python",
    content="Python é uma linguagem de programação...",
    category="tech:python",
    tags=["python", "programação", "tutorial"],
    source="manual"
)
```

### 3. Buscar Documentos

#### Busca Semântica
```python
mcp__rag-server__search(
    query="como usar embeddings locais",
    limit=5,
    use_semantic=True  # Ativa busca semântica
)
```

#### Busca por Categoria
```python
mcp__rag-server__search_by_category(
    category="tech:python",
    limit=10
)
```

#### Busca por Tags
```python
mcp__rag-server__search_by_tags(
    tags=["python", "tutorial"],
    limit=5
)
```

### 4. Gerenciar Documentos

#### Listar Documentos
```python
mcp__rag-server__list(
    category="tech:python",  # Opcional
    source="manual",          # Opcional
    tags=["tutorial"]         # Opcional
)
```

#### Remover Documento
```python
mcp__rag-server__remove(
    id="documento-uuid-aqui"
)
```

#### Atualizar Documento
```python
mcp__rag-server__update(
    id="documento-uuid-aqui",
    title="Novo Título",        # Opcional
    content="Novo conteúdo",     # Opcional
    category="nova:categoria",   # Opcional
    tags=["nova", "tag"]        # Opcional
)
```

## 📊 Estrutura de Dados

### Documento Completo
```json
{
  "id": "5b671e9b-f879-4421-acea-963dfb92886f",
  "title": "Título do Documento",
  "content": "Conteúdo completo...",
  "category": "categoria:subcategoria",
  "tags": ["tag1", "tag2"],
  "source": "origem",
  "type": "text",
  "hash": "114a03e29f5be0a4",
  "created_at": "2025-08-11T15:44:06.594872",
  "updated_at": "2025-08-11T15:44:06.594918",
  "version": 1
}
```

### Resultado de Busca
```json
{
  "results": [
    {
      "title": "Documento Relevante",
      "content": "...",
      "score": 0.85,  // Score de similaridade (0-1)
      "category": "tech:ai",
      "tags": ["ai", "ml"]
    }
  ],
  "total": 10,
  "query": "busca original"
}
```

## 🛠️ Configuração Técnica

### Localização dos Arquivos
```
~/.claude/
├── mcp-rag-server/
│   ├── rag_server.py          # Servidor principal
│   ├── start-rag-server.sh    # Script de inicialização
│   └── requirements.txt       # Dependências Python
└── mcp-rag-cache/
    ├── documents.json          # Cache de documentos
    ├── embeddings.npy         # Embeddings vetoriais
    └── tfidf_matrix.npz       # Matriz TF-IDF
```

### Requisitos do Sistema
- **Python**: 3.8+
- **Memória**: ~100-200MB
- **Disco**: ~1MB por 100 documentos
- **CPU**: Qualquer (ARM/x86)

### Modelo de Embeddings
- **Nome**: all-MiniLM-L6-v2
- **Tamanho**: ~90MB (baixado na primeira execução)
- **Dimensão**: 384
- **Qualidade**: Excelente para busca semântica
- **Velocidade**: ~50ms por texto

## 🎯 Casos de Uso

### 1. Base de Conhecimento Pessoal
```python
# Adicionar notas e referências
mcp__rag-server__add(
    title="Notas da Reunião 11/08",
    content="Discussão sobre arquitetura...",
    category="trabalho:reunioes",
    tags=["reunião", "arquitetura", "decisões"]
)

# Buscar informações rapidamente
mcp__rag-server__search(
    query="decisões de arquitetura",
    limit=5
)
```

### 2. Documentação de Projetos
```python
# Indexar documentação
mcp__rag-server__add(
    title="API Documentation",
    content="Endpoints disponíveis...",
    category="projeto:api",
    tags=["api", "docs", "endpoints"]
)

# Buscar por categoria
mcp__rag-server__search_by_category(
    category="projeto:api"
)
```

### 3. Chat com Memória
```python
# Salvar histórico de conversas
mcp__rag-server__add(
    title=f"Chat {session_id}",
    content=conversation_text,
    category="chat:history",
    tags=["chat", user_id, date]
)

# Recuperar contexto relevante
mcp__rag-server__search(
    query="última conversa sobre Python",
    limit=3
)
```

## 🚦 Status e Monitoramento

### Verificar Saúde do Servidor
```bash
# Via terminal
ps aux | grep rag_server

# Via MCP
mcp__rag-server__stats
```

### Métricas Importantes
- **Total de documentos**: Quantidade indexada
- **Tamanho do cache**: Em MB
- **Categorias ativas**: Lista de categorias
- **Tags populares**: Tags mais usadas

## 🔧 Troubleshooting

### Servidor não conecta
```bash
# Reiniciar servidor
claude mcp remove rag-server
claude mcp add rag-server ~/.claude/mcp-rag-server/start-rag-server.sh
```

### Busca não retorna resultados
1. Verificar se há documentos: `mcp__rag-server__stats`
2. Usar busca mais genérica: `use_semantic=True`
3. Verificar categoria/tags corretas

### Performance lenta
1. Limitar resultados: `limit=5`
2. Usar categoria específica para filtrar
3. Verificar tamanho do cache (>1000 docs pode ficar lento)

## 📈 Performance e Limites

| Operação | Tempo Médio | Limite Recomendado |
|----------|-------------|-------------------|
| Adicionar | ~100ms | 1000 docs/minuto |
| Buscar | ~50ms | 100 buscas/minuto |
| Listar | ~20ms | Sem limite |
| Remover | ~10ms | Sem limite |

### Capacidade
- **Documentos**: Até 10.000 (recomendado)
- **Tamanho por doc**: Até 100KB
- **Total cache**: Até 100MB

## 🎉 Benefícios

### ✅ Vantagens
- **100% Privado**: Dados nunca saem da máquina
- **Gratuito**: Sem custos de API
- **Rápido**: Busca em milissegundos
- **Flexível**: Categorias e tags customizáveis
- **Persistente**: Sobrevive a reinicializações
- **Integrado**: Funciona direto no Claude Code

### ❌ Limitações
- **Escala**: Melhor para <10.000 documentos
- **Idiomas**: Otimizado para inglês/português
- **Tipos**: Apenas texto (não processa PDFs/imagens)
- **Relacionamentos**: Não é um banco de grafos

## 🔮 Dicas Avançadas

### Organização Eficiente
```python
# Use categorias hierárquicas
"projeto:backend:api"
"projeto:frontend:componentes"
"docs:publico:tutorial"
"docs:interno:processos"

# Tags descritivas
["2024-08", "importante", "revisar", "v2.0"]
```

### Busca Otimizada
```python
# Combine métodos de busca
# 1. Busca ampla semântica
results = search(query="machine learning", limit=20)

# 2. Depois filtre por categoria
filtered = [r for r in results if r.category.startswith("tech:ai")]
```

### Backup Regular
```bash
# Fazer backup do cache
cp -r ~/.claude/mcp-rag-cache ~/backup-rag-$(date +%Y%m%d)

# Restaurar backup
cp -r ~/backup-rag-20240811/* ~/.claude/mcp-rag-cache/
```

## 📝 Conclusão

O RAG Server MCP é uma solução poderosa, privada e gratuita para adicionar capacidades de busca semântica ao Claude Code. Com embeddings locais e interface simples via MCP, é perfeito para bases de conhecimento pessoais, documentação de projetos e sistemas de chat com memória.

**Principais Takeaways:**
- Totalmente local e privado
- Busca semântica de qualidade
- Fácil de usar via MCP
- Sem necessidade de configuração complexa
- Ideal para até 10.000 documentos

---

*Última atualização: 11/08/2025*
*Versão do servidor: 3.1.0*
*Modelo de embeddings: all-MiniLM-L6-v2*