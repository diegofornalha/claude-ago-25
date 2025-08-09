# Transformação de Issues em Tarefas - Documentação

## Visão Geral

Este documento descreve como as issues do sistema são transformadas em tarefas com uma estrutura JSON específica para integração com outros sistemas.

## Estrutura de Dados

### Issue (Formato Original)
```typescript
{
  id: number,
  title: string,
  description: string | null,
  status: 'open' | 'in_progress' | 'done',
  priority: 'low' | 'medium' | 'high',
  userId: number,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Task (Formato Transformado)
```typescript
{
  content: string,
  status: 'pending' | 'in_progress' | 'completed',
  priority: 'low' | 'medium' | 'high',
  id: string
}
```

## Mapeamento de Campos

| Campo Issue | Campo Task | Transformação |
|-------------|------------|---------------|
| `id` | `id` | Convertido para string: `id.toString()` |
| `title` + `description` | `content` | Se houver descrição: `"${title}: ${description}"`, senão apenas `title` |
| `status` | `status` | Mapeamento: `open → pending`, `in_progress → in_progress`, `done → completed` |
| `priority` | `priority` | Mantém o mesmo valor (low, medium, high) |

## Endpoint da API

### GET /tasks

Retorna issues transformadas em formato de tarefas.

**Query Parameters:**
- `page` (number): Página da lista (padrão: 1)
- `limit` (number): Itens por página (padrão: 20, máx: 100)
- `userId` (number): Filtrar por usuário (opcional)

**Exemplo de Requisição:**
```bash
curl "http://localhost:3344/tasks?page=1&limit=10&userId=1"
```

**Exemplo de Resposta:**
```json
[
  {
    "content": "Implementar sistema de autenticação JWT",
    "status": "completed",
    "priority": "high",
    "id": "1"
  },
  {
    "content": "Corrigir bug no formulário de login: O botão de submit não está funcionando no Firefox",
    "status": "in_progress",
    "priority": "high",
    "id": "2"
  },
  {
    "content": "Adicionar dark mode na interface",
    "status": "pending",
    "priority": "medium",
    "id": "3"
  }
]
```

## Arquivos Criados

### 1. `/src/utils/issue-to-task-transformer.ts`
Contém as funções de transformação:
- `issueToTask()`: Transforma uma issue em tarefa
- `issuesToTasks()`: Transforma múltiplas issues
- `taskToIssue()`: Transformação reversa (tarefa → issue)

### 2. `/src/mocks/tasks-mock.json`
Arquivo de mock com 10 exemplos de tarefas para testes e desenvolvimento.

### 3. Endpoint `/tasks` em `server.ts`
Novo endpoint que:
- Busca issues do banco de dados
- Aplica a transformação para formato de tarefa
- Retorna array JSON no formato especificado
- Utiliza cache com TTL de 1 minuto

## Uso Prático

### JavaScript/TypeScript
```javascript
// Buscar tarefas
const response = await fetch('http://localhost:3344/tasks?limit=5');
const tasks = await response.json();

console.log(tasks);
// [
//   { content: "Tarefa 1", status: "pending", priority: "high", id: "1" },
//   { content: "Tarefa 2", status: "completed", priority: "low", id: "2" },
//   ...
// ]
```

### Integração com Sistemas de Todo
O formato de saída é compatível com sistemas de gerenciamento de tarefas que esperam:
- `content`: Texto descritivo da tarefa
- `status`: Estado de conclusão
- `priority`: Nível de prioridade
- `id`: Identificador único como string

## Considerações

1. **Performance**: O endpoint utiliza o mesmo sistema de cache das issues (1 minuto TTL)
2. **Paginação**: Suporta os mesmos parâmetros de paginação do endpoint `/issues`
3. **Filtros**: Permite filtrar por `userId` para tarefas de usuários específicos
## Próximos Passos

- [ ] Adicionar endpoint POST /tasks para criar issues a partir de tarefas
- [ ] Implementar PUT /tasks/:id para atualizar
- [ ] Adicionar filtros por status e prioridade
- [ ] Criar webhook para sincronização automática