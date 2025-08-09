/**
 * Integração do MCP-RAG com o backend do app
 * Permite que o Claude Code use o RAG via comandos MCP
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { db } from '../db/client'
import { webfetchDocs, webfetchSubpages } from '../db/schema/webfetch-docs'
import { eq } from 'drizzle-orm'

const execAsync = promisify(exec)

export class MCPRAGIntegration {
  private mcpServerPath = '/Users/agents/.claude/mcp-rag-server/server.py'
  
  /**
   * Dispara indexação de uma URL via MCP
   */
  async indexWebFetchDoc(docId: string) {
    try {
      // Buscar documento no banco
      const [doc] = await db
        .select()
        .from(webfetchDocs)
        .where(eq(webfetchDocs.id, docId))
      
      if (!doc) {
        throw new Error('Documento não encontrado')
      }
      
      // Atualizar status para indexing
      await db
        .update(webfetchDocs)
        .set({ status: 'indexing' })
        .where(eq(webfetchDocs.id, docId))
      
      // Chamar MCP via Python (simulando chamada MCP)
      const command = `python3 -c "
import asyncio
import sys
sys.path.append('/Users/agents/.claude/mcp-rag-server')
from webfetch_integration import WebFetchRAGIntegration
from server import RAGIndex
from pathlib import Path

async def index_url():
    cache_dir = Path.home() / '.claude' / 'mcp-rag-cache'
    rag_index = RAGIndex(cache_dir)
    web_integration = WebFetchRAGIntegration(rag_index)
    
    result = await web_integration.fetch_and_index_url(
        '${doc.url}',
        max_depth=${doc.maxDepth || 1}
    )
    
    print(json.dumps(result))

asyncio.run(index_url())
"`
      
      const { stdout, stderr } = await execAsync(command)
      
      if (stderr) {
        console.error('Erro MCP:', stderr)
        throw new Error(stderr)
      }
      
      const result = JSON.parse(stdout)
      
      if (result.status === 'indexed') {
        // Atualizar documento com sucesso
        await db
          .update(webfetchDocs)
          .set({
            status: 'indexed',
            indexedAt: new Date(),
            documentId: result.doc_id,
            title: result.title || doc.title,
            sections: result.sections || 0
          })
          .where(eq(webfetchDocs.id, docId))
        
        // Salvar subpáginas indexadas
        if (result.subpages && result.subpages.length > 0) {
          for (const subpage of result.subpages) {
            if (subpage.status === 'indexed') {
              await db.insert(webfetchSubpages).values({
                parentId: docId,
                url: subpage.url,
                title: subpage.title,
                depth: 1,
                status: 'indexed'
              })
            }
          }
        }
        
        return { success: true, result }
      } else {
        throw new Error(result.error || 'Falha na indexação')
      }
      
    } catch (error: any) {
      // Atualizar status para failed
      await db
        .update(webfetchDocs)
        .set({ 
          status: 'failed',
          metadata: { error: error.message }
        })
        .where(eq(webfetchDocs.id, docId))
      
      throw error
    }
  }
  
  /**
   * Busca no RAG via MCP
   */
  async searchRAG(query: string, mode: string = 'hybrid') {
    try {
      const command = `python3 -c "
import asyncio
import json
import sys
sys.path.append('/Users/agents/.claude/mcp-rag-server')
from server import RAGIndex
from pathlib import Path

async def search():
    cache_dir = Path.home() / '.claude' / 'mcp-rag-cache'
    rag_index = RAGIndex(cache_dir)
    
    results = rag_index.search('${query}', '${mode}', 10)
    print(json.dumps(results))

asyncio.run(search())
"`
      
      const { stdout, stderr } = await execAsync(command)
      
      if (stderr) {
        console.error('Erro na busca:', stderr)
        return []
      }
      
      return JSON.parse(stdout)
      
    } catch (error) {
      console.error('Erro ao buscar no RAG:', error)
      return []
    }
  }
  
  /**
   * Verifica status do MCP-RAG
   */
  async checkHealth() {
    try {
      const command = `python3 -c "
import os
import json
from pathlib import Path

cache_dir = Path.home() / '.claude' / 'mcp-rag-cache'
docs_file = cache_dir / 'documents.json'

if docs_file.exists():
    with open(docs_file, 'r') as f:
        docs = json.load(f)
    print(json.dumps({
        'status': 'healthy',
        'documents': len(docs),
        'cache_dir': str(cache_dir)
    }))
else:
    print(json.dumps({
        'status': 'healthy',
        'documents': 0,
        'cache_dir': str(cache_dir)
    }))
"`
      
      const { stdout } = await execAsync(command)
      return JSON.parse(stdout)
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      }
    }
  }
}

// Singleton
export const mcpRAG = new MCPRAGIntegration()

// Worker para processar indexações pendentes
export async function processarIndexacoesPendentes() {
  try {
    // Buscar documentos pendentes
    const pendingDocs = await db
      .select()
      .from(webfetchDocs)
      .where(eq(webfetchDocs.status, 'pending'))
      .limit(5) // Processar 5 por vez
    
    for (const doc of pendingDocs) {
      try {
        console.log(`Indexando: ${doc.url}`)
        await mcpRAG.indexWebFetchDoc(doc.id)
        console.log(`✓ Indexado: ${doc.url}`)
      } catch (error) {
        console.error(`✗ Erro ao indexar ${doc.url}:`, error)
      }
      
      // Aguardar entre indexações para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
  } catch (error) {
    console.error('Erro ao processar indexações:', error)
  }
}

// Iniciar worker (executar a cada 30 segundos)
if (process.env.NODE_ENV !== 'test') {
  setInterval(processarIndexacoesPendentes, 30000)
  // Executar imediatamente na inicialização
  processarIndexacoesPendentes()
}