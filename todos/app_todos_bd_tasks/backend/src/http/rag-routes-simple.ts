import { Hono } from 'hono'
import { z } from 'zod'
import { ragService } from '../services/rag-service'

const app = new Hono()

// Schemas
const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().default(5)
})

const addDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.string().default('general'),
  source: z.string().default('manual'),
  metadata: z.record(z.any()).optional()
})

/**
 * GET /rag/stats - Estatísticas do cache RAG
 */
app.get('/stats', async (c) => {
  const stats = await ragService.getStats()
  return c.json(stats)
})

/**
 * GET /rag/documents - Lista documentos
 */
app.get('/documents', async (c) => {
  const documents = await ragService.listDocuments()
  return c.json({ 
    documents,
    total: documents.length 
  })
})

/**
 * POST /rag/search - Busca documentos
 */
app.post('/search', async (c) => {
  const body = await c.req.json()
  const { query, limit } = searchSchema.parse(body)
  
  const results = await ragService.search(query, limit)
  return c.json({ 
    results,
    query,
    total: results.length 
  })
})

/**
 * POST /rag/add - Adiciona documento
 */
app.post('/add', async (c) => {
  const body = await c.req.json()
  const doc = addDocumentSchema.parse(body)
  
  const newDoc = await ragService.addDocument(doc)
  return c.json({ 
    success: true,
    document: newDoc 
  })
})

/**
 * DELETE /rag/documents/:id - Remove documento
 */
app.delete('/documents/:id', async (c) => {
  const id = c.req.param('id')
  
  const success = await ragService.removeDocument(id)
  if (success) {
    return c.json({ 
      success: true,
      message: 'Documento removido com sucesso' 
    })
  } else {
    return c.json({ 
      error: 'Documento não encontrado' 
    }, 404)
  }
})

/**
 * POST /rag/index-session - Indexa sessão do Claude
 */
app.post('/index-session', async (c) => {
  const { sessionId, messages } = await c.req.json()
  
  await ragService.indexClaudeSession(sessionId, messages)
  
  return c.json({ 
    success: true,
    message: 'Sessão indexada com sucesso' 
  })
})

/**
 * POST /rag/index-url - Indexa URL usando fetch simples
 */
app.post('/index-url', async (c) => {
  const { url } = await c.req.json()
  
  if (!url || !url.startsWith('http')) {
    return c.json({ error: 'URL inválida' }, 400)
  }
  
  try {
    // Buscar conteúdo da URL diretamente
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGIndexer/1.0)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const html = await response.text()
    
    // Extrair título da página
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : url
    
    // Extrair texto do body (versão simplificada)
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
      .replace(/<[^>]+>/g, ' ')                          // Remove tags HTML
      .replace(/\s+/g, ' ')                              // Normaliza espaços
      .trim()
    
    // Limitar tamanho do conteúdo
    if (content.length > 10000) {
      content = content.substring(0, 10000) + '...'
    }
    
    // Adicionar ao RAG
    const doc = await ragService.addDocument({
      title,
      content,
      type: 'webpage',
      source: url,
      metadata: {
        url,
        capturedVia: 'WebFetch',
        fetchedAt: new Date().toISOString(),
        contentLength: content.length
      }
    })
    
    return c.json({ 
      success: true,
      document: doc,
      message: 'URL indexada com sucesso' 
    })
  } catch (error) {
    console.error('Erro ao indexar URL:', error)
    return c.json({ 
      error: 'Erro ao indexar URL',
      details: error.message 
    }, 500)
  }
})

/**
 * GET /rag/sync-todos - Sincroniza arquivos de todos como Playbooks
 */
app.get('/sync-todos', async (c) => {
  try {
    const fs = await import('fs').then(m => m.promises)
    const path = await import('path')
    
    // Diretório dos arquivos de todos
    const todosDir = '/Users/agents/.claude/todos'
    
    // Não precisa mais remover, pois o addDocument agora verifica duplicatas automaticamente
    
    // Ler todos os arquivos .json do diretório
    const files = await fs.readdir(todosDir)
    const todoFiles = files.filter(file => file.endsWith('.json') && file !== 'todos.json')
    
    let addedCount = 0
    let errorCount = 0
    
    for (const file of todoFiles) {
      try {
        const filePath = path.join(todosDir, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const todos = JSON.parse(content)
        
        if (Array.isArray(todos) && todos.length > 0) {
          // Criar conteúdo formatado das tarefas
          const formattedContent = todos.map((todo: any, index: number) => 
            `${index + 1}. [${todo.status}] ${todo.content} (${todo.priority})`
          ).join('\n')
          
          // Adicionar como documento do tipo playbook
          await ragService.addDocument({
            title: `Playbook: ${file.replace('.json', '')}`,
            content: formattedContent,
            type: 'playbook',
            source: filePath,
            metadata: {
              fileName: file,
              taskCount: todos.length,
              capturedVia: 'TodoSync',
              syncedAt: new Date().toISOString()
            }
          })
          
          addedCount++
        }
      } catch (error) {
        console.error(`Erro ao processar ${file}:`, error)
        errorCount++
      }
    }
    
    return c.json({
      success: true,
      message: `Sincronização concluída: ${addedCount} playbooks adicionados`,
      stats: {
        total: todoFiles.length,
        added: addedCount,
        errors: errorCount
      }
    })
  } catch (error) {
    console.error('Erro ao sincronizar todos:', error)
    return c.json({ 
      error: 'Erro ao sincronizar todos',
      details: error.message 
    }, 500)
  }
})

export default app