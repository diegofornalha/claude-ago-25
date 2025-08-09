import React, { useState, useRef, useEffect } from 'react'
import { useRAGRealtimeSearch } from '../hooks/useRAGSearch'

interface RAGSearchBarProps {
  onResultClick?: (result: any) => void
  placeholder?: string
  autoFocus?: boolean
}

export function RAGSearchBar({ 
  onResultClick,
  placeholder = "Buscar no conhecimento base...",
  autoFocus = false
}: RAGSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  
  const search = useRAGRealtimeSearch({
    minQueryLength: 2,
    debounceMs: 300,
    limit: 8
  })
  
  // Navegar com teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!search.hasResults) return
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < search.results.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : search.results.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (search.results[selectedIndex]) {
            handleResultClick(search.results[selectedIndex])
          }
          break
        case 'Escape':
          search.clearSearch()
          inputRef.current?.blur()
          break
      }
    }
    
    if (isFocused) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFocused, search.results, selectedIndex, search.hasResults])
  
  // Reset seleção quando resultados mudarem
  useEffect(() => {
    setSelectedIndex(0)
  }, [search.results])
  
  const handleResultClick = (result: any) => {
    search.clearSearch()
    setIsFocused(false)
    onResultClick?.(result)
  }
  
  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(e.target as Node) &&
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const highlightMatch = (text: string, query: string) => {
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 font-semibold">{part}</mark>
        : part
    )
  }
  
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Input de busca */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search.query}
          onChange={(e) => search.setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`
            w-full px-12 py-3 text-lg border rounded-lg 
            transition-all duration-200
            ${isFocused 
              ? 'border-blue-500 ring-2 ring-blue-200' 
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
        />
        
        {/* Ícone de busca */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          {search.isSearching ? (
            <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        
        {/* Limpar busca */}
        {search.query && (
          <button
            onClick={() => search.clearSearch()}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        {/* Contador de caracteres */}
        {search.query && !search.canSearch && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {3 - search.query.length} chars
          </div>
        )}
      </div>
      
      {/* Resultados */}
      {isFocused && search.hasResults && (
        <div 
          ref={resultsRef}
          className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto"
        >
          {search.results.map((result, index) => (
            <button
              key={result.id}
              onClick={() => handleResultClick(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`
                w-full px-4 py-3 text-left hover:bg-gray-50 
                border-b border-gray-100 last:border-0
                transition-colors duration-150
                ${selectedIndex === index ? 'bg-blue-50' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Ícone por tipo */}
                <div className="flex-shrink-0 mt-0.5">
                  {result.metadata?.type === 'session' ? '📝' : 
                   result.metadata?.url ? '🌐' : 
                   result.source?.includes('.md') ? '📄' :
                   result.source?.includes('.ts') ? '💻' : '📎'}
                </div>
                
                <div className="flex-1 min-w-0">
                  {/* Título */}
                  <div className="font-medium text-gray-900 truncate">
                    {highlightMatch(
                      result.metadata?.title || result.source || 'Documento',
                      search.query
                    )}
                  </div>
                  
                  {/* Preview do conteúdo */}
                  <div className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {highlightMatch(
                      result.content.substring(0, 150),
                      search.query
                    )}...
                  </div>
                  
                  {/* Metadados */}
                  <div className="flex items-center gap-3 mt-1">
                    {result.similarity && (
                      <span className="text-xs text-green-600">
                        {(result.similarity * 100).toFixed(0)}% relevante
                      </span>
                    )}
                    {result.metadata?.url && (
                      <span className="text-xs text-gray-500 truncate">
                        {new URL(result.metadata.url).hostname}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {/* Dicas de uso */}
      {isFocused && !search.query && (
        <div className="absolute z-40 w-full mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">💡 Dicas de busca:</p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Digite pelo menos 2 caracteres</li>
            <li>• Use ↑↓ para navegar nos resultados</li>
            <li>• Enter para selecionar, Esc para fechar</li>
            <li>• Busca em documentos, sessões e código</li>
          </ul>
        </div>
      )}
    </div>
  )
}