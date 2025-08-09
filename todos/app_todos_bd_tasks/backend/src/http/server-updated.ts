import { fastifyCors } from "@fastify/cors";
import { fastifyCompress } from "@fastify/compress";
import { fastifyEtag } from "@fastify/etag";
import { fastifyHelmet } from "@fastify/helmet";
import { fastifyRateLimit } from "@fastify/rate-limit";
import { fastifyJwt } from "@fastify/jwt";
import { fastifySwagger } from "@fastify/swagger";
import { fastifySwaggerUi } from "@fastify/swagger-ui";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import { fastify } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { schema } from "../db/schema/index.js";
import { eq, desc, sql } from "drizzle-orm";
import { env, isDevelopment } from "../config/env.js";

const app = fastify({ 
  logger: isDevelopment ? {
    level: env.LOG_LEVEL,
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  } : {
    level: env.LOG_LEVEL,
  },
  requestIdLogLabel: 'reqId',
  genReqId: () => crypto.randomUUID(),
}).withTypeProvider<ZodTypeProvider>()

app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

// Security plugins
await app.register(fastifyHelmet)
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: () => {
    return {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: 60,
    }
  }
})

// Performance plugins
await app.register(fastifyCompress, { global: true })
await app.register(fastifyEtag)

// CORS
await app.register(fastifyCors, {
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
  credentials: true,
})

// JWT Auth (if secret is configured)
if (env.JWT_SECRET) {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  })
}

// API Documentation
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Node Local DB API',
      description: 'High-performance REST API with PostgreSQL',
      version: '1.0.0',
    },
    servers: [
      {
        url: isDevelopment ? `http://localhost:${env.PORT}` : 'https://api.example.com',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
})

await app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
})

const issuesCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 minute

// Copy all the routes from the original server.ts here...
// (Routes remain the same as in the current server.ts)

app.get('/health', {
  schema: {
    tags: ['Health'],
    response: {
      200: z.object({
        status: z.literal('ok'),
        timestamp: z.string(),
        uptime: z.number(),
        environment: z.string(),
      }),
    },
  },
}, async () => {
  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  }
})

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach((signal) => {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down gracefully...`)
    await app.close()
    process.exit(0)
  })
})

app.setErrorHandler((error, request, reply) => {
  const reqId = request.id
  app.log.error({ reqId, err: error }, 'Request error')
  
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.validation,
      requestId: reqId,
    })
  }

  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      requestId: reqId,
    })
  }

  if (error.statusCode === 401) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
      requestId: reqId,
    })
  }

  return reply.status(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    requestId: reqId,
  })
})

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    app.log.info(`🚀 HTTP server running on http://localhost:${env.PORT}`)
    app.log.info(`📚 API documentation available at http://localhost:${env.PORT}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()