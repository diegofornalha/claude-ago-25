interface LockInfo {
  sessionId: string
  timestamp: number
  feature?: string
}

export class TodoLockManager {
  private static locks = new Map<string, LockInfo>()
  private static readonly LOCK_TIMEOUT = 30000 // 30 segundos
  
  // Adquirir lock para editar todos
  static async acquireLock(
    fileName: string, 
    sessionId: string,
    feature?: string
  ): Promise<boolean> {
    const now = Date.now()
    const existingLock = this.locks.get(fileName)
    
    // Verificar se lock expirou
    if (existingLock && (now - existingLock.timestamp) > this.LOCK_TIMEOUT) {
      this.locks.delete(fileName)
    }
    
    // Tentar adquirir lock
    if (!this.locks.has(fileName)) {
      this.locks.set(fileName, {
        sessionId,
        timestamp: now,
        feature
      })
      
      // Broadcast para outras abas/sessões
      this.broadcastLockStatus(fileName, 'acquired', sessionId)
      
      return true
    }
    
    // Lock já existe para outra sessão
    const lock = this.locks.get(fileName)!
    if (lock.sessionId === sessionId) {
      // Renovar próprio lock
      lock.timestamp = now
      return true
    }
    
    return false
  }
  
  // Liberar lock
  static releaseLock(fileName: string, sessionId: string): void {
    const lock = this.locks.get(fileName)
    if (lock?.sessionId === sessionId) {
      this.locks.delete(fileName)
      this.broadcastLockStatus(fileName, 'released', sessionId)
    }
  }
  
  // Verificar status do lock
  static getLockStatus(fileName: string): LockInfo | null {
    const lock = this.locks.get(fileName)
    if (!lock) return null
    
    const now = Date.now()
    if ((now - lock.timestamp) > this.LOCK_TIMEOUT) {
      this.locks.delete(fileName)
      return null
    }
    
    return lock
  }
  
  // Broadcast entre abas usando BroadcastChannel
  private static broadcastLockStatus(
    fileName: string, 
    action: 'acquired' | 'released',
    sessionId: string
  ): void {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('todo-locks')
      channel.postMessage({
        fileName,
        action,
        sessionId,
        timestamp: Date.now()
      })
      channel.close()
    }
  }
  
  // Ouvir mudanças de lock de outras abas
  static listenToLockChanges(callback: (event: any) => void): () => void {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('todo-locks')
      channel.onmessage = callback
      return () => channel.close()
    }
    return () => {}
  }
  
  // Verificar conflitos antes de salvar
  static async checkConflicts(
    fileName: string,
    sessionId: string,
    currentTodos: any[],
    savedTodos: any[]
  ): Promise<{hasConflict: boolean; resolution?: any[]}> {
    // Comparar versões
    const currentSet = new Set(currentTodos.map(t => t.id))
    const savedSet = new Set(savedTodos.map(t => t.id))
    
    // Detectar mudanças conflitantes
    const added = currentTodos.filter(t => !savedSet.has(t.id))
    const removed = savedTodos.filter(t => !currentSet.has(t.id))
    
    if (added.length > 0 || removed.length > 0) {
      // Tentar resolver automaticamente
      const resolution = this.autoResolveConflicts(currentTodos, savedTodos)
      return {
        hasConflict: true,
        resolution
      }
    }
    
    return { hasConflict: false }
  }
  
  // Resolução automática de conflitos
  private static autoResolveConflicts(local: any[], remote: any[]): any[] {
    const merged = new Map<string, any>()
    
    // Adicionar todos remotos primeiro (prioridade)
    remote.forEach(todo => {
      merged.set(todo.id, { ...todo, source: 'remote' })
    })
    
    // Merge com todos locais
    local.forEach(todo => {
      const existing = merged.get(todo.id)
      if (!existing) {
        // Novo todo local
        merged.set(todo.id, { ...todo, source: 'local' })
      } else if (todo.status !== existing.status) {
        // Conflito de status - manter o mais recente
        if (todo.updatedAt > existing.updatedAt) {
          merged.set(todo.id, { ...todo, source: 'local' })
        }
      }
    })
    
    return Array.from(merged.values()).sort((a, b) => 
      parseInt(a.id) - parseInt(b.id)
    )
  }
}