import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

export function ClaudeSessionDetailDebug() {
  const { sessionId } = useParams<{ sessionId: string }>()
  
  // Debug: Log quando o componente monta
  useEffect(() => {
    console.log('ClaudeSessionDetailDebug mounted with sessionId:', sessionId)
  }, [sessionId])
  
  const { data: session, isLoading, error } = useQuery({
    queryKey: ['claude-session-detail', sessionId],
    queryFn: async () => {
      console.log('Fetching session:', sessionId)
      try {
        const response = await fetch(`${API_URL}/api/claude-sessions/${sessionId}`)
        console.log('Response status:', response.status)
        if (!response.ok) throw new Error('Falha ao buscar sessão')
        const data = await response.json()
        console.log('Session data:', data)
        return data.session as SessionDetail
      } catch (err) {
        console.error('Error fetching session:', err)
        throw err
      }
    },
    refetchInterval: 5000,
  })

  // Debug: Log estado do loading
  useEffect(() => {
    console.log('Loading state:', { isLoading, error, hasSession: !!session })
  }, [isLoading, error, session])

  // Sempre renderizar algo visível para debug
  return (
    <div className="container mx-auto p-4">
      <div className="bg-yellow-100 p-4 mb-4 rounded">
        <h2 className="font-bold">Debug Info:</h2>
        <p>SessionId: {sessionId || 'undefined'}</p>
        <p>IsLoading: {isLoading ? 'true' : 'false'}</p>
        <p>Error: {error ? error.message : 'none'}</p>
        <p>Has Session: {session ? 'true' : 'false'}</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Carregando detalhes da sessão...</div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Erro: {error.message}</div>
        </div>
      )}

      {session && (
        <div>
          <div className="mb-6">
            <Link to="/claude-sessions" className="text-blue-600 hover:text-blue-800">
              ← Voltar para sessões
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-2xl font-bold mb-4">
              {sessionId?.slice(0, 8)}...
            </h1>
            <p className="text-gray-600">
              Total de tarefas: {session.todos.length}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}