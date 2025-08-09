import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
}

interface SessionDetail {
  sessionId: string
  todos: Todo[]
  conversation: Array<{
    type: string
    content: string
    timestamp: string
  }> | null
  metadata: {
    summary?: string
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3344'

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

export function ClaudeSessionDetailSimple() {
  const { sessionId, filter } = useParams<{ sessionId: string; filter?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [customName, setCustomName] = useState<string | null>(null)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editingTodoContent, setEditingTodoContent] = useState('')
  const [deletingTodoId, setDeletingTodoId] = useState<string | null>(null)
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null)
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null)
  
  // Sincronizar filter da URL com o estado
  useEffect(() => {
    if (filter === 'pendentes') {
      setFilterStatus('pending')
    } else if (filter === 'em-progresso') {
      setFilterStatus('in_progress')
    } else if (filter === 'concluidas') {
      setFilterStatus('completed')
    } else {
      setFilterStatus('all')
    }
  }, [filter])
  
  // Buscar nome customizado do documento
  useEffect(() => {
    fetch(`${API_URL}/api/documents`)
      .then(res => res.json())
      .then(documents => {
        const doc = documents.find((d: any) => d.sessionId === sessionId)
        if (doc?.customName) {
          setCustomName(doc.customName)
          setEditingName(doc.customName)
        }
      })
      .catch(() => {})
  }, [sessionId])
  
  // Mutation para atualizar o nome
  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const response = await fetch(`${API_URL}/api/documents/${sessionId}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customName: newName }),
      })
      if (!response.ok) throw new Error('Erro ao atualizar nome')
      return response.json()
    },
    onSuccess: () => {
      setCustomName(editingName)
      setIsEditingName(false)
      // Invalidar queries para atualizar a lista de documentos
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['claude-sessions'] })
    },
  })
  
  // Mutation para atualizar tarefa
  const updateTodoMutation = useMutation({
    mutationFn: async ({ todoId, updates }: { todoId: string; updates: { content?: string; status?: string; priority?: string } }) => {
      const response = await fetch(`${API_URL}/api/claude-sessions/${sessionId}/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Erro ao atualizar tarefa')
      return response.json()
    },
    onSuccess: () => {
      setEditingTodoId(null)
      setEditingStatusId(null)
      setEditingPriorityId(null)
      queryClient.invalidateQueries({ queryKey: ['claude-session-detail', sessionId] })
    },
  })
  
  // Mutation para excluir tarefa
  const deleteTodoMutation = useMutation({
    mutationFn: async (todoId: string) => {
      const response = await fetch(`${API_URL}/api/claude-sessions/${sessionId}/todos/${todoId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Erro ao excluir tarefa')
      return response.json()
    },
    onSuccess: () => {
      setDeletingTodoId(null)
      queryClient.invalidateQueries({ queryKey: ['claude-session-detail', sessionId] })
    },
  })
  
  // Mutation para reordenar tarefas
  const reorderTodosMutation = useMutation({
    mutationFn: async (todos: Todo[]) => {
      const response = await fetch(`${API_URL}/api/claude-sessions/${sessionId}/todos/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todos }),
      })
      if (!response.ok) throw new Error('Erro ao reordenar tarefas')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-session-detail', sessionId] })
    },
  })
  
  const { data: session, isLoading, error } = useQuery({
    queryKey: ['claude-session-detail', sessionId],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/claude-sessions/${sessionId}`)
      if (!response.ok) throw new Error('Falha ao buscar sessão')
      const data = await response.json()
      return data.session as SessionDetail
    },
    refetchInterval: 5000,
  })
  
  // Funções para mover tarefas
  const handleMoveUp = (todoId: string) => {
    if (!session) return
    
    const index = session.todos.findIndex(t => t.id === todoId)
    if (index <= 0) return
    
    const newTodos = [...session.todos]
    const temp = newTodos[index]
    newTodos[index] = newTodos[index - 1]
    newTodos[index - 1] = temp
    
    reorderTodosMutation.mutate(newTodos)
  }
  
  const handleMoveDown = (todoId: string) => {
    if (!session) return
    
    const index = session.todos.findIndex(t => t.id === todoId)
    if (index === -1 || index >= session.todos.length - 1) return
    
    const newTodos = [...session.todos]
    const temp = newTodos[index]
    newTodos[index] = newTodos[index + 1]
    newTodos[index + 1] = temp
    
    reorderTodosMutation.mutate(newTodos)
  }
  
  // Função para limpar concluídas e adicionar nova tarefa
  const handleClearCompleted = async () => {
    if (!session) return
    
    // Filtrar apenas tarefas não concluídas
    const activeTodos = session.todos.filter(t => t.status !== 'completed')
    
    // Gerar novo ID baseado no timestamp
    const newId = Date.now().toString()
    
    // Adicionar nova tarefa em branco
    const newTodo = {
      id: newId,
      content: '',
      status: 'pending' as const,
      priority: 'medium' as const
    }
    
    const updatedTodos = [...activeTodos, newTodo]
    
    // Salvar a nova lista
    reorderTodosMutation.mutate(updatedTodos)
    
    // Ativar edição na nova tarefa
    setTimeout(() => {
      setEditingTodoId(newId)
      setEditingTodoContent('')
    }, 100)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando detalhes da sessão...</div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Erro ao carregar sessão</div>
      </div>
    )
  }

  const stats = {
    total: session.todos.length,
    pending: session.todos.filter(t => t.status === 'pending').length,
    inProgress: session.todos.filter(t => t.status === 'in_progress').length,
    completed: session.todos.filter(t => t.status === 'completed').length
  }

  const progressPercentage = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link to="/claude-sessions" className="text-blue-600 hover:text-blue-800">
          ← Voltar para sessões
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="text-2xl font-bold px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1"
                placeholder="Nome da sessão..."
                autoFocus
              />
              <button
                onClick={() => {
                  if (editingName.trim()) {
                    updateNameMutation.mutate(editingName.trim())
                  }
                }}
                disabled={updateNameMutation.isPending}
                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {updateNameMutation.isPending ? '...' : '✓'}
              </button>
              <button
                onClick={() => {
                  setEditingName(customName || '')
                  setIsEditingName(false)
                }}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                {customName || `${sessionId?.slice(0, 8)}...`}
              </h1>
              <button
                onClick={() => {
                  setEditingName(customName || '')
                  setIsEditingName(true)
                }}
                className="text-gray-500 hover:text-gray-700"
                title="Editar nome"
              >
                ✏️
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <button
            onClick={() => navigate(`/claude-sessions/${sessionId}`)}
            className={`text-center p-3 rounded transition-all ${
              filterStatus === 'all' 
                ? 'bg-gray-200 ring-2 ring-gray-400' 
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </button>
          <button
            onClick={() => navigate(`/claude-sessions/${sessionId}/pendentes`)}
            className={`text-center p-3 rounded transition-all ${
              filterStatus === 'pending' 
                ? 'bg-yellow-200 ring-2 ring-yellow-400' 
                : 'bg-yellow-50 hover:bg-yellow-100'
            }`}
          >
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pendentes</div>
          </button>
          <button
            onClick={() => navigate(`/claude-sessions/${sessionId}/em-progresso`)}
            className={`text-center p-3 rounded transition-all ${
              filterStatus === 'in_progress' 
                ? 'bg-blue-200 ring-2 ring-blue-400' 
                : 'bg-blue-50 hover:bg-blue-100'
            }`}
          >
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-600">Em Progresso</div>
          </button>
          <button
            onClick={() => navigate(`/claude-sessions/${sessionId}/concluidas`)}
            className={`text-center p-3 rounded transition-all ${
              filterStatus === 'completed' 
                ? 'bg-green-200 ring-2 ring-green-400' 
                : 'bg-green-50 hover:bg-green-100'
            }`}
          >
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Concluídas</div>
          </button>
        </div>

        <div className="mb-4">
          <div className="bg-gray-200 rounded-full h-6 overflow-hidden">
            <div 
              className="bg-green-500 h-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Progresso: {progressPercentage}%
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">📋 Tarefas</h2>
          <div className="flex items-center gap-4">
            {filterStatus !== 'all' && (
              <span className="text-sm text-gray-500">
                Mostrando apenas: {filterStatus === 'pending' ? 'Pendentes' : 
                                 filterStatus === 'in_progress' ? 'Em Progresso' : 
                                 'Concluídas'}
              </span>
            )}
            <button
              onClick={() => handleClearCompleted()}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
            >
              Limpar concluídas
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {session.todos
            .filter(todo => filterStatus === 'all' || todo.status === filterStatus)
            .map((todo, filteredIndex) => {
              const realIndex = session.todos.findIndex(t => t.id === todo.id)
              return (
            <div
              key={todo.id}
              className={`p-4 rounded-lg border ${
                todo.status === 'completed' ? 'bg-gray-50 opacity-75' : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {editingTodoId === todo.id ? (
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={editingTodoContent}
                        onChange={(e) => setEditingTodoContent(e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (editingTodoContent.trim()) {
                            updateTodoMutation.mutate({ 
                              todoId: todo.id, 
                              updates: { content: editingTodoContent.trim() }
                            })
                          }
                        }}
                        disabled={updateTodoMutation.isPending}
                        className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setEditingTodoId(null)
                          setEditingTodoContent('')
                        }}
                        className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {todo.content}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {editingStatusId === todo.id ? (
                      <select
                        value={todo.status}
                        onChange={(e) => {
                          updateTodoMutation.mutate({ 
                            todoId: todo.id, 
                            updates: { status: e.target.value }
                          })
                        }}
                        onBlur={() => setEditingStatusId(null)}
                        className="text-xs px-2 py-1 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      >
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em Progresso</option>
                        <option value="completed">Concluída</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingStatusId(todo.id)}
                        className={`text-xs px-2 py-1 rounded-full cursor-pointer hover:opacity-80 ${statusColors[todo.status]}`}
                      >
                        {statusLabels[todo.status]}
                      </button>
                    )}
                    
                    {editingPriorityId === todo.id ? (
                      <select
                        value={todo.priority}
                        onChange={(e) => {
                          updateTodoMutation.mutate({ 
                            todoId: todo.id, 
                            updates: { priority: e.target.value }
                          })
                        }}
                        onBlur={() => setEditingPriorityId(null)}
                        className="text-xs px-2 py-1 rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      >
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingPriorityId(todo.id)}
                        className={`text-xs px-2 py-1 rounded-full border cursor-pointer hover:opacity-80 ${priorityColors[todo.priority]}`}
                      >
                        {todo.priority === 'high' ? 'Alta' : todo.priority === 'medium' ? 'Média' : 'Baixa'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {filterStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => handleMoveUp(todo.id)}
                        disabled={realIndex === 0}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para cima"
                      >
                        ⬆️
                      </button>
                      <button
                        onClick={() => handleMoveDown(todo.id)}
                        disabled={realIndex === session.todos.length - 1}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para baixo"
                      >
                        ⬇️
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setEditingTodoId(todo.id)
                      setEditingTodoContent(todo.content)
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    title="Editar tarefa"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      console.log('Deletando tarefa:', todo.id)
                      setDeletingTodoId(todo.id)
                    }}
                    className="text-gray-500 hover:text-red-600"
                    title="Excluir tarefa"
                  >
                    🗑️
                  </button>
                  <div className="text-xs text-gray-500">
                    #{todo.id}
                  </div>
                </div>
              </div>
            </div>
          )})}
        </div>
        {session.todos.filter(todo => filterStatus === 'all' || todo.status === filterStatus).length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Nenhuma tarefa {filterStatus === 'pending' ? 'pendente' : 
                           filterStatus === 'in_progress' ? 'em progresso' : 
                           filterStatus === 'completed' ? 'concluída' : ''} encontrada.
          </p>
        )}
      </div>
      
      {/* Modal de confirmação de exclusão */}
      {deletingTodoId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirmar Exclusão
            </h3>
            
            <p className="text-gray-600 mb-6">
              Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingTodoId(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteTodoMutation.mutate(deletingTodoId)}
                disabled={deleteTodoMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteTodoMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}