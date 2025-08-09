import { z } from 'zod'

export const userSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
})

export type User = z.infer<typeof userSchema>

// Simple local storage implementation
class LocalCollection<T extends { id: number }> {
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

  getById(id: number): T | undefined {
    return this.data.find(item => item.id === id)
  }

  create(item: T): T {
    this.data.push(item)
    this.save()
    return item
  }

  update(id: number, updates: Partial<T>): T | undefined {
    const index = this.data.findIndex(item => item.id === id)
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...updates }
      this.save()
      return this.data[index]
    }
    return undefined
  }

  delete(id: number): boolean {
    const index = this.data.findIndex(item => item.id === id)
    if (index !== -1) {
      this.data.splice(index, 1)
      this.save()
      return true
    }
    return false
  }
}

export const users = new LocalCollection<User>('users', [
  {
    id: 1,
    name: 'Diego',
    email: 'diego@example.com',
  }
])