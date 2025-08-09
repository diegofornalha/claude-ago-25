'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { ExternalLink, Copy, Check, FileText, Code, Eye } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface DocumentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  document: {
    id: string
    title: string
    content: string
    source?: string
    type?: string
    category?: string
    tags?: string[]
    metadata?: any
    created_at?: string
    updated_at?: string
  } | null
}

export function DocumentDetailModal({ isOpen, onClose, document }: DocumentDetailModalProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('formatted')

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  if (!document) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(document.content)
    setCopied(true)
  }

  const handleOpenSource = () => {
    if (document.source?.startsWith('http')) {
      window.open(document.source, '_blank')
    } else if (document.metadata?.url) {
      window.open(document.metadata.url, '_blank')
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <DialogTitle className="text-2xl font-bold pr-4">
                {document.title}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                {document.type && (
                  <Badge variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {document.type}
                  </Badge>
                )}
                {document.category && (
                  <Badge variant="secondary">{document.category}</Badge>
                )}
                {document.tags?.map((tag) => (
                  <Badge key={tag} variant="default" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {(document.source?.startsWith('http') || document.metadata?.url) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenSource}
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir Fonte
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 px-6 pb-6 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="formatted" className="gap-2">
                <Eye className="h-4 w-4" />
                Formatado
              </TabsTrigger>
              <TabsTrigger value="raw" className="gap-2">
                <Code className="h-4 w-4" />
                Texto Bruto
              </TabsTrigger>
              <TabsTrigger value="metadata" className="gap-2">
                <FileText className="h-4 w-4" />
                Metadados
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="formatted" className="h-full mt-0">
                <ScrollArea className="h-full w-full rounded-md border p-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        },
                        h1: ({ children }) => (
                          <h1 className="text-3xl font-bold mt-6 mb-4">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-2xl font-semibold mt-5 mb-3">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xl font-medium mt-4 mb-2">{children}</h3>
                        ),
                        p: ({ children }) => (
                          <p className="mb-4 leading-relaxed">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-relaxed">{children}</li>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary pl-4 my-4 italic">
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {children}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4">
                            <table className="min-w-full divide-y divide-border">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-muted">{children}</thead>
                        ),
                        tbody: ({ children }) => (
                          <tbody className="divide-y divide-border">{children}</tbody>
                        ),
                        tr: ({ children }) => <tr>{children}</tr>,
                        th: ({ children }) => (
                          <th className="px-4 py-2 text-left font-medium">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="px-4 py-2">{children}</td>
                        ),
                      }}
                    >
                      {document.content}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="raw" className="h-full mt-0">
                <ScrollArea className="h-full w-full rounded-md border">
                  <pre className="p-6 text-sm font-mono whitespace-pre-wrap break-words">
                    {document.content}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="metadata" className="h-full mt-0">
                <ScrollArea className="h-full w-full">
                  <div className="space-y-4 p-4">
                    <Card>
                      <CardContent className="pt-6">
                        <dl className="grid grid-cols-1 gap-4">
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">ID</dt>
                            <dd className="text-sm font-mono">{document.id}</dd>
                          </div>
                          {document.source && (
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Fonte</dt>
                              <dd className="text-sm break-all">{document.source}</dd>
                            </div>
                          )}
                          {formatDate(document.created_at) && (
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Criado em</dt>
                              <dd className="text-sm">{formatDate(document.created_at)}</dd>
                            </div>
                          )}
                          {formatDate(document.updated_at) && (
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Atualizado em</dt>
                              <dd className="text-sm">{formatDate(document.updated_at)}</dd>
                            </div>
                          )}
                          {document.metadata && Object.keys(document.metadata).length > 0 && (
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground mb-2">
                                Metadados Adicionais
                              </dt>
                              <dd>
                                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                                  {JSON.stringify(document.metadata, null, 2)}
                                </pre>
                              </dd>
                            </div>
                          )}
                        </dl>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}