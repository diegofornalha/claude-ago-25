import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ID da sessão atual
const CURRENT_SESSION_ID = '320197f4-9f03-475e-9703-7b9ce2c918e8'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3344'

interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
}

const priorityColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200'
}

const statusColors = {
  pending: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800'
}

const statusLabels = {
  pending: 'Pendente',
  in_progress: 'Em Progresso',
  completed: 'Concluída'
}

export function CurrentSession() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['current-session-todos'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/claude-sessions/${CURRENT_SESSION_ID}/todos`)
      if (!response.ok) throw new Error('Falha ao buscar tarefas')
      return response.json()
    },
    refetchInterval: 2000, // Atualiza a cada 2 segundos
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando tarefas...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Erro ao carregar tarefas</div>
      </div>
    )
  }

  const { todos, stats } = data
  const progressPercentage = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">
          📋 Sessão Atual do Claude
        </h1>
        
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-blue-900">
            Sincronizando em tempo real com: {CURRENT_SESSION_ID}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Arquivos: todos/{CURRENT_SESSION_ID}.json e projects/.../{CURRENT_SESSION_ID}.jsonl
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pendentes</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-600">Em Progresso</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Concluídas</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progresso Geral</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <div className="text-xs text-gray-500 text-center">
          Última atualização: {format(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </div>
      </div>

      <div className="space-y-3">
        {todos.map((todo: Todo) => (
          <div
            key={todo.id}
            className={`bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-all duration-200 ${
              todo.status === 'completed' ? 'opacity-75' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className={`text-sm font-medium mb-2 ${
                  todo.status === 'completed' ? 'line-through text-gray-600' : 'text-gray-900'
                }`}>
                  {todo.content}
                </p>
                <div className="flex gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[todo.status]}`}>
                    {statusLabels[todo.status]}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full border ${priorityColors[todo.priority]}`}>
                    Prioridade: {todo.priority === 'high' ? 'Alta' : todo.priority === 'medium' ? 'Média' : 'Baixa'}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                #{todo.id}
              </div>
            </div>
          </div>
        ))}
      </div>

      {todos.length === 0 && (
        <div className="text-center text-gray-500 mt-8">
          Nenhuma tarefa encontrada
        </div>
      )}
    </div>
  )
}