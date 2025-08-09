export interface TodoSyncConfig {
  // Modo de sincronização
  mode: 'isolated' | 'shared' | 'collaborative'
  
  // Estratégia de resolução de conflitos
  conflictResolution: 'last-write-wins' | 'merge' | 'manual'
  
  // Namespace para isolar todos
  useNamespace: boolean
  
  // Tempo de lock em ms
  lockTimeout: number
  
  // Auto-save interval em ms
  autoSaveInterval: number
}

export const defaultTodoSyncConfig: TodoSyncConfig = {
  mode: 'isolated', // Cada sessão tem seus próprios todos
  conflictResolution: 'merge',
  useNamespace: true,
  lockTimeout: 30000,
  autoSaveInterval: 5000
}

// Configurações por tipo de projeto
export const projectConfigs: Record<string, Partial<TodoSyncConfig>> = {
  'app_todos_bd_tasks': {
    mode: 'collaborative', // Múltiplas sessões podem colaborar
    conflictResolution: 'merge',
    useNamespace: true
  },
  'single_session': {
    mode: 'isolated',
    conflictResolution: 'last-write-wins',
    useNamespace: false
  }
}

// Helper para obter configuração baseada no projeto
export function getTodoSyncConfig(projectPath: string): TodoSyncConfig {
  const projectName = projectPath.split('/').pop() || ''
  return {
    ...defaultTodoSyncConfig,
    ...(projectConfigs[projectName] || {})
  }
}