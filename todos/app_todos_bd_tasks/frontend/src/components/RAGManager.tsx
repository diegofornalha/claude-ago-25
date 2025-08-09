import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

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
  score?: number
}

interface RAGStats {
  total_documents: number
  cache_dir: string
  oldest_doc?: string
  newest_doc?: string
  total_size?: number
}

export function RAGManager() {
  const [documents, setDocuments] = useState<RAGDocument[]>([])
  const [stats, setStats] = useState<RAGStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RAGDocument[]>([])
  const [selectedDoc, setSelectedDoc] = useState<RAGDocument | null>(null)
  const { toast } = useToast()

  // Carregar documentos do cache local
  const loadDocuments = async () => {
    try {
      setLoading(true)
      
      // Ler arquivo de cache diretamente
      const response = await fetch('/api/rag/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
        setStats(data.stats || null)
      } else {
        // Fallback: ler diretamente do sistema de arquivos
        loadLocalCache()
      }
    } catch (error) {
      console.error('Erro ao carregar documentos:', error)
      loadLocalCache()
    } finally {
      setLoading(false)
    }
  }

  // Carregar cache local diretamente
  const loadLocalCache = async () => {
    try {
      // Este seria um endpoint que lê o arquivo local
      const cachePath = '/Users/agents/.claude/mcp-rag-cache/documents.json'
      // Simular leitura (em produção, seria via API)
      const mockData = {
        documents: [
          {
            id: '8ead605c',
            content: 'O Claude Code é uma ferramenta de desenvolvimento que permite usar o Claude para programação...',
            source: 'teste_manual',
            metadata: { tipo: 'documentação', categoria: 'Claude' },
            timestamp: new Date().toISOString()
          },
          {
            id: '26a1e709',
            content: '# Claude Code Documentation\n\nClaude Code is an AI-powered coding assistant...',
            source: 'web:docs.anthropic.com',
            metadata: {
              url: 'https://docs.anthropic.com/claude/docs/claude-code',
              title: 'Claude Code Documentation',
              capturedVia: 'WebFetch'
            },
            timestamp: new Date().toISOString()
          }
        ],
        stats: {
          total_documents: 2,
          cache_dir: '/Users/agents/.claude/mcp-rag-cache',
          oldest_doc: '2024-05-26T10:00:00Z',
          newest_doc: new Date().toISOString()
        }
      }
      
      setDocuments(mockData.documents)
      setStats(mockData.stats)
    } catch (error) {
      console.error('Erro ao carregar cache local:', error)
    }
  }

  // Buscar no RAG
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    try {
      // Busca local primeiro
      const filtered = documents.filter(doc => 
        doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.metadata.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      
      setSearchResults(filtered)
      
      toast({
        title: 'Busca realizada',
        description: `${filtered.length} documentos encontrados`
      })
    } catch (error) {
      toast({
        title: 'Erro na busca',
        variant: 'destructive'
      })
    }
  }

  // Remover documento
  const handleRemove = async (docId: string) => {
    if (!confirm('Remover este documento do cache RAG?')) return

    try {
      // Aqui você faria a chamada para remover via MCP
      setDocuments(docs => docs.filter(d => d.id !== docId))
      
      toast({
        title: 'Documento removido',
        description: 'Removido do cache RAG local'
      })
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        variant: 'destructive'
      })
    }
  }

  // Exportar cache
  const handleExport = () => {
    const data = JSON.stringify({ documents, stats }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rag-cache-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const getSourceIcon = (source: string) => {
    if (source.includes('web:')) return '🌐'
    if (source.includes('manual')) return '✍️'
    if (source.includes('claude_session')) return '🤖'
    return '📄'
  }

  const getSourceColor = (source: string) => {
    if (source.includes('web:')) return 'bg-blue-100 text-blue-800'
    if (source.includes('manual')) return 'bg-green-100 text-green-800'
    if (source.includes('claude_session')) return 'bg-purple-100 text-purple-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total no Cache</CardTitle>
            <span className="text-2xl">💾</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_documents || 0}</div>
            <p className="text-xs text-muted-foreground">
              documentos salvos localmente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WebFetch</CardTitle>
            <span className="text-2xl">📄</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.filter(d => d.metadata.capturedVia === 'WebFetch').length}
            </div>
            <p className="text-xs text-muted-foreground">
              capturados via WebFetch
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões Claude</CardTitle>
            <span className="text-2xl">#️⃣</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.filter(d => d.source.includes('claude_session')).length}
            </div>
            <p className="text-xs text-muted-foreground">
              sessões indexadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Atualização</CardTitle>
            <span className="text-2xl">📅</span>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {stats?.newest_doc 
                ? new Date(stats.newest_doc).toLocaleDateString() 
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.cache_dir?.split('/').pop() || 'mcp-rag-cache'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="documents" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="search">Buscar</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" onClick={loadDocuments}>
              🔄 Recarregar
            </Button>
            <Button variant="outline" onClick={handleExport}>
              ⬇️ Exportar
            </Button>
          </div>
        </div>

        <TabsContent value="documents" className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Documentos salvos no cache RAG local em: <code className="bg-muted px-2 py-1 rounded">{stats?.cache_dir}</code>
          </div>

          {loading ? (
            <div className="text-center py-8">Carregando cache local...</div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhum documento no cache RAG
                </p>
                <p className="text-sm text-muted-foreground">
                  Use o WebFetch para capturar páginas ou indexe manualmente
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getSourceIcon(doc.source)}</span>
                          <CardTitle className="text-base">
                            {doc.metadata.title || `Documento ${doc.id}`}
                          </CardTitle>
                        </div>
                        <CardDescription>
                          <Badge className={getSourceColor(doc.source)}>
                            {doc.source}
                          </Badge>
                          {doc.metadata.url && (
                            <span className="ml-2 text-xs">
                              {new URL(doc.metadata.url).hostname}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.metadata.capturedVia && (
                          <Badge variant="secondary">
                            {doc.metadata.capturedVia}
                          </Badge>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Ver
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>
                                {doc.metadata.title || `Documento ${doc.id}`}
                              </DialogTitle>
                              <DialogDescription>
                                ID: {doc.id} | Fonte: {doc.source}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="h-[60vh] mt-4 overflow-y-auto">
                              <pre className="whitespace-pre-wrap text-sm p-4">
                                {doc.content}
                              </pre>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(doc.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {doc.content}
                    </p>
                    <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                      <span>
                        {new Date(doc.timestamp).toLocaleString()}
                      </span>
                      <span>
                        {doc.content.length} caracteres
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar no cache RAG local..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              🔍 Buscar
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {searchResults.length} resultados encontrados
              </p>
              {searchResults.map((doc) => (
                <Card key={doc.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {doc.metadata.title || doc.source}
                    </CardTitle>
                    <CardDescription>
                      Score: {doc.score?.toFixed(2) || 'N/A'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm line-clamp-3">{doc.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status do Sistema RAG</CardTitle>
              <CardDescription>
                Informações sobre o cache e indexação local
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Cache Directory</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {stats?.cache_dir || 'N/A'}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total de Documentos</span>
                  <span className="text-sm">{stats?.total_documents || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Documento Mais Antigo</span>
                  <span className="text-sm">
                    {stats?.oldest_doc 
                      ? new Date(stats.oldest_doc).toLocaleDateString() 
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Documento Mais Recente</span>
                  <span className="text-sm">
                    {stats?.newest_doc 
                      ? new Date(stats.newest_doc).toLocaleDateString() 
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Tipos de Documentos</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>WebFetch</span>
                    <span>{documents.filter(d => d.metadata.capturedVia === 'WebFetch').length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Manual</span>
                    <span>{documents.filter(d => d.source.includes('manual')).length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Playbooks</span>
                    <span>{documents.filter(d => d.source.includes('claude_session')).length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}