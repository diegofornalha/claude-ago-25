import { pgTable, uuid, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const syncTypes = ['push', 'pull', 'conflict', 'full_sync'] as const;

export const syncMetrics = pgTable('sync_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  deviceId: text('device_id').notNull(),
  syncType: text('sync_type', { enum: syncTypes }).notNull(),
  latency: integer('latency'), // milliseconds
  recordCount: integer('record_count'),
  bytesTransferred: integer('bytes_transferred'),
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Performance metrics table
export const performanceMetrics = pgTable('performance_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  metricType: text('metric_type').notNull(), // query_latency, sync_duration, etc
  operation: text('operation').notNull(),
  value: integer('value').notNull(), // milliseconds or count
  percentile: integer('percentile'), // 50, 95, 99
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  deviceId: text('device_id').notNull(),
});

// Health check results
export const healthChecks = pgTable('health_checks', {
  id: uuid('id').defaultRandom().primaryKey(),
  checkType: text('check_type').notNull(), // db_integrity, storage_space, sync_queue, connection
  status: text('status').notNull(), // healthy, degraded, critical
  details: text('details').$type<Record<string, any>>(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Type inference
export type SyncMetric = typeof syncMetrics.$inferSelect;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type HealthCheck = typeof healthChecks.$inferSelect;