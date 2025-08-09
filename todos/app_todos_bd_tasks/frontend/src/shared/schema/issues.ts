import { pgTable, uuid, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const issueStatus = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export const issuePriority = ['low', 'medium', 'high', 'urgent'] as const;

export const issues = pgTable('issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: issueStatus }).notNull().default('pending'),
  priority: text('priority', { enum: issuePriority }).notNull().default('medium'),
  
  // Relations
  userId: uuid('user_id').references(() => users.id),
  
  // Claude integration
  sessionId: text('session_id'),
  claudeTaskId: text('claude_task_id'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  
  // Version control for sync
  version: integer('version').default(1).notNull(),
  locallyModified: boolean('locally_modified').default(false),
  deletedAt: timestamp('deleted_at'), // Soft delete
  
  // Additional metadata as JSON
  metadata: text('metadata').$type<Record<string, any>>(),
});

// Type inference helpers
export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;