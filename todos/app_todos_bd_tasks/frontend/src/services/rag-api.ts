/**
 * RAG API Service - Interface para comunicação com o servidor MCP RAG v2
 */

export interface RAGDocument {
  id: string
  title?: string
  content: string
  source: string
  type?: string
  tags?: string[]
  category?: string
  hash?: string
  created_at?: string
  updated_at?: string
  version?: number
  score?: number
  metadata?: {
    url?: string
    capturedVia?: string
    timestamp?: string
    [key: string]: any
  }
}

export interface RAGStats {
  total_documents: number
  total_size_bytes: number
  total_size_mb: number
  cache_file: string
  cache_dir: string
  has_embeddings: boolean
  embedding_model?: string
  has_tfidf: boolean
  categories?: Record<string, number>
  sources?: Record<string, number>
  top_tags?: Record<string, number>
  oldest_doc?: string
  newest_doc?: string
  unique_hashes?: number
}

export interface SearchResult {
  results: RAGDocument[]
  query: string
  total: number
  search_type?: 'semantic' | 'text'
}

class RAGAPIService {
  private baseURL = '/api/rag'
  
  /**
   * Busca semântica ou textual nos documentos
   */
  async search(query: string, limit = 5, useSemantic = true): Promise<SearchResult> {
    const response = await fetch(`${this.baseURL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit, use_semantic: useSemantic })
    })
    
    if (!response.ok) throw new Error('Erro na busca')
    return response.json()
  }
  
  /**
   * Busca documentos por tags
   */
  async searchByTags(tags: string[], limit = 10): Promise<SearchResult> {
    const response = await fetch(`${this.baseURL}/search/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, limit })
    })
    
    if (!response.ok) throw new Error('Erro na busca por tags')
    return response.json()
  }
  
  /**
   * Busca documentos por categoria
   */
  async searchByCategory(category: string, limit = 10): Promise<SearchResult> {
    const response = await fetch(`${this.baseURL}/search/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, limit })
    })
    
    if (!response.ok) throw new Error('Erro na busca por categoria')
    return response.json()
  }
  
  /**
   * Adiciona novo documento
   */
  async addDocument(doc: Partial<RAGDocument>): Promise<RAGDocument> {
    const response = await fetch(`${this.baseURL}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc)
    })
    
    if (!response.ok) throw new Error('Erro ao adicionar documento')
    return response.json()
  }
  
  /**
   * Atualiza documento existente
   */
  async updateDocument(id: string, updates: Partial<RAGDocument>): Promise<boolean> {
    const response = await fetch(`${this.baseURL}/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) throw new Error('Erro ao atualizar documento')
    const result = await response.json()
    return result.success
  }
  
  /**
   * Remove documento
   */
  async removeDocument(id: string): Promise<boolean> {
    const response = await fetch(`${this.baseURL}/documents/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) throw new Error('Erro ao remover documento')
    const result = await response.json()
    return result.success
  }
  
  /**
   * Lista documentos com filtros opcionais
   */
  async listDocuments(filters?: {
    category?: string
    tags?: string[]
    source?: string
  }): Promise<RAGDocument[]> {
    const params = new URLSearchParams()
    if (filters?.category) params.append('category', filters.category)
    if (filters?.tags) params.append('tags', filters.tags.join(','))
    if (filters?.source) params.append('source', filters.source)
    
    const response = await fetch(`${this.baseURL}/documents?${params}`)
    
    if (!response.ok) throw new Error('Erro ao listar documentos')
    const result = await response.json()
    return result.documents || []
  }
  
  /**
   * Obtém estatísticas do cache
   */
  async getStats(): Promise<RAGStats> {
    const response = await fetch(`${this.baseURL}/stats`)
    
    if (!response.ok) throw new Error('Erro ao obter estatísticas')
    return response.json()
  }
  
  /**
   * Carrega documentos diretamente do cache local (fallback)
   */
  async loadLocalCache(): Promise<{
    documents: RAGDocument[]
    stats: RAGStats
  }> {
    try {
      // Tenta carregar do servidor primeiro
      const [documents, stats] = await Promise.all([
        this.listDocuments(),
        this.getStats()
      ])
      
      return { documents, stats }
    } catch (error) {
      console.error('Erro ao carregar do servidor, usando mock:', error)
      
      // Fallback para dados mock
      return {
        documents: [
          {
            id: 'doc_1748318937933',
            title: 'Introduction - Model Context Protocol',
            content: 'MCP is an open protocol that standardizes how applications provide context to LLMs...',
            source: 'https://modelcontextprotocol.io',
            type: 'webpage',
            tags: ['mcp', 'protocol', 'ai'],
            category: 'documentation',
            created_at: '2025-05-27T04:08:57.933Z'
          }
        ],
        stats: {
          total_documents: 10,
          total_size_bytes: 31034,
          total_size_mb: 0.03,
          cache_file: '/Users/agents/.claude/mcp-rag-cache/documents.json',
          cache_dir: '/Users/agents/.claude/mcp-rag-cache',
          has_embeddings: true,
          embedding_model: 'all-MiniLM-L6-v2',
          has_tfidf: true,
          categories: {
            documentation: 4,
            webpage: 3,
            code: 2,
            text: 1
          },
          sources: {
            'modelcontextprotocol.io': 3,
            'manual': 4,
            'test': 2,
            'github.com': 1
          },
          top_tags: {
            mcp: 5,
            protocol: 3,
            ai: 3,
            documentation: 2
          },
          oldest_doc: '2025-05-27T04:08:57.933Z',
          newest_doc: '2025-08-09T00:43:21.491290',
          unique_hashes: 10
        }
      }
    }
  }
}

export const ragAPI = new RAGAPIService()