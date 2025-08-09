import React, { useState } from 'react';
import { useHealthMonitoring, useResourceMonitoring, useSystemAlerts } from './monitoring-hooks-simple';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

interface MonitoringWidgetProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  defaultExpanded?: boolean;
}

export const MonitoringWidget: React.FC<MonitoringWidgetProps> = ({ 
  position = 'bottom-right',
  defaultExpanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { health, isMonitoring, startMonitoring, stopMonitoring } = useHealthMonitoring();
  const resources = useResourceMonitoring();
  const { alerts, dismissAlert } = useSystemAlerts({
    alertThresholds: {
      errorRate: 0.05,
      latencyP95: 1000,
      memoryUsage: 90,
      storageUsage: 80
    }
  });

  // Iniciar monitoramento automaticamente
  React.useEffect(() => {
    startMonitoring();
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right': return 'top-4 right-4';
      case 'top-left': return 'top-4 left-4';
      case 'bottom-right': return 'bottom-4 right-4';
      case 'bottom-left': return 'bottom-4 left-4';
    }
  };

  const getStatusColor = (status?: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'unhealthy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status?: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy': return '✓';
      case 'degraded': return '⚠';
      case 'unhealthy': return '✗';
      default: return '?';
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const recentAlerts = alerts.slice(0, 3);
  const hasAlerts = alerts.length > 0;

  return (
    <div className={`fixed ${getPositionClasses()} z-50`}>
      {/* Widget Compacto */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-white transition-all hover:scale-105 ${
            getStatusColor(health?.overall)
          }`}
        >
          <span className="text-lg">{getStatusIcon(health?.overall)}</span>
          <span className="text-sm font-medium">Sistema</span>
          {hasAlerts && (
            <span className="ml-1 bg-white text-red-500 rounded-full w-2 h-2 animate-pulse" />
          )}
        </button>
      )}

      {/* Widget Expandido */}
      {isExpanded && (
        <div className="bg-white rounded-lg shadow-2xl w-80 max-h-96 overflow-hidden">
          {/* Header */}
          <div className={`p-3 text-white ${getStatusColor(health?.overall)}`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getStatusIcon(health?.overall)}</span>
                <span className="font-semibold">
                  Sistema {health?.overall === 'healthy' ? 'Saudável' : 
                          health?.overall === 'degraded' ? 'Degradado' : 'Com Problemas'}
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-80">
            {/* Recursos */}
            <div className="p-3 border-b">
              <h4 className="text-sm font-semibold mb-2">Recursos</h4>
              
              {/* Memória */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Memória</span>
                  <span>{resources.memory.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      resources.memory.percentage > 90 ? 'bg-red-500' :
                      resources.memory.percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${resources.memory.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatBytes(resources.memory.used)} / {formatBytes(resources.memory.total)}
                </div>
              </div>

              {/* Storage */}
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Armazenamento</span>
                  <span>{resources.storage.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      resources.storage.percentage > 95 ? 'bg-red-500' :
                      resources.storage.percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${resources.storage.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatBytes(resources.storage.used)} / {formatBytes(resources.storage.quota)}
                </div>
              </div>
            </div>

            {/* Serviços */}
            {health && (
              <div className="p-3 border-b">
                <h4 className="text-sm font-semibold mb-2">Serviços</h4>
                <div className="grid grid-cols-2 gap-2">
                  {health.checks.map((check) => (
                    <div 
                      key={check.service}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                        check.status === 'healthy' ? 'bg-green-100 text-green-700' :
                        check.status === 'degraded' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}
                    >
                      <span>{getStatusIcon(check.status)}</span>
                      <span className="capitalize truncate">{check.service}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alertas */}
            {hasAlerts && (
              <div className="p-3">
                <h4 className="text-sm font-semibold mb-2 flex justify-between">
                  <span>Alertas Recentes</span>
                  <span className="text-xs text-gray-500">{alerts.length}</span>
                </h4>
                <div className="space-y-2">
                  {recentAlerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className={`text-xs p-2 rounded flex justify-between items-start ${
                        alert.type === 'error' ? 'bg-red-100 text-red-700' :
                        alert.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-xs opacity-75">
                          {formatDistanceToNow(alert.timestamp, { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="hover:opacity-75"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-gray-50 flex justify-between items-center">
            <span className="text-xs text-gray-500">
              {isMonitoring ? 'Monitorando...' : 'Pausado'}
            </span>
            <button
              onClick={() => isMonitoring ? stopMonitoring() : startMonitoring()}
              className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              {isMonitoring ? 'Pausar' : 'Iniciar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};