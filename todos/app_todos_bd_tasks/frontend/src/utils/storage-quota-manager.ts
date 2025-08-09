import { getDb } from '../db/pglite-lazy';
import { issues, syncQueue, syncMetrics } from '../shared/schema';
import { lt, and, isNotNull, desc } from 'drizzle-orm';
import { BackupManager } from '../migration/backup-manager';

export interface StorageInfo {
  usage: number;
  quota: number;
  percentUsed: number;
  availableSpace: number;
}

export interface CleanupResult {
  deletedRecords: number;
  freedSpace: number;
  compressedBackups: number;
  clearedCaches: number;
}

export class StorageQuotaManager {
  private warningThreshold = 0.8;    // 80%
  private criticalThreshold = 0.95;  // 95%
  private checkInterval = 300000;    // 5 minutes
  private checkTimer: number | null = null;
  private lastNotificationTime = 0;
  private notificationCooldown = 3600000; // 1 hour

  constructor() {
    this.startMonitoring();
  }

  /**
   * Get current storage status
   */
  async getStorageInfo(): Promise<StorageInfo> {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      // Storage API not supported
      return {
        usage: 0,
        quota: 0,
        percentUsed: 0,
        availableSpace: 0,
      };
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentUsed = quota > 0 ? (usage / quota) : 0;

    return {
      usage,
      quota,
      percentUsed,
      availableSpace: quota - usage,
    };
  }

  /**
   * Check storage and trigger cleanup if needed
   */
  async checkStorageAndCleanup(): Promise<void> {
    const info = await this.getStorageInfo();
    
    if (info.percentUsed >= this.criticalThreshold) {
      console.warn(`Critical storage usage: ${(info.percentUsed * 100).toFixed(2)}%`);
      await this.performCriticalCleanup();
    } else if (info.percentUsed >= this.warningThreshold) {
      console.warn(`High storage usage: ${(info.percentUsed * 100).toFixed(2)}%`);
      await this.performWarningCleanup();
    }
  }

  /**
   * Perform aggressive cleanup when storage is critical
   */
  async performCriticalCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedRecords: 0,
      freedSpace: 0,
      compressedBackups: 0,
      clearedCaches: 0,
    };

    const beforeInfo = await this.getStorageInfo();

    try {
      // 1. Delete old completed issues (30+ days)
      result.deletedRecords += await this.cleanupOldData(30);
      
      // 2. Compress old backups
      result.compressedBackups = await this.compressOldBackups(7);
      
      // 3. Clear old sync records
      result.deletedRecords += await this.clearOldSyncRecords(7);
      
      // 4. Clear metrics older than 7 days
      result.deletedRecords += await this.clearOldMetrics(7);
      
      // 5. Clear caches
      result.clearedCaches = await this.clearCaches();
      
      // Calculate freed space
      const afterInfo = await this.getStorageInfo();
      result.freedSpace = beforeInfo.usage - afterInfo.usage;
      
      // If still critical, notify user
      if (afterInfo.percentUsed >= this.criticalThreshold) {
        this.notifyUser('critical', afterInfo);
      }
      
    } catch (error) {
      console.error('Critical cleanup failed:', error);
    }
    
    return result;
  }

  /**
   * Perform moderate cleanup when storage is high
   */
  async performWarningCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedRecords: 0,
      freedSpace: 0,
      compressedBackups: 0,
      clearedCaches: 0,
    };

    const beforeInfo = await this.getStorageInfo();

    try {
      // 1. Delete old completed issues (90+ days)
      result.deletedRecords += await this.cleanupOldData(90);
      
      // 2. Compress old backups (30+ days)
      result.compressedBackups = await this.compressOldBackups(30);
      
      // 3. Clear old sync records (30+ days)
      result.deletedRecords += await this.clearOldSyncRecords(30);
      
      // 4. Clear metrics older than 30 days
      result.deletedRecords += await this.clearOldMetrics(30);
      
      // Calculate freed space
      const afterInfo = await this.getStorageInfo();
      result.freedSpace = beforeInfo.usage - afterInfo.usage;
      
      // Notify user if approaching critical
      if (afterInfo.percentUsed >= 0.9) {
        this.notifyUser('warning', afterInfo);
      }
      
    } catch (error) {
      console.error('Warning cleanup failed:', error);
    }
    
    return result;
  }

  /**
   * Manual cleanup with custom settings
   */
  async performManualCleanup(options: {
    deleteOlderThan?: number;
    compressBackups?: boolean;
    clearCaches?: boolean;
    clearMetrics?: boolean;
  }): Promise<CleanupResult> {
    const result: CleanupResult = {
      deletedRecords: 0,
      freedSpace: 0,
      compressedBackups: 0,
      clearedCaches: 0,
    };

    const beforeInfo = await this.getStorageInfo();

    if (options.deleteOlderThan) {
      result.deletedRecords += await this.cleanupOldData(options.deleteOlderThan);
    }

    if (options.compressBackups) {
      result.compressedBackups = await this.compressOldBackups(0);
    }

    if (options.clearCaches) {
      result.clearedCaches = await this.clearCaches();
    }

    if (options.clearMetrics) {
      result.deletedRecords += await this.clearOldMetrics(30);
    }

    const afterInfo = await this.getStorageInfo();
    result.freedSpace = beforeInfo.usage - afterInfo.usage;

    return result;
  }

  /**
   * Get storage breakdown by category
   */
  async getStorageBreakdown(): Promise<{
    database: number;
    backups: number;
    caches: number;
    other: number;
    total: number;
  }> {
    // Estimate sizes (this is approximate)
    const db = await getDb();
    
    // Count records to estimate database size
    const [issueCount] = await db.select({ count: count() }).from(issues);
    const [syncCount] = await db.select({ count: count() }).from(syncQueue);
    const [metricsCount] = await db.select({ count: count() }).from(syncMetrics);
    
    // Rough estimates (adjust based on actual data)
    const avgIssueSize = 1024;        // 1KB per issue
    const avgSyncRecordSize = 512;    // 0.5KB per sync record
    const avgMetricSize = 256;        // 0.25KB per metric
    
    const databaseSize = 
      (issueCount.count * avgIssueSize) +
      (syncCount.count * avgSyncRecordSize) +
      (metricsCount.count * avgMetricSize);
    
    // Get backup sizes
    const backups = BackupManager.listBackups();
    const backupSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    
    // Cache size (if using Cache API)
    let cacheSize = 0;
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        // Estimate cache size
        cacheSize += requests.length * 50 * 1024; // 50KB average per cached item
      }
    }
    
    const info = await this.getStorageInfo();
    const other = Math.max(0, info.usage - databaseSize - backupSize - cacheSize);
    
    return {
      database: databaseSize,
      backups: backupSize,
      caches: cacheSize,
      other,
      total: info.usage,
    };
  }

  /**
   * Start automatic monitoring
   */
  startMonitoring(): void {
    this.stopMonitoring();
    
    // Initial check
    this.checkStorageAndCleanup();
    
    // Periodic checks
    this.checkTimer = window.setInterval(() => {
      this.checkStorageAndCleanup();
    }, this.checkInterval);
  }

  /**
   * Stop automatic monitoring
   */
  stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  private async cleanupOldData(daysOld: number): Promise<number> {
    const db = await getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Delete old completed issues with soft delete
    const result = await db
      .update(issues)
      .set({ deletedAt: new Date() })
      .where(
        and(
          lt(issues.updatedAt, cutoffDate),
          eq(issues.status, 'completed'),
          isNull(issues.deletedAt)
        )
      );
    
    return result.rowCount || 0;
  }

  private async compressOldBackups(daysOld: number): Promise<number> {
    const backups = BackupManager.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let compressed = 0;
    
    for (const backup of backups) {
      if (backup.timestamp < cutoffDate && !backup.compressed) {
        try {
          // BackupManager handles compression internally
          await BackupManager.exportBackup(backup.id);
          compressed++;
        } catch (error) {
          console.error(`Failed to compress backup ${backup.id}:`, error);
        }
      }
    }
    
    return compressed;
  }

  private async clearOldSyncRecords(daysOld: number): Promise<number> {
    const db = await getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Delete synced records
    const result = await db
      .delete(syncQueue)
      .where(
        and(
          lt(syncQueue.createdAt, cutoffDate),
          isNotNull(syncQueue.syncedAt)
        )
      );
    
    return result.rowCount || 0;
  }

  private async clearOldMetrics(daysOld: number): Promise<number> {
    const db = await getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db
      .delete(syncMetrics)
      .where(lt(syncMetrics.createdAt, cutoffDate));
    
    return result.rowCount || 0;
  }

  private async clearCaches(): Promise<number> {
    let cleared = 0;
    
    // Clear browser caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
        cleared++;
      }
    }
    
    // Clear React Query cache if available
    if (window.queryClient) {
      window.queryClient.clear();
      cleared++;
    }
    
    return cleared;
  }

  private notifyUser(level: 'warning' | 'critical', info: StorageInfo): void {
    // Throttle notifications
    const now = Date.now();
    if (now - this.lastNotificationTime < this.notificationCooldown) {
      return;
    }
    
    this.lastNotificationTime = now;
    
    const percentStr = (info.percentUsed * 100).toFixed(1);
    const availableMB = (info.availableSpace / (1024 * 1024)).toFixed(1);
    
    if (window.showNotification) {
      window.showNotification({
        type: level === 'critical' ? 'error' : 'warning',
        message: level === 'critical' 
          ? 'Espaço de armazenamento crítico!'
          : 'Espaço de armazenamento baixo',
        description: `${percentStr}% usado. ${availableMB}MB disponível.`,
      });
    }
    
    // Emit event for UI handling
    window.dispatchEvent(new CustomEvent('storage-quota-' + level, {
      detail: info
    }));
  }
}

// Missing imports
import { count, eq, isNull } from 'drizzle-orm';

// Type augmentation for window
declare global {
  interface Window {
    queryClient?: any;
  }
}