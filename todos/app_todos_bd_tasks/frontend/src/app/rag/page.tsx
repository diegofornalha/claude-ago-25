'use client'

import { RAGManager } from '@/components/RAGManager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function RAGPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestão do RAG Local</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie documentos capturados via WebFetch e salvos no cache RAG local
        </p>
      </div>

      <Alert>
        <span className="text-lg">ℹ️</span>
        <AlertTitle>Como funciona</AlertTitle>
        <AlertDescription>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>WebFetch captura conteúdo de páginas web</li>
            <li>Documentos são salvos localmente em <code>~/.claude/mcp-rag-cache/</code></li>
            <li>Busca offline usando vetorização TF-IDF</li>
            <li>100% local, nada é enviado para a nuvem</li>
          </ul>
        </AlertDescription>
      </Alert>

      <RAGManager />

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