import { FastifyInstance } from 'fastify'
import { exec } from 'child_process'
import { promisify } from 'util'
import { z } from 'zod'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const execAsync = promisify(exec)

export async function cleanupRoutes(app: FastifyInstance) {
  // Rota para verificar quais arquivos seriam removidos
  app.get('/api/cleanup/preview', async (request, reply) => {
    try {
      const todosDir = `${process.env.HOME}/.claude/todos`
      const files = await readdir(todosDir)
      
      const emptyFiles = []
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        
        const filePath = join(todosDir, file)
        const content = await readFile(filePath, 'utf-8')
        const trimmed = content.trim()
        
        // Verifica se é vazio ou apenas []
        if (!content || trimmed === '[]' || trimmed === '') {
          emptyFiles.push({
            filename: file,
            sessionId: file.replace('.json', '')
          })
        }
      }
      
      return reply.send({
        emptyFiles,
        totalEmpty: emptyFiles.length
      })
    } catch (error) {
      console.error('Erro ao verificar arquivos:', error)
      return reply.status(500).send({
        error: 'Erro ao verificar arquivos vazios'
      })
    }
  })

  // Rota para executar a limpeza
  app.post('/api/cleanup/empty-todos', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          removed: z.number(),
          preserved: z.number(),
        }),
        500: z.object({
          error: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const scriptPath = `${process.env.HOME}/.claude/todos/limpar_todo_vazia.sh`
      
      // Verifica se o script existe
      try {
        await execAsync(`test -f ${scriptPath}`)
      } catch {
        // Se não existe, usa o clean_todos.sh
        const alternativePath = `${process.env.HOME}/.claude/clean_todos.sh`
        const { stdout } = await execAsync(`bash ${alternativePath}`)
        
        // Extrai números do output
        const removedMatch = stdout.match(/Total de arquivos removidos:\s*(\d+)/)
        const preservedMatch = stdout.match(/Arquivos preservados:\s*(\d+)/)
        
        const removed = removedMatch ? parseInt(removedMatch[1]) : 0
        const preserved = preservedMatch ? parseInt(preservedMatch[1]) : 0
        
        return reply.send({
          success: true,
          message: 'Limpeza executada com sucesso',
          removed,
          preserved,
        })
      }
      
      // Executa o script
      const { stdout } = await execAsync(`bash ${scriptPath}`)
      
      // Extrai números do output
      const removedMatch = stdout.match(/Total de arquivos removidos:\s*(\d+)/)
      const preservedMatch = stdout.match(/Arquivos preservados:\s*(\d+)/)
      
      const removed = removedMatch ? parseInt(removedMatch[1]) : 0
      const preserved = preservedMatch ? parseInt(preservedMatch[1]) : 0
      
      return reply.send({
        success: true,
        message: 'Limpeza executada com sucesso',
        removed,
        preserved,
      })
    } catch (error) {
      console.error('Erro ao executar limpeza:', error)
      return reply.status(500).send({
        error: 'Erro ao executar script de limpeza',
      })
    }
  })

  // Nova rota para limpeza inteligente (projetos órfãos)
  app.post('/api/cleanup/orphaned-todos', {
    schema: {
      response: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
          orphaned: z.number(),
          empty: z.number(),
          preserved: z.number(),
        }),
        500: z.object({
          error: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const scriptPath = `${process.env.HOME}/.claude/todos/limpar_todo_vazia.sh`
      
      // Executa o script melhorado
      const { stdout } = await execAsync(`bash ${scriptPath}`)
      
      // Extrai números do output atualizado
      const orphanedMatch = stdout.match(/Arquivos órfãos removidos[^:]*:\s*(\d+)/)
      const emptyMatch = stdout.match(/Arquivos vazios removidos[^:]*:\s*(\d+)/)
      const preservedMatch = stdout.match(/Arquivos preservados[^:]*:\s*(\d+)/)
      
      const orphaned = orphanedMatch ? parseInt(orphanedMatch[1]) : 0
      const empty = emptyMatch ? parseInt(emptyMatch[1]) : 0
      const preserved = preservedMatch ? parseInt(preservedMatch[1]) : 0
      
      return reply.send({
        success: true,
        message: 'Limpeza inteligente executada com sucesso',
        orphaned,
        empty,
        preserved,
      })
    } catch (error) {
      console.error('Erro ao executar limpeza inteligente:', error)
      return reply.status(500).send({
        error: 'Erro ao executar script de limpeza inteligente',
      })
    }
  })
}