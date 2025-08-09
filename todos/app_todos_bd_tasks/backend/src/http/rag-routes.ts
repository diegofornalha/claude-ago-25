import { Hono } from 'hono'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const app = new Hono()

// Caminho do cache RAG
const RAG_CACHE_DIR = path.join(os.homedir(), '.claude', 'mcp-rag-cache')
const DOCUMENTS_FILE = path.join(RAG_CACHE_DIR, 'documents.json')

/**
 * GET /rag/documents - Lista documentos do cache RAG
 */
app.get('/documents', async (c) => {
  try {
    // Verificar se o arquivo existe
    const exists = await fs.access(DOCUMENTS_FILE).then(() => true).catch(() => false)
    
    if (!exists) {
      return c.json({
        documents: [],
        stats: {
          total_documents: 0,
          cache_dir: RAG_CACHE_DIR
        }
      })
    }
    
    // Ler documentos
    const content = await fs.readFile(DOCUMENTS_FILE, 'utf-8')
    const documents = JSON.parse(content)
    
    // Calcular estatísticas
    const stats = {
      total_documents: documents.length,
      cache_dir: RAG_CACHE_DIR,
      oldest_doc: documents.length > 0 ? documents[0].timestamp : null,
      newest_doc: documents.length > 0 ? documents[documents.length - 1].timestamp : null,
      total_size: content.length
    }
    
    return c.json({ documents, stats })
  } catch (error) {
    console.error('Erro ao ler cache RAG:', error)
    return c.json({ error: 'Erro ao acessar cache RAG' }, 500)
  }
})

/**
 * POST /rag/search - Busca no cache RAG local
 */
app.post('/search', async (c) => {
  try {
    const body = await c.req.json()
    const { query } = z.object({
      query: z.string(),
      limit: z.number().optional().default(10)
    }).parse(body)
    
    // Ler documentos
    const content = await fs.readFile(DOCUMENTS_FILE, 'utf-8')
    const documents = JSON.parse(content)
    
    // Busca simples por palavras-chave
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(' ').filter(w => w.length > 2)
    
    const results = documents
      .map((doc: any) => {
        const contentLower = doc.content.toLowerCase()
        const titleLower = (doc.metadata?.title || '').toLowerCase()
        const sourceLower = doc.source.toLowerCase()
        
        // Calcular score baseado em matches
        let score = 0
        queryWords.forEach(word => {
          if (contentLower.includes(word)) score += 1
          if (titleLower.includes(word)) score += 2 // Título tem peso maior
          if (sourceLower.includes(word)) score += 0.5
        })
        
        return {
          ...doc,
          score: score / queryWords.length
        }
      })
      .filter((doc: any) => doc.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, body.limit || 10)
    
    return c.json({ results })
  } catch (error) {
    console.error('Erro na busca RAG:', error)
    return c.json({ error: 'Erro ao buscar' }, 500)
  }
})

/**
 * DELETE /rag/document/:id - Remove documento do cache
 */
app.delete('/document/:id', async (c) => {
  try {
    const { id } = c.req.param()
    
    // Ler documentos atuais
    const content = await fs.readFile(DOCUMENTS_FILE, 'utf-8')
    const documents = JSON.parse(content)
    
    // Filtrar removendo o documento
    const filtered = documents.filter((doc: any) => doc.id !== id)
    
    if (filtered.length === documents.length) {
      return c.json({ error: 'Documento não encontrado' }, 404)
    }
    
    // Salvar de volta
    await fs.writeFile(DOCUMENTS_FILE, JSON.stringify(filtered, null, 2))
    
    return c.json({ message: 'Documento removido', remaining: filtered.length })
  } catch (error) {
    console.error('Erro ao remover documento:', error)
    return c.json({ error: 'Erro ao remover' }, 500)
  }
})

/**
 * POST /rag/sync - Sincroniza com MCP RAG
 * Útil para atualizar após captura via WebFetch
 */
app.post('/sync', async (c) => {
  try {
    // Aqui você poderia chamar o MCP para sincronizar
    // Por enquanto, apenas retorna o status atual
    const exists = await fs.access(DOCUMENTS_FILE).then(() => true).catch(() => false)
    
    return c.json({
      synced: exists,
      cache_dir: RAG_CACHE_DIR,
      message: 'Sincronização não implementada ainda'
    })
  } catch (error) {
    return c.json({ error: 'Erro na sincronização' }, 500)
  }
})

export default app