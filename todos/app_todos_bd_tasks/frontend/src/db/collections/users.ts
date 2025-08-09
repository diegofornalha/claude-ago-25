import { createElectricCollection } from '@tanstack/db-collections'
import { z } from 'zod/v4-mini'

export const users = createElectricCollection({
  id: 'users',
  streamOptions: {
    url: 'http://localhost:3000/v1/shape',
    params: {
      table: 'users',
    },
  },
  primaryKey: ['id'],
  schema: z.object({
    id: z.int(),
    name: z.string(),
  }),
})
