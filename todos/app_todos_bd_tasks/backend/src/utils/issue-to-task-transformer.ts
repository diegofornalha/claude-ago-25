import type { Issue } from '../db/schema/issues.js'

export interface Task {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  id: string
}

/**
 * Transforma uma issue do banco de dados em uma tarefa no formato desejado
 */
export function issueToTask(issue: Issue): Task {
  // Mapear status
  const statusMap: Record<string, Task['status']> = {
    'open': 'pending',
    'in_progress': 'in_progress',
    'done': 'completed'
  }

  // Criar content: se tiver descrição, concatenar com título
  const content = issue.description 
    ? `${issue.title}: ${issue.description}`
    : issue.title

  return {
    content,
    status: statusMap[issue.status || 'open'] || 'pending',
    priority: issue.priority || 'medium',
    id: issue.id.toString()
  }
}

/**
 * Transforma múltiplas issues em tarefas
 */
export function issuesToTasks(issues: Issue[]): Task[] {
  return issues.map(issueToTask)
}

/**
 * Transforma uma tarefa de volta para o formato de issue (para criação/atualização)
 */
export function taskToIssue(task: Task, userId: number): Partial<Issue> {
  // Mapear status reverso
  const statusMap: Record<Task['status'], string> = {
    'pending': 'open',
    'in_progress': 'in_progress',
    'completed': 'done'
  }

  // Separar título e descrição se houver ":"
  const [title, ...descriptionParts] = task.content.split(':')
  const description = descriptionParts.length > 0 
    ? descriptionParts.join(':').trim() 
    : null

  return {
    title: title.trim(),
    description,
    status: statusMap[task.status],
    priority: task.priority,
    userId
  }
}