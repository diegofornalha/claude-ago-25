import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const issues = pgTable('issues', {
  id: serial().primaryKey(),
  title: text().notNull(),
  description: text(),
  userId: integer().notNull().references(() => users.id),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }),
})