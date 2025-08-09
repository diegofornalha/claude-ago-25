import React from 'react';
import { MonitoringDashboard } from '../monitoring/monitoring-dashboard';
import { HealthChecker } from '../monitoring/health-checker-simple';
import { MetricsCollector } from '../utils/metrics-collector';

export function MonitoringPageComplete() {
  // Criar instâncias dos serviços
  const healthChecker = React.useMemo(() => new HealthChecker(30000, 5000), []);
  const metricsCollector = React.useMemo(() => MetricsCollector.getInstance(), []);

  React.useEffect(() => {
    // Iniciar monitoramento
    healthChecker.start();
    
    // Simular algumas métricas para demonstração
    const interval = setInterval(() => {
      // CPU (simulado)
      metricsCollector.recordMetric('system', 'cpu-usage', 40 + Math.random() * 20);
      
      // Memória (simulado)
      metricsCollector.recordMetric('system', 'memory-usage', 60 + Math.random() * 20);
      
      // Requisições
      metricsCollector.recordMetric('app', 'requests', Math.floor(1000 + Math.random() * 500));
      
      // Erros
      if (Math.random() > 0.9) {
        metricsCollector.recordMetric('app', 'errors', 1);
      }
      
      // Latência de API
      metricsCollector.recordMetric('performance', 'api-latency', 20 + Math.random() * 100);
    }, 5000);

    return () => {
      clearInterval(interval);
      healthChecker.stop();
    };
  }, [healthChecker, metricsCollector]);

  return (
    <div className="min-h-screen bg-gray-50">
      <MonitoringDashboard 
        healthChecker={healthChecker}
        metricsCollector={metricsCollector}
      />
    </div>
  );
}