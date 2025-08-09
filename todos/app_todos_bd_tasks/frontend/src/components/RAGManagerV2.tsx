'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  Plus, 
  Trash2, 
  RefreshCw, 
  FileText, 
  Globe, 
  Code, 
  BookOpen,
  TrendingUp,
  Database,
  Zap,
  AlertCircle
} from 'lucide-react'

// API base URL para o servidor RAG melhorado
const API_BASE = 'http://localhost:5001/api/rag'

// Ícones por tipo de documento
const typeIcons = {
  webpage: Globe,
  documentation: BookOpen,
  code: Code,
  text: FileText,
  markdown: FileText
}

// Cores por tipo de documento
const typeColors = {
  webpage: 'bg-blue-500',
  documentation: 'bg-green-500',
  code: 'bg-purple-500',
  text: 'bg-gray-500',
  markdown: 'bg-indigo-500'
}

interface Document {
  id: string
  title: string
  content: string
  type: string
  source: string
  metadata?: any
  created_at?: string
  score?: number
}

interface Stats {
  total_documents: number
  types: Record<string, number>
  cache_size_bytes: number
  index_size_bytes: number
  vectors_size_bytes: number
  total_size_bytes: number
  version: string
  features: {
    vector_search: boolean
    validation: boolean
    auto_indexing: boolean
    tf_idf: boolean
  }
}

export function RAGManagerV2() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchResults, setSearchResults] = useState<Document[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('search')
  
  // Form para adicionar documento
  const [newDoc, setNewDoc] = useState({
    title: '',
    content: '',
    type: 'text',
    source: 'manual'
  })

  // Carregar documentos e estatísticas
  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/documents`)
      if (!response.ok) throw new Error('Erro ao carregar documentos')
      
      const data = await response.json()
      setDocuments(data.documents || [])
      setStats(data.stats || null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Busca vetorial
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 10 })
      })
      
      if (!response.ok) throw new Error('Erro na busca')
      
      const data = await response.json()
      setSearchResults(data.results || [])
      setActiveTab('search')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Adicionar documento
  const handleAddDocument = async () => {
    if (!newDoc.title || !newDoc.content) {
      setError('Título e conteúdo são obrigatórios')
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc)
      })
      
      if (!response.ok) throw new Error('Erro ao adicionar documento')
      
      // Limpar form e recarregar
      setNewDoc({ title: '', content: '', type: 'text', source: 'manual' })
      await loadData()
      setActiveTab('documents')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Remover documento
  const handleRemoveDocument = async (docId: string) => {
    if (!confirm('Confirma remoção do documento?')) return
    
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/remove/${docId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Erro ao remover documento')
      
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Verificar saúde do servidor
  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`)
      if (!response.ok) {
        setError('Servidor RAG não está respondendo em localhost:5001')
      }
    } catch (err) {
      setError('Servidor RAG não está rodando. Execute: cd /Users/agents/.claude/mcp-rag-server && source venv/bin/activate && python3 create_api_endpoint.py')
    }
  }

  useEffect(() => {
    checkHealth()
    loadData()
  }, [])

  // Formatar bytes
  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Renderizar score de relevância
  const renderScore = (score?: number) => {
    if (!score) return null
    const percentage = Math.round(score * 100)
    const color = percentage > 70 ? 'text-green-500' : percentage > 40 ? 'text-yellow-500' : 'text-red-500'
    return (
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        <span className={`font-bold ${color}`}>{percentage}%</span>
        <Progress value={percentage} className="w-20 h-2" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Total de Documentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_documents}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Tamanho do Cache
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatBytes(stats.total_size_bytes)}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tipos de Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.entries(stats.types).map(([type, count]) => (
                  <Badge key={type} variant="secondary">
                    {type}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Features Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {stats.features.vector_search && <Badge className="bg-green-500">Vetorial</Badge>}
                {stats.features.tf_idf && <Badge className="bg-blue-500">TF-IDF</Badge>}
                {stats.features.validation && <Badge className="bg-purple-500">Validação</Badge>}
                {stats.features.auto_indexing && <Badge className="bg-orange-500">Auto-Index</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Busca Vetorial
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Documentos ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="add">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </TabsTrigger>
        </TabsList>

        {/* Tab de Busca */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Busca Semântica com TF-IDF</CardTitle>
              <CardDescription>
                Busca vetorial inteligente com scores de relevância
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Digite sua busca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Resultados ({searchResults.length})</h3>
                  {searchResults.map((doc) => {
                    const Icon = typeIcons[doc.type as keyof typeof typeIcons] || FileText
                    return (
                      <Card key={doc.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${typeColors[doc.type as keyof typeof typeColors] || 'bg-gray-500'} text-white`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="space-y-1">
                                <CardTitle className="text-base">{doc.title}</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{doc.type}</Badge>
                                  <Badge variant="secondary">{doc.source}</Badge>
                                </div>
                              </div>
                            </div>
                            {renderScore(doc.score)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {doc.content}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Documentos */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Documentos Indexados</CardTitle>
                  <CardDescription>
                    Todos os documentos no cache RAG com busca vetorial
                  </CardDescription>
                </div>
                <Button onClick={loadData} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {documents.map((doc) => {
                  const Icon = typeIcons[doc.type as keyof typeof typeIcons] || FileText
                  return (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${typeColors[doc.type as keyof typeof typeColors] || 'bg-gray-500'} text-white`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                              <CardTitle className="text-base">{doc.title}</CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{doc.type}</Badge>
                                <Badge variant="secondary">{doc.source}</Badge>
                                {doc.created_at && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(doc.created_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDocument(doc.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {doc.content}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Adicionar */}
        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Novo Documento</CardTitle>
              <CardDescription>
                Adicione documentos ao índice RAG para busca vetorial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Título</label>
                <Input
                  placeholder="Título do documento"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({...newDoc, title: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Conteúdo</label>
                <Textarea
                  placeholder="Conteúdo do documento..."
                  value={newDoc.content}
                  onChange={(e) => setNewDoc({...newDoc, content: e.target.value})}
                  rows={6}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <select
                    className="w-full px-3 py-2 border rounded-md"
                    value={newDoc.type}
                    onChange={(e) => setNewDoc({...newDoc, type: e.target.value})}
                  >
                    <option value="text">Texto</option>
                    <option value="documentation">Documentação</option>
                    <option value="code">Código</option>
                    <option value="webpage">Página Web</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fonte</label>
                  <Input
                    placeholder="Origem do documento"
                    value={newDoc.source}
                    onChange={(e) => setNewDoc({...newDoc, source: e.target.value})}
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleAddDocument} 
                disabled={loading || !newDoc.title || !newDoc.content}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar ao Índice
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}