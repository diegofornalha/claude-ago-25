import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client';
import { missions } from '../db/schema/missions';
import { eq } from 'drizzle-orm';
import { claudeChatIntegration } from '../claude/claudechat-integration';

const createMissionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const getMissionSchema = z.object({
  id: z.coerce.number(),
});

export async function missionsRoutes(app: FastifyInstance) {
  // Criar nova missão
  app.post('/missions', async (request, reply) => {
    const { title, description } = createMissionSchema.parse(request.body);
    
    try {
      // Iniciar transação
      const result = await db.transaction(async (tx) => {
        // Criar missão no banco
        const [mission] = await tx.insert(missions)
          .values({
            title,
            description,
            status: 'pending',
          })
          .returning();
        
        // Enviar missão para Claude em background
        claudeChatIntegration.sendMissionToClaudeChat(mission, {
          onStatusUpdate: (status, data) => {
            console.log(`Missão ${mission.id} mudou para status: ${status}`, data);
          },
          onProgress: (message) => {
            console.log(`Missão ${mission.id}: ${message}`);
          },
        }).catch(error => {
          console.error(`Erro ao processar missão ${mission.id}:`, error);
        });
        
        return mission;
      });
      
      return reply.status(201).send(result);
    } catch (error) {
      console.error('Erro ao criar missão:', error);
      return reply.status(500).send({ error: 'Erro ao criar missão' });
    }
  });
  
  // Buscar missão por ID
  app.get('/missions/:id', async (request, reply) => {
    const { id } = getMissionSchema.parse(request.params);
    
    try {
      const [mission] = await db.select()
        .from(missions)
        .where(eq(missions.id, id))
        .limit(1);
      
      if (!mission) {
        return reply.status(404).send({ error: 'Missão não encontrada' });
      }
      
      // Se a missão estiver completa, buscar as tarefas
      let todos: any[] = [];
      if (mission.status === 'completed' && mission.sessionId) {
        todos = await claudeChatIntegration.getMissionTodos(id);
      }
      
      return reply.send({
        ...mission,
        todos,
      });
    } catch (error) {
      console.error('Erro ao buscar missão:', error);
      return reply.status(500).send({ error: 'Erro ao buscar missão' });
    }
  });
  
  // Listar todas as missões
  app.get('/missions', async (request, reply) => {
    try {
      const allMissions = await db.select()
        .from(missions)
        .orderBy(missions.createdAt);
      
      return reply.send(allMissions);
    } catch (error) {
      console.error('Erro ao listar missões:', error);
      return reply.status(500).send({ error: 'Erro ao listar missões' });
    }
  });
  
  // Buscar tarefas de uma missão
  app.get('/missions/:id/todos', async (request, reply) => {
    const { id } = getMissionSchema.parse(request.params);
    
    try {
      const [mission] = await db.select()
        .from(missions)
        .where(eq(missions.id, id))
        .limit(1);
      
      if (!mission) {
        return reply.status(404).send({ error: 'Missão não encontrada' });
      }
      
      if (mission.status !== 'completed') {
        return reply.send({ todos: [], status: mission.status });
      }
      
      const todos = await claudeChatIntegration.getMissionTodos(id);
      
      return reply.send({ todos, status: mission.status });
    } catch (error) {
      console.error('Erro ao buscar tarefas da missão:', error);
      return reply.status(500).send({ error: 'Erro ao buscar tarefas' });
    }
  });
  
  // Deletar missão
  app.delete('/missions/:id', async (request, reply) => {
    const { id } = getMissionSchema.parse(request.params);
    
    try {
      // Verificar se a missão existe
      const [mission] = await db.select()
        .from(missions)
        .where(eq(missions.id, id))
        .limit(1);
      
      if (!mission) {
        return reply.status(404).send({ error: 'Missão não encontrada' });
      }
      
      // Deletar a missão
      await db.delete(missions)
        .where(eq(missions.id, id));
      
      return reply.status(204).send();
    } catch (error) {
      console.error('Erro ao deletar missão:', error);
      return reply.status(500).send({ error: 'Erro ao deletar missão' });
    }
  });
}