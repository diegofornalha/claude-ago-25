import { getDb } from '../db/pglite-lazy';
import { syncMetrics, performanceMetrics } from '../shared/schema';
import type { SyncType } from '../shared/types';

interface MetricData {
  type: SyncType;
  duration?: number;
  recordCount?: number;
  bytesTransferred?: number;
  success: boolean;
  error?: string;
}

interface PerformanceData {
  operation: string;
  duration: number;
}

export class MetricsCollector {
  private performanceBuffer: Map<string, number[]> = new Map();
  private flushInterval = 60000; // 1 minute
  private flushTimer: number | null = null;
  private deviceId: string;

  constructor() {
    this.deviceId = this.getDeviceId();
    this.startPeriodicFlush();
  }

  /**
   * Record a sync operation metric
   */
  async recordSync(data: MetricData): Promise<void> {
    const db = await getDb();
    
    await db.insert(syncMetrics).values({
      deviceId: this.deviceId,
      syncType: data.type,
      latency: data.duration || null,
      recordCount: data.recordCount || null,
      bytesTransferred: data.bytesTransferred || null,
      success: data.success,
      errorMessage: data.error || null,
    });
    
    // Also record as performance metric if duration is provided
    if (data.duration) {
      this.recordPerformance(`sync_${data.type}`, data.duration);
    }
  }

  /**
   * Record a performance metric
   */
  recordPerformance(operation: string, duration: number): void {
    if (!this.performanceBuffer.has(operation)) {
      this.performanceBuffer.set(operation, []);
    }
    
    this.performanceBuffer.get(operation)!.push(duration);
  }

  /**
   * Get performance percentiles for an operation
   */
  async getPercentiles(
    operation: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    p50: number;
    p95: number;
    p99: number;
    count: number;
  }> {
    const db = await getDb();
    
    let query = db
      .select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.operation, operation));
    
    if (timeRange) {
      query = query.where(
        and(
          gte(performanceMetrics.timestamp, timeRange.start),
          lte(performanceMetrics.timestamp, timeRange.end)
        )
      );
    }
    
    const metrics = await query;
    
    if (metrics.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0 };
    }
    
    // Sort values for percentile calculation
    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    
    return {
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
      count: values.length,
    };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    averageLatency: number;
    totalRecords: number;
    totalBytes: number;
  }> {
    const db = await getDb();
    
    let query = db.select().from(syncMetrics);
    
    if (timeRange) {
      query = query.where(
        and(
          gte(syncMetrics.createdAt, timeRange.start),
          lte(syncMetrics.createdAt, timeRange.end)
        )
      );
    }
    
    const metrics = await query;
    
    const successful = metrics.filter(m => m.success);
    const failed = metrics.filter(m => !m.success);
    
    const totalLatency = successful.reduce(
      (sum, m) => sum + (m.latency || 0), 
      0
    );
    const totalRecords = successful.reduce(
      (sum, m) => sum + (m.recordCount || 0), 
      0
    );
    const totalBytes = successful.reduce(
      (sum, m) => sum + (m.bytesTransferred || 0), 
      0
    );
    
    return {
      totalSyncs: metrics.length,
      successfulSyncs: successful.length,
      failedSyncs: failed.length,
      successRate: metrics.length > 0 
        ? (successful.length / metrics.length) * 100 
        : 0,
      averageLatency: successful.length > 0 
        ? totalLatency / successful.length 
        : 0,
      totalRecords,
      totalBytes,
    };
  }

  /**
   * Get error statistics
   */
  async getErrorStats(
    timeRange?: { start: Date; end: Date }
  ): Promise<Map<string, number>> {
    const db = await getDb();
    
    let query = db
      .select()
      .from(syncMetrics)
      .where(
        and(
          eq(syncMetrics.success, false),
          isNotNull(syncMetrics.errorMessage)
        )
      );
    
    if (timeRange) {
      query = query.where(
        and(
          gte(syncMetrics.createdAt, timeRange.start),
          lte(syncMetrics.createdAt, timeRange.end)
        )
      );
    }
    
    const errors = await query;
    
    const errorCounts = new Map<string, number>();
    
    for (const error of errors) {
      const msg = error.errorMessage || 'Unknown error';
      errorCounts.set(msg, (errorCounts.get(msg) || 0) + 1);
    }
    
    return errorCounts;
  }

  /**
   * Clean old metrics
   */
  async cleanOldMetrics(daysOld: number = 30): Promise<void> {
    const db = await getDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    await Promise.all([
      db
        .delete(syncMetrics)
        .where(lt(syncMetrics.createdAt, cutoffDate)),
      db
        .delete(performanceMetrics)
        .where(lt(performanceMetrics.timestamp, cutoffDate)),
    ]);
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining metrics
    this.flushPerformanceMetrics();
  }

  private startPeriodicFlush(): void {
    this.flushTimer = window.setInterval(() => {
      this.flushPerformanceMetrics();
    }, this.flushInterval);
  }

  private async flushPerformanceMetrics(): Promise<void> {
    if (this.performanceBuffer.size === 0) return;
    
    const db = await getDb();
    const entries: any[] = [];
    
    // Calculate percentiles for each operation
    for (const [operation, values] of this.performanceBuffer.entries()) {
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      
      // Store P50, P95, P99
      entries.push(
        {
          metricType: 'query_latency',
          operation,
          value: this.percentile(sorted, 50),
          percentile: 50,
          deviceId: this.deviceId,
        },
        {
          metricType: 'query_latency',
          operation,
          value: this.percentile(sorted, 95),
          percentile: 95,
          deviceId: this.deviceId,
        },
        {
          metricType: 'query_latency',
          operation,
          value: this.percentile(sorted, 99),
          percentile: 99,
          deviceId: this.deviceId,
        }
      );
    }
    
    if (entries.length > 0) {
      await db.insert(performanceMetrics).values(entries);
    }
    
    // Clear buffer
    this.performanceBuffer.clear();
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
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

// Missing imports
import { eq, and, gte, lte, lt, isNotNull } from 'drizzle-orm';