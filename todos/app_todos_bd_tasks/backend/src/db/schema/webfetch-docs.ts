import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

/**
 * Schema para gerenciar documentações capturadas via WebFetch
 */
export const webfetchDocs = pgTable('webfetch_docs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Informações da URL
  url: text('url').notNull().unique(),
  domain: text('domain').notNull(),
  title: text('title'),
  description: text('description'),
  
  // Status da indexação
  status: text('status', { 
    enum: ['pending', 'indexing', 'indexed', 'failed', 'archived'] 
  }).default('pending').notNull(),
  
  // Metadados da captura
  capturedAt: timestamp('captured_at'),
  lastUpdated: timestamp('last_updated'),
  indexedAt: timestamp('indexed_at'),
  
  // Dados do conteúdo
  contentHash: text('content_hash'), // Para detectar mudanças
  documentId: text('document_id'), // ID no sistema RAG
  sections: integer('sections').default(0),
  words: integer('words').default(0),
  
  // Configurações
  autoUpdate: boolean('auto_update').default(false),
  updateFrequency: text('update_frequency', {
    enum: ['daily', 'weekly', 'monthly', 'manual']
  }).default('manual'),
  maxDepth: integer('max_depth').default(1),
  
  // Organização
  category: text('category'), // Ex: "MCP", "Claude", "LangChain"
  tags: jsonb('tags').$type<string[]>().default([]),
  notes: text('notes'),
  
  // Estatísticas de uso
  searchCount: integer('search_count').default(0),
  lastSearched: timestamp('last_searched'),
  
  // Metadados extras
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

/**
 * Tabela para rastrear subpáginas indexadas
 */
export const webfetchSubpages = pgTable('webfetch_subpages', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: uuid('parent_id').notNull().references(() => webfetchDocs.id, { onDelete: 'cascade' }),
  
  url: text('url').notNull(),
  title: text('title'),
  depth: integer('depth').notNull(),
  status: text('status', { 
    enum: ['indexed', 'skipped', 'failed'] 
  }).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull()
})

/**
 * Tabela para histórico de buscas
 */
export const webfetchSearchHistory = pgTable('webfetch_search_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  query: text('query').notNull(),
  mode: text('mode').default('hybrid'),
  resultsCount: integer('results_count').default(0),
  
  // Documentos que apareceram nos resultados
  matchedDocs: jsonb('matched_docs').$type<string[]>().default([]),
  
  createdAt: timestamp('created_at').defaultNow().notNull()
})

// Relações
export const webfetchDocsRelations = relations(webfetchDocs, ({ many }) => ({
  subpages: many(webfetchSubpages)
}))

export const webfetchSubpagesRelations = relations(webfetchSubpages, ({ one }) => ({
  parent: one(webfetchDocs, {
    fields: [webfetchSubpages.parentId],
    references: [webfetchDocs.id]
  })
}))