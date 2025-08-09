import { useState, useEffect } from 'react'

interface TodoNamespace {
  sessionId: string
  context: string
  feature?: string
}

export function useTodoNamespace(sessionId: string) {
  const [namespace, setNamespace] = useState<TodoNamespace>({
    sessionId,
    context: 'general'
  })

  // Detectar contexto baseado no conteúdo dos todos
  const detectContext = (todos: any[]) => {
    const keywords = {
      frontend: ['component', 'react', 'ui', 'css', 'tailwind'],
      backend: ['api', 'server', 'database', 'endpoint'],
      rag: ['embedding', 'vector', 'search', 'index'],
      devops: ['shell', 'docker', 'deploy', 'ci/cd']
    }

    for (const [context, words] of Object.entries(keywords)) {
      const hasKeyword = todos.some(todo => 
        words.some(word => 
          todo.content.toLowerCase().includes(word)
        )
      )
      if (hasKeyword) return context
    }
    return 'general'
  }

  // Criar nome de arquivo único por contexto
  const getFileName = (sessionId: string, context: string) => {
    return `${sessionId}-${context}.json`
  }

  // Prevenir conflitos ao salvar
  const saveTodos = async (todos: any[], context: string) => {
    const fileName = getFileName(sessionId, context)
    
    // Adicionar lock para prevenir escritas simultâneas
    const lockKey = `todo-lock-${fileName}`
    const maxWaitTime = 5000 // 5 segundos
    const startTime = Date.now()
    
    while (localStorage.getItem(lockKey) === 'locked') {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Timeout esperando lock de todos')
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    try {
      localStorage.setItem(lockKey, 'locked')
      
      // Salvar todos com timestamp
      const data = {
        todos,
        context,
        sessionId,
        updatedAt: new Date().toISOString(),
        version: Date.now()
      }
      
      localStorage.setItem(`todos-${fileName}`, JSON.stringify(data))
      
    } finally {
      localStorage.removeItem(lockKey)
    }
  }

  // Merge de todos de diferentes sessões
  const mergeTodos = (todoLists: any[][]) => {
    const merged = new Map()
    
    todoLists.forEach(todos => {
      todos.forEach(todo => {
        const key = `${todo.content}-${todo.status}`
        if (!merged.has(key) || todo.updatedAt > merged.get(key).updatedAt) {
          merged.set(key, todo)
        }
      })
    })
    
    return Array.from(merged.values())
  }

  return {
    namespace,
    detectContext,
    getFileName,
    saveTodos,
    mergeTodos
  }
}