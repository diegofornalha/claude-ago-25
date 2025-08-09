import { useLiveQuery } from '@tanstack/react-db'
import { Link, useParams } from 'react-router-dom'
import { issues } from '../db/collections/issues-local'
import { users } from '../db/collections/users-local'

export function IssueDetail() {
  const { id } = useParams<{ id: string }>()
  
  const { data } = useLiveQuery(query => {
    return query
      .from({ issues })
      .join({
        type: 'inner',
        from: { users },
        on: ['@users.id', '=', '@issues.userId'],
      })
      .select('@issues.id', '@issues.title', '@issues.description', '@issues.createdAt', '@users.name')
      .where(['@issues.id', '=', Number(id)])
      .limit(1)
  })

  const issue = data[0]

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
                  {issue.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium">{issue.name}</span>
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
            <h2 className="text-xl font-semibold mb-4">Integrations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors border border-zinc-700">
                <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <div className="text-left">
                  <p className="font-medium">GitHub</p>
                  <p className="text-sm text-zinc-500">Conectar ao GitHub</p>
                </div>
              </button>

              <button className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors border border-zinc-700">
                <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.19 0 2.34-.21 3.41-.6.3-.11.49-.4.49-.72v-3.68c0-.43-.35-.78-.78-.78-.32 0-.59.19-.71.47A7.01 7.01 0 0112 19c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7c0 .79-.13 1.54-.36 2.25-.23.69-.87 1.15-1.58 1.15s-1.3-.51-1.48-1.17A3 3 0 0012 9a3 3 0 000 6 3 3 0 002.83-2h2.17c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5 5 2.24 5 5c0 .34-.04.67-.09 1h2.09c.05-.33.09-.66.09-1 0-5.52-4.48-10-10-10z"/>
                </svg>
                <div className="text-left">
                  <p className="font-medium">Jira</p>
                  <p className="text-sm text-zinc-500">Sincronizar com Jira</p>
                </div>
              </button>

              <button className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors border border-zinc-700">
                <svg className="w-8 h-8 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
                <div className="text-left">
                  <p className="font-medium">Slack</p>
                  <p className="text-sm text-zinc-500">Enviar notificações</p>
                </div>
              </button>

              <button className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors border border-zinc-700">
                <svg className="w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <div className="text-left">
                  <p className="font-medium">Linear</p>
                  <p className="text-sm text-zinc-500">Importar do Linear</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}