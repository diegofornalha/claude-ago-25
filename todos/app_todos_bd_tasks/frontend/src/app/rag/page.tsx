'use client'

import { RAGManagerV2 } from '@/components/RAGManagerV2'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Brain, Database, Shield, Zap } from 'lucide-react'

export default function RAGPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestão do RAG Local</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie documentos capturados via WebFetch e salvos no cache RAG local
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <Brain className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-sm">Busca Semântica</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Embeddings com all-MiniLM-L6-v2 para busca inteligente
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <Database className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-sm">Cache Local</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Documentos salvos em ~/.claude/mcp-rag-cache/
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <Shield className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-sm">100% Privado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Todos os dados ficam no seu dispositivo
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <Zap className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-sm">Alta Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Deduplicação automática e índices otimizados
            </p>
          </CardContent>
        </Card>
      </div>

      <RAGManagerV2 />

      <Card>
        <CardHeader>
          <CardTitle>Integração com Claude Code</CardTitle>
          <CardDescription>
            Como usar o RAG no Claude Code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Buscar documentos:</h4>
              <pre className="bg-muted p-3 rounded text-sm">
{`mcp__rag_standalone__rag_search({
  "query": "Claude Code features",
  "limit": 5
})`}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Indexar novo conteúdo:</h4>
              <pre className="bg-muted p-3 rounded text-sm">
{`mcp__rag_standalone__rag_index({
  "content": "Conteúdo capturado...",
  "source": "WebFetch",
  "metadata": {"url": "https://..."}
})`}
              </pre>
            </div>

            <div>
              <h4 className="font-medium mb-2">Ver estatísticas:</h4>
              <pre className="bg-muted p-3 rounded text-sm">
{`mcp__rag_standalone__rag_stats()`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}