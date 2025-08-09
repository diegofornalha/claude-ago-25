import { Link, useParams } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage'

interface Issue {
  id: number
  title: string
  description: string | null
  userId: number
  createdAt: string
}

export function IssueDetailSimple() {
  const { id } = useParams<{ id: string }>()
  const [issues] = useLocalStorage<Issue[]>('issues', [])
  
  const issue = issues.find(i => i.id === Number(id))

  if (!issue) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Issue não encontrada</h2>
          <Link to="/" className="text-indigo-400 hover:text-indigo-300">
            Voltar para lista
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar para lista
          </Link>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <span className="text-sm font-mono text-zinc-500 block mb-2">
                ISS-{String(issue.id).padStart(3, '0')}
              </span>
              <h1 className="text-3xl font-bold">{issue.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-red-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <p className="text-sm text-zinc-500 mb-1">Criado por</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm font-medium">
                  D
                </div>
                <span className="font-medium">Diego</span>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-zinc-500 mb-1">Data de criação</p>
              <p className="font-medium">
                {new Date(issue.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-zinc-500 mb-1">Status</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-400 border border-green-800">
                Aberto
              </span>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-8">
            <h2 className="text-xl font-semibold mb-4">Descrição</h2>
            {issue.description ? (
              <p className="text-zinc-300 whitespace-pre-wrap">{issue.description}</p>
            ) : (
              <p className="text-zinc-500 italic">Nenhuma descrição fornecida.</p>
            )}
          </div>

          <div className="border-t border-zinc-800 pt-8 mt-8">
            <h2 className="text-xl font-semibold mb-4">Integração</h2>
            <div className="w-full">
              <button 
                onClick={() => {
                  const prompt = `Trabalhe na seguinte issue:\n\nTítulo: ${issue.title}\n\nDescrição: ${issue.description || 'Sem descrição'}\n\nID: ISS-${String(issue.id).padStart(3, '0')}`
                  navigator.clipboard.writeText(prompt)
                  alert('Prompt copiado para a área de transferência! Cole no Claude Code para começar a trabalhar.')
                }}
                className="w-full flex items-center gap-4 p-6 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 rounded-lg hover:from-indigo-900/30 hover:to-purple-900/30 transition-all border border-indigo-700/50 hover:border-indigo-600"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-lg">Claude Code</p>
                  <p className="text-sm text-zinc-400">Clique para copiar o prompt e trabalhar nesta issue com IA</p>
                </div>
                <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}