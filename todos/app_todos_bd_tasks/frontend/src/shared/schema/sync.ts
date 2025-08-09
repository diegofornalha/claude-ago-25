import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const syncOperations = ['CREATE', 'UPDATE', 'DELETE'] as const;

export const syncQueue = pgTable('sync_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  tableName: text('table_name').notNull(),
  recordId: uuid('record_id').notNull(),
  operation: text('operation', { enum: syncOperations }).notNull(),
  data: jsonb('data').notNull().$type<Record<string, any>>(),
  deviceId: text('device_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  syncedAt: timestamp('synced_at'),
  error: text('error'),
  retries: integer('retries').default(0).notNull(),
});

export const syncConflicts = pgTable('sync_conflicts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tableName: text('table_name').notNull(),
  recordId: uuid('record_id').notNull(),
  localData: jsonb('local_data').notNull().$type<Record<string, any>>(),
  remoteData: jsonb('remote_data').notNull().$type<Record<string, any>>(),
  conflictType: text('conflict_type').notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolution: text('resolution'), // LOCAL_WINS, REMOTE_WINS, MERGED, USER_DECISION
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type inference
export type SyncQueueEntry = typeof syncQueue.$inferSelect;
export type NewSyncQueueEntry = typeof syncQueue.$inferInsert;
export type SyncConflict = typeof syncConflicts.$inferSelect;