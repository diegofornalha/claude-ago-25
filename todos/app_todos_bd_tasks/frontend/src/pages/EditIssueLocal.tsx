import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { issues } from '../db/collections/issues-local'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3344'

export function EditIssueLocal() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingToClaude, setSendingToClaude] = useState(false)
  const [claudeResponse, setClaudeResponse] = useState<any>(null)

  useEffect(() => {
    // Buscar missão existente
    const issue = issues.getById(id || '')
    if (issue) {
      setTitle(issue.title)
      setDescription(issue.description || '')
    }
    setLoading(false)
  }, [id])

  async function sendToClaude() {
    if (!title.trim()) {
      return
    }

    setSendingToClaude(true)
    setClaudeResponse(null)

    try {
      const response = await fetch(`${API_URL}/api/claude-sessions/send-mission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id || '',
          title,
          description: description.trim() || undefined,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setClaudeResponse(data)
        
        // Atualizar a missão com o sessionId se foi criado
        if (data.sessionId) {
          issues.update(id || '', {
            sessionId: data.sessionId,
          })
        }
      } else {
        console.error('Erro ao enviar para Claude:', data.error)
        alert('Erro ao processar com Claude: ' + data.error)
      }
    } catch (error) {
      console.error('Erro ao enviar para Claude:', error)
      alert('Erro ao conectar com Claude')
    } finally {
      setSendingToClaude(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      return
    }

    // Atualizar missão
    issues.update(id || '', {
      title,
      description: description.trim() || null,
    })
    
    // Enviar para Claude
    await sendToClaude()
    
    // Navegar de volta
    setTimeout(() => {
      navigate(`/issues/${id}`)
    }, 2000)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            to={`/issues/${id}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-800">Editar Missão</h1>
          <p className="text-gray-600 mt-2">Atualize as informações da missão</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Título *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Descreva brevemente a missão..."
              autoFocus
              required
              disabled={sendingToClaude}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Descrição
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder="Adicione detalhes sobre a missão..."
              disabled={sendingToClaude}
            />
          </div>

          {sendingToClaude && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <p className="text-blue-700">Enviando missão para Claude...</p>
              </div>
            </div>
          )}

          {claudeResponse && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">✅ Claude processou a missão!</h3>
              <p className="text-sm text-green-700 mb-2">
                {claudeResponse.sessionId}
              </p>
              {claudeResponse.todos.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-green-800 mb-1">
                    Tarefas sugeridas: {claudeResponse.todos.length}
                  </p>
                  <ul className="text-sm text-green-700 list-disc list-inside">
                    {claudeResponse.todos.slice(0, 3).map((todo: any, index: number) => (
                      <li key={index}>{todo.content}</li>
                    ))}
                    {claudeResponse.todos.length > 3 && (
                      <li>... e mais {claudeResponse.todos.length - 3} tarefas</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={sendingToClaude}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingToClaude ? 'Processando...' : 'Salvar Alterações'}
            </button>
            <Link
              to={`/issues/${id}`}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}