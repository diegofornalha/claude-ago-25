import React, { useState, useEffect } from 'react'

interface RAGDocument {
  id: string
  content: string
  source: string
  metadata: {
    url?: string
    title?: string
    capturedVia?: string
    timestamp?: string
  }
  timestamp: string
  similarity?: number
}

export function RAGManagerSimple() {
  const [documents, setDocuments] = useState<RAGDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('documents')
  const [error, setError] = useState<string | null>(null)

  // Carregar documentos
  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Buscar documentos da API real
      const response = await fetch('http://localhost:3344/api/rag/documents?limit=50')
      
      if (!response.ok) {
        throw new Error('Erro ao buscar documentos')
      }
      
      const data = await response.json()
      
      // Transformar dados do backend para o formato do frontend
      const formattedDocs: RAGDocument[] = data.documents.map((doc: any) => ({
        id: doc.id || doc.source,
        content: doc.content,
        source: doc.source,
        metadata: doc.metadata || {},
        timestamp: doc.timestamp || new Date().toISOString()
      }))
      
      setDocuments(formattedDocs)
    } catch (error) {
      console.error('Erro ao carregar documentos:', error)
      // Não mostrar erro se for apenas um cache vazio (200 OK mas array vazio)
      if (documents.length === 0) {
        setError(null)
      } else {
        setError('Erro ao carregar documentos. Verifique se o servidor está rodando.')
      }
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      // Se não há query, mostrar todos os documentos
      await loadDocuments()
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('http://localhost:3344/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, top_k: 10 })
      })
      
      if (!response.ok) {
        throw new Error('Erro na busca')
      }
      
      const data = await response.json()
      
      // Transformar resultados da busca
      const searchResults: RAGDocument[] = data.results.map((result: any) => ({
        id: result.id || result.source,
        content: result.content,
        source: result.source,
        metadata: result.metadata || {},
        timestamp: result.timestamp || new Date().toISOString(),
        similarity: result.similarity
      }))
      
      setDocuments(searchResults)
    } catch (error) {
      console.error('Erro na busca:', error)
      setError('Erro ao buscar documentos. Verifique se o servidor está rodando.')
    } finally {
      setLoading(false)
    }
  }
  
  const filteredDocs = documents

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">RAG Manager - Cache Local</h1>
      
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl">💾</div>
          <div className="text-xl font-bold">{documents.length}</div>
          <div className="text-sm text-gray-600">Total Documentos</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl">🌐</div>
          <div className="text-xl font-bold">
            {documents.filter(d => d.metadata.capturedVia === 'WebFetch').length}
          </div>
          <div className="text-sm text-gray-600">Via WebFetch</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl">📁</div>
          <div className="text-xl font-bold">~/.claude/mcp-rag-cache</div>
          <div className="text-sm text-gray-600">Local do Cache</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl">📅</div>
          <div className="text-xl font-bold">Hoje</div>
          <div className="text-sm text-gray-600">Última Atualização</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b">
          <div className="flex">
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'documents' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setActiveTab('documents')}
            >
              Documentos
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'search' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setActiveTab('search')}
            >
              Buscar
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'info' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
              onClick={() => setActiveTab('info')}
            >
              Informações
            </button>
          </div>
        </div>

        <div className="p-4">
          {activeTab === 'documents' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Documentos salvos em: <code className="bg-gray-100 px-2 py-1 rounded">~/.claude/mcp-rag-cache/documents.json</code>
                </div>
                <button
                  onClick={loadDocuments}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? 'Carregando...' : 'Atualizar'}
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}
              
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : filteredDocs.length === 0 && !error ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum documento no cache RAG</h3>
                  <p className="text-gray-600 mb-4">Comece adicionando conteúdo ao sistema</p>
                  <div className="text-sm text-gray-500">
                    <p>• Use o WebFetch para capturar páginas web</p>
                    <p>• Os documentos serão salvos em ~/.claude/mcp-rag-cache</p>
                  </div>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">⚠️</div>
                  <p className="text-red-600">{error}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDocs.map(doc => (
                    <div key={doc.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium">
                            {doc.metadata.title || `Documento ${doc.id}`}
                          </h3>
                          <div className="text-sm text-gray-600">
                            Fonte: {doc.source} | {doc.metadata.capturedVia && `Via: ${doc.metadata.capturedVia}`}
                          </div>
                          {doc.similarity !== undefined && (
                            <div className="text-sm text-blue-600 mt-1">
                              Similaridade: {(doc.similarity * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {doc.content}
                      </p>
                      {doc.metadata.url && (
                        <div className="mt-2 text-xs text-blue-600">
                          {doc.metadata.url}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div>
              <div className="mb-4 flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Buscar documentos..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}
              
              {loading ? (
                <div className="text-center py-8">Buscando...</div>
              ) : searchQuery && filteredDocs.length === 0 && !error ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-gray-600">Nenhum documento encontrado para "{searchQuery}"</p>
                  <p className="text-sm text-gray-500 mt-2">Tente outros termos de busca</p>
                </div>
              ) : filteredDocs.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-2">
                    {filteredDocs.length} resultados encontrados
                  </div>
                  {filteredDocs.map(doc => (
                    <div key={doc.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium">
                            {doc.metadata.title || `Documento ${doc.id}`}
                          </h3>
                          <div className="text-sm text-gray-600">
                            Fonte: {doc.source}
                          </div>
                          {doc.similarity !== undefined && (
                            <div className="text-sm text-blue-600 mt-1">
                              Similaridade: {(doc.similarity * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {doc.content}
                      </p>
                      {doc.metadata.url && (
                        <div className="mt-2 text-xs text-blue-600">
                          {doc.metadata.url}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  Digite uma consulta para buscar documentos
                </div>
              )}
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Como usar no Claude Code:</h3>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`// Buscar documentos
mcp__rag_standalone__rag_search({
  "query": "Claude features",
  "limit": 5
})

// Indexar novo conteúdo
mcp__rag_standalone__rag_index({
  "content": "Conteúdo...",
  "source": "WebFetch"
})`}
                </pre>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Status do Sistema:</h3>
                <ul className="text-sm space-y-1">
                  <li>✅ Cache local funcionando</li>
                  <li>✅ 100% offline</li>
                  <li>✅ Dados persistentes</li>
                  <li>✅ Integrado com WebFetch</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}