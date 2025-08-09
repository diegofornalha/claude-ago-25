import React, { useState, useEffect } from 'react';
import { RealTimeAlertSystem } from './real-time-alerts';
import type { Alert } from './real-time-alerts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertUIProps {
  alertSystem: RealTimeAlertSystem;
  position?: 'top' | 'bottom';
  maxVisible?: number;
}

export const AlertUI: React.FC<AlertUIProps> = ({ 
  alertSystem, 
  position = 'top',
  maxVisible = 3 
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Carregar alertas ativos
    setAlerts(alertSystem.getActiveAlerts());

    // Escutar novos alertas
    const unsubscribe = alertSystem.onAlert(() => {
      setAlerts(alertSystem.getActiveAlerts());
    });

    // Escutar dismissals
    const handleDismiss = () => {
      setAlerts(alertSystem.getActiveAlerts());
    };
    
    alertSystem.on('alert:dismissed', handleDismiss);

    return () => {
      unsubscribe();
      alertSystem.off('alert:dismissed', handleDismiss);
    };
  }, [alertSystem]);

  const getSeverityStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white border-red-700';
      case 'high':
        return 'bg-orange-500 text-white border-orange-600';
      case 'medium':
        return 'bg-yellow-500 text-white border-yellow-600';
      case 'low':
        return 'bg-blue-500 text-white border-blue-600';
    }
  };

  const getTypeIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
    }
  };

  const toggleExpanded = (alertId: string) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  const visibleAlerts = alerts.slice(0, maxVisible);
  const hiddenCount = alerts.length - maxVisible;

  return (
    <div className={`fixed ${position === 'top' ? 'top-4' : 'bottom-4'} right-4 z-50 max-w-md`}>
      <div className="space-y-2">
        {visibleAlerts.map((alert, index) => (
          <div
            key={alert.id}
            className={`alert-item rounded-lg shadow-lg p-4 border-2 transition-all transform ${
              getSeverityStyles(alert.severity)
            } ${index === 0 ? 'scale-100' : 'scale-95'}`}
            style={{
              animation: 'slideIn 0.3s ease-out',
              animationDelay: `${index * 0.1}s`
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2 flex-1">
                <span className="text-xl">{getTypeIcon(alert.type)}</span>
                
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">{alert.title}</h4>
                  
                  <p className={`text-sm mt-1 ${
                    expandedAlerts.has(alert.id) ? '' : 'line-clamp-2'
                  }`}>
                    {alert.message}
                  </p>

                  {alert.metadata && expandedAlerts.has(alert.id) && (
                    <div className="mt-2 text-xs opacity-90">
                      <pre className="bg-black bg-opacity-20 p-2 rounded">
                        {JSON.stringify(alert.metadata, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs opacity-75">
                      {formatDistanceToNow(alert.timestamp, { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                    
                    {alert.source && (
                      <span className="text-xs bg-black bg-opacity-20 px-2 py-0.5 rounded">
                        {alert.source}
                      </span>
                    )}
                  </div>

                  {alert.actions && alert.actions.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {alert.actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            action.action();
                            if (!alert.persistent) {
                              alertSystem.dismissAlert(alert.id);
                            }
                          }}
                          className="px-3 py-1 text-sm bg-white text-gray-800 rounded hover:bg-gray-100"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 ml-2">
                {alert.metadata && (
                  <button
                    onClick={() => toggleExpanded(alert.id)}
                    className="text-white opacity-75 hover:opacity-100"
                    title="Ver detalhes"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d={expandedAlerts.has(alert.id) 
                          ? "M19 9l-7 7-7-7" 
                          : "M9 5l7 7-7 7"
                        } 
                      />
                    </svg>
                  </button>
                )}
                
                <button
                  onClick={() => alertSystem.dismissAlert(alert.id)}
                  className="text-white opacity-75 hover:opacity-100"
                  title="Dispensar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {hiddenCount > 0 && (
          <div className="text-center">
            <button
              onClick={() => {
                // Abrir painel completo de alertas
                const event = new CustomEvent('open-alerts-panel');
                window.dispatchEvent(event);
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              +{hiddenCount} alertas ocultos
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

// Painel completo de alertas
export const AlertsPanel: React.FC<{ alertSystem: RealTimeAlertSystem }> = ({ alertSystem }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [alertHistory, setAlertHistory] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'rules'>('active');

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-alerts-panel', handleOpen);

    return () => {
      window.removeEventListener('open-alerts-panel', handleOpen);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveAlerts(alertSystem.getActiveAlerts());
      setAlertHistory(alertSystem.getAlertHistory());
    }
  }, [isOpen, alertSystem]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Central de Alertas</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="bg-gray-100 border-b flex">
          {(['active', 'history', 'rules'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 capitalize ${
                activeTab === tab 
                  ? 'bg-white border-b-2 border-blue-500' 
                  : 'hover:bg-gray-200'
              }`}
            >
              {tab === 'active' ? `Ativos (${activeAlerts.length})` :
               tab === 'history' ? 'Histórico' : 'Regras'}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {activeTab === 'active' && (
            <div className="space-y-2">
              {activeAlerts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum alerta ativo</p>
              ) : (
                activeAlerts.map(alert => (
                  <div key={alert.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{alert.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(alert.timestamp).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          alertSystem.dismissAlert(alert.id);
                          setActiveAlerts(alertSystem.getActiveAlerts());
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        Dispensar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {alertHistory.map(alert => (
                <div key={alert.id} className="bg-gray-50 p-3 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium text-sm">{alert.title}</h5>
                      <p className="text-xs text-gray-600">{alert.message}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-3">
              {alertSystem.getRules().map(rule => (
                <div key={rule.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold">{rule.name}</h4>
                      <p className="text-sm text-gray-600">
                        Severidade: {rule.severity} | Tipo: {rule.type}
                      </p>
                      {rule.cooldown && (
                        <p className="text-xs text-gray-500">
                          Cooldown: {rule.cooldown / 60000} minutos
                        </p>
                      )}
                    </div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => {
                          if (e.target.checked) {
                            alertSystem.enableRule(rule.id);
                          } else {
                            alertSystem.disableRule(rule.id);
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">Ativa</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};