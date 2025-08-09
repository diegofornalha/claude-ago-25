import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

interface RAGDocument {
  id: string
  content: string
  source: string
  metadata: {
    url?: string
    title?: string
    capturedVia?: string
    timestamp?: string
    type?: string
  }
  timestamp: string
  similarity?: number
}

interface RAGStats {
  total: number
  byType: Record<string, number>
  bySource: Record<string, number>
  lastUpdated: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

/**
 * Hook para buscar documentos do RAG
 */
export function useRAGDocuments(limit = 50) {
  return useQuery<RAGDocument[]>({
    queryKey: ['rag-documents', limit],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/rag/documents?limit=${limit}`)
      
      if (!response.ok) {
        // Se for erro 500, assumir que é cache não inicializado e retornar array vazio
        if (response.status === 500) {
          return []
        }
        throw new Error('Erro ao buscar documentos')
      }
      
      const data = await response.json()
      
      // Se não houver documentos, retornar array vazio
      if (!data.documents || data.documents.length === 0) {
        return []
      }
      
      // Transformar dados do backend para o formato do frontend
      return data.documents.map((doc: any) => ({
        id: doc.id || doc.source,
        content: doc.content,
        source: doc.source,
        metadata: doc.metadata || {},
        timestamp: doc.timestamp || new Date().toISOString(),
        similarity: doc.similarity
      }))
    },
    staleTime: 30000, // 30 segundos
    retry: 1 // Reduzir tentativas para não ficar mostrando erro repetidamente
  })
}

/**
 * Hook para buscar estatísticas do RAG
 */
export function useRAGStats() {
  return useQuery<RAGStats>({
    queryKey: ['rag-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/rag/stats`)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar estatísticas')
      }
      
      return response.json()
    },
    staleTime: 60000, // 1 minuto
  })
}

/**
 * Hook para buscar no RAG
 */
export function useRAGSearch() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ query, limit = 10 }: { query: string; limit?: number }) => {
      const response = await fetch(`${API_URL}/api/rag/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, limit })
      })
      
      if (!response.ok) {
        throw new Error('Erro na busca')
      }
      
      const data = await response.json()
      return data.results as RAGDocument[]
    },
    onSuccess: (data) => {
      // Cache os resultados da busca
      queryClient.setQueryData(['rag-search-results'], data)
    },
    onError: (error: any) => {
      toast.error(`Erro na busca: ${error.message}`)
    }
  })
}

/**
 * Hook para adicionar documento ao RAG
 */
export function useRAGAddDocument() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ content, source, metadata }: { 
      content: string; 
      source: string; 
      metadata?: any 
    }) => {
      const response = await fetch(`${API_URL}/api/rag/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content, source, metadata })
      })
      
      if (!response.ok) {
        throw new Error('Erro ao adicionar documento')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalida cache de documentos e stats
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
      queryClient.invalidateQueries({ queryKey: ['rag-stats'] })
      toast.success('Documento adicionado ao RAG!')
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar: ${error.message}`)
    }
  })
}

/**
 * Hook para remover documento do RAG
 */
export function useRAGRemoveDocument() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`${API_URL}/api/rag/documents/${documentId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Erro ao remover documento')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalida cache
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
      queryClient.invalidateQueries({ queryKey: ['rag-stats'] })
      toast.success('Documento removido!')
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover: ${error.message}`)
    }
  })
}

/**
 * Hook para adicionar URLs em lote
 */
export function useRAGAddBatch() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (urls: string[]) => {
      // Usar novo endpoint que faz fetch real do conteúdo
      const results = await Promise.all(
        urls.map(async (url) => {
          try {
            const response = await fetch(`${API_URL}/api/rag/index-url`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ url })
            })
            
            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.details || `Erro ao indexar ${url}`)
            }
            
            const data = await response.json()
            return { url, success: true, document: data.document }
          } catch (error: any) {
            return { url, success: false, error: error.message }
          }
        })
      )
      
      const successCount = results.filter(r => r.success).length
      if (successCount === 0) {
        throw new Error('Nenhuma URL foi indexada')
      }
      
      return { added: successCount, total: urls.length }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
      queryClient.invalidateQueries({ queryKey: ['rag-stats'] })
      toast.success(`${data.added} de ${data.total} URLs adicionadas ao RAG!`)
    },
    onError: (error: any) => {
      toast.error(`Erro ao adicionar URLs: ${error.message}`)
    }
  })
}