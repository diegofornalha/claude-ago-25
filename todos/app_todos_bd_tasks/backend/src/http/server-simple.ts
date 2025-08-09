import fastify from 'fastify'
import cors from '@fastify/cors'
import { ClaudeIntegration } from '../claude/integration'

const app = fastify({
  logger: true
})

// Registrar CORS
await app.register(cors, {
  origin: true,
  credentials: true
})

const claude = new ClaudeIntegration()

// Rota de teste
app.get('/api/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Rotas do Claude
app.get('/api/claude-sessions', async (request, reply) => {
  try {
    const sessions = await claude.getAllSessions()
    return {
      success: true,
      count: sessions.length,
      sessions
    }
  } catch (error) {
    console.error('Erro ao buscar sessões:', error)
    return reply.status(500).send({
      success: false,
      error: 'Erro ao buscar sessões'
    })
  }
})

app.get('/api/claude-sessions/:sessionId', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string }
  
  try {
    const session = await claude.getSessionDetails(sessionId)
    
    if (!session) {
      return reply.status(404).send({
        success: false,
        error: 'Sessão não encontrada'
      })
    }

    return {
      success: true,
      session
    }
  } catch (error) {
    console.error('Erro ao buscar sessão:', error)
    return reply.status(500).send({
      success: false,
      error: 'Erro ao buscar detalhes da sessão'
    })
  }
})

app.get('/api/claude-sessions/:sessionId/todos', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string }
  
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

    return {
      success: true,
      sessionId,
      todos,
      stats
    }
  } catch (error) {
    console.error('Erro ao buscar todos:', error)
    return reply.status(500).send({
      success: false,
      error: 'Erro ao buscar todos da sessão'
    })
  }
})

// PUT - Atualizar tarefa
app.put('/api/claude-sessions/:sessionId/todos/:todoId', async (request, reply) => {
  const { sessionId, todoId } = request.params as { sessionId: string; todoId: string }
  const { content, status, priority } = request.body as { content?: string; status?: string; priority?: string }
  
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

    return {
      success: true,
      message: 'Tarefa atualizada com sucesso'
    }
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error)
    return reply.status(500).send({
      success: false,
      error: 'Erro ao atualizar tarefa'
    })
  }
})

// DELETE - Excluir tarefa
app.delete('/api/claude-sessions/:sessionId/todos/:todoId', async (request, reply) => {
  const { sessionId, todoId } = request.params as { sessionId: string; todoId: string }
  
  try {
    const deleted = await claude.deleteTodo(sessionId, todoId)
    
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: 'Tarefa não encontrada'
      })
    }

    return {
      success: true,
      message: 'Tarefa excluída com sucesso'
    }
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error)
    return reply.status(500).send({
      success: false,
      error: 'Erro ao excluir tarefa'
    })
  }
})

// PUT - Reordenar tarefas
app.put('/api/claude-sessions/:sessionId/todos/reorder', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string }
  const { todos } = request.body as { todos: any[] }
  
  try {
    const reordered = await claude.reorderTodos(sessionId, todos)
    
    if (!reordered) {
      return reply.status(404).send({
        success: false,
        error: 'Sessão não encontrada'
      })
    }

    return {
      success: true,
      message: 'Tarefas reordenadas com sucesso'
    }
  } catch (error) {
    console.error('Erro ao reordenar tarefas:', error)
    return reply.status(500).send({
      success: false,
      error: 'Erro ao reordenar tarefas'
    })
  }
})

// Iniciar servidor
const start = async () => {
  try {
    await app.listen({ port: 3344, host: '0.0.0.0' })
    console.log('Servidor rodando em http://localhost:3344')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()