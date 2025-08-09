import { integer, pgTable, text } from 'drizzle-orm/pg-core'

export const issues = pgTable('issues', {
  id: integer().notNull().primaryKey(),
  title: text().notNull(),
  description: text(),
})
