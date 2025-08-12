import { useState, useEffect, useCallback } from 'react'

interface TodoLock {
  sessionId: string
  lockedAt: string
  expiresAt: string
  context: string
  operation: 'read' | 'write' | 'delete'
}

interface CoordinationConfig {
  sessionId: string
  context: 'frontend' | 'backend' | 'rag' | 'general'
  projectPath?: string
  lockTimeout?: number // em ms, padrão 5 min
}

export function useTodoCoordination(config: CoordinationConfig) {
  const { 
    sessionId, 
    context, 
    projectPath = 'app_todos_bd_tasks',
    lockTimeout = 5 * 60 * 1000 // 5 
  } = config

  const [hasLock, setHasLock] = useState(false)
  const [conflicts, setConflicts] = useState<TodoLock[]>([])
  const [isChecking, setIsChecking] = useState(false)

  // Gerar caminho do arquivo baseado no contexto
  const getTodoFilePath = useCallback(() => {
    if (projectPath) {
      return `todos/${projectPath}/${context}/${sessionId}.json`
    }
    return `todos/sessions/${sessionId}/main.json`
  }, [sessionId, context, projectPath])

  // Verificar se há locks ativos
  const checkActiveLocks = useCallback(async (): Promise<TodoLock[]> => {
    const lockKey = `todo-locks-${projectPath}-${context}`
    const locksData = localStorage.getItem(lockKey)
    
    if (!locksData) return []
    
    try {
      const locks: TodoLock[] = JSON.parse(locksData)
      const now = new Date().getTime()
      
      // Filtrar locks não expirados
      const activeLocks = locks.filter(lock => {
        const expiresAt = new Date(lock.expiresAt).getTime()
        return expiresAt > now && lock.sessionId !== sessionId
      })
      
      // Limpar locks expirados
      if (activeLocks.length !== locks.length) {
        localStorage.setItem(lockKey, JSON.stringify(activeLocks))
      }
      
      return activeLocks
    } catch (error) {
      console.error('Erro ao verificar locks:', error)
      return []
    }
  }, [sessionId, context, projectPath])

  // Criar lock
  const createLock = useCallback(async (operation: 'read' | 'write' | 'delete' = 'write'): Promise<boolean> => {
    setIsChecking(true)
    
    try {
      // Verificar conflitos primeiro
      const activeLocks = await checkActiveLocks()
      
      if (activeLocks.length > 0 && operation === 'write') {
        console.warn('Conflitos detectados:', activeLocks)
        setConflicts(activeLocks)
        setIsChecking(false)
        return false
      }
      
      // Criar novo lock
      const now = new Date()
      const expires = new Date(now.getTime() + lockTimeout)
      
      const newLock: TodoLock = {
        sessionId,
        lockedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        context,
        operation
      }
      
      // Adicionar ao storage
      const lockKey = `todo-locks-${projectPath}-${context}`
      const existingLocks = await checkActiveLocks()
      const updatedLocks = [...existingLocks, newLock]
      
      localStorage.setItem(lockKey, JSON.stringify(updatedLocks))
      
      // Broadcast para outras abas
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('todo-coordination')
        channel.postMessage({
          type: 'lock-created',
          lock: newLock,
          projectPath,
          context
        })
        channel.close()
      }
      
      setHasLock(true)
      setConflicts([])
      setIsChecking(false)
      
      // Auto-renovar lock enquanto ativo
      const renewInterval = setInterval(() => {
        renewLock()
      }, lockTimeout / 2) // Renovar na metade do tempo
      
      // Limpar ao desmontar
      return () => {
        clearInterval(renewInterval)
        releaseLock()
      }
      
    } catch (error) {
      console.error('Erro ao criar lock:', error)
      setIsChecking(false)
      return false
    }
  }, [sessionId, context, projectPath, lockTimeout, checkActiveLocks])

  // Renovar lock
  const renewLock = useCallback(async () => {
    if (!hasLock) return
    
    const lockKey = `todo-locks-${projectPath}-${context}`
    const locksData = localStorage.getItem(lockKey)
    
    if (!locksData) return
    
    try {
      const locks: TodoLock[] = JSON.parse(locksData)
      const lockIndex = locks.findIndex(l => l.sessionId === sessionId)
      
      if (lockIndex !== -1) {
        const now = new Date()
        const expires = new Date(now.getTime() + lockTimeout)
        
        locks[lockIndex] = {
          ...locks[lockIndex],
          expiresAt: expires.toISOString()
        }
        
        localStorage.setItem(lockKey, JSON.stringify(locks))
      }
    } catch (error) {
      console.error('Erro ao renovar lock:', error)
    }
  }, [sessionId, context, projectPath, lockTimeout, hasLock])

  // Liberar lock
  const releaseLock = useCallback(async () => {
    if (!hasLock) return
    
    const lockKey = `todo-locks-${projectPath}-${context}`
    const locksData = localStorage.getItem(lockKey)
    
    if (!locksData) return
    
    try {
      const locks: TodoLock[] = JSON.parse(locksData)
      const filteredLocks = locks.filter(l => l.sessionId !== sessionId)
      
      localStorage.setItem(lockKey, JSON.stringify(filteredLocks))
      
      // Broadcast liberação
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('todo-coordination')
        channel.postMessage({
          type: 'lock-released',
          sessionId,
          projectPath,
          context
        })
        channel.close()
      }
      
      setHasLock(false)
    } catch (error) {
      console.error('Erro ao liberar lock:', error)
    }
  }, [sessionId, context, projectPath, hasLock])

  // Ouvir mudanças de outras abas
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    
    const channel = new BroadcastChannel('todo-coordination')
    
    channel.onmessage = async (event) => {
      if (event.data.projectPath === projectPath && event.data.context === context) {
        // Re-verificar conflitos quando houver mudanças
        const activeLocks = await checkActiveLocks()
        setConflicts(activeLocks)
      }
    }
    
    return () => {
      channel.close()
    }
  }, [projectPath, context, checkActiveLocks])

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (hasLock) {
        releaseLock()
      }
    }
  }, [hasLock, releaseLock])

  return {
    // Estado
    hasLock,
    conflicts,
    isChecking,
    
    // Ações
    createLock,
    releaseLock,
    checkConflicts: checkActiveLocks,
    
    // Helpers
    getTodoFilePath,
    canWrite: hasLock || conflicts.length === 0,
    canRead: true, // Sempre pode ler
    
    // Metadados
    sessionId,
    context,
    projectPath
  }
}

// Hook auxiliar para auto-coordenação
export function useAutoCoordination(
  sessionId: string,
  detectContext: () => 'frontend' | 'backend' | 'rag' | 'general'
) {
  const [context, setContext] = useState(detectContext())
  
  const coordination = useTodoCoordination({
    sessionId,
    context
  })
  
  // Re-detectar contexto periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      const newContext = detectContext()
      if (newContext !== context) {
        setContext(newContext)
      }
    }, 10000) // A cada 10 segundos
    
    return () => clearInterval(interval)
  }, [context, detectContext])
  
  return coordination
}