import { env } from './src/env.ts'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  out: './src/db/migrations',
  schema: './src/db/schema/**',
  dbCredentials: {
    url: env.DATABASE_URL,
  }
})