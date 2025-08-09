import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useHiddenSessions } from '../hooks/useHiddenSessions'

interface TaskInfo {
  id: string
  content: string
}

interface Session {
  sessionId: string
  todos: string
  conversation: string | null
  hasConversation: boolean
  lastModified: string
  todoCount: number
  pendingCount: number
  completedCount: number
  inProgressCount: number
  currentTaskName: string | null
  currentTask: TaskInfo | null
  firstPendingTask: TaskInfo | null
  lastCompletedTask: TaskInfo | null
  customName: string | null
  isContinuation?: boolean
  originalSessionId?: string | null
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3344'

export function ClaudeSessions() {
  const [showHidden, setShowHidden] = useState(false)
  const { hideSession, unhideSession, isHidden, hiddenCount, clearHidden } = useHiddenSessions()
  const queryClient = useQueryClient()
  
  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['claude-sessions'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/claude-sessions`)
      if (!response.ok) throw new Error('Falha ao buscar sessões')
      const data = await response.json()
      return data.sessions as Session[]
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  })

  const visibleSessions = sessions?.filter(session => {
    const hidden = isHidden(session.sessionId)
    const empty = session.todoCount === 0
    
    if (showHidden) {
      return hidden
    } else {
      // Sempre ocultar sessões vazias
      if (empty) return false
      return !hidden
    }
  }) || []
  
  // Contar apenas sessões ocultas que realmente existem
  const actualHiddenCount = sessions?.filter(session => isHidden(session.sessionId)).length || 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando sessões...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Erro ao carregar sessões</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Produção de Tarefas</h1>
      
      {/* Tabs para alternar entre visíveis e ocultas */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setShowHidden(false)}
          className={`pb-2 px-1 font-medium transition-colors ${
            !showHidden 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Playbooks Ativos
        </button>
        <button
          onClick={() => setShowHidden(true)}
          className={`pb-2 px-1 font-medium transition-colors ${
            showHidden 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Playbooks Inativos {actualHiddenCount > 0 && `(${actualHiddenCount})`}
        </button>
        
        {/* Botões de limpeza */}
        {showHidden && actualHiddenCount > 0 && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={async () => {
                try {
                  // Primeiro executa o script de limpeza
                  const response = await fetch(`${API_URL}/api/cleanup/empty-todos`, {
                    method: 'POST'
                  })
                  
                  if (response.ok) {
                    const result = await response.json()
                    console.log(`Removidos: ${result.removed} arquivos vazios`)
                    
                    // Limpa a lista de ocultos do localStorage
                    clearHidden()
                    
                    // Força atualização das sessões
                    queryClient.invalidateQueries({ queryKey: ['claude-sessions'] })
                    
                    // Volta para aba ativa
                    setShowHidden(false)
                  }
                } catch (error) {
                  console.error('Erro ao limpar sessões:', error)
                }
              }}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1"
              title="Limpar todas as sessões vazias (remove arquivos)"
            >
              <span>🗑️</span>
              <span>Limpar vazias</span>
            </button>
            
            <button
              onClick={async () => {
                try {
                  // Executa limpeza inteligente de projetos órfãos
                  const response = await fetch(`${API_URL}/api/cleanup/orphaned-todos`, {
                    method: 'POST'
                  })
                  
                  if (response.ok) {
                    const result = await response.json()
                    console.log(`Removidos: ${result.orphaned} arquivos órfãos, ${result.empty} vazios`)
                    
                    // Limpa a lista de ocultos do localStorage
                    clearHidden()
                    
                    // Força atualização das sessões
                    queryClient.invalidateQueries({ queryKey: ['claude-sessions'] })
                    
                    // Volta para aba ativa
                    setShowHidden(false)
                  }
                } catch (error) {
                  console.error('Erro ao excluir inativos:', error)
                }
              }}
              className="px-3 py-1 text-sm text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded-md transition-colors flex items-center gap-1"
              title="Excluir todos de projetos que não existem mais"
            >
              <span>🔄</span>
              <span>Excluir inativos</span>
            </button>
          </div>
        )}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleSessions.map((session) => (
          <SessionCard 
            key={session.sessionId} 
            session={session} 
            isHidden={isHidden(session.sessionId)}
            onHide={() => hideSession(session.sessionId)}
            onUnhide={() => unhideSession(session.sessionId)}
          />
        ))}
      </div>
      
      {!visibleSessions.length && (
        <div className="text-center text-gray-500 mt-8">
          {showHidden ? 'Nenhuma sessão oculta' : 'Nenhuma sessão encontrada'}
        </div>
      )}
    </div>
  )
}

interface SessionCardProps {
  session: Session
  isHidden: boolean
  onHide: () => void
  onUnhide: () => void
}

function SessionCard({ session, isHidden, onHide, onUnhide }: SessionCardProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)
  const [editingSessionName, setEditingSessionName] = useState(false)
  const [editingNameContent, setEditingNameContent] = useState('')
  const [hoveredCard, setHoveredCard] = useState(false)
  const queryClient = useQueryClient()

  const progressPercentage = session.todoCount > 0
    ? Math.round((session.completedCount / session.todoCount) * 100)
    : 0

  // Mutation para atualizar tarefa
  const updateTodoMutation = useMutation({
    mutationFn: async ({ todoId, content }: { todoId: string; content: string }) => {
      const response = await fetch(`${API_URL}/api/claude-sessions/${session.sessionId}/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
      if (!response.ok) throw new Error('Erro ao atualizar tarefa')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-sessions'] })
      setEditingTaskId(null)
    }
  })

  const handleStartEdit = (taskId: string, currentContent: string) => {
    setEditingTaskId(taskId)
    setEditingContent(currentContent)
  }

  const handleSaveEdit = (taskId: string) => {
    if (editingContent.trim()) {
      updateTodoMutation.mutate({ todoId: taskId, content: editingContent.trim() })
    } else {
      setEditingTaskId(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingTaskId(null)
    setEditingContent('')
  }

  // Mutation para atualizar nome da sessão
  const updateSessionNameMutation = useMutation({
    mutationFn: async ({ sessionId, customName }: { sessionId: string; customName: string }) => {
      const response = await fetch(`${API_URL}/api/documents/${sessionId}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customName })
      })
      if (!response.ok) throw new Error('Erro ao atualizar nome')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-sessions'] })
      setEditingSessionName(false)
    }
  })

  // Mutation para deletar sessão
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`${API_URL}/api/documents/${sessionId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Erro ao deletar sessão')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claude-sessions'] })
    }
  })

  const handleStartEditName = () => {
    setEditingSessionName(true)
    setEditingNameContent(session.customName || session.sessionId)
  }

  const handleSaveEditName = () => {
    if (editingNameContent.trim()) {
      updateSessionNameMutation.mutate({ sessionId: session.sessionId, customName: editingNameContent.trim() })
    } else {
      setEditingSessionName(false)
    }
  }

  const handleCancelEditName = () => {
    setEditingSessionName(false)
    setEditingNameContent('')
  }

  const handleDeleteSession = () => {
    deleteSessionMutation.mutate(session.sessionId)
  }

  return (
    <div 
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow relative"
      onMouseEnter={() => setHoveredCard(true)}
      onMouseLeave={() => setHoveredCard(false)}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-sm text-gray-800 truncate">
          {session.todoCount} {session.todoCount === 1 ? 'tarefa' : 'tarefas'}
        </h3>
        <div className="flex items-center gap-1">
          {session.hasConversation && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded" title="Sessão com conversa">
              💬
            </span>
          )}
          {session.isContinuation && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono" title={`Continuação de ${session.originalSessionId?.slice(0, 8)}`}>
              claude -c:{session.originalSessionId?.slice(0, 6)}
            </span>
          )}
          <div className="flex items-center group">
            {editingSessionName ? (
              <input
                type="text"
                value={editingNameContent}
                onChange={(e) => setEditingNameContent(e.target.value)}
                onBlur={handleSaveEditName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEditName()
                  if (e.key === 'Escape') handleCancelEditName()
                }}
                className="text-xs px-2 py-1 border-b-2 border-blue-500 focus:outline-none bg-transparent font-mono min-w-[100px]"
                autoFocus
              />
            ) : (
              <span 
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono flex items-center gap-1" 
                title={session.customName ? `ID: ${session.sessionId}` : "ID da sessão"}
              >
                {session.customName || session.sessionId.slice(0, 6)}
                {hoveredCard && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartEditName()
                    }}
                    className="text-gray-400 hover:text-gray-600 ml-1"
                  >
                    ✏️
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="space-y-3 mt-3">
        {/* Pendentes */}
        {session.pendingCount > 0 && (
          <div className="space-y-1">
            <div className="flex items-center text-sm">
              <span className="text-gray-600">Pendentes:</span>
              <span className="ml-auto font-medium text-orange-600">{session.pendingCount}</span>
            </div>
            {session.firstPendingTask && (
              <div 
                className="text-xs text-gray-500 pl-4 flex items-center group"
                onMouseEnter={() => setHoveredTaskId(session.firstPendingTask.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                <span className="mr-1">•</span>
                {editingTaskId === session.firstPendingTask.id ? (
                  <input
                    type="text"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    onBlur={() => handleSaveEdit(session.firstPendingTask.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(session.firstPendingTask.id)
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="flex-1 px-1 py-0 text-xs border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="truncate flex-1">{session.firstPendingTask.content}</span>
                    {hoveredTaskId === session.firstPendingTask.id && (
                      <button
                        onClick={() => handleStartEdit(session.firstPendingTask.id, session.firstPendingTask.content)}
                        className="ml-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✏️
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Em progresso */}
        {session.inProgressCount > 0 && (
          <div className="space-y-1">
            <div className="flex items-center text-sm">
              <span className="text-gray-600">Em progresso:</span>
              <span className="ml-auto font-medium text-blue-600">{session.inProgressCount}</span>
            </div>
            {session.currentTask && (
              <div 
                className="text-xs text-blue-600 pl-4 flex items-center group"
                onMouseEnter={() => setHoveredTaskId(session.currentTask.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                <span className="mr-1">•</span>
                {editingTaskId === session.currentTask.id ? (
                  <input
                    type="text"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    onBlur={() => handleSaveEdit(session.currentTask.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(session.currentTask.id)
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="flex-1 px-1 py-0 text-xs border-b border-blue-300 focus:border-blue-500 outline-none bg-transparent text-blue-600"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="truncate flex-1">{session.currentTask.content}</span>
                    {hoveredTaskId === session.currentTask.id && (
                      <button
                        onClick={() => handleStartEdit(session.currentTask.id, session.currentTask.content)}
                        className="ml-1 text-blue-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✏️
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Concluídas */}
        {session.completedCount > 0 && (
          <div className="space-y-1">
            <div className="flex items-center text-sm">
              <span className="text-gray-600">Concluídas:</span>
              <span className="ml-auto font-medium text-green-600">{session.completedCount}</span>
            </div>
            {session.lastCompletedTask && (
              <div 
                className="text-xs text-gray-500 pl-4 flex items-center group"
                onMouseEnter={() => setHoveredTaskId(session.lastCompletedTask.id)}
                onMouseLeave={() => setHoveredTaskId(null)}
              >
                <span className="mr-1">•</span>
                {editingTaskId === session.lastCompletedTask.id ? (
                  <input
                    type="text"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    onBlur={() => handleSaveEdit(session.lastCompletedTask.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(session.lastCompletedTask.id)
                      if (e.key === 'Escape') handleCancelEdit()
                    }}
                    className="flex-1 px-1 py-0 text-xs border-b border-gray-300 focus:border-blue-500 outline-none bg-transparent"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="truncate flex-1">{session.lastCompletedTask.content}</span>
                    {hoveredTaskId === session.lastCompletedTask.id && (
                      <button
                        onClick={() => handleStartEdit(session.lastCompletedTask.id, session.lastCompletedTask.content)}
                        className="ml-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✏️
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Progresso</span>
          <span>{progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        Última atualização: {format(new Date(session.lastModified), 'dd/MM/yyyy HH:mm')}
      </div>
      
      <div className="mt-3 flex justify-between items-center">
        <Link
          to={`/claude-sessions/${session.sessionId}`}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Ver detalhes →
        </Link>
        
        <div className="flex items-center gap-2">
          {/* Botão de deletar */}
          <button
            onClick={handleDeleteSession}
            className="p-1 text-red-400 hover:text-red-600 transition-colors text-lg"
            title="Deletar sessão"
            disabled={deleteSessionMutation.isPending}
          >
            🗑️
          </button>
          
          {/* Botão de ocultar/desocultar */}
          <button
            onClick={isHidden ? onUnhide : onHide}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors text-lg"
            title={isHidden ? 'Desocultar sessão' : 'Ocultar sessão'}
          >
            {isHidden ? '👁️' : '🙈'}
          </button>
        </div>
      </div>
    </div>
  )
}