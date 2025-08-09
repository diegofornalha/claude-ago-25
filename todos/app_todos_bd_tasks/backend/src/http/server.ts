import { fastifyCors } from "@fastify/cors";
import { fastifyCompress } from "@fastify/compress";
import { fastifyEtag } from "@fastify/etag";
import { fastifyHelmet } from "@fastify/helmet";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import { fastify } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { schema } from "../db/schema/index";
import { eq, desc, sql } from "drizzle-orm";
import { issuesToTasks } from "../utils/issue-to-task-transformer";
import { claudeRoutes } from "./claude-routes";
import { missionsRoutes } from "./missions-routes";
import { cleanupRoutes } from "./cleanup-routes";
import { documentsRoutes } from "./documents-routes";
import webfetchRoutes from "./webfetch-routes";
import ragRoutes from "./rag-routes-simple";
import ragSyncRoutes from "./rag-sync-routes";

const app = fastify({ 
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
}).withTypeProvider<ZodTypeProvider>()

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

await app.register(fastifyHelmet)
await app.register(fastifyCompress, { global: true })
await app.register(fastifyEtag)
await app.register(fastifyCors, {
  origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
})

const issuesCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute

app.post('/issues', {
  schema: {
    body: z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      userId: z.coerce.number().int().positive(),
    }),
    response: {
      201: z.object({
        id: z.number(),
        title: z.string(),
        userId: z.number(),
        createdAt: z.date(),
      }),
    },
  },
}, async (request, reply) => {
  const { title, description, userId } = request.body

  const [newIssue] = await db.insert(schema.issues).values({
    title,
    description,
    userId,
  }).returning()

  issuesCache.clear()

  return reply.status(201).send(newIssue)
})

app.get('/issues', {
  schema: {
    querystring: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
      userId: z.coerce.number().int().positive().optional(),
    }),
    response: {
      200: z.object({
        data: z.array(z.object({
          id: z.number(),
          title: z.string(),
          description: z.string().nullable(),
          userId: z.number(),
          createdAt: z.date(),
        })),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          totalPages: z.number(),
        }),
      }),
    },
  },
}, async (request, reply) => {
  const { page, limit, userId } = request.query
  const offset = (page - 1) * limit
  
  const cacheKey = `issues:${page}:${limit}:${userId || 'all'}`
  const cached = issuesCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    reply.header('X-Cache', 'HIT')
    return cached.data
  }

  const conditions = userId ? eq(schema.issues.userId, userId) : undefined
  
  const [issues, [{ count }]] = await Promise.all([
    db.select()
      .from(schema.issues)
      .where(conditions)
      .orderBy(desc(schema.issues.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.issues)
      .where(conditions),
  ])

  const result = {
    data: issues,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  }

  issuesCache.set(cacheKey, { data: result, timestamp: Date.now() })
  reply.header('X-Cache', 'MISS')
  
  return result
})

app.get('/issues/:id', {
  schema: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    response: {
      200: z.object({
        id: z.number(),
        title: z.string(),
        description: z.string().nullable(),
        userId: z.number(),
        createdAt: z.date(),
        user: z.object({
          id: z.number(),
          name: z.string(),
        }),
      }),
      404: z.object({
        error: z.string(),
      }),
    },
  },
}, async (request, reply) => {
  const { id } = request.params

  const result = await db
    .select({
      id: schema.issues.id,
      title: schema.issues.title,
      description: schema.issues.description,
      userId: schema.issues.userId,
      createdAt: schema.issues.createdAt,
      user: {
        id: schema.users.id,
        name: schema.users.name,
      },
    })
    .from(schema.issues)
    .innerJoin(schema.users, eq(schema.issues.userId, schema.users.id))
    .where(eq(schema.issues.id, id))
    .limit(1)

  if (result.length === 0) {
    return reply.status(404).send({ error: 'Issue not found' })
  }

  return result[0]
})

app.put('/issues/:id', {
  schema: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    body: z.object({
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      userId: z.coerce.number().int().positive().optional(),
    }),
    response: {
      200: z.object({
        id: z.number(),
        title: z.string(),
        description: z.string().nullable(),
        userId: z.number(),
        createdAt: z.date(),
        updatedAt: z.date().nullable(),
      }),
      404: z.object({
        error: z.string(),
      }),
    },
  },
}, async (request, reply) => {
  const { id } = request.params
  const updateData = request.body

  // Check if issue exists
  const [existingIssue] = await db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.id, id))
    .limit(1)

  if (!existingIssue) {
    return reply.status(404).send({ error: 'Issue not found' })
  }

  const [updatedIssue] = await db
    .update(schema.issues)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(schema.issues.id, id))
    .returning()

  // Clear cache after update
  issuesCache.clear()

  return updatedIssue
})

app.delete('/issues/:id', {
  schema: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    response: {
      204: z.null(),
      404: z.object({
        error: z.string(),
      }),
    },
  },
}, async (request, reply) => {
  const { id } = request.params

  // Check if issue exists
  const [existingIssue] = await db
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.id, id))
    .limit(1)

  if (!existingIssue) {
    return reply.status(404).send({ error: 'Issue not found' })
  }

  await db.delete(schema.issues).where(eq(schema.issues.id, id))

  // Clear cache after delete
  issuesCache.clear()

  return reply.status(204).send()
})

// User endpoints
app.post('/users', {
  schema: {
    body: z.object({
      name: z.string().min(1).max(255),
    }),
    response: {
      201: z.object({
        id: z.number(),
        name: z.string(),
        createdAt: z.date(),
      }),
    },
  },
}, async (request, reply) => {
  const { name } = request.body

  const [newUser] = await db.insert(schema.users).values({
    name,
  }).returning()

  return reply.status(201).send(newUser)
})

app.get('/users', {
  schema: {
    querystring: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }),
    response: {
      200: z.object({
        data: z.array(z.object({
          id: z.number(),
          name: z.string(),
          createdAt: z.date(),
        })),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          totalPages: z.number(),
        }),
      }),
    },
  },
}, async (request, reply) => {
  const { page, limit } = request.query
  const offset = (page - 1) * limit

  const [users, [{ count }]] = await Promise.all([
    db.select()
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(schema.users),
  ])

  return {
    data: users,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil(count / limit),
    },
  }
})

app.get('/users/:id', {
  schema: {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    response: {
      200: z.object({
        id: z.number(),
        name: z.string(),
        createdAt: z.date(),
        issuesCount: z.number(),
      }),
      404: z.object({
        error: z.string(),
      }),
    },
  },
}, async (request, reply) => {
  const { id } = request.params

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1)

  if (!user) {
    return reply.status(404).send({ error: 'User not found' })
  }

  // Count user's issues
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.issues)
    .where(eq(schema.issues.userId, id))

  return {
    ...user,
    issuesCount: count,
  }
})

app.get('/health', {
  schema: {
    response: {
      200: z.object({
        status: z.literal('ok'),
        timestamp: z.string(),
        uptime: z.number(),
      }),
    },
  },
}, async () => {
  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }
})

// Novo endpoint para tarefas
app.get('/tasks', {
  schema: {
    querystring: z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
      userId: z.coerce.number().int().positive().optional(),
    }),
    response: {
      200: z.array(z.object({
        content: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed']),
        priority: z.enum(['low', 'medium', 'high']),
        id: z.string(),
      })),
    },
  },
}, async (request, reply) => {
  const { page, limit, userId } = request.query
  const offset = (page - 1) * limit
  
  const cacheKey = `tasks:${page}:${limit}:${userId || 'all'}`
  const cached = issuesCache.get(cacheKey)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    reply.header('X-Cache', 'HIT')
    return cached.data
  }

  const conditions = userId ? eq(schema.issues.userId, userId) : undefined
  
  const issues = await db.select()
    .from(schema.issues)
    .where(conditions)
    .orderBy(desc(schema.issues.createdAt))
    .limit(limit)
    .offset(offset)

  const tasks = issuesToTasks(issues)
  
  issuesCache.set(cacheKey, { data: tasks, timestamp: Date.now() })
  reply.header('X-Cache', 'MISS')
  
  return tasks
})

// Rotas de missões removidas - usando missions-routes.ts

// Registrar rotas do Claude
await app.register(claudeRoutes, { prefix: '/api' })

// Registrar rotas de missões
await app.register(missionsRoutes)

// Registrar rotas de limpeza
await app.register(cleanupRoutes)

// Registrar rotas de documentos
await app.register(documentsRoutes)

// Registrar rotas de WebFetch (Hono para Fastify)
await app.register(async function (fastify) {
  // Adaptador simples para Hono -> Fastify
  fastify.all('/api/webfetch/*', async (request, reply) => {
    const path = request.url.replace('/api/webfetch', '')
    const method = request.method
    
    // Criar request compatível com Hono
    const honoRequest = new Request(`http://localhost${path}`, {
      method: method,
      headers: request.headers as any,
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(request.body) : undefined
    })
    
    // Executar no Hono
    const honoResponse = await webfetchRoutes.fetch(honoRequest)
    
    // Retornar resposta
    reply.status(honoResponse.status)
    return honoResponse.json()
  })
}, { prefix: '' })

// Registrar rotas de RAG (Hono para Fastify)
await app.register(async function (fastify) {
  fastify.all('/api/rag/*', async (request, reply) => {
    try {
      const path = request.url.replace('/api/rag', '')
      const method = request.method
      
      let body = undefined
      if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
        body = JSON.stringify(request.body)
      }
      
      const honoRequest = new Request(`http://localhost${path}`, {
        method: method,
        headers: request.headers as any,
        body: body
      })
      
      const honoResponse = await ragRoutes.fetch(honoRequest)
      
      reply.status(honoResponse.status)
      
      // Verifica se a resposta tem conteúdo
      const text = await honoResponse.text()
      if (text) {
        try {
          return JSON.parse(text)
        } catch {
          return { message: text }
        }
      }
      return {}
    } catch (error) {
      console.error('Erro na rota RAG:', error)
      reply.status(500)
      return { error: 'Erro interno no servidor' }
    }
  })
}, { prefix: '' })

// Registrar rotas de sincronização RAG (Hono para Fastify)
await app.register(async function (fastify) {
  fastify.all('/api/rag/sync/*', async (request, reply) => {
    const path = request.url.replace('/api/rag/sync', '')
    const method = request.method
    
    const honoRequest = new Request(`http://localhost${path}`, {
      method: method,
      headers: request.headers as any,
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(request.body) : undefined
    })
    
    const honoResponse = await ragSyncRoutes.fetch(honoRequest)
    
    reply.status(honoResponse.status)
    return honoResponse.json()
  })
}, { prefix: '' })

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.validation,
    })
  }

  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    })
  }

  return reply.status(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  })
})

const start = async () => {
  try {
    await app.listen({ port: 3344, host: '0.0.0.0' })
    app.log.info('🚀 HTTP server running on http://localhost:3344')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()