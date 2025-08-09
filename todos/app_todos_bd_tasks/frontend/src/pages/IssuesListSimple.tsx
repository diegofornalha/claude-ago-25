import { Link } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage'

interface Issue {
  id: number
  title: string
  description: string | null
  userId: number
  createdAt: string
}

export function IssuesListSimple() {
  const [issues] = useLocalStorage<Issue[]>('issues', [
    {
      id: 1,
      title: 'Exemplo de Issue',
      description: 'Esta é uma issue de exemplo para demonstrar o funcionamento',
      userId: 1,
      createdAt: new Date().toISOString(),
    }
  ])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Issues</h1>
            <p className="text-zinc-400 mt-2">Gerencie suas issues e tarefas</p>
          </div>
          <Link
            to="/issues/new"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Issue
          </Link>
        </div>

        <div className="space-y-4">
          {issues.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-zinc-500 text-lg">Nenhuma issue encontrada</p>
              <p className="text-zinc-600 mt-2">Crie sua primeira issue para começar</p>
            </div>
          ) : (
            issues.map(item => (
              <Link
                key={item.id}
                to={`/issues/${item.id}`}
                className="block bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-all hover:shadow-lg hover:shadow-zinc-900/50"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-mono text-zinc-500">
                    ISS-{String(item.id).padStart(3, '0')}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                
                {item.description && (
                  <p className="text-zinc-400 text-sm line-clamp-2 mb-3">
                    {item.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1 text-zinc-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Diego</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}