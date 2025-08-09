import { db } from '../db/client'
import { webfetchDocs } from '../db/schema/webfetch-docs'
import { eq, and, inArray } from 'drizzle-orm'
import { createHash } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

interface RAGDocument {
  id: string
  content: string
  source: string
  metadata: {
    url?: string
    title?: string
    timestamp?: string
    type?: string
  }
}

interface CacheDocument {
  id: string
  source: string
  content: string
  embeddings?: number[]
  metadata: any
  timestamp: string
}

export class RAGSyncService {
  private cacheDir: string
  private documentsPath: string
  
  constructor() {
    this.cacheDir = path.join(process.env.HOME || '', '.claude', 'mcp-rag-cache')
    this.documentsPath = path.join(this.cacheDir, 'documents.json')
  }
  
  /**
   * Sincroniza cache local com PostgreSQL
   */
  async syncCacheToDatabase() {
    console.log('🔄 Iniciando sincronização RAG Cache → PostgreSQL...')
    
    try {
      // 1. Ler documentos do cache local
      const cacheDocuments = await this.loadCacheDocuments()
      console.log(`📚 ${cacheDocuments.length} documentos encontrados no cache`)
      
      // 2. Separar por tipo
      const webDocs = cacheDocuments.filter(doc => 
        doc.metadata?.url || doc.source?.startsWith('http')
      )
      
      const sessionDocs = cacheDocuments.filter(doc => 
        doc.metadata?.type === 'session' || doc.source?.includes('.jsonl')
      )
      
      console.log(`🌐 ${webDocs.length} documentos web`)
      console.log(`📝 ${sessionDocs.length} documentos de sessão`)
      
      // 3. Sincronizar documentos web
      await this.syncWebDocuments(webDocs)
      
      // 4. Por enquanto, apenas log das sessões (futura tabela)
      if (sessionDocs.length > 0) {
        console.log(`ℹ️  Sessões serão sincronizadas em futura implementação`)
      }
      
      console.log('✅ Sincronização concluída!')
      
      return {
        total: cacheDocuments.length,
        webDocs: webDocs.length,
        sessionDocs: sessionDocs.length
      }
      
    } catch (error) {
      console.error('❌ Erro na sincronização:', error)
      throw error
    }
  }
  
  /**
   * Carrega documentos do cache local
   */
  private async loadCacheDocuments(): Promise<CacheDocument[]> {
    try {
      const data = await fs.readFile(this.documentsPath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.warn('⚠️  Cache não encontrado ou vazio')
      return []
    }
  }
  
  /**
   * Sincroniza documentos web com a tabela webfetch_docs
   */
  private async syncWebDocuments(documents: CacheDocument[]) {
    for (const doc of documents) {
      try {
        const url = doc.metadata?.url || doc.source
        if (!url || !url.startsWith('http')) continue
        
        // Extrair informações
        const domain = new URL(url).hostname
        const contentHash = createHash('md5').update(doc.content).digest('hex')
        const wordCount = doc.content.split(/\s+/).length
        
        // Verificar se já existe
        const existing = await db
          .select()
          .from(webfetchDocs)
          .where(eq(webfetchDocs.url, url))
          .limit(1)
        
        if (existing.length > 0) {
          // Atualizar se mudou
          if (existing[0].contentHash !== contentHash) {
            await db
              .update(webfetchDocs)
              .set({
                contentHash,
                words: wordCount,
                documentId: doc.id,
                lastUpdated: new Date(),
                status: 'indexed',
                updatedAt: new Date()
              })
              .where(eq(webfetchDocs.id, existing[0].id))
            
            console.log(`📝 Atualizado: ${domain} - ${doc.metadata?.title || 'Sem título'}`)
          }
        } else {
          // Inserir novo
          await db.insert(webfetchDocs).values({
            url,
            domain,
            title: doc.metadata?.title || 'Documento RAG',
            description: doc.content.substring(0, 200) + '...',
            status: 'indexed',
            capturedAt: new Date(doc.timestamp || Date.now()),
            indexedAt: new Date(),
            contentHash,
            documentId: doc.id,
            words: wordCount,
            category: this.categorizeByDomain(domain),
            metadata: doc.metadata || {}
          })
          
          console.log(`✅ Novo: ${domain} - ${doc.metadata?.title || 'Sem título'}`)
        }
        
      } catch (error) {
        console.error(`❌ Erro ao sincronizar ${doc.id}:`, error)
      }
    }
  }
  
  /**
   * Categoriza documento baseado no domínio
   */
  private categorizeByDomain(domain: string): string {
    const categories: Record<string, string[]> = {
      'MCP': ['modelcontextprotocol.io'],
      'Database': ['orm.drizzle.team', 'electric-sql.com', 'github.com/TanStack/db'],
      'Framework': ['fastify.dev', 'tanstack.com', 'zod.dev'],
      'Claude': ['anthropic.com', 'claude.ai'],
      'LocalFirst': ['localfirstweb.dev']
    }
    
    for (const [category, domains] of Object.entries(categories)) {
      if (domains.some(d => domain.includes(d))) {
        return category
      }
    }
    
    return 'General'
  }
  
  /**
   * Sincroniza do banco para o cache (direção inversa)
   */
  async syncDatabaseToCache() {
    console.log('🔄 Sincronizando PostgreSQL → RAG Cache...')
    
    try {
      // Buscar documentos indexados no banco
      const dbDocs = await db
        .select()
        .from(webfetchDocs)
        .where(eq(webfetchDocs.status, 'indexed'))
      
      console.log(`📊 ${dbDocs.length} documentos no banco`)
      
      // Carregar cache atual
      const cacheDocuments = await this.loadCacheDocuments()
      const cacheIds = new Set(cacheDocuments.map(d => d.id))
      
      // Identificar documentos que estão no banco mas não no cache
      const missingInCache = dbDocs.filter(doc => 
        doc.documentId && !cacheIds.has(doc.documentId)
      )
      
      if (missingInCache.length > 0) {
        console.log(`⚠️  ${missingInCache.length} documentos precisam ser re-indexados no cache`)
        // Aqui você poderia chamar o WebFetch para re-indexar
      }
      
      return {
        dbTotal: dbDocs.length,
        cacheTotal: cacheDocuments.length,
        missing: missingInCache.length
      }
      
    } catch (error) {
      console.error('❌ Erro na sincronização reversa:', error)
      throw error
    }
  }
  
  /**
   * Status da sincronização
   */
  async getSyncStatus() {
    const cacheDocuments = await this.loadCacheDocuments()
    const dbDocs = await db.select().from(webfetchDocs)
    
    return {
      cache: {
        total: cacheDocuments.length,
        types: this.groupByType(cacheDocuments)
      },
      database: {
        total: dbDocs.length,
        byStatus: this.groupByStatus(dbDocs),
        byCategory: this.groupByCategory(dbDocs)
      },
      lastSync: new Date()
    }
  }
  
  private groupByType(docs: CacheDocument[]) {
    const types: Record<string, number> = {}
    docs.forEach(doc => {
      const type = doc.metadata?.type || 'unknown'
      types[type] = (types[type] || 0) + 1
    })
    return types
  }
  
  private groupByStatus(docs: any[]) {
    const statuses: Record<string, number> = {}
    docs.forEach(doc => {
      statuses[doc.status] = (statuses[doc.status] || 0) + 1
    })
    return statuses
  }
  
  private groupByCategory(docs: any[]) {
    const categories: Record<string, number> = {}
    docs.forEach(doc => {
      const cat = doc.category || 'uncategorized'
      categories[cat] = (categories[cat] || 0) + 1
    })
    return categories
  }
}

// Singleton
export const ragSync = new RAGSyncService()