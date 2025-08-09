import { useState, useEffect, useRef } from 'react';
import { HealthChecker, SystemHealth } from './health-checker';
import { MetricsCollector } from '../utils/metrics-collector';
import { WebSocketManager } from '../sync/websocket-manager';
import { SyncEngine } from '../sync/sync-engine';

export interface MonitoringConfig {
  healthCheckInterval?: number;
  metricsInterval?: number;
  alertThresholds?: {
    errorRate?: number;
    latencyP95?: number;
    memoryUsage?: number;
    storageUsage?: number;
  };
}

export function useHealthMonitoring(
  config: MonitoringConfig = {},
  dependencies?: {
    wsManager?: WebSocketManager;
    syncEngine?: SyncEngine;
  }
) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const healthCheckerRef = useRef<HealthChecker | null>(null);

  useEffect(() => {
    const checker = new HealthChecker(config.healthCheckInterval);
    healthCheckerRef.current = checker;

    // Registrar checks adicionais se dependencies foram fornecidas
    if (dependencies?.wsManager) {
      checker.registerWebSocketCheck(dependencies.wsManager);
    }
    if (dependencies?.syncEngine) {
      checker.registerSyncCheck(dependencies.syncEngine);
    }

    // Configurar listener
    const unsubscribe = checker.onHealthChange(setHealth);

    return () => {
      unsubscribe();
      checker.destroy();
    };
  }, [config.healthCheckInterval]);

  const startMonitoring = () => {
    if (healthCheckerRef.current && !isMonitoring) {
      healthCheckerRef.current.startMonitoring();
      setIsMonitoring(true);
    }
  };

  const stopMonitoring = () => {
    if (healthCheckerRef.current && isMonitoring) {
      healthCheckerRef.current.stopMonitoring();
      setIsMonitoring(false);
    }
  };

  const runCheck = async (service?: string) => {
    if (!healthCheckerRef.current) return null;

    if (service) {
      return await healthCheckerRef.current.runCheck(service);
    } else {
      const result = await healthCheckerRef.current.runAllChecks();
      setHealth(result);
      return result;
    }
  };

  return {
    health,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    runCheck,
    healthChecker: healthCheckerRef.current
  };
}

export function useMetricsMonitoring(config: MonitoringConfig = {}) {
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const collectorRef = useRef<MetricsCollector | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!collectorRef.current) {
      collectorRef.current = MetricsCollector.getInstance();
    }

    const updateMetrics = () => {
      if (collectorRef.current) {
        setMetrics(collectorRef.current.getAllMetrics());
      }
    };

    // Atualizar métricas inicialmente
    updateMetrics();

    // Configurar intervalo de atualização
    if (config.metricsInterval) {
      intervalRef.current = window.setInterval(updateMetrics, config.metricsInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config.metricsInterval]);

  const recordMetric = (category: string, metric: string, value: number) => {
    if (collectorRef.current) {
      collectorRef.current.recordMetric(category, metric, value);
      // Atualizar estado imediatamente
      setMetrics(collectorRef.current.getAllMetrics());
    }
  };

  const getMetric = (category: string, metric?: string) => {
    if (!collectorRef.current) return null;

    if (metric) {
      return collectorRef.current.getMetric(category, metric);
    } else {
      const categoryMetrics = collectorRef.current.getAllMetrics()[category];
      return categoryMetrics || {};
    }
  };

  const resetMetrics = (category?: string) => {
    if (collectorRef.current) {
      collectorRef.current.reset(category);
      setMetrics(collectorRef.current.getAllMetrics());
    }
  };

  return {
    metrics,
    recordMetric,
    getMetric,
    resetMetrics,
    metricsCollector: collectorRef.current
  };
}

export function useSystemAlerts(config: MonitoringConfig = {}) {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
    details?: any;
  }>>([]);

  const { health } = useHealthMonitoring(config);
  const { metrics } = useMetricsMonitoring(config);

  useEffect(() => {
    if (!health || !config.alertThresholds) return;

    const newAlerts: typeof alerts = [];

    // Verificar saúde do sistema
    if (health.overall === 'unhealthy') {
      const unhealthyServices = health.checks
        .filter(c => c.status === 'unhealthy')
        .map(c => c.service);

      newAlerts.push({
        id: `health-${Date.now()}`,
        type: 'error',
        message: `Serviços com problemas: ${unhealthyServices.join(', ')}`,
        timestamp: Date.now(),
        details: { unhealthyServices }
      });
    }

    // Verificar métricas
    if (metrics.sync?.errorRate > (config.alertThresholds.errorRate || 0.05)) {
      newAlerts.push({
        id: `error-rate-${Date.now()}`,
        type: 'warning',
        message: `Taxa de erro alta: ${(metrics.sync.errorRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        details: { errorRate: metrics.sync.errorRate }
      });
    }

    if (metrics.database?.queryLatency?.p95 > (config.alertThresholds.latencyP95 || 1000)) {
      newAlerts.push({
        id: `latency-${Date.now()}`,
        type: 'warning',
        message: `Latência do banco alta: P95 = ${metrics.database.queryLatency.p95.toFixed(0)}ms`,
        timestamp: Date.now(),
        details: { latency: metrics.database.queryLatency }
      });
    }

    // Adicionar novos alertas
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50)); // Manter últimos 50 alertas
    }
  }, [health, metrics, config.alertThresholds]);

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  return {
    alerts,
    dismissAlert,
    clearAlerts
  };
}

// Hook para performance timing
export function usePerformanceTiming(operation: string) {
  const startTimeRef = useRef<number>(0);
  const { recordMetric } = useMetricsMonitoring();

  const startTiming = () => {
    startTimeRef.current = performance.now();
  };

  const endTiming = (category: string = 'performance') => {
    if (startTimeRef.current === 0) return;

    const duration = performance.now() - startTimeRef.current;
    recordMetric(category, operation, duration);
    startTimeRef.current = 0;

    return duration;
  };

  return { startTiming, endTiming };
}

// Hook para monitorar recursos
export function useResourceMonitoring(intervalMs: number = 5000) {
  const [resources, setResources] = useState({
    memory: { used: 0, total: 0, percentage: 0 },
    storage: { used: 0, quota: 0, percentage: 0 },
    cpu: { usage: 0 }
  });

  useEffect(() => {
    const checkResources = async () => {
      const newResources = { ...resources };

      // Memory check
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        newResources.memory = {
          used: memory.usedJSHeapSize,
          total: memory.jsHeapSizeLimit,
          percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        };
      }

      // Storage check
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        newResources.storage = {
          used: estimate.usage || 0,
          quota: estimate.quota || 0,
          percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
        };
      }

      setResources(newResources);
    };

    checkResources();
    const interval = setInterval(checkResources, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return resources;
}