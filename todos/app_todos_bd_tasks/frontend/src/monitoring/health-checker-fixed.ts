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
    // Browser Performance Check
    this.registerCheck('browser-performance', async () => {
      const start = Date.now();
      try {
        // Simular verificação de performance
        const memoryUsage = (performance as any).memory ? 
          ((performance as any).memory.usedJSHeapSize / (performance as any).memory.jsHeapSizeLimit) * 100 : 
          Math.random() * 100;
        
        const latency = Date.now() - start;
        
        return {
          service: 'browser-performance',
          status: memoryUsage < 80 ? 'healthy' : memoryUsage < 95 ? 'degraded' : 'unhealthy',
          latency,
          message: `Memory usage: ${memoryUsage.toFixed(1)}%`,
          details: {
            memoryPercentage: memoryUsage
          },
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          service: 'browser-performance',
          status: 'unhealthy',
          message: `Error: ${error}`,
          timestamp: Date.now()
        };
      }
    });

    // Storage Check
    this.registerCheck('storage', async () => {
      try {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          const usagePercentage = ((estimate.usage || 0) / (estimate.quota || 1)) * 100;
          
          return {
            service: 'storage',
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
          service: 'storage',
          status: 'healthy',
          message: 'Storage API not available',
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          service: 'storage',
          status: 'unhealthy',
          message: `Storage check failed: ${error}`,
          timestamp: Date.now()
        };
      }
    });

    // Network Check
    this.registerCheck('network', async () => {
      const start = Date.now();
      try {
        const online = navigator.onLine;
        const latency = Date.now() - start;
        
        if (!online) {
          return {
            service: 'network',
            status: 'unhealthy',
            latency,
            message: 'No network connection',
            timestamp: Date.now()
          };
        }
        
        // Simular latência de rede
        const networkLatency = Math.random() * 200;
        
        return {
          service: 'network',
          status: networkLatency < 100 ? 'healthy' : networkLatency < 300 ? 'degraded' : 'unhealthy',
          latency: networkLatency,
          message: `Network latency: ${networkLatency.toFixed(0)}ms`,
          details: {
            online,
            effectiveType: (navigator as any).connection?.effectiveType || 'unknown'
          },
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          service: 'network',
          status: 'unhealthy',
          message: `Network check failed: ${error}`,
          timestamp: Date.now()
        };
      }
    });

    // Application Health (simulado)
    this.registerCheck('application', async () => {
      try {
        // Simular saúde da aplicação
        const errorRate = Math.random() * 0.1; // 0-10% de erro
        const responseTime = 50 + Math.random() * 150; // 50-200ms
        
        const status = errorRate < 0.02 && responseTime < 100 ? 'healthy' :
                      errorRate < 0.05 && responseTime < 200 ? 'degraded' : 'unhealthy';
        
        return {
          service: 'application',
          status,
          latency: responseTime,
          message: `Error rate: ${(errorRate * 100).toFixed(1)}%, Response time: ${responseTime.toFixed(0)}ms`,
          details: {
            errorRate,
            responseTime,
            uptime: performance.now() / 1000 // segundos desde o carregamento
          },
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          service: 'application',
          status: 'unhealthy',
          message: `Application check failed: ${error}`,
          timestamp: Date.now()
        };
      }
    });
  }

  registerCheck(service: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(service, checkFn);
  }

  async runCheck(service: string): Promise<HealthCheckResult> {
    const checkFn = this.checks.get(service);
    if (!checkFn) {
      return {
        service,
        status: 'unhealthy',
        message: 'Check not found',
        timestamp: Date.now()
      };
    }

    try {
      const result = await Promise.race([
        checkFn(),
        new Promise<HealthCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.timeoutMs)
        )
      ]);
      
      this.lastResults.set(service, result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        service,
        status: 'unhealthy',
        message: `Check failed: ${error}`,
        timestamp: Date.now()
      };
      this.lastResults.set(service, result);
      return result;
    }
  }

  async runAllChecks(): Promise<SystemHealth> {
    const results = await Promise.all(
      Array.from(this.checks.keys()).map(service => this.runCheck(service))
    );

    const hasUnhealthy = results.some(r => r.status === 'unhealthy');
    const hasDegraded = results.some(r => r.status === 'degraded');
    
    const overall = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

    const health: SystemHealth = {
      overall,
      checks: results,
      timestamp: Date.now()
    };

    // Notificar listeners
    this.listeners.forEach(listener => listener(health));

    return health;
  }

  start(): void {
    if (this.checkInterval) return;
    
    // Executar verificação inicial
    this.runAllChecks();
    
    // Configurar intervalo
    this.checkInterval = window.setInterval(() => {
      this.runAllChecks();
    }, this.intervalMs);
  }

  stop(): void {
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
    const checks = Array.from(this.lastResults.values());
    const hasUnhealthy = checks.some(r => r.status === 'unhealthy');
    const hasDegraded = checks.some(r => r.status === 'degraded');
    
    return {
      overall: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
      checks,
      timestamp: Date.now()
    };
  }
}