import type { 
  issues, 
  users, 
  syncQueue, 
  syncConflicts,
  syncMetrics,
  performanceMetrics,
  healthChecks 
} from '../schema';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// User types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Issue types
export type Issue = InferSelectModel<typeof issues>;
export type NewIssue = InferInsertModel<typeof issues>;

// Sync types
export type SyncQueueEntry = InferSelectModel<typeof syncQueue>;
export type NewSyncQueueEntry = InferInsertModel<typeof syncQueue>;
export type SyncConflict = InferSelectModel<typeof syncConflicts>;
export type NewSyncConflict = InferInsertModel<typeof syncConflicts>;

// Metrics types
export type SyncMetric = InferSelectModel<typeof syncMetrics>;
export type NewSyncMetric = InferInsertModel<typeof syncMetrics>;
export type PerformanceMetric = InferSelectModel<typeof performanceMetrics>;
export type HealthCheck = InferSelectModel<typeof healthChecks>;

// Additional utility types
export type IssueStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncType = 'push' | 'pull' | 'conflict' | 'full_sync';
export type ConflictResolution = 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGED' | 'USER_DECISION';

// Migration types
export interface MigrationProgress {
  currentStep: string;
  totalRecords: number;
  processedRecords: number;
  percentComplete: number;
  estimatedTime?: number;
  errors: Array<{
    record: string;
    error: string;
  }>;
}

// Sync status types
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  conflicts: number;
}

// Health status types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'emergency';
  syncHealth: 'healthy' | 'degraded' | 'critical';
  conflictRate: number;
  averageLatency: number;
  errorRate: number;
  storageUsage: {
    used: number;
    quota: number;
    percentUsed: number;
  };
  recommendation?: string;
}

// Emergency mode types
export interface EmergencyModeData {
  isActive: boolean;
  dataSize: number;
  lastBackup?: Date;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  payload?: any;
  timestamp: Date;
  deviceId?: string;
}

export interface SyncBatchMessage extends WSMessage {
  type: 'sync-batch';
  payload: {
    changes: SyncQueueEntry[];
  };
}

export interface ConflictMessage extends WSMessage {
  type: 'conflict';
  payload: {
    conflict: SyncConflict;
  };
}