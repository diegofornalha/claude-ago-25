import { createElectricCollection } from '@tanstack/db-collections'
import { z } from 'zod/v4-mini'

export const issueSchema = z.object({
  id: z.int(),
  title: z.string(),
  description: z.nullable(z.string()),
  userId: z.int(),
  createdAt: z.string(),
})

export type Issue = z.infer<typeof issueSchema>

export const issues = createElectricCollection({
  id: 'issues',
  streamOptions: {
    url: 'http://localhost:3000/v1/shape',
    params: {
      table: 'issues',
    },
  },
  primaryKey: ['id'],
  schema: issueSchema,
})
