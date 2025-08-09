import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const missionStatusEnum = pgEnum('mission_status', ['pending', 'processing', 'completed', 'error']);

export const missions = pgTable('missions', {
  id: serial().primaryKey(),
  title: text().notNull(),
  description: text(),
  status: missionStatusEnum().notNull().default('pending'),
  sessionId: text().unique(),
  response: text(),
  error: text(),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});