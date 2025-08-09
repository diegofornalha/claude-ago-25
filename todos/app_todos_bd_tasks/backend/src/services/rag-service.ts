import { readFile, writeFile } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CACHE_PATH = join(homedir(), '.claude', 'mcp-rag-cache')
const CACHE_FILE = join(CACHE_PATH, 'documents.json')

interface RAGDocument {
  id: string
  title: string
  content: string
  type: string
  source: string
  created_at?: string
  metadata?: Record<string, any>
}

interface RAGCache {
  documents: RAGDocument[]
}

export class RAGService {
  private cache: RAGCache = { documents: [] }
  private initialized = false

  constructor() {
    // Inicializa de forma síncrona
    this.initializeSync()
  }

  private initializeSync(): void {
    try {
      if (existsSync(CACHE_FILE)) {
        const data = readFileSync(CACHE_FILE, 'utf-8')
        this.cache = JSON.parse(data)
        // Garante que documents seja sempre um array
        if (!this.cache.documents || !Array.isArray(this.cache.documents)) {
          this.cache.documents = []
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cache RAG:', error)
      this.cache = { documents: [] }
    }
    this.initialized = true
  }

  private async loadCache(): Promise<void> {
    try {
      if (existsSync(CACHE_FILE)) {
        const data = await readFile(CACHE_FILE, 'utf-8')
        this.cache = JSON.parse(data)
      }
    } catch (error) {
      console.error('Erro ao carregar cache RAG:', error)
      this.cache = { documents: [] }
    }
  }

  private async saveCache(): Promise<void> {
    try {
      await writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2))
    } catch (error) {
      console.error('Erro ao salvar cache RAG:', error)
    }
  }

  async addDocument(doc: Omit<RAGDocument, 'id' | 'created_at'>): Promise<RAGDocument> {
    // Verificar duplicatas para URLs
    if (doc.metadata?.url || doc.source?.startsWith('http')) {
      const url = doc.metadata?.url || doc.source
      
      // Verificar se já existe documento com exatamente a mesma URL
      const existingIndex = this.cache.documents.findIndex(existingDoc => {
        const existingUrl = existingDoc.metadata?.url || existingDoc.source
        return existingUrl === url
      })
      
      // Se encontrar duplicata exata, atualizar ao invés de adicionar
      if (existingIndex >= 0) {
        const updatedDoc: RAGDocument = {
          ...this.cache.documents[existingIndex],
          ...doc,
          id: this.cache.documents[existingIndex].id,
          created_at: this.cache.documents[existingIndex].created_at,
          metadata: {
            ...this.cache.documents[existingIndex].metadata,
            ...doc.metadata,
            updated_at: new Date().toISOString()
          }
        }
        this.cache.documents[existingIndex] = updatedDoc
        await this.saveCache()
        return updatedDoc
      }
    }
    
    // Verificar duplicatas para playbooks (baseado no source/filepath)
    if (doc.type === 'playbook' && doc.source) {
      const existingIndex = this.cache.documents.findIndex(
        existingDoc => existingDoc.source === doc.source && existingDoc.type === 'playbook'
      )
      
      if (existingIndex >= 0) {
        // Atualizar documento existente
        const updatedDoc: RAGDocument = {
          ...this.cache.documents[existingIndex],
          ...doc,
          id: this.cache.documents[existingIndex].id,
          created_at: this.cache.documents[existingIndex].created_at,
          metadata: {
            ...this.cache.documents[existingIndex].metadata,
            ...doc.metadata,
            updated_at: new Date().toISOString()
          }
        }
        this.cache.documents[existingIndex] = updatedDoc
        await this.saveCache()
        return updatedDoc
      }
    }
    
    // Se não for duplicata, adicionar novo documento
    const newDoc: RAGDocument = {
      ...doc,
      id: `doc_${Date.now()}`,
      created_at: new Date().toISOString()
    }
    
    this.cache.documents.push(newDoc)
    await this.saveCache()
    
    return newDoc
  }

  async removeDocument(id: string): Promise<boolean> {
    const index = this.cache.documents.findIndex(doc => doc.id === id)
    if (index >= 0) {
      this.cache.documents.splice(index, 1)
      await this.saveCache()
      return true
    }
    return false
  }

  async search(query: string, limit = 5): Promise<RAGDocument[]> {
    const queryLower = query.toLowerCase()
    const results = this.cache.documents.filter(doc => {
      const content = `${doc.title} ${doc.content}`.toLowerCase()
      return content.includes(queryLower)
    })
    
    return results.slice(0, limit)
  }

  async listDocuments(): Promise<RAGDocument[]> {
    return this.cache.documents
  }

  async getStats() {
    const typeCount: Record<string, number> = {}
    const sourceCount: Record<string, number> = {}
    
    for (const doc of this.cache.documents) {
      typeCount[doc.type] = (typeCount[doc.type] || 0) + 1
      sourceCount[doc.source] = (sourceCount[doc.source] || 0) + 1
    }
    
    return {
      total_documents: this.cache.documents.length,
      types: typeCount,
      sources: sourceCount,
      cache_file: CACHE_FILE
    }
  }

  // Método especial para indexar conversas do Claude
  async indexClaudeSession(sessionId: string, messages: any[]): Promise<void> {
    const content = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
    const title = `Claude Session: ${sessionId}`
    
    await this.addDocument({
      title,
      content,
      type: 'claude_session',
      source: 'claude_projects',
      metadata: {
        sessionId,
        messageCount: messages.length,
        indexed_at: new Date().toISOString()
      }
    })
  }
}

// Singleton
export const ragService = new RAGService()