import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { issues } from '../db/collections/issues-local'

export function CreateIssueLocal() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim()) {
      return
    }

    // Generate UUID for new issue
    const generateUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    // Criar nova missão
    const newIssue = {
      id: generateUUID(),
      title,
      description: description.trim() || null,
      userId: 1,
      createdAt: new Date().toISOString(),
    }
    
    issues.create(newIssue)
    navigate('/')
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-800">Nova Missão</h1>
          <p className="text-gray-600 mt-2">Crie uma nova missão para acompanhar</p>
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
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Criar Missão
            </button>
            <Link
              to="/"
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