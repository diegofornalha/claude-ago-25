import React, { useState, useEffect } from 'react';
import { pilotMigration } from '../migration/pilot-migration';
import { rollbackManager } from '../rollback/rollback-manager';
import { featureFlags } from '../utils/feature-flags';
import { MetricsCollector } from '../utils/metrics-collector';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const RolloutDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'features' | 'rollback'>('overview');
  const [pilotGroups, setPilotGroups] = useState(pilotMigration.getPilotGroups());
  const [migrationMetrics, setMigrationMetrics] = useState(pilotMigration.getMetrics());
  const [rollbackPoints, setRollbackPoints] = useState(rollbackManager.getRollbackPoints());
  const [features, setFeatures] = useState(featureFlags.getAllFlags());
  const [systemMetrics, setSystemMetrics] = useState<any>({});

  useEffect(() => {
    const metricsCollector = MetricsCollector.getInstance();
    
    // Atualizar dados periodicamente
    const interval = setInterval(() => {
      setPilotGroups(pilotMigration.getPilotGroups());
      setMigrationMetrics(pilotMigration.getMetrics());
      setRollbackPoints(rollbackManager.getRollbackPoints());
      setFeatures(featureFlags.getAllFlags());
      setSystemMetrics(metricsCollector.getAllMetrics());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getGroupStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'completed': return 'text-blue-600 bg-blue-100';
      case 'rolled_back': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderOverview = () => {
    const totalUsers = pilotGroups.reduce((sum, g) => sum + g.userIds.length, 0);
    const activeGroups = pilotGroups.filter(g => g.status === 'active').length;
    const completedGroups = pilotGroups.filter(g => g.status === 'completed').length;
    const successRate = migrationMetrics.usersMigrated > 0 
      ? ((migrationMetrics.usersMigrated - migrationMetrics.errorCount) / migrationMetrics.usersMigrated * 100).toFixed(1)
      : 0;

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold mb-4">Visão Geral do Rollout</h2>
        
        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Usuários Total</h3>
            <p className="text-3xl font-bold">{totalUsers}</p>
            <p className="text-sm text-gray-500 mt-1">Em grupos piloto</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Migrados</h3>
            <p className="text-3xl font-bold">{migrationMetrics.usersMigrated}</p>
            <p className="text-sm text-gray-500 mt-1">
              {successRate}% sucesso
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Grupos Ativos</h3>
            <p className="text-3xl font-bold">{activeGroups}</p>
            <p className="text-sm text-gray-500 mt-1">
              {completedGroups} completos
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Rollbacks</h3>
            <p className="text-3xl font-bold">{migrationMetrics.rollbackCount}</p>
            <p className="text-sm text-gray-500 mt-1">
              {rollbackPoints.length} pontos salvos
            </p>
          </div>
        </div>

        {/* Gráfico de Progresso */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Progresso da Migração</h3>
          
          <div className="space-y-4">
            {pilotGroups.map(group => {
              const progress = group.userIds.length > 0 
                ? (group.status === 'completed' ? 100 : 
                   group.status === 'active' ? 50 : 0)
                : 0;

              return (
                <div key={group.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{group.name}</span>
                    <span className="text-sm text-gray-500">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        group.status === 'rolled_back' ? 'bg-red-500' :
                        progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alertas e Status */}
        {migrationMetrics.errorRate > 0.02 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Taxa de erro elevada: {(migrationMetrics.errorRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGroups = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Grupos Piloto</h2>
        <button
          onClick={() => pilotMigration.createPilotGroup({
            id: `custom-${Date.now()}`,
            name: 'Novo Grupo',
            description: 'Grupo personalizado',
            userIds: [],
            startDate: new Date(),
            rollbackThreshold: {
              errorRate: 0.05,
              performanceDegradation: 0.2,
              userComplaints: 5
            }
          })}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Criar Grupo
        </button>
      </div>

      <div className="grid gap-4">
        {pilotGroups.map(group => (
          <div key={group.id} className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{group.name}</h3>
                <p className="text-sm text-gray-600">{group.description}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGroupStatusColor(group.status)}`}>
                {group.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
              <div>
                <p className="text-gray-600">Usuários</p>
                <p className="font-semibold">{group.userIds.length}</p>
              </div>
              <div>
                <p className="text-gray-600">Início</p>
                <p className="font-semibold">
                  {formatDistanceToNow(group.startDate, { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Taxa de Erro Limite</p>
                <p className="font-semibold">{(group.rollbackThreshold.errorRate * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-gray-600">Performance Limite</p>
                <p className="font-semibold">{(group.rollbackThreshold.performanceDegradation * 100).toFixed(0)}%</p>
              </div>
            </div>

            <div className="flex gap-2">
              {group.status === 'planned' && (
                <button
                  onClick={() => pilotMigration.startPilotMigration(group.id)}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  Iniciar Migração
                </button>
              )}
              {group.status === 'active' && (
                <>
                  <button
                    onClick={() => pilotMigration.pauseMigration()}
                    className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                  >
                    Pausar
                  </button>
                  <button
                    onClick={() => rollbackManager.rollback(group.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    Rollback
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFeatures = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold mb-4">Feature Flags</h2>

      <div className="grid gap-4">
        {features.map(flag => (
          <div key={flag.key} className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-semibold">{flag.name}</h3>
                <p className="text-sm text-gray-600">{flag.description}</p>
                <p className="text-xs text-gray-500 mt-1">Key: {flag.key}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={flag.enabled}
                  onChange={(e) => {
                    featureFlags.updateFlag(flag.key, { enabled: e.target.checked });
                    setFeatures(featureFlags.getAllFlags());
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm">
              <div>
                <span className="text-gray-600">Rollout:</span>
                <span className="ml-2 font-medium">{flag.rolloutPercentage}%</span>
              </div>
              {flag.targetUsers && flag.targetUsers.length > 0 && (
                <div>
                  <span className="text-gray-600">Usuários alvo:</span>
                  <span className="ml-2 font-medium">{flag.targetUsers.length}</span>
                </div>
              )}
              {flag.targetGroups && flag.targetGroups.length > 0 && (
                <div>
                  <span className="text-gray-600">Grupos alvo:</span>
                  <span className="ml-2 font-medium">{flag.targetGroups.join(', ')}</span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="text-sm text-gray-600">Percentual de Rollout</label>
              <input
                type="range"
                min="0"
                max="100"
                value={flag.rolloutPercentage}
                onChange={(e) => {
                  featureFlags.updateFlag(flag.key, { 
                    rolloutPercentage: parseInt(e.target.value) 
                  });
                  setFeatures(featureFlags.getAllFlags());
                }}
                className="w-full mt-1"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRollback = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Pontos de Rollback</h2>
        <button
          onClick={async () => {
            await rollbackManager.createRollbackPoint('Manual checkpoint');
            setRollbackPoints(rollbackManager.getRollbackPoints());
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Criar Checkpoint
        </button>
      </div>

      {/* Configuração de Rollback Automático */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">Rollback Automático</h3>
        
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={rollbackManager.getConfig().autoRollbackEnabled}
              onChange={(e) => {
                rollbackManager.updateConfig({ autoRollbackEnabled: e.target.checked });
              }}
              className="mr-2"
            />
            <span>Ativar rollback automático</span>
          </label>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-600">Taxa de Erro Limite</label>
              <input
                type="number"
                value={rollbackManager.getConfig().thresholds.errorRate * 100}
                onChange={(e) => {
                  const config = rollbackManager.getConfig();
                  config.thresholds.errorRate = parseFloat(e.target.value) / 100;
                  rollbackManager.updateConfig(config);
                }}
                className="w-full mt-1 px-3 py-2 border rounded"
                step="0.1"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Tempo de Resposta (ms)</label>
              <input
                type="number"
                value={rollbackManager.getConfig().thresholds.responseTime}
                onChange={(e) => {
                  const config = rollbackManager.getConfig();
                  config.thresholds.responseTime = parseInt(e.target.value);
                  rollbackManager.updateConfig(config);
                }}
                className="w-full mt-1 px-3 py-2 border rounded"
                step="100"
                min="0"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Disponibilidade Mínima (%)</label>
              <input
                type="number"
                value={rollbackManager.getConfig().thresholds.availabilityTarget * 100}
                onChange={(e) => {
                  const config = rollbackManager.getConfig();
                  config.thresholds.availabilityTarget = parseFloat(e.target.value) / 100;
                  rollbackManager.updateConfig(config);
                }}
                className="w-full mt-1 px-3 py-2 border rounded"
                step="0.1"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Pontos de Rollback */}
      <div className="grid gap-4">
        {rollbackPoints.map(point => (
          <div key={point.id} className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-semibold">{point.description}</h3>
                <p className="text-sm text-gray-600">
                  Versão: {point.version} • {formatDistanceToNow(point.timestamp, { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const ok = await rollbackManager.testRollback(point.id);
                    alert(ok ? 'Teste OK! Backup disponível.' : 'Teste falhou!');
                  }}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  Testar
                </button>
                <button
                  onClick={() => {
                    if (confirm('Tem certeza? Isso reverterá o sistema.')) {
                      rollbackManager.rollback(point.id);
                    }
                  }}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Executar Rollback
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Usuários</p>
                <p className="font-semibold">{point.metadata.userCount}</p>
              </div>
              <div>
                <p className="text-gray-600">Dados</p>
                <p className="font-semibold">{point.metadata.dataCount}</p>
              </div>
              <div>
                <p className="text-gray-600">Schema</p>
                <p className="font-semibold">{point.metadata.schemaVersion}</p>
              </div>
              <div>
                <p className="text-gray-600">Ambiente</p>
                <p className="font-semibold">{point.metadata.environment}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard de Rollout</h1>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'groups', 'features', 'rollback'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'overview' ? 'Visão Geral' :
               tab === 'groups' ? 'Grupos Piloto' :
               tab === 'features' ? 'Features' : 'Rollback'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'groups' && renderGroups()}
        {activeTab === 'features' && renderFeatures()}
        {activeTab === 'rollback' && renderRollback()}
      </div>
    </div>
  );
};