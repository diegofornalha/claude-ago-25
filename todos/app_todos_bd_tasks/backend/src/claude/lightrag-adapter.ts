/**
 * Adaptador para integração com LightRAG
 * Unifica o sistema de Claude Sessions com busca semântica
 */

import axios from 'axios'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'

// Configuração
const LIGHTRAG_URL = process.env.LIGHTRAG_URL || 'http://localhost:8020'
const LIGHTRAG_TIMEOUT = 30000 // 30 segundos

// Schemas
const LightRAGQuerySchema = z.object({
  query: z.string(),
  mode: z.enum(['naive', 'local', 'global', 'hybrid']).default('hybrid'),
  max_results: z.number().optional().default(10),
  only_need_context: z.boolean().optional().default(false)
})

const LightRAGInsertSchema = z.object({
  text: z.string(),
  source: z.string().optional(),
  summary: z.string().optional()
})

export class LightRAGAdapter {
  private client = axios.create({
    baseURL: LIGHTRAG_URL,
    timeout: LIGHTRAG_TIMEOUT,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  /**
   * Verifica se o serviço LightRAG está disponível
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', {
        timeout: 5000
      })
      return response.status === 200
    } catch (error) {
      console.error('LightRAG health check failed:', error)
      return false
    }
  }

  /**
   * Busca informações na base de conhecimento
   */
  async query(params: z.infer<typeof LightRAGQuerySchema>) {
    try {
      const validatedParams = LightRAGQuerySchema.parse(params)
      const response = await this.client.post('/query', validatedParams)
      
      return {
        success: true,
        results: response.data.results || [],
        context: response.data.context || null,
        error: null
      }
    } catch (error: any) {
      console.error('LightRAG query error:', error)
      return {
        success: false,
        results: [],
        context: null,
        error: error.message || 'Query failed'
      }
    }
  }

  /**
   * Insere texto na base de conhecimento
   */
  async insertText(params: z.infer<typeof LightRAGInsertSchema>) {
    try {
      const validatedParams = LightRAGInsertSchema.parse(params)
      const response = await this.client.post('/insert', validatedParams)
      
      return {
        success: true,
        message: response.data.message || 'Text inserted successfully',
        error: null
      }
    } catch (error: any) {
      console.error('LightRAG insert error:', error)
      return {
        success: false,
        message: null,
        error: error.message || 'Insert failed'
      }
    }
  }

  /**
   * Indexa uma sessão completa do Claude
   */
  async indexSession(sessionId: string, todos: any[], conversation?: any[]) {
    try {
      // Preparar conteúdo da sessão
      let content = `Sessão Claude: ${sessionId}\n\n`
      
      // Adicionar tarefas
      if (todos && todos.length > 0) {
        content += 'TAREFAS:\n'
        todos.forEach((todo, index) => {
          content += `${index + 1}. [${todo.status}] ${todo.content} (Prioridade: ${todo.priority})\n`
        })
        content += '\n'
      }
      
      // Adicionar resumo da conversa (se disponível)
      if (conversation && conversation.length > 0) {
        content += 'CONVERSA:\n'
        conversation.slice(0, 10).forEach(msg => {
          if (msg.type === 'user' && msg.content) {
            content += `Usuário: ${msg.content.substring(0, 200)}...\n`
          }
        })
      }
      
      // Inserir no LightRAG
      const result = await this.insertText({
        text: content,
        source: `claude_session_${sessionId}`,
        summary: `Sessão com ${todos.length} tarefas`
      })
      
      return result
    } catch (error: any) {
      console.error(`Error indexing session ${sessionId}:`, error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Busca sessões relacionadas a uma query
   */
  async searchSessions(query: string, mode: 'naive' | 'local' | 'global' | 'hybrid' = 'hybrid') {
    try {
      const result = await this.query({
        query,
        mode,
        max_results: 20
      })
      
      if (!result.success || result.results.length === 0) {
        return []
      }
      
      // Extrair IDs de sessão dos resultados
      const sessionIds = new Set<string>()
      result.results.forEach((res: any) => {
        // Procurar por padrões de UUID
        const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
        const matches = (res.content || '').match(uuidPattern)
        if (matches) {
          matches.forEach(id => sessionIds.add(id))
        }
      })
      
      return Array.from(sessionIds)
    } catch (error) {
      console.error('Error searching sessions:', error)
      return []
    }
  }

  /**
   * Obtém sugestões contextuais para uma sessão
   */
  async getSuggestions(sessionId: string, currentTask?: string) {
    try {
      let query = `tarefas similares ou relacionadas`
      if (currentTask) {
        query = `tarefas similares a: ${currentTask}`
      }
      
      const result = await this.query({
        query,
        mode: 'local',
        max_results: 5
      })
      
      if (!result.success) {
        return []
      }
      
      // Processar resultados para extrair sugestões úteis
      const suggestions = result.results.map((res: any) => {
        // Extrair tarefas completas dos resultados
        const taskPattern = /\[completed\] (.+?) \(Prioridade:/gi
        const matches = [...(res.content || '').matchAll(taskPattern)]
        return matches.map(m => m[1])
      }).flat()
      
      // Remover duplicatas e limitar resultados
      return [...new Set(suggestions)].slice(0, 5)
    } catch (error) {
      console.error('Error getting suggestions:', error)
      return []
    }
  }

  /**
   * Indexa todas as sessões existentes (migração inicial)
   */
  async indexAllSessions(progressCallback?: (current: number, total: number) => void) {
    try {
      const TODOS_DIR = '/Users/agents/.claude/todos'
      const todoFiles = await fs.readdir(TODOS_DIR)
      const jsonFiles = todoFiles.filter(f => f.endsWith('.json'))
      
      let indexed = 0
      const total = jsonFiles.length
      
      for (const file of jsonFiles) {
        const sessionId = file.replace('.json', '')
        const todoPath = path.join(TODOS_DIR, file)
        
        try {
          const content = await fs.readFile(todoPath, 'utf-8')
          const todos = JSON.parse(content)
          
          if (todos.length > 0) {
            await this.indexSession(sessionId, todos)
            indexed++
          }
          
          if (progressCallback) {
            progressCallback(indexed, total)
          }
        } catch (error) {
          console.error(`Error indexing session ${sessionId}:`, error)
        }
      }
      
      return {
        total,
        indexed,
        success: true
      }
    } catch (error: any) {
      console.error('Error indexing all sessions:', error)
      return {
        total: 0,
        indexed: 0,
        success: false,
        error: error.message
      }
    }
  }
}

// Singleton instance
export const lightRAG = new LightRAGAdapter()