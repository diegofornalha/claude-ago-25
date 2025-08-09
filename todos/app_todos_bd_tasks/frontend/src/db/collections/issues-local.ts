import { z } from 'zod'

export const issueSchema = z.object({
  id: z.string(), // Changed to string to support UUIDs
  title: z.string(),
  description: z.string().nullable(),
  userId: z.number(),
  createdAt: z.string(),
  sessionId: z.string().optional(), // Link to Claude session
})

export type Issue = z.infer<typeof issueSchema>

// Simple local storage implementation
class LocalCollection<T extends { id: string }> {
  private key: string
  private data: T[]

  constructor(key: string, initialData: T[] = []) {
    this.key = key
    const stored = localStorage.getItem(this.key)
    this.data = stored ? JSON.parse(stored) : initialData
    if (!stored && initialData.length > 0) {
      this.save()
    }
  }

  private save() {
    localStorage.setItem(this.key, JSON.stringify(this.data))
  }

  getAll(): T[] {
    return [...this.data]
  }

  getById(id: string): T | undefined {
    return this.data.find(item => item.id === id)
  }

  create(item: T): T {
    this.data.push(item)
    this.save()
    return item
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const index = this.data.findIndex(item => item.id === id)
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...updates } as T
      this.save()
      return this.data[index]
    }
    return undefined
  }

  delete(id: string): boolean {
    const index = this.data.findIndex(item => item.id === id)
    if (index !== -1) {
      this.data.splice(index, 1)
      this.save()
      return true
    }
    return false
  }
}

// Generate a simple UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const issues = new LocalCollection<Issue>('issues', [
  {
    id: generateUUID(),
    title: 'Garantir que a ui e ux estão bem definidas',
    description: null,
    userId: 1,
    createdAt: new Date('2025-05-25').toISOString(),
  },
  {
    id: 'ee6afc7b-0e09-429b-8d71-1217a909b8d7', // Using session ID as issue ID
    title: 'Integrar Missões com Sessões do Claude',
    sessionId: 'ee6afc7b-0e09-429b-8d71-1217a909b8d7', // Same as ID for linked missions
    description: `Implementar a integração completa entre o sistema de Missões e as Sessões do Claude, permitindo:

1. Converter tarefas do Claude em Missões
2. Vincular missões a sessões específicas
3. Sincronizar status entre tarefas e missões
4. Visualizar missões relacionadas nas sessões
5. Rastrear contexto completo das missões

Tarefas:
- [ ] Adicionar campo sessionId no schema de missões
- [ ] Criar botão "Transformar em Missão" nas tarefas do Claude
- [ ] Implementar vinculação de missão com sessão
- [ ] Adicionar seção de missões relacionadas na página de sessão
- [ ] Sincronizar status entre tarefa Claude e missão
- [ ] Mostrar link para sessão original na página da missão
- [ ] Criar indicador visual de missões vinculadas
- [ ] Implementar filtro de missões por sessão`,
    userId: 1,
    createdAt: new Date().toISOString(),
  }
])