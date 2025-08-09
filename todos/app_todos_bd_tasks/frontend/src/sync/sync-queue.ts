import { getDb } from '../db/pglite-lazy';
import { syncQueue } from '../shared/schema';
import { eq, isNull, isNotNull, and, lt, count } from 'drizzle-orm';
import type { SyncQueueEntry, NewSyncQueueEntry } from '../shared/types';

export class SyncQueue {
  private deviceId: string;
  private maxRetries = 5;
  private retryDelay = 5000; // 5 seconds base delay

  constructor() {
    this.deviceId = this.getDeviceId();
  }

  /**
   * Add a change to the sync queue
   */
  async addChange(
    tableName: string,
    recordId: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    data: any
  ): Promise<void> {
    const db = await getDb();
    
    // Check if there's already a pending change for this record
    const existing = await db
      .select()
      .from(syncQueue)
      .where(
        and(
          eq(syncQueue.tableName, tableName),
          eq(syncQueue.recordId, recordId),
          isNull(syncQueue.syncedAt)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing entry with latest data
      await db
        .update(syncQueue)
        .set({
          operation,
          data,
          retries: 0, // Reset retries on new change
          error: null,
        })
        .where(eq(syncQueue.id, existing[0].id));
    } else {
      // Create new entry
      await db.insert(syncQueue).values({
        tableName,
        recordId,
        operation,
        data,
        deviceId: this.deviceId,
      });
    }
  }

  /**
   * Get pending changes count
   */
  async getPendingCount(): Promise<number> {
    const db = await getDb();
    const result = await db
      .select({ count: count() })
      .from(syncQueue)
      .where(
        and(
          isNull(syncQueue.syncedAt),
          lt(syncQueue.retries, this.maxRetries)
        )
      );
    
    return result[0]?.count || 0;
  }

  /**
   * Get pending changes
   */
  async getPendingChanges(limit: number = 100): Promise<SyncQueueEntry[]> {
    const db = await getDb();
    
    return await db
      .select()
      .from(syncQueue)
      .where(
        and(
          isNull(syncQueue.syncedAt),
          lt(syncQueue.retries, this.maxRetries)
        )
      )
      .orderBy(syncQueue.createdAt)
      .limit(limit);
  }

  /**
   * Mark entry as synced
   */
  async markAsSynced(id: string): Promise<void> {
    const db = await getDb();
    
    await db
      .update(syncQueue)
      .set({
        syncedAt: new Date(),
        error: null,
      })
      .where(eq(syncQueue.id, id));
  }

  /**
   * Increment retry count
   */
  async incrementRetry(id: string, error?: string): Promise<void> {
    const db = await getDb();
    
    const entry = await db
      .select()
      .from(syncQueue)
      .where(eq(syncQueue.id, id))
      .limit(1);
    
    if (entry.length === 0) return;
    
    const newRetries = entry[0].retries + 1;
    
    await db
      .update(syncQueue)
      .set({
        retries: newRetries,
        error: error || entry[0].error,
      })
      .where(eq(syncQueue.id, id));
    
    // Schedule retry if under max retries
    if (newRetries < this.maxRetries) {
      this.scheduleRetry(id, newRetries);
    }
  }

  /**
   * Clear synced entries older than specified days
   */
  async clearOldEntries(daysOld: number = 7): Promise<void> {
    const db = await getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    await db
      .delete(syncQueue)
      .where(
        and(
          lt(syncQueue.syncedAt, cutoffDate),
          isNotNull(syncQueue.syncedAt)
        )
      );
  }

  /**
   * Get failed entries (max retries reached)
   */
  async getFailedEntries(): Promise<SyncQueueEntry[]> {
    const db = await getDb();
    
    return await db
      .select()
      .from(syncQueue)
      .where(
        and(
          isNull(syncQueue.syncedAt),
          eq(syncQueue.retries, this.maxRetries)
        )
      )
      .orderBy(syncQueue.createdAt);
  }

  /**
   * Retry failed entry
   */
  async retryFailed(id: string): Promise<void> {
    const db = await getDb();
    
    await db
      .update(syncQueue)
      .set({
        retries: 0,
        error: null,
      })
      .where(eq(syncQueue.id, id));
  }

  /**
   * Batch add changes (for migration or bulk operations)
   */
  async batchAddChanges(
    changes: Array<{
      tableName: string;
      recordId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      data: any;
    }>
  ): Promise<void> {
    const db = await getDb();
    
    const entries: NewSyncQueueEntry[] = changes.map(change => ({
      tableName: change.tableName,
      recordId: change.recordId,
      operation: change.operation,
      data: change.data,
      deviceId: this.deviceId,
    }));
    
    // Insert in batches of 100
    for (let i = 0; i < entries.length; i += 100) {
      const batch = entries.slice(i, i + 100);
      await db.insert(syncQueue).values(batch);
    }
  }

  /**
   * Get sync statistics
   */
  async getStatistics(): Promise<{
    pending: number;
    synced: number;
    failed: number;
    total: number;
  }> {
    const db = await getDb();
    
    const [pending, synced, failed, total] = await Promise.all([
      db
        .select({ count: count() })
        .from(syncQueue)
        .where(
          and(
            isNull(syncQueue.syncedAt),
            lt(syncQueue.retries, this.maxRetries)
          )
        ),
      db
        .select({ count: count() })
        .from(syncQueue)
        .where(isNotNull(syncQueue.syncedAt)),
      db
        .select({ count: count() })
        .from(syncQueue)
        .where(
          and(
            isNull(syncQueue.syncedAt),
            eq(syncQueue.retries, this.maxRetries)
          )
        ),
      db.select({ count: count() }).from(syncQueue),
    ]);
    
    return {
      pending: pending[0]?.count || 0,
      synced: synced[0]?.count || 0,
      failed: failed[0]?.count || 0,
      total: total[0]?.count || 0,
    };
  }

  private scheduleRetry(id: string, retryCount: number): void {
    // Exponential backoff: 5s, 10s, 20s, 40s, 80s
    const delay = this.retryDelay * Math.pow(2, retryCount - 1);
    
    setTimeout(() => {
      // Emit retry event
      window.dispatchEvent(
        new CustomEvent('sync-retry', {
          detail: { id, retryCount },
        })
      );
    }, delay);
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }
}

// Helper function to automatically track changes
export function trackChange(
  tableName: string,
  recordId: string,
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  data: any
): void {
  const queue = new SyncQueue();
  queue.addChange(tableName, recordId, operation, data).catch(console.error);
}