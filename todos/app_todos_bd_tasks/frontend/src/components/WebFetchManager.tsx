import React, { useState, useEffect } from 'react'
import { Plus, Search, RefreshCw, ExternalLink, Archive, Tag, Book, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'

interface WebFetchDoc {
  id: string
  url: string
  domain: string
  title?: string
  description?: string
  status: 'pending' | 'indexing' | 'indexed' | 'failed' | 'archived'
  category?: string
  tags: string[]
  sections: number
  words: number
  searchCount: number
  autoUpdate: boolean
  updateFrequency: 'daily' | 'weekly' | 'monthly' | 'manual'
  createdAt: string
  indexedAt?: string
}

interface WebFetchStats {
  total: number
  indexed: number
  pending: number
  failed: number
  totalSections: number
  totalWords: number
  categories: string[]
  recentSearches: Array<{
    query: string
    resultsCount: number
    createdAt: string
  }>
}

export function WebFetchManager() {
  const [docs, setDocs] = useState<WebFetchDoc[]>([])
  const [stats, setStats] = useState<WebFetchStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const { toast } = useToast()

  // Form state para novo documento
  const [newDoc, setNewDoc] = useState({
    url: '',
    category: '',
    tags: '',
    notes: '',
    autoUpdate: false,
    updateFrequency: 'manual' as const,
    maxDepth: 1
  })

  // Carregar documentos e estatísticas
  const loadData = async () => {
    try {
      setLoading(true)
      
      // Construir query params
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (filterCategory !== 'all') params.append('category', filterCategory)
      if (filterStatus !== 'all') params.append('status', filterStatus)
      
      // Buscar documentos
      const docsResponse = await fetch(`/api/webfetch?${params}`)
      const docsData = await docsResponse.json()
      setDocs(docsData)
      
      // Buscar estatísticas
      const statsResponse = await fetch('/api/webfetch/stats')
      const statsData = await statsResponse.json()
      setStats(statsData)
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as documentações',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [searchQuery, filterCategory, filterStatus])

  // Adicionar nova documentação
  const handleAddDoc = async () => {
    try {
      const response = await fetch('/api/webfetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDoc,
          tags: newDoc.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      })
      
      if (response.ok) {
        toast({
          title: 'Documentação adicionada',
          description: 'A indexação será iniciada em breve'
        })
        setIsAddDialogOpen(false)
        setNewDoc({
          url: '',
          category: '',
          tags: '',
          notes: '',
          autoUpdate: false,
          updateFrequency: 'manual',
          maxDepth: 1
        })
        loadData()
      }
    } catch (error) {
      toast({
        title: 'Erro ao adicionar',
        description: 'Não foi possível adicionar a documentação',
        variant: 'destructive'
      })
    }
  }

  // Reindexar documento
  const handleReindex = async (id: string) => {
    try {
      const response = await fetch(`/api/webfetch/${id}/index`, {
        method: 'POST'
      })
      
      if (response.ok) {
        toast({
          title: 'Reindexação iniciada',
          description: 'O documento está sendo reindexado'
        })
        loadData()
      }
    } catch (error) {
      toast({
        title: 'Erro ao reindexar',
        variant: 'destructive'
      })
    }
  }

  // Remover documento
  const handleRemove = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta documentação?')) return
    
    try {
      const response = await fetch(`/api/webfetch/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        toast({
          title: 'Documentação removida',
          description: 'A documentação foi removida do índice'
        })
        loadData()
      }
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        variant: 'destructive'
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      indexed: 'default',
      pending: 'secondary',
      indexing: 'secondary',
      failed: 'destructive',
      archived: 'outline'
    }
    
    const labels: Record<string, string> = {
      indexed: 'Indexado',
      pending: 'Pendente',
      indexing: 'Indexando...',
      failed: 'Falhou',
      archived: 'Arquivado'
    }
    
    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Docs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.indexed || 0} indexados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seções</CardTitle>
            <Book className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSections || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalWords || 0} palavras
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.failed || 0} falharam
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.categories?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              organizadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de ações */}
      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar documentações..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
        
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {stats?.categories?.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="indexed">Indexados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="failed">Falhados</SelectItem>
          </SelectContent>
        </Select>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar URL
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Documentação</DialogTitle>
              <DialogDescription>
                Adicione uma URL para indexar no seu knowledge base local
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  placeholder="https://docs.example.com"
                  value={newDoc.url}
                  onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  placeholder="Ex: MCP, Claude, LangChain"
                  value={newDoc.category}
                  onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="tags"
                  placeholder="api, documentation, reference"
                  value={newDoc.tags}
                  onChange={(e) => setNewDoc({ ...newDoc, tags: e.target.value })}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="maxDepth">Profundidade máxima</Label>
                <Select 
                  value={newDoc.maxDepth.toString()} 
                  onValueChange={(v) => setNewDoc({ ...newDoc, maxDepth: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Apenas esta página</SelectItem>
                    <SelectItem value="1">1 nível de subpáginas</SelectItem>
                    <SelectItem value="2">2 níveis de subpáginas</SelectItem>
                    <SelectItem value="3">3 níveis de subpáginas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoUpdate"
                  checked={newDoc.autoUpdate}
                  onCheckedChange={(checked) => 
                    setNewDoc({ ...newDoc, autoUpdate: checked as boolean })
                  }
                />
                <Label htmlFor="autoUpdate">Atualizar automaticamente</Label>
              </div>
              
              {newDoc.autoUpdate && (
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Frequência de atualização</Label>
                  <Select 
                    value={newDoc.updateFrequency} 
                    onValueChange={(v: any) => setNewDoc({ ...newDoc, updateFrequency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diária</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Observações sobre esta documentação..."
                  value={newDoc.notes}
                  onChange={(e) => setNewDoc({ ...newDoc, notes: e.target.value })}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddDoc}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de documentações */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando documentações...
          </div>
        ) : docs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Nenhuma documentação encontrada
              </p>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira documentação
              </Button>
            </CardContent>
          </Card>
        ) : (
          docs.map((doc) => (
            <Card key={doc.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {doc.title || doc.url}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Globe className="h-3 w-3" />
                      {doc.domain}
                      {doc.category && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span>{doc.category}</span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.status)}
                    {doc.autoUpdate && (
                      <Badge variant="secondary">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {doc.updateFrequency}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {doc.description && (
                    <p className="text-sm text-muted-foreground">
                      {doc.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {doc.tags.map((tag, i) => (
                      <Badge key={i} variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Seções</p>
                      <p className="font-medium">{doc.sections}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Palavras</p>
                      <p className="font-medium">{doc.words.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Buscas</p>
                      <p className="font-medium">{doc.searchCount}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-xs text-muted-foreground">
                      {doc.indexedAt ? (
                        <>Indexado em {new Date(doc.indexedAt).toLocaleDateString()}</>
                      ) : (
                        <>Adicionado em {new Date(doc.createdAt).toLocaleDateString()}</>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(doc.url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      
                      {doc.status === 'indexed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReindex(doc.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(doc.id)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Buscas recentes */}
      {stats?.recentSearches && stats.recentSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buscas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentSearches.map((search, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{search.query}</span>
                  <span className="text-muted-foreground">
                    {search.resultsCount} resultados • {' '}
                    {new Date(search.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}