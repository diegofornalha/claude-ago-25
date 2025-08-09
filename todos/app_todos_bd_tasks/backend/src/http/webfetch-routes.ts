import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db/client'
import { webfetchDocs, webfetchSubpages, webfetchSearchHistory } from '../db/schema/webfetch-docs'
import { eq, desc, ilike, and, or, sql } from 'drizzle-orm'
import { mcpRAG } from '../claude/mcp-rag-integration'

const app = new Hono()

// Schemas de validação
const CreateWebFetchDocSchema = z.object({
  url: z.string().url(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  autoUpdate: z.boolean().optional(),
  updateFrequency: z.enum(['daily', 'weekly', 'monthly', 'manual']).optional(),
  maxDepth: z.number().min(0).max(3).optional()
})

const UpdateWebFetchDocSchema = CreateWebFetchDocSchema.partial()

const SearchWebFetchSchema = z.object({
  query: z.string(),
  mode: z.enum(['naive', 'local', 'global', 'hybrid']).optional()
})

/**
 * GET /webfetch - Lista documentações
 */
app.get('/', async (c) => {
  const { category, status, search } = c.req.query()
  
  let conditions = []
  
  if (category) {
    conditions.push(eq(webfetchDocs.category, category))
  }
  
  if (status) {
    conditions.push(eq(webfetchDocs.status, status as any))
  }
  
  if (search) {
    conditions.push(
      or(
        ilike(webfetchDocs.title, `%${search}%`),
        ilike(webfetchDocs.url, `%${search}%`),
        ilike(webfetchDocs.description, `%${search}%`)
      )
    )
  }
  
  const docs = await db
    .select()
    .from(webfetchDocs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(webfetchDocs.createdAt))
  
  return c.json(docs)
})

/**
 * GET /webfetch/stats - Estatísticas
 */
app.get('/stats', async (c) => {
  const stats = await db
    .select({
      total: sql<number>`count(*)`,
      indexed: sql<number>`count(*) filter (where status = 'indexed')`,
      pending: sql<number>`count(*) filter (where status = 'pending')`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
      totalSections: sql<number>`sum(sections)`,
      totalWords: sql<number>`sum(words)`,
      categories: sql<string[]>`array_agg(distinct category) filter (where category is not null)`
    })
    .from(webfetchDocs)
  
  const recentSearches = await db
    .select()
    .from(webfetchSearchHistory)
    .orderBy(desc(webfetchSearchHistory.createdAt))
    .limit(10)
  
  return c.json({
    ...stats[0],
    recentSearches
  })
})

/**
 * GET /webfetch/:id - Detalhes de uma documentação
 */
app.get('/:id', async (c) => {
  const id = c.req.param('id')
  
  const [doc] = await db
    .select()
    .from(webfetchDocs)
    .where(eq(webfetchDocs.id, id))
  
  if (!doc) {
    return c.json({ error: 'Documentação não encontrada' }, 404)
  }
  
  // Buscar subpáginas
  const subpages = await db
    .select()
    .from(webfetchSubpages)
    .where(eq(webfetchSubpages.parentId, id))
    .orderBy(webfetchSubpages.depth)
  
  return c.json({
    ...doc,
    subpages
  })
})

/**
 * POST /webfetch - Adiciona nova documentação para indexar
 */
app.post('/', async (c) => {
  const body = await c.req.json()
  const data = CreateWebFetchDocSchema.parse(body)
  
  // Extrair domínio da URL
  const url = new URL(data.url)
  const domain = url.hostname
  
  const [doc] = await db
    .insert(webfetchDocs)
    .values({
      ...data,
      domain,
      status: 'pending'
    })
    .returning()
  
  // Disparar indexação via MCP-RAG
  mcpRAG.indexWebFetchDoc(doc.id).catch(error => {
    console.error('Erro ao disparar indexação:', error)
  })
  
  return c.json(doc, 201)
})

/**
 * PUT /webfetch/:id - Atualiza documentação
 */
app.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const data = UpdateWebFetchDocSchema.parse(body)
  
  const [updated] = await db
    .update(webfetchDocs)
    .set({
      ...data,
      updatedAt: new Date()
    })
    .where(eq(webfetchDocs.id, id))
    .returning()
  
  if (!updated) {
    return c.json({ error: 'Documentação não encontrada' }, 404)
  }
  
  return c.json(updated)
})

/**
 * DELETE /webfetch/:id - Remove documentação
 */
app.delete('/:id', async (c) => {
  const id = c.req.param('id')
  
  const [deleted] = await db
    .delete(webfetchDocs)
    .where(eq(webfetchDocs.id, id))
    .returning()
  
  if (!deleted) {
    return c.json({ error: 'Documentação não encontrada' }, 404)
  }
  
  // TODO: Remover do índice RAG
  // await removeFromIndex(deleted.documentId)
  
  return c.json({ message: 'Documentação removida com sucesso' })
})

/**
 * POST /webfetch/:id/index - Força reindexação
 */
app.post('/:id/index', async (c) => {
  const id = c.req.param('id')
  
  const [doc] = await db
    .select()
    .from(webfetchDocs)
    .where(eq(webfetchDocs.id, id))
  
  if (!doc) {
    return c.json({ error: 'Documentação não encontrada' }, 404)
  }
  
  // Atualizar status
  await db
    .update(webfetchDocs)
    .set({ status: 'indexing' })
    .where(eq(webfetchDocs.id, id))
  
  // Disparar indexação via MCP-RAG
  mcpRAG.indexWebFetchDoc(doc.id).catch(error => {
    console.error('Erro ao disparar reindexação:', error)
  })
  
  return c.json({ message: 'Indexação iniciada' })
})

/**
 * POST /webfetch/search - Busca no RAG
 */
app.post('/search', async (c) => {
  const body = await c.req.json()
  const { query, mode = 'hybrid' } = SearchWebFetchSchema.parse(body)
  
  // Buscar no MCP-RAG
  const ragResults = await mcpRAG.searchRAG(query, mode)
  
  // Buscar documentos correspondentes no banco
  const docIds = ragResults
    .filter(r => r.metadata?.url)
    .map(r => r.metadata.url)
  
  const docs = docIds.length > 0 ? await db
    .select()
    .from(webfetchDocs)
    .where(sql`url = ANY(${docIds})`)
    .limit(10) : []
  
  // Registrar busca
  await db.insert(webfetchSearchHistory).values({
    query,
    mode,
    resultsCount: docs.length,
    matchedDocs: docs.map(d => d.id)
  })
  
  // Incrementar contador de buscas
  if (docs.length > 0) {
    await db
      .update(webfetchDocs)
      .set({ 
        searchCount: sql`search_count + 1`,
        lastSearched: new Date()
      })
      .where(sql`id = ANY(${docs.map(d => d.id)})`)
  }
  
  // Combinar resultados do RAG com metadados do banco
  const enrichedResults = ragResults.map(ragResult => {
    const doc = docs.find(d => d.url === ragResult.metadata?.url)
    return {
      ...ragResult,
      doc: doc || null
    }
  })
  
  return c.json({
    query,
    mode,
    results: enrichedResults,
    totalResults: ragResults.length
  })
})

/**
 * POST /webfetch/batch - Adiciona múltiplas URLs
 */
app.post('/batch', async (c) => {
  const body = await c.req.json()
  const { urls, category, tags } = z.object({
    urls: z.array(z.string().url()),
    category: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).parse(body)
  
  const docs = []
  
  for (const url of urls) {
    const domain = new URL(url).hostname
    
    const [doc] = await db
      .insert(webfetchDocs)
      .values({
        url,
        domain,
        category,
        tags,
        status: 'pending'
      })
      .onConflictDoNothing()
      .returning()
    
    if (doc) {
      docs.push(doc)
    }
  }
  
  return c.json({
    message: `${docs.length} documentações adicionadas`,
    docs
  })
})

export default app