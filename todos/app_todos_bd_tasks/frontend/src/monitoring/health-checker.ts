import { db } from '../db/pglite-instance';
import { sql } from 'drizzle-orm';
import { WebSocketManager } from '../sync/websocket-manager';
import { SyncEngine } from '../sync/sync-engine';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: number;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private lastResults: Map<string, HealthCheckResult> = new Map();
  private checkInterval: number | null = null;
  private listeners: Set<(health: SystemHealth) => void> = new Set();

  constructor(
    private intervalMs: number = 30000, // 30 segundos
    private timeoutMs: number = 5000 // 5 segundos timeout por check
  ) {
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // Database check
    this.registerCheck('database', async () => {
      const start = Date.now();
      try {
        const result = await db.execute(sql`SELECT 1 as test`);
        const latency = Date.now() - start;
        
        return {
          service: 'database',
          status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'unhealthy',
          latency,
          message: 'Database connection OK',
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          service: 'database',
          status: 'unhealthy',
          message: `Database error: ${error}`,
          timestamp: Date.now()
        };
      }
    });

    // PGLite storage check
    this.registerCheck('pglite-storage', async () => {
      try {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          const usagePercentage = ((estimate.usage || 0) / (estimate.quota || 1)) * 100;
          
          return {
            service: 'pglite-storage',
            status: usagePercentage < 80 ? 'healthy' : usagePercentage < 95 ? 'degraded' : 'unhealthy',
            message: `Storage usage: ${usagePercentage.toFixed(1)}%`,
            details: {
              used: estimate.usage,
              quota: estimate.quota,
              percentage: usagePercentage
            },
            timestamp: Date.now()
          };
        }
        
        return {
          service: 'pglite-storage',
          status: 'healthy',
          message: 'Storage API not available',
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          service: 'pglite-storage',
          status: 'unhealthy',
          message: `Storage check failed: ${error}`,
          timestamp: Date.now()
        };
      }
    });

    // IndexedDB check
    this.registerCheck('indexeddb', async () => {
      const start = Date.now();
      try {
        const testKey = 'health-check-' + Date.now();
        const testValue = { test: true, timestamp: Date.now() };
        
        // Testar write
        await this.testIndexedDBOperation('put', testKey, testValue);
        
        // Testar read
        const readValue = await this.testIndexedDBOperation('get', testKey);
        
        // Testar delete
        await this.testIndexedDBOperation('delete', testKey);
        
        const latency = Date.now() - start;
        
        return {
          service: 'indexeddb',
          status: latency < 50 ? 'healthy' : latency < 200 ? 'degraded' : 'unhealthy',
          latency,
          message: 'IndexedDB operations OK',
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          service: 'indexeddb',
          status: 'unhealthy',
          message: `IndexedDB error: ${error}`,
          timestamp: Date.now()
        };
      }
    });

    // Memory check
    this.registerCheck('memory', async () => {
      try {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          const usedHeapPercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
          
          return {
            service: 'memory',
            status: usedHeapPercentage < 70 ? 'healthy' : usedHeapPercentage < 90 ? 'degraded' : 'unhealthy',
            message: `Heap usage: ${usedHeapPercentage.toFixed(1)}%`,
            details: {
              usedHeap: memory.usedJSHeapSize,
              totalHeap: memory.totalJSHeapSize,
              heapLimit: memory.jsHeapSizeLimit,
              percentage: usedHeapPercentage
            },
            timestamp: Date.now()
          };
        }
        
        return {
          service: 'memory',
          status: 'healthy',
          message: 'Memory API not available',
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          service: 'memory',
          status: 'unhealthy',
          message: `Memory check failed: ${error}`,
          timestamp: Date.now()
        };
      }
    });

    // Network connectivity check
    this.registerCheck('network', async () => {
      try {
        const online = navigator.onLine;
        
        if (!online) {
          return {
            service: 'network',
            status: 'unhealthy',
            message: 'No network connection',
            timestamp: Date.now()
          };
        }

        // Testar conectividade real com um endpoint
        const start = Date.now();
        try {
          const response = await fetch('/api/health', {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000)
          });
          
          const latency = Date.now() - start;
          
          return {
            service: 'network',
            status: response.ok ? 'healthy' : 'degraded',
            latency,
            message: response.ok ? 'Network connectivity OK' : `API returned ${response.status}`,
            timestamp: Date.now()
          };
        } catch (fetchError) {
          return {
            service: 'network',
            status: 'degraded',
            message: 'API unreachable but internet connected',
            timestamp: Date.now()
          };
        }
      } catch (error) {
        return {
          service: 'network',
          status: 'unhealthy',
          message: `Network check failed: ${error}`,
          timestamp: Date.now()
        };
      }
    });
  }

  registerCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFn);
  }

  async runCheck(name: string): Promise<HealthCheckResult> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return {
        service: name,
        status: 'unhealthy',
        message: `Check ${name} not found`,
        timestamp: Date.now()
      };
    }

    try {
      const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
        setTimeout(() => reject(new Error('Check timeout')), this.timeoutMs);
      });

      const result = await Promise.race([checkFn(), timeoutPromise]);
      this.lastResults.set(name, result);
      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        service: name,
        status: 'unhealthy',
        message: `Check failed: ${error}`,
        timestamp: Date.now()
      };
      this.lastResults.set(name, errorResult);
      return errorResult;
    }
  }

  async runAllChecks(): Promise<SystemHealth> {
    const results = await Promise.all(
      Array.from(this.checks.keys()).map(name => this.runCheck(name))
    );

    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const health: SystemHealth = {
      overall,
      checks: results,
      timestamp: Date.now()
    };

    // Notificar listeners
    this.listeners.forEach(listener => listener(health));

    return health;
  }

  startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Executar checagem inicial
    this.runAllChecks();

    // Configurar intervalo
    this.checkInterval = window.setInterval(() => {
      this.runAllChecks();
    }, this.intervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  onHealthChange(listener: (health: SystemHealth) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLastResults(): SystemHealth {
    const results = Array.from(this.lastResults.values());
    
    const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
    const degradedCount = results.filter(r => r.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      checks: results,
      timestamp: Date.now()
    };
  }

  private async testIndexedDBOperation(operation: string, key: string, value?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('HealthCheckDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('test')) {
          db.createObjectStore('test');
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['test'], 'readwrite');
        const store = transaction.objectStore('test');
        
        let op: IDBRequest;
        switch (operation) {
          case 'put':
            op = store.put(value, key);
            break;
          case 'get':
            op = store.get(key);
            break;
          case 'delete':
            op = store.delete(key);
            break;
          default:
            reject(new Error(`Unknown operation: ${operation}`));
            return;
        }
        
        op.onsuccess = () => resolve(op.result);
        op.onerror = () => reject(op.error);
      };
    });
  }

  // Integração com WebSocket
  registerWebSocketCheck(wsManager: WebSocketManager): void {
    this.registerCheck('websocket', async () => {
      const isConnected = wsManager.isConnected();
      const reconnectAttempts = (wsManager as any).reconnectAttempts || 0;
      
      return {
        service: 'websocket',
        status: isConnected ? 'healthy' : reconnectAttempts < 3 ? 'degraded' : 'unhealthy',
        message: isConnected ? 'WebSocket connected' : `Disconnected (${reconnectAttempts} reconnect attempts)`,
        details: {
          connected: isConnected,
          reconnectAttempts
        },
        timestamp: Date.now()
      };
    });
  }

  // Integração com SyncEngine
  registerSyncCheck(syncEngine: SyncEngine): void {
    this.registerCheck('sync', async () => {
      const status = syncEngine.getStatus();
      const queueSize = await syncEngine.getQueueSize();
      
      return {
        service: 'sync',
        status: status.isRunning && queueSize < 100 ? 'healthy' : 
                queueSize < 1000 ? 'degraded' : 'unhealthy',
        message: `Sync ${status.isRunning ? 'running' : 'stopped'}, ${queueSize} items in queue`,
        details: {
          ...status,
          queueSize
        },
        timestamp: Date.now()
      };
    });
  }

  destroy(): void {
    this.stopMonitoring();
    this.checks.clear();
    this.lastResults.clear();
    this.listeners.clear();
  }
}