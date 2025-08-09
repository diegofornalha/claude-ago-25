import React, { useState, useEffect } from 'react';
import { HealthChecker } from './health-checker-simple';
import { SystemHealth, HealthCheckResult } from './types';
import { MetricsCollector } from '../utils/metrics-collector';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MonitoringDashboardProps {
  healthChecker: HealthChecker;
  metricsCollector: MetricsCollector;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ 
  healthChecker, 
  metricsCollector 
}) => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);

  useEffect(() => {
    // Carregar dados iniciais
    loadHealthData();
    loadMetricsData();

    // Configurar listeners
    const unsubscribe = healthChecker.onHealthChange(setHealth);

    // Auto-refresh
    let interval: number | null = null;
    if (autoRefresh) {
      interval = window.setInterval(() => {
        loadHealthData();
        loadMetricsData();
      }, refreshInterval);
    }

    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const loadHealthData = async () => {
    const healthData = await healthChecker.runAllChecks();
    setHealth(healthData);
  };

  const loadMetricsData = () => {
    const allMetrics = metricsCollector.getAllMetrics();
    setMetrics(allMetrics);
  };

  const getStatusColor = (status: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy': return 'text-red-600 bg-red-100';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy': return '✓';
      case 'degraded': return '⚠';
      case 'unhealthy': return '✗';
    }
  };

  const formatLatency = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const renderMetricValue = (value: any): string => {
    if (typeof value === 'number') {
      return value.toFixed(2);
    }
    if (typeof value === 'object' && value !== null) {
      if ('p50' in value && 'p95' in value && 'p99' in value) {
        return `P50: ${value.p50.toFixed(0)}ms | P95: ${value.p95.toFixed(0)}ms | P99: ${value.p99.toFixed(0)}ms`;
      }
    }
    return String(value);
  };

  if (!health) {
    return (
      <div className="monitoring-dashboard p-6">
        <div className="text-center text-gray-500">Carregando dados de monitoramento...</div>
      </div>
    );
  }

  return (
    <div className="monitoring-dashboard p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="header mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">Dashboard de Monitoramento</h1>
            
            <div className="controls flex items-center gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                <span>Auto-refresh</span>
              </label>
              
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-3 py-1 border rounded"
              >
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
                <option value={60000}>1m</option>
                <option value={300000}>5m</option>
              </select>
              
              <button
                onClick={() => {
                  loadHealthData();
                  loadMetricsData();
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Atualizar
              </button>
            </div>
          </div>
          
          {/* Overall Status */}
          <div className={`overall-status p-4 rounded-lg ${getStatusColor(health.overall)}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getStatusIcon(health.overall)}</span>
              <span className="text-xl font-semibold capitalize">
                Sistema {health.overall === 'healthy' ? 'Saudável' : 
                        health.overall === 'degraded' ? 'Degradado' : 'Com Problemas'}
              </span>
              <span className="text-sm ml-auto">
                Última verificação: {formatDistanceToNow(health.timestamp, { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="services-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {health.checks.map((check) => (
            <div
              key={check.service}
              className={`service-card p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow ${
                selectedService === check.service ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedService(check.service)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold capitalize">{check.service}</h3>
                <span className={`px-2 py-1 rounded text-sm ${getStatusColor(check.status)}`}>
                  {getStatusIcon(check.status)} {check.status}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{check.message}</p>
              
              {check.latency && (
                <p className="text-sm text-gray-500">
                  Latência: {formatLatency(check.latency)}
                </p>
              )}
              
              {check.details && (
                <div className="mt-2 pt-2 border-t">
                  {Object.entries(check.details).slice(0, 2).map(([key, value]) => (
                    <p key={key} className="text-xs text-gray-500">
                      {key}: {typeof value === 'number' ? value.toFixed(1) : String(value)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Metrics Section */}
        <div className="metrics-section mb-8">
          <h2 className="text-2xl font-bold mb-4">Métricas de Performance</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(metrics).map(([category, categoryMetrics]) => (
              <div key={category} className="metrics-card bg-white p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-3 capitalize">{category}</h3>
                
                <div className="space-y-2">
                  {Object.entries(categoryMetrics as Record<string, any>).map(([metric, value]) => (
                    <div key={metric} className="metric-row flex justify-between items-center">
                      <span className="text-sm text-gray-600">{metric}:</span>
                      <span className="text-sm font-mono">
                        {renderMetricValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Service Details */}
        {selectedService && (
          <div className="service-details bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">
              Detalhes: {selectedService}
            </h2>
            
            {(() => {
              const check = health.checks.find(c => c.service === selectedService);
              if (!check) return null;
              
              return (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className={`font-semibold ${getStatusColor(check.status)}`}>
                        {getStatusIcon(check.status)} {check.status}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Última verificação</p>
                      <p className="font-semibold">
                        {formatDistanceToNow(check.timestamp, { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    
                    {check.latency && (
                      <div>
                        <p className="text-sm text-gray-600">Latência</p>
                        <p className="font-semibold">{formatLatency(check.latency)}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">Mensagem</p>
                    <p className="bg-gray-100 p-2 rounded">{check.message}</p>
                  </div>
                  
                  {check.details && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Detalhes Adicionais</p>
                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Quick Actions */}
        <div className="quick-actions mt-8 p-4 bg-white rounded-lg shadow">
          <h3 className="font-semibold mb-3">Ações Rápidas</h3>
          
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const result = await healthChecker.runCheck('database');
                alert(`Database check: ${result.status}\n${result.message}`);
              }}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              Testar Database
            </button>
            
            <button
              onClick={async () => {
                const result = await healthChecker.runCheck('network');
                alert(`Network check: ${result.status}\n${result.message}`);
              }}
              className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              Testar Rede
            </button>
            
            <button
              onClick={() => {
                metricsCollector.reset();
                setMetrics({});
                alert('Métricas resetadas!');
              }}
              className="px-3 py-1 bg-red-200 rounded hover:bg-red-300"
            >
              Resetar Métricas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};