/**
 * Rotas para integração com Claude Sessions
 */

import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ClaudeIntegration } from '../claude/integration'
import { claudeChatIntegration } from '../claude/claudechat-integration'

const claude = new ClaudeIntegration()

export async function claudeRoutes(app: FastifyInstance) {
  // Listar todas as sessões
  app.get('/claude-sessions', async (request, reply) => {
    try {
      const sessions = await claude.getAllSessions()
      
      return reply.send({
        success: true,
        count: sessions.length,
        sessions
      })
    } catch (error) {
      console.error('Erro ao buscar sessões:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao buscar sessões'
      })
    }
  })

  // Buscar detalhes de uma sessão
  app.get('/claude-sessions/:sessionId', {
    schema: {
      params: z.object({
        sessionId: z.string()
      })
    }
  }, async (request, reply) => {
    const { sessionId } = request.params

    try {
      const session = await claude.getSessionDetails(sessionId)
      
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: 'Sessão não encontrada'
        })
      }

      return reply.send({
        success: true,
        session
      })
    } catch (error) {
      console.error('Erro ao buscar sessão:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao buscar detalhes da sessão'
      })
    }
  })

  // Buscar apenas todos de uma sessão
  app.get('/claude-sessions/:sessionId/todos', {
    schema: {
      params: z.object({
        sessionId: z.string()
      })
    }
  }, async (request, reply) => {
    const { sessionId } = request.params

    try {
      const session = await claude.getSessionDetails(sessionId)
      
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: 'Sessão não encontrada'
        })
      }

      const todos = session.todos
      const stats = {
        total: todos.length,
        pending: todos.filter((t: any) => t.status === 'pending').length,
        inProgress: todos.filter((t: any) => t.status === 'in_progress').length,
        completed: todos.filter((t: any) => t.status === 'completed').length
      }

      return reply.send({
        success: true,
        sessionId,
        todos,
        stats
      })
    } catch (error) {
      console.error('Erro ao buscar todos:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao buscar todos da sessão'
      })
    }
  })

  // Buscar apenas sessões ativas (com todos pendentes)
  app.get('/claude-sessions/active', async (request, reply) => {
    try {
      const sessions = await claude.getAllSessions()
      const activeSessions = sessions.filter(s => s.pendingCount > 0)
      
      return reply.send({
        success: true,
        count: activeSessions.length,
        sessions: activeSessions
      })
    } catch (error) {
      console.error('Erro ao buscar sessões ativas:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao buscar sessões ativas'
      })
    }
  })

  // Sincronizar todos de uma sessão com o banco local
  app.post('/claude-sessions/:sessionId/sync', {
    schema: {
      params: z.object({
        sessionId: z.string()
      })
    }
  }, async (request, reply) => {
    const { sessionId } = request.params

    try {
      const session = await claude.getSessionDetails(sessionId)
      
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: 'Sessão não encontrada'
        })
      }

      await claude.syncTodosToDatabase(sessionId, session.todos)

      return reply.send({
        success: true,
        message: `${session.todos.length} todos sincronizados`
      })
    } catch (error) {
      console.error('Erro ao sincronizar todos:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao sincronizar todos'
      })
    }
  })

  // Enviar missão para o ClaudeChat
  app.post('/claude-sessions/send-mission', {
    schema: {
      body: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional()
      })
    }
  }, async (request, reply) => {
    const mission = request.body

    try {
      // Enviar missão para o Claude
      const result = await claudeChatIntegration.sendMissionToClaudeChat(mission)
      
      // Se gerou todos, buscar eles
      let todos = []
      if (result.todosPath) {
        todos = await claudeChatIntegration.getTodosFromSession(result.sessionId)
      }

      return reply.send({
        success: true,
        sessionId: result.sessionId,
        response: result.response,
        todos,
        paths: {
          jsonl: result.jsonlPath,
          todos: result.todosPath
        }
      })
    } catch (error) {
      console.error('Erro ao enviar missão para Claude:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao processar missão com Claude'
      })
    }
  })
  
  // PUT - Atualizar tarefa
  app.put('/claude-sessions/:sessionId/todos/:todoId', {
    schema: {
      params: z.object({
        sessionId: z.string(),
        todoId: z.string()
      }),
      body: z.object({
        content: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional()
      })
    }
  }, async (request, reply) => {
    const { sessionId, todoId } = request.params
    const { content, status, priority } = request.body
    
    try {
      const updates: any = {}
      if (content !== undefined) updates.content = content
      if (status !== undefined) updates.status = status
      if (priority !== undefined) updates.priority = priority
      
      const updated = await claude.updateTodo(sessionId, todoId, updates)
      
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: 'Tarefa não encontrada'
        })
      }

      return reply.send({
        success: true,
        message: 'Tarefa atualizada com sucesso'
      })
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao atualizar tarefa'
      })
    }
  })

  // DELETE - Excluir tarefa
  app.delete('/claude-sessions/:sessionId/todos/:todoId', {
    schema: {
      params: z.object({
        sessionId: z.string(),
        todoId: z.string()
      })
    }
  }, async (request, reply) => {
    const { sessionId, todoId } = request.params
    
    try {
      const deleted = await claude.deleteTodo(sessionId, todoId)
      
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Tarefa não encontrada'
        })
      }

      return reply.send({
        success: true,
        message: 'Tarefa excluída com sucesso'
      })
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao excluir tarefa'
      })
    }
  })

  // PUT - Reordenar tarefas
  app.put('/claude-sessions/:sessionId/todos/reorder', {
    schema: {
      params: z.object({
        sessionId: z.string()
      }),
      body: z.object({
        todos: z.array(z.any())
      })
    }
  }, async (request, reply) => {
    const { sessionId } = request.params
    const { todos } = request.body
    
    try {
      const reordered = await claude.reorderTodos(sessionId, todos)
      
      if (!reordered) {
        return reply.status(404).send({
          success: false,
          error: 'Sessão não encontrada'
        })
      }

      return reply.send({
        success: true,
        message: 'Tarefas reordenadas com sucesso'
      })
    } catch (error) {
      console.error('Erro ao reordenar tarefas:', error)
      return reply.status(500).send({
        success: false,
        error: 'Erro ao reordenar tarefas'
      })
    }
  })
}