import { useOptimisticMutation } from '@tanstack/react-db'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { issues } from '../db/collections/issues-local'

export function CreateIssue() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const createIssueMutation = useOptimisticMutation({
    mutationFn: async ({ transaction }) => {
      const { collection } = transaction.mutations[0]
      await collection.commitPendingTransactions
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      return
    }

    createIssueMutation.mutate(() => {
      issues.insert({
        id: Math.round(Math.random() * 100000),
        title,
        description: description.trim() || null,
        userId: 1,
        createdAt: new Date().toISOString(),
      })
    })

    navigate('/')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </Link>
          
          <h1 className="text-3xl font-bold">Nova Issue</h1>
          <p className="text-zinc-400 mt-2">Crie uma nova issue para acompanhar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Título *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
              placeholder="Descreva brevemente a issue..."
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Descrição
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all resize-none"
              placeholder="Adicione detalhes sobre a issue..."
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Criar Issue
            </button>
            <Link
              to="/"
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}