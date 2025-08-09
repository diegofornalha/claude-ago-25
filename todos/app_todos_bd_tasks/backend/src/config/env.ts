import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  
  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3344),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Security
  JWT_SECRET: z.string().min(32).optional(),
  CORS_ORIGIN: z.string().default('*'),
  
  // Optional Services
  REDIS_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
})

export type Env = z.infer<typeof envSchema>

const parseResult = envSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parseResult.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parseResult.data

// Helper functions
export const isDevelopment = env.NODE_ENV === 'development'
export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'