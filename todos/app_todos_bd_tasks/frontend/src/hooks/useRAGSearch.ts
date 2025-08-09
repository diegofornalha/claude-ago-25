import { useState, useCallback, useEffect } from 'react'
import { useDebouncedValue } from './useDebouncedValue'

interface SearchResult {
  id: string
  content: string
  source: string
  metadata: any
  similarity: number
  highlights?: string[]
}

interface UseRAGSearchOptions {
  minQueryLength?: number
  debounceMs?: number
  limit?: number
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

/**
 * Hook para busca em tempo real no RAG com debounce
 */
export function useRAGRealtimeSearch(options: UseRAGSearchOptions = {}) {
  const {
    minQueryLength = 3,
    debounceMs = 300,
    limit = 10
  } = options

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Debounce da query
  const debouncedQuery = useDebouncedValue(query, debounceMs)
  
  // Função de busca
  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < minQueryLength) {
      setResults([])
      return
    }
    
    try {
      setIsSearching(true)
      setError(null)
      
      const response = await fetch(`${API_URL}/api/rag/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          query: searchQuery,
          limit,
          mode: 'hybrid' // busca híbrida (keyword + semantic)
        })
      })
      
      if (!response.ok) {
        throw new Error('Erro na busca')
      }
      
      const data = await response.json()
      setResults(data.results || [])
      
    } catch (err: any) {
      setError(err.message)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [limit, minQueryLength])
  
  // Executar busca quando query mudar (com debounce)
  useEffect(() => {
    if (debouncedQuery) {
      search(debouncedQuery)
    } else {
      setResults([])
    }
  }, [debouncedQuery, search])
  
  // Função para limpar busca
  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
  }, [])
  
  return {
    query,
    setQuery,
    results,
    isSearching,
    error,
    clearSearch,
    hasResults: results.length > 0,
    canSearch: query.length >= minQueryLength
  }
}

