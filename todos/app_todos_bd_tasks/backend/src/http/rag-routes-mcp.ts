import { Hono } from 'hono'
import { z } from 'zod'
import { MCPClient, createRAGClient } from '../mcp/client'

const app = new Hono()

// Cliente MCP singleton
let mcpClient: MCPClient | null = null

async function getMCPClient(): Promise<MCPClient> {
  if (!mcpClient) {
    mcpClient = createRAGClient()
    await mcpClient.connect()
  }
  return mcpClient
}

// Schemas de validação
const searchSchema = z.object({
  query: z.string().min(1),
  top_k: z.number().int().positive().default(5)
})

const addDocumentSchema = z.object({
  content: z.string().min(1),
  source: z.string(),
  metadata: z.record(z.any()).optional()
})

const addBatchSchema = z.object({
  urls: z.array(z.string().url())
})

/**
 * GET /rag/stats - Estatísticas do cache RAG
 */
app.get('/stats', async (c) => {
  try {
    const client = await getMCPClient()
    const stats = await client.callTool('stats')
    return c.json({ stats })
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error)
    return c.json({ error: 'Erro ao acessar servidor MCP' }, 500)
  }
})

/**
 * GET /rag/documents - Lista documentos do cache RAG
 */
app.get('/documents', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20')
    
    const client = await getMCPClient()
    const result = await client.callTool('list', { limit })
    
    // Parse the text response to extract documents
    const documents = parseDocumentsList(result)
    
    return c.json({ 
      documents,
      total: documents.length,
      limit 
    })
  } catch (error) {
    console.error('Erro ao listar documentos:', error)
    return c.json({ error: 'Erro ao acessar servidor MCP' }, 500)
  }
})

/**
 * POST /rag/search - Busca vetorial no cache RAG
 */
app.post('/search', async (c) => {
  try {
    const body = await c.req.json()
    const { query, top_k } = searchSchema.parse(body)
    
    const client = await getMCPClient()
    const results = await client.callTool('search', { query, top_k })
    
    return c.json({ 
      query,
      results: parseSearchResults(results)
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Dados inválidos', details: error.errors }, 400)
    }
    console.error('Erro na busca:', error)
    return c.json({ error: 'Erro ao realizar busca' }, 500)
  }
})

/**
 * POST /rag/documents - Adiciona documento ao cache RAG
 */
app.post('/documents', async (c) => {
  try {
    const body = await c.req.json()
    const { content, source, metadata } = addDocumentSchema.parse(body)
    
    const client = await getMCPClient()
    const result = await client.callTool('add', { content, source, metadata })
    
    return c.json({ 
      success: true,
      message: result
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Dados inválidos', details: error.errors }, 400)
    }
    console.error('Erro ao adicionar documento:', error)
    return c.json({ error: 'Erro ao adicionar documento' }, 500)
  }
})

/**
 * POST /rag/batch - Adiciona múltiplas URLs para indexação
 */
app.post('/batch', async (c) => {
  try {
    const body = await c.req.json()
    const { urls } = addBatchSchema.parse(body)
    
    const client = await getMCPClient()
    const result = await client.callTool('add_batch', { urls })
    
    return c.json({ 
      success: true,
      message: result
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Dados inválidos', details: error.errors }, 400)
    }
    console.error('Erro ao adicionar batch:', error)
    return c.json({ error: 'Erro ao processar batch' }, 500)
  }
})

/**
 * DELETE /rag/documents/:id - Remove documento do cache RAG
 */
app.delete('/documents/:id', async (c) => {
  try {
    const documentId = c.req.param('id')
    
    if (!documentId) {
      return c.json({ error: 'ID do documento é obrigatório' }, 400)
    }
    
    const client = await getMCPClient()
    const result = await client.callTool('remove', { id: documentId })
    
    return c.json({ 
      success: true,
      message: 'Documento removido com sucesso',
      result
    })
  } catch (error) {
    console.error('Erro ao remover documento:', error)
    return c.json({ error: 'Erro ao remover documento' }, 500)
  }
})

/**
 * GET /rag/tools - Lista ferramentas disponíveis no MCP
 */
app.get('/tools', async (c) => {
  try {
    const client = await getMCPClient()
    const tools = await client.listTools()
    
    return c.json({ tools })
  } catch (error) {
    console.error('Erro ao listar ferramentas:', error)
    return c.json({ error: 'Erro ao acessar servidor MCP' }, 500)
  }
})

// Funções auxiliares para parsing
function parseDocumentsList(text: string): any[] {
  // Extrair documentos do texto retornado pelo MCP
  // Por enquanto, retornar array vazio
  // TODO: Implementar parsing real
  return []
}

function parseSearchResults(text: string): any[] {
  // Extrair resultados de busca do texto
  // Por enquanto, retornar array vazio
  // TODO: Implementar parsing real
  return []
}

// Cleanup ao encerrar
process.on('SIGINT', async () => {
  if (mcpClient) {
    await mcpClient.disconnect()
  }
  process.exit(0)
})

export default app