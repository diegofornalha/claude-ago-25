import { useState, useEffect, useRef } from 'react';
import { HealthChecker, SystemHealth } from './health-checker-simple';
import { MetricsCollector } from '../utils/metrics-collector';

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

export function useHealthMonitoring(config: MonitoringConfig = {}) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const healthCheckerRef = useRef<HealthChecker | null>(null);

  useEffect(() => {
    const checker = new HealthChecker(config.healthCheckInterval || 30000);
    healthCheckerRef.current = checker;

    // Configurar listener
    const unsubscribe = checker.onHealthChange(setHealth);

    return () => {
      unsubscribe();
      checker.stop();
    };
  }, [config.healthCheckInterval]);

  const startMonitoring = () => {
    if (healthCheckerRef.current) {
      healthCheckerRef.current.start();
      setIsMonitoring(true);
    }
  };

  const stopMonitoring = () => {
    if (healthCheckerRef.current) {
      healthCheckerRef.current.stop();
      setIsMonitoring(false);
    }
  };

  return {
    health,
    isMonitoring,
    startMonitoring,
    stopMonitoring
  };
}

export interface ResourceUsage {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  storage: {
    used: number;
    quota: number;
    percentage: number;
  };
}

export function useResourceMonitoring(intervalMs: number = 5000) {
  const [resources, setResources] = useState<ResourceUsage>({
    memory: { used: 0, total: 0, percentage: 0 },
    storage: { used: 0, quota: 0, percentage: 0 }
  });

  useEffect(() => {
    const updateResources = async () => {
      // Memory usage (simulado se não disponível)
      let memoryData = { used: 0, total: 0, percentage: 0 };
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        if (memory) {
          memoryData = {
            used: memory.usedJSHeapSize,
            total: memory.jsHeapSizeLimit,
            percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
          };
        }
      } else {
        // Simular dados
        memoryData = {
          used: Math.floor(Math.random() * 500 * 1024 * 1024),
          total: 1024 * 1024 * 1024,
          percentage: 40 + Math.random() * 40
        };
      }

      // Storage usage
      let storageData = { used: 0, quota: 0, percentage: 0 };
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          storageData = {
            used: estimate.usage || 0,
            quota: estimate.quota || 0,
            percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
          };
        } catch (error) {
          console.error('Storage estimate failed:', error);
        }
      } else {
        // Simular dados
        storageData = {
          used: Math.floor(Math.random() * 200 * 1024 * 1024),
          quota: 500 * 1024 * 1024,
          percentage: 20 + Math.random() * 60
        };
      }

      setResources({
        memory: memoryData,
        storage: storageData
      });
    };

    updateResources();
    const interval = setInterval(updateResources, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return resources;
}

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
  details?: any;
}

export function useSystemAlerts(config: { alertThresholds?: MonitoringConfig['alertThresholds'] } = {}) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const metricsCollector = useRef(MetricsCollector.getInstance());

  useEffect(() => {
    const checkAlerts = () => {
      const newAlerts: SystemAlert[] = [];
      const metrics = metricsCollector.current.getAllMetrics();

      // Verificar error rate
      if (config.alertThresholds?.errorRate && metrics.app?.errors) {
        const errorRate = metrics.app.errors.rate || 0;
        if (errorRate > config.alertThresholds.errorRate) {
          newAlerts.push({
            id: `error-rate-${Date.now()}`,
            type: 'error',
            message: `Taxa de erro alta: ${(errorRate * 100).toFixed(1)}%`,
            timestamp: Date.now(),
            details: { errorRate }
          });
        }
      }

      // Verificar latência P95
      if (config.alertThresholds?.latencyP95 && metrics.performance?.['api-latency']) {
        const latencyP95 = metrics.performance['api-latency'].p95 || 0;
        if (latencyP95 > config.alertThresholds.latencyP95) {
          newAlerts.push({
            id: `latency-${Date.now()}`,
            type: 'warning',
            message: `Latência P95 alta: ${latencyP95.toFixed(0)}ms`,
            timestamp: Date.now(),
            details: { latencyP95 }
          });
        }
      }

      // Adicionar novos alertas
      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 50)); // Manter últimos 50 alertas
      }
    };

    const interval = setInterval(checkAlerts, 10000); // Verificar a cada 10s
    return () => clearInterval(interval);
  }, [config.alertThresholds]);

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
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