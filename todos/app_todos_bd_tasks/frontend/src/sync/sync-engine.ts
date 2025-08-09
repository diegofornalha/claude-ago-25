import { WebSocketManager } from './websocket-manager';
import { SyncQueue } from './sync-queue';
import { ConflictResolver } from './conflict-resolver';
import { MetricsCollector } from './metrics-collector';
import { getDb } from '../db/pglite-lazy';
import { syncQueue, syncMetrics } from '../shared/schema';
import type { SyncStatus, WSMessage, SyncQueueEntry } from '../shared/types';
import { eq, isNull, desc } from 'drizzle-orm';

export interface SyncEngineOptions {
  wsUrl?: string;
  batchSize?: number;
  syncInterval?: number;
  enableAutoSync?: boolean;
}

export class SyncEngine {
  private ws: WebSocketManager;
  private queue: SyncQueue;
  private resolver: ConflictResolver;
  private metrics: MetricsCollector;
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;
  private syncTimer: number | null = null;
  private pendingChanges = 0;
  private conflicts = 0;
  
  private options: Required<SyncEngineOptions> = {
    wsUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:3344/sync',
    batchSize: 100,
    syncInterval: 30000, // 30 seconds
    enableAutoSync: true,
  };

  constructor(options?: SyncEngineOptions) {
    this.options = { ...this.options, ...options };
    
    // Initialize components
    this.ws = new WebSocketManager({
      url: this.options.wsUrl,
      reconnectOptions: {
        maxAttempts: 10,
        baseDelay: 1000,
        maxDelay: 30000,
      },
      onConnect: () => this.handleConnect(),
      onDisconnect: () => this.handleDisconnect(),
      onMessage: (msg) => this.handleMessage(msg),
    });

    this.queue = new SyncQueue();
    this.resolver = new ConflictResolver();
    this.metrics = new MetricsCollector();

    // Setup event handlers
    this.setupEventHandlers();
    
    // Start connection
    this.ws.connect();
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    const wsStatus = this.ws.getStatus();
    
    return {
      isOnline: wsStatus.connected,
      isSyncing: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      pendingChanges: this.pendingChanges,
      conflicts: this.conflicts,
    };
  }

  /**
   * Force sync now
   */
  async sync(): Promise<void> {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return;
    }

    const startTime = Date.now();
    this.syncInProgress = true;
    this.emitSyncStart();

    try {
      // Update pending count
      this.pendingChanges = await this.queue.getPendingCount();
      
      if (this.pendingChanges > 0) {
        // Process in batches
        await this.processPendingChanges();
      }
      
      // Pull server updates
      await this.pullServerUpdates();
      
      // Record successful sync
      const duration = Date.now() - startTime;
      await this.metrics.recordSync({
        type: 'full_sync',
        duration,
        recordCount: this.pendingChanges,
        success: true,
      });
      
      this.lastSyncTime = new Date();
      this.emitSyncComplete({ pendingChanges: 0 });
      
    } catch (error) {
      console.error('Sync failed:', error);
      
      // Record failed sync
      await this.metrics.recordSync({
        type: 'full_sync',
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.emitSyncError(error);
      
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Start auto sync
   */
  startAutoSync(): void {
    if (!this.options.enableAutoSync) return;
    
    this.stopAutoSync();
    
    this.syncTimer = window.setInterval(() => {
      this.sync().catch(console.error);
    }, this.options.syncInterval);
  }

  /**
   * Stop auto sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Shutdown sync engine
   */
  shutdown(): void {
    this.stopAutoSync();
    this.ws.disconnect();
  }

  private async processPendingChanges(): Promise<void> {
    const db = await getDb();
    let processed = 0;
    
    while (processed < this.pendingChanges) {
      // Get batch of pending changes
      const batch = await db
        .select()
        .from(syncQueue)
        .where(isNull(syncQueue.syncedAt))
        .orderBy(syncQueue.createdAt)
        .limit(this.options.batchSize);
      
      if (batch.length === 0) break;
      
      // Send batch to server
      const response = await this.ws.sendBatch(
        batch.map(entry => ({
          type: 'sync-change',
          payload: {
            id: entry.id,
            tableName: entry.tableName,
            recordId: entry.recordId,
            operation: entry.operation,
            data: entry.data,
            deviceId: entry.deviceId,
          },
          timestamp: new Date(),
        }))
      );
      
      // Process responses
      await this.processBatchResponse(response, batch);
      
      processed += batch.length;
      
      // Update progress
      this.emitSyncProgress({
        processed,
        total: this.pendingChanges,
        percent: (processed / this.pendingChanges) * 100,
      });
    }
  }

  private async processBatchResponse(response: any, batch: SyncQueueEntry[]): Promise<void> {
    const db = await getDb();
    
    for (let i = 0; i < response.results.length; i++) {
      const result = response.results[i];
      const entry = batch[i];
      
      if (result.success) {
        // Mark as synced
        await db
          .update(syncQueue)
          .set({ syncedAt: new Date() })
          .where(eq(syncQueue.id, entry.id));
          
      } else if (result.conflict) {
        // Handle conflict
        this.conflicts++;
        const resolved = await this.resolver.resolve({
          local: entry,
          remote: result.remoteVersion,
          type: result.conflictType,
        });
        
        if (resolved.autoResolved) {
          // Apply resolution
          await this.applyResolution(resolved);
        } else {
          // Emit conflict for user resolution
          this.emitConflict(resolved);
        }
        
      } else {
        // Handle error - increment retry
        const newRetries = entry.retries + 1;
        
        if (newRetries > 5) {
          // Move to dead letter queue
          await db
            .update(syncQueue)
            .set({ 
              error: result.error,
              syncedAt: new Date() // Mark as "processed" to skip
            })
            .where(eq(syncQueue.id, entry.id));
        } else {
          // Increment retry count
          await db
            .update(syncQueue)
            .set({ 
              retries: newRetries,
              error: result.error 
            })
            .where(eq(syncQueue.id, entry.id));
        }
      }
    }
  }

  private async pullServerUpdates(): Promise<void> {
    // Request updates since last sync
    const since = this.lastSyncTime || new Date(0);
    
    this.ws.send({
      type: 'pull-updates',
      payload: {
        since: since.toISOString(),
        deviceId: this.getDeviceId(),
      },
      timestamp: new Date(),
    });
  }

  private async applyResolution(resolution: any): Promise<void> {
    // Apply resolved data to local database
    const db = await getDb();
    const { tableName, recordId, data } = resolution;
    
    // Dynamic table update based on tableName
    switch (tableName) {
      case 'issues':
        await db.execute(`
          UPDATE issues 
          SET ${Object.keys(data).map(k => `${k} = ?`).join(', ')}
          WHERE id = ?
        `, [...Object.values(data), recordId]);
        break;
      // Add other tables as needed
    }
  }

  private setupEventHandlers(): void {
    // WebSocket events
    this.ws.on('server-update', async (update: any) => {
      await this.handleServerUpdate(update);
    });
    
    this.ws.on('conflict', async (conflict: any) => {
      await this.handleConflict(conflict);
    });
    
    // Window events
    window.addEventListener('online', () => {
      console.log('Network online, starting sync');
      this.sync();
    });
    
    window.addEventListener('beforeunload', () => {
      // Try to sync before leaving
      if (this.pendingChanges > 0) {
        this.sync();
      }
    });
  }

  private async handleConnect(): Promise<void> {
    console.log('WebSocket connected, starting sync');
    await this.sync();
    this.startAutoSync();
  }

  private handleDisconnect(): void {
    console.log('WebSocket disconnected');
    this.stopAutoSync();
  }

  private async handleMessage(message: WSMessage): Promise<void> {
    switch (message.type) {
      case 'server-update':
        await this.handleServerUpdate(message.payload);
        break;
      case 'conflict':
        await this.handleConflict(message.payload);
        break;
      case 'pull-updates-response':
        await this.handlePullUpdatesResponse(message.payload);
        break;
    }
  }

  private async handleServerUpdate(update: any): Promise<void> {
    // Apply server update to local database
    await this.applyServerUpdate(update);
    
    // Emit update event
    this.emitServerUpdate(update);
  }

  private async handleConflict(conflict: any): Promise<void> {
    this.conflicts++;
    
    const resolved = await this.resolver.resolve(conflict);
    
    if (resolved.autoResolved) {
      await this.applyResolution(resolved);
    } else {
      this.emitConflict(resolved);
    }
  }

  private async handlePullUpdatesResponse(updates: any[]): Promise<void> {
    for (const update of updates) {
      await this.applyServerUpdate(update);
    }
  }

  private async applyServerUpdate(update: any): Promise<void> {
    const db = await getDb();
    const { tableName, operation, data } = update;
    
    // Apply update based on operation
    switch (operation) {
      case 'CREATE':
      case 'UPDATE':
        // Upsert data
        await db.execute(`
          INSERT INTO ${tableName} (${Object.keys(data).join(', ')})
          VALUES (${Object.keys(data).map(() => '?').join(', ')})
          ON CONFLICT (id) DO UPDATE SET
          ${Object.keys(data).map(k => `${k} = EXCLUDED.${k}`).join(', ')}
        `, Object.values(data));
        break;
        
      case 'DELETE':
        // Soft delete
        await db.execute(`
          UPDATE ${tableName} SET deleted_at = ? WHERE id = ?
        `, [new Date(), data.id]);
        break;
    }
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  // Event emitters
  private emit(event: string, data?: any): void {
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  private emitSyncStart(): void {
    this.emit('sync-start');
  }

  private emitSyncComplete(data: any): void {
    this.emit('sync-complete', data);
  }

  private emitSyncError(error: any): void {
    this.emit('sync-error', error);
  }

  private emitSyncProgress(progress: any): void {
    this.emit('sync-progress', progress);
  }

  private emitServerUpdate(update: any): void {
    this.emit('server-update', update);
  }

  private emitConflict(conflict: any): void {
    this.emit('sync-conflict', conflict);
  }
}