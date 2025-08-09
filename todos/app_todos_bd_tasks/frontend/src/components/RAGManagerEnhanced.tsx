import React, { useState, useEffect } from 'react'
import { useRAGDocuments, useRAGStats, useRAGRemoveDocument, useRAGAddBatch } from '../hooks/useRAGDocuments'
import { useRAGRealtimeSearch } from '../hooks/useRAGSearch'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useParams } from 'react-router-dom'
import { DocumentDetailModal } from './DocumentDetailModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3344'

export function RAGManagerEnhanced() {
  const [activeTab, setActiveTab] = useState<'documents' | 'search' | 'add'>('documents')
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [selectedDocumentForModal, setSelectedDocumentForModal] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [urlsToAdd, setUrlsToAdd] = useState('')
  const [documentFilter, setDocumentFilter] = useState<'all' | 'webfetch' | 'playbooks'>('all')
  const [mcpDocs, setMcpDocs] = useState<any[]>([])
  const [importingMcp, setImportingMcp] = useState(false)
  
  // Hooks de dados
  const { data: documents = [], isLoading: loadingDocs, error: docsError } = useRAGDocuments(50)
  const { data: stats, isLoading: loadingStats } = useRAGStats()
  const removeDoc = useRAGRemoveDocument()
  const addBatch = useRAGAddBatch()
  
  // Hook de busca em tempo real
  const search = useRAGRealtimeSearch({ 
    minQueryLength: 3, 
    debounceMs: 300,
    limit: 20 
  })
  
  // Estatísticas calculadas com agrupamento por domínio
  const totalDocs = documents.length
  
  // Contar web pages agrupadas por domínio
  const webDocsGrouped = documents
    .filter(d => d.metadata?.capturedVia === 'WebFetch' || d.metadata?.type === 'webpage' || d.source?.startsWith('http'))
    .reduce((acc, doc) => {
      const url = doc.metadata?.url || doc.source
      if (url && url.startsWith('http')) {
        const domain = new URL(url).hostname
        if (!acc[domain]) acc[domain] = 0
        acc[domain]++
      }
      return acc
    }, {} as Record<string, number>)
  
  // Contar domínios únicos (não o total de documentos)
  const webDocsCount = Object.keys(webDocsGrouped).length
  
  // Contar playbooks (arquivos de todos)
  const playbookDocs = documents.filter(d => d.metadata?.type === 'playbook' || d.metadata?.capturedVia === 'TodoSync').length
  
  // Filtrar documentos baseado no filtro ativo
  const filteredDocuments = documents.filter(doc => {
    switch (documentFilter) {
      case 'webfetch':
        return doc.metadata?.capturedVia === 'WebFetch' || doc.metadata?.type === 'webpage' || doc.source?.startsWith('http')
      case 'playbooks':
        return doc.metadata?.type === 'playbook' || doc.metadata?.capturedVia === 'TodoSync'
      default:
        return true
    }
  })
  
  const handleRemoveDocument = async (docId: string) => {
    removeDoc.mutate(docId)
  }

  const handleViewDocument = (doc: any) => {
    setSelectedDocumentForModal(doc)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedDocumentForModal(null)
  }
  
  const handleFilterClick = (filter: 'all' | 'webfetch' | 'playbooks') => {
    setDocumentFilter(filter)
    setActiveTab('documents')
    
    // Atualizar a URL
    const filterParam = filter === 'all' ? '' : filter === 'webfetch' ? 'Via-WebFetch' : 'Playbooks'
    const newUrl = filterParam ? `/rag/${filterParam}` : '/rag'
    window.history.pushState({}, '', newUrl)
  }
  
  const handleAddUrls = async () => {
    const urls = urlsToAdd
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.startsWith('http'))
    
    if (urls.length === 0) {
      toast.error('Adicione URLs válidas (uma por linha)')
      return
    }
    
    toast.loading(`Indexando ${urls.length} URL${urls.length > 1 ? 's' : ''}...`, {
      id: 'indexing-urls'
    })
    
    addBatch.mutate(urls, {
      onSuccess: (data) => {
        toast.success(`${data.added} de ${data.total} URLs indexadas com sucesso!`, {
          id: 'indexing-urls'
        })
        setUrlsToAdd('')
        setActiveTab('documents')
      },
      onError: (error: any) => {
        toast.error(`Erro na indexação: ${error.message}`, {
          id: 'indexing-urls'
        })
      }
    })
  }
  
  const exportCache = () => {
    const dataStr = JSON.stringify(documents, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const link = document.createElement('a')
    link.setAttribute('href', dataUri)
    link.setAttribute('download', `rag-cache-${new Date().toISOString()}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success('Cache exportado!')
  }

  // Função para buscar documentos do MCP RAG Server
  const fetchMcpDocuments = async () => {
    try {
      setImportingMcp(true)
      toast.loading('Buscando documentos do MCP RAG Server...', { id: 'fetch-mcp' })
      
      const response = await fetch('http://localhost:8765/frontend-documents.json')
      if (!response.ok) {
        throw new Error('Servidor MCP não está rodando. Execute: python3 simple-sync-server.py')
      }
      
      const data = await response.json()
      const docs = data.documents || []
      
      // Filtrar apenas documentos A2A
      const a2aDocs = docs.filter((doc: any) => 
        doc.category?.includes('a2a') || 
        doc.tags?.includes('a2a') ||
        doc.source?.includes('a2a')
      )
      
      setMcpDocs(a2aDocs)
      toast.success(`${a2aDocs.length} documentos A2A encontrados no MCP!`, { id: 'fetch-mcp' })
      
      if (a2aDocs.length > 0) {
        // Importar automaticamente sem confirmação - atualizado!
        await importMcpToIndexedDB(a2aDocs)
      }
      
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`, { id: 'fetch-mcp' })
      console.error(error)
    } finally {
      setImportingMcp(false)
    }
  }

  // Função para importar documentos MCP para IndexedDB
  const importMcpToIndexedDB = async (docsToImport: any[]) => {
    try {
      toast.loading('Importando para IndexedDB...', { id: 'import-mcp' })
      
      // Abrir/criar database
      const dbRequest = indexedDB.open('rag-cache', 1)
      
      dbRequest.onerror = () => {
        throw new Error('Erro ao abrir IndexedDB')
      }
      
      dbRequest.onupgradeneeded = (event: any) => {
        const db = event.target.result
        
        // Criar object store se não existir
        if (!db.objectStoreNames.contains('documents')) {
          const store = db.createObjectStore('documents', { keyPath: 'id' })
          store.createIndex('url', 'url', { unique: false })
          store.createIndex('category', 'category', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
      
      dbRequest.onsuccess = (event: any) => {
        const db = event.target.result
        const transaction = db.transaction(['documents'], 'readwrite')
        const store = transaction.objectStore('documents')
        
        // Limpar store antigo de documentos A2A
        const clearRequest = store.clear()
        
        clearRequest.onsuccess = () => {
          // Adicionar novos documentos
          let imported = 0
          docsToImport.forEach(doc => {
            // Garantir que cada documento tem um ID único
            if (!doc.id) {
              doc.id = crypto.randomUUID()
            }
            
            // Adicionar timestamp se não existir
            if (!doc.timestamp) {
              doc.timestamp = new Date().toISOString()
            }
            
            // Adicionar ao store
            const request = store.add(doc)
            request.onsuccess = () => {
              imported++
            }
          })
          
          transaction.oncomplete = () => {
            toast.success(`✅ ${imported} documentos A2A importados!`, { id: 'import-mcp' })
            
            // Salvar no localStorage também
            localStorage.setItem('rag-documents-a2a', JSON.stringify(docsToImport))
            localStorage.setItem('rag-sync-timestamp', new Date().toISOString())
            
            // Recarregar página para mostrar novos documentos
            setTimeout(() => {
              window.location.reload()
            }, 1500)
          }
        }
        
        transaction.onerror = () => {
          throw new Error('Erro na transação IndexedDB')
        }
      }
      
    } catch (error: any) {
      toast.error(`Erro na importação: ${error.message}`, { id: 'import-mcp' })
      console.error(error)
    }
  }
  
  // Não mostrar erro se for apenas um cache vazio
  if (docsError && !docsError.toString().includes('500')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-semibold">Erro ao carregar documentos</p>
        <p className="text-sm mt-1">{docsError.toString()}</p>
      </div>
    )
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🧠 RAG Manager - Cache Local</h1>
        <p className="text-gray-600">Sistema de recuperação aumentada por geração em tempo real</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div 
          className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-colors ${
            documentFilter === 'all' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
          }`}
          onClick={() => handleFilterClick('all')}
        >
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Total</span>
            <span className="text-2xl font-bold text-blue-600">{totalDocs}</span>
          </div>
        </div>
        
        <div 
          className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-colors ${
            documentFilter === 'webfetch' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'
          }`}
          onClick={() => handleFilterClick('webfetch')}
        >
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Web Pages</span>
            <span className="text-2xl font-bold text-green-600">{webDocsCount}</span>
          </div>
        </div>
        
        <div 
          className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-colors ${
            documentFilter === 'playbooks' ? 'ring-2 ring-purple-500 bg-purple-50' : 'hover:bg-gray-50'
          }`}
          onClick={() => handleFilterClick('playbooks')}
        >
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Playbooks</span>
            <span className="text-2xl font-bold text-purple-600">{playbookDocs}</span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Cache Local</span>
            <span className="text-xs font-mono text-gray-600">~/.claude/mcp-rag-cache</span>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'documents'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📄 Total ({filteredDocuments.length})
            </button>
            
            <button
              onClick={() => setActiveTab('search')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'search'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🔍 Buscar
            </button>
            
            <button
              onClick={() => setActiveTab('add')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'add'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ➕ Adicionar URLs
            </button>
            
            {documentFilter === 'playbooks' && (
              <button
                onClick={async () => {
                  toast.loading('Sincronizando playbooks...', { id: 'sync-todos' })
                  try {
                    const response = await fetch(`${API_URL}/api/rag/sync-todos`)
                    const data = await response.json()
                    if (response.ok) {
                      toast.success(`${data.stats.added} playbooks sincronizados!`, { id: 'sync-todos' })
                      // Recarregar documentos
                      window.location.reload()
                    } else {
                      toast.error('Erro ao sincronizar playbooks', { id: 'sync-todos' })
                    }
                  } catch (error) {
                    toast.error('Erro ao sincronizar playbooks', { id: 'sync-todos' })
                  }
                }}
                className="px-4 py-2 m-2 text-sm bg-purple-600 text-white hover:bg-purple-700 rounded-md transition-colors"
              >
                🔄 Sincronizar Playbooks
              </button>
            )}
            
            <button
              onClick={fetchMcpDocuments}
              disabled={importingMcp}
              className="px-4 py-2 m-2 text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 rounded-md transition-colors"
            >
              {importingMcp ? '⏳ Importando...' : '🔄 Importar do MCP'}
            </button>
            
            <button
              onClick={exportCache}
              className="px-4 py-2 m-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              📥 Exportar Cache
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {/* Tab: Documents */}
          {activeTab === 'documents' && (
            <div>
              {loadingDocs ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">
                    {documentFilter === 'all' ? '📭' : '🔍'}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {documentFilter === 'all' 
                      ? 'Nenhum documento no cache RAG'
                      : documentFilter === 'webfetch'
                        ? 'Nenhuma página web indexada'
                        : 'Nenhum playbook indexado'
                    }
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {documentFilter === 'all' 
                      ? 'Comece adicionando conteúdo ao sistema de recuperação'
                      : documentFilter === 'webfetch'
                        ? 'Adicione URLs para indexar páginas web'
                        : 'Não há playbooks indexados ainda'
                    }
                  </p>
                  {documentFilter !== 'all' && (
                    <button
                      onClick={() => setDocumentFilter('all')}
                      className="mb-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Ver todos os documentos
                    </button>
                  )}
                  {documentFilter !== 'playbooks' && (
                    <div className="space-y-2 text-sm text-gray-500">
                      <p>• Use o WebFetch para capturar páginas web</p>
                      <p>• Adicione URLs manualmente na aba "Adicionar URLs"</p>
                      <p>• Os documentos serão salvos localmente em ~/.claude/mcp-rag-cache</p>
                    </div>
                  )}
                  {documentFilter === 'all' && (
                    <button
                      onClick={() => setActiveTab('add')}
                      className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Adicionar URLs
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {documentFilter !== 'all' && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-700">
                          Mostrando {filteredDocuments.length} de {totalDocs} documentos 
                          {documentFilter === 'webfetch' && ' (Web Pages)'}
                          {documentFilter === 'playbooks' && ' (Playbooks)'}
                        </span>
                        <button
                          onClick={() => setDocumentFilter('all')}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Limpar filtro
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {(() => {
                      // Agrupar documentos por domínio quando mostrar Web Pages
                      if (documentFilter === 'webfetch' || documentFilter === 'all') {
                        const webDocs = filteredDocuments.filter(doc => 
                          doc.metadata?.capturedVia === 'WebFetch' || 
                          doc.metadata?.type === 'webpage' ||
                          doc.source?.startsWith('http')
                        )
                        const otherDocs = filteredDocuments.filter(doc => 
                          !doc.metadata?.capturedVia?.includes('WebFetch') && 
                          !doc.metadata?.type?.includes('web') &&
                          !doc.source?.startsWith('http')
                        )
                        
                        // Agrupar web docs por domínio
                        const groupedWebDocs = webDocs.reduce((acc, doc) => {
                          const url = doc.metadata?.url || doc.source
                          if (url && url.startsWith('http')) {
                            const domain = new URL(url).hostname
                            if (!acc[domain]) acc[domain] = []
                            acc[domain].push(doc)
                          }
                          return acc
                        }, {} as Record<string, typeof webDocs>)
                        
                        return (
                          <>
                            {/* Renderizar documentos web agrupados por domínio */}
                            {Object.entries(groupedWebDocs).map(([domain, docs]) => (
                              <div key={domain} className="space-y-2">
                                {docs.length > 1 && (
                                  <div className="text-xs text-gray-500 font-medium px-2 flex items-center gap-2">
                                    <span>🌐 {domain}</span>
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                                      {docs.length} páginas
                                    </span>
                                  </div>
                                )}
                                {docs.map((doc) => (
                                  <div
                                    key={doc.id}
                                    className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                                      selectedDoc === doc.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                    } ${docs.length > 1 ? 'ml-4' : ''}`}
                                    onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <h3 className="font-medium text-gray-900">
                                          {doc.metadata?.title || doc.source}
                                        </h3>
                                        {doc.metadata?.url && (
                                          <a
                                            href={doc.metadata.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {doc.metadata.url}
                                          </a>
                                        )}
                                        <p 
                                          className="text-sm text-gray-600 mt-1 hover:text-gray-800 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleViewDocument(doc)
                                          }}
                                        >
                                          {doc.content.substring(0, 150)}...
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 ml-4">
                                        <span className="text-xs text-gray-500">
                                          {format(new Date(doc.timestamp), 'dd/MM HH:mm')}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleViewDocument(doc)
                                          }}
                                          className="text-blue-500 hover:text-blue-700"
                                          title="Ver detalhes"
                                        >
                                          👁️
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleRemoveDocument(doc.id)
                                          }}
                                          className="text-red-500 hover:text-red-700"
                                          disabled={removeDoc.isPending}
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                            
                            {/* Renderizar outros documentos (não web) */}
                            {otherDocs.map((doc) => (
                              <div
                                key={doc.id}
                                className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                                  selectedDoc === doc.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                }`}
                                onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h3 className="font-medium text-gray-900">
                                      {doc.source}
                                    </h3>
                                    <p 
                                      className="text-sm text-gray-600 mt-1 hover:text-gray-800 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleViewDocument(doc)
                                      }}
                                    >
                                      {doc.content.substring(0, 150)}...
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    <span className="text-xs text-gray-500">
                                      {format(new Date(doc.timestamp), 'dd/MM HH:mm')}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleViewDocument(doc)
                                      }}
                                      className="text-blue-500 hover:text-blue-700"
                                      title="Ver detalhes"
                                    >
                                      👁️
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemoveDocument(doc.id)
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                      disabled={removeDoc.isPending}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )
                      }
                      
                      // Para playbooks, renderizar sem agrupamento
                      return filteredDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                            selectedDoc === doc.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}
                          onClick={() => setSelectedDoc(selectedDoc === doc.id ? null : doc.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">
                                {doc.source}
                              </h3>
                              <p 
                                className="text-sm text-gray-600 mt-1 hover:text-gray-800 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewDocument(doc)
                                }}
                              >
                                {doc.content.substring(0, 150)}...
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <span className="text-xs text-gray-500">
                                {format(new Date(doc.timestamp), 'dd/MM HH:mm')}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewDocument(doc)
                                }}
                                className="text-blue-500 hover:text-blue-700"
                                title="Ver detalhes"
                              >
                                👁️
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveDocument(doc.id)
                                }}
                                className="text-red-500 hover:text-red-700"
                                disabled={removeDoc.isPending}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Tab: Search */}
          {activeTab === 'search' && (
            <div>
              <div className="mb-4">
                <input
                  type="text"
                  value={search.query}
                  onChange={(e) => search.setQuery(e.target.value)}
                  placeholder="Digite pelo menos 3 caracteres para buscar..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {search.isSearching && (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              
              {search.results && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    {search.results.length} resultado{search.results.length !== 1 ? 's' : ''} encontrado{search.results.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-3">
                    {search.results.map((doc) => (
                      <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {doc.source}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {doc.content.substring(0, 200)}...
                        </p>
                        {doc.similarity && (
                          <span className="text-xs text-gray-500 mt-2 inline-block">
                            Relevância: {(doc.similarity * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Tab: Add URLs */}
          {activeTab === 'add' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URLs para indexar (uma por linha)
                </label>
                <textarea
                  value={urlsToAdd}
                  onChange={(e) => setUrlsToAdd(e.target.value)}
                  placeholder="https://example.com/page1\nhttps://example.com/page2"
                  className="w-full h-40 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <button
                onClick={handleAddUrls}
                disabled={!urlsToAdd.trim() || addBatch.isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {addBatch.isPending ? 'Indexando...' : 'Indexar URLs'}
              </button>
              
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-2">💡 Dicas</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• As URLs devem começar com http:// ou https://</li>
                  <li>• O conteúdo será extraído e indexado automaticamente</li>
                  <li>• URLs duplicadas serão atualizadas</li>
                  <li>• O cache é salvo localmente em ~/.claude/mcp-rag-cache</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de Detalhes do Documento */}
      <DocumentDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        document={selectedDocumentForModal}
      />
    </div>
  )
}