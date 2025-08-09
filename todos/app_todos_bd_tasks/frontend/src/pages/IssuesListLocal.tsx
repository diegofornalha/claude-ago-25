import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { issues } from '../db/collections/issues-local'
import { users } from '../db/collections/users-local'

export function IssuesListLocal() {
  const [issuesList, setIssuesList] = useState<any[]>([])

  useEffect(() => {
    // Buscar issues e fazer join manual com users
    const allIssues = issues.getAll()
    const allUsers = users.getAll()
    
    const issuesWithUsers = allIssues.map(issue => {
      const user = allUsers.find(u => u.id === issue.userId)
      return {
        ...issue,
        userName: user?.name || 'Unknown'
      }
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    setIssuesList(issuesWithUsers)
  }, [])

  return (
    <div className="container mx-auto p-4">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">
          <span className="mr-2">⚠️</span>
          Potenciais Problemas
        </h1>
        <Link
          to="/issues/new"
          className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
        >
          Reportar Problema
        </Link>
      </div>

      <div className="space-y-4">
        {issuesList.map((issue) => (
          <div
            key={issue.id}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 relative"
          >
            <Link
              to={`/issues/${issue.id}`}
              className="block"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {issue.title}
                  </h2>
                  {issue.sessionId && (
                    <div className="text-sm text-blue-600 mb-1">
                      Vinculada à {issue.sessionId.slice(0, 8)}...
                    </div>
                  )}
                  {issue.description && (
                    <p className="text-gray-600 mb-3">
                      {issue.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Por {issue.userName}</span>
                    <span>
                      {new Date(issue.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (confirm('Tem certeza que deseja deletar esta missão?')) {
                  issues.delete(issue.id)
                  setIssuesList(prev => prev.filter(i => i.id !== issue.id))
                }
              }}
              className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="Deletar missão"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {issuesList.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Nenhuma missão encontrada</p>
          <Link
            to="/issues/new"
            className="inline-block mt-4 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors"
          >
            Criar primeira missão
          </Link>
        </div>
      )}
    </div>
  )
}