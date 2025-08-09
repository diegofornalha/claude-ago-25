import React, { useState, useEffect } from 'react';
import { SyncEngine } from '../sync/sync-engine';
import { ConflictResolver } from '../sync/conflict-resolver';
import { WebSocketManager } from '../sync/websocket-manager';
import { db } from '../db/pglite-instance';
import { users, issues, syncQueue } from '../shared/schema';
import { sql } from 'drizzle-orm';

interface DebugPanelProps {
  syncEngine: SyncEngine;
  wsManager: WebSocketManager;
  conflictResolver: ConflictResolver;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  syncEngine,
  wsManager,
  conflictResolver
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sync' | 'conflicts' | 'database' | 'network'>('sync');
  const [syncStatus, setSyncStatus] = useState(syncEngine.getStatus());
  const [queueSize, setQueueSize] = useState(0);
  const [logs, setLogs] = useState<Array<{
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    message: string;
    data?: any;
  }>>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      setSyncStatus(syncEngine.getStatus());
      setQueueSize(await syncEngine.getQueueSize());
    }, 1000);

    return () => clearInterval(interval);
  }, [syncEngine]);

  const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    setLogs(prev => [...prev, {
      timestamp: Date.now(),
      level,
      message,
      data
    }].slice(-100)); // Manter últimos 100 logs
  };

  // Ações de Debug
  const forceSync = async () => {
    log('info', 'Forçando sincronização...');
    try {
      await syncEngine.forceSync();
      log('info', 'Sincronização forçada com sucesso');
    } catch (error) {
      log('error', 'Erro ao forçar sincronização', error);
    }
  };

  const simulateConflict = async () => {
    log('info', 'Simulando conflito...');
    try {
      // Criar dois registros com mesmo ID mas dados diferentes
      const conflictId = `conflict-test-${Date.now()}`;
      
      const localIssue = {
        id: conflictId,
        title: 'Local Version',
        description: 'Created locally',
        status: 'open' as const,
        priority: 'high' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const remoteIssue = {
        id: conflictId,
        title: 'Remote Version',
        description: 'Created remotely',
        status: 'closed' as const,
        priority: 'low' as const,
        createdAt: new Date(Date.now() - 1000),
        updatedAt: new Date(Date.now() + 1000)
      };

      // Inserir versão local
      await db.insert(issues).values(localIssue);

      // Simular chegada de versão remota
      const conflict = await conflictResolver.resolveConflict(
        { type: 'issues', data: localIssue },
        { type: 'issues', data: remoteIssue }
      );

      log('info', 'Conflito simulado e resolvido', conflict);
    } catch (error) {
      log('error', 'Erro ao simular conflito', error);
    }
  };

  const clearSyncQueue = async () => {
    log('info', 'Limpando fila de sincronização...');
    try {
      await db.delete(syncQueue);
      log('info', 'Fila de sincronização limpa');
    } catch (error) {
      log('error', 'Erro ao limpar fila', error);
    }
  };

  const simulateNetworkFailure = () => {
    log('warn', 'Simulando falha de rede...');
    wsManager.disconnect();
    setTimeout(() => {
      log('info', 'Reconectando...');
      wsManager.connect();
    }, 5000);
  };

  const exportDebugData = async () => {
    log('info', 'Exportando dados de debug...');
    try {
      const debugData = {
        timestamp: Date.now(),
        syncStatus,
        queueSize,
        logs,
        database: {
          users: await db.select({ count: sql`count(*)` }).from(users),
          issues: await db.select({ count: sql`count(*)` }).from(issues),
          syncQueue: await db.select({ count: sql`count(*)` }).from(syncQueue)
        },
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage }
      };

      const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      log('info', 'Dados de debug exportados');
    } catch (error) {
      log('error', 'Erro ao exportar dados', error);
    }
  };

  const renderSyncTab = () => (
    <div className="space-y-4">
      <div className="status-section">
        <h3 className="font-semibold mb-2">Status de Sincronização</h3>
        <div className="bg-gray-100 p-3 rounded text-sm">
          <p>Status: <span className={syncStatus.isRunning ? 'text-green-600' : 'text-red-600'}>
            {syncStatus.isRunning ? 'Rodando' : 'Parado'}
          </span></p>
          <p>Última sincronização: {syncStatus.lastSyncTime ? 
            new Date(syncStatus.lastSyncTime).toLocaleString('pt-BR') : 'Nunca'}</p>
          <p>Próxima sincronização: {syncStatus.nextSyncTime ? 
            new Date(syncStatus.nextSyncTime).toLocaleString('pt-BR') : 'N/A'}</p>
          <p>Itens na fila: {queueSize}</p>
          <p>Tentativas de sync: {syncStatus.syncAttempts}</p>
          <p>Erros de sync: {syncStatus.syncErrors}</p>
        </div>
      </div>

      <div className="actions-section">
        <h3 className="font-semibold mb-2">Ações</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={forceSync}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Forçar Sync
          </button>
          <button
            onClick={() => syncEngine.pause()}
            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Pausar Sync
          </button>
          <button
            onClick={() => syncEngine.resume()}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Resumir Sync
          </button>
          <button
            onClick={clearSyncQueue}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Limpar Fila
          </button>
        </div>
      </div>
    </div>
  );

  const renderConflictsTab = () => (
    <div className="space-y-4">
      <div className="conflicts-section">
        <h3 className="font-semibold mb-2">Simulação de Conflitos</h3>
        <div className="space-y-2">
          <button
            onClick={simulateConflict}
            className="w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Simular Conflito de Dados
          </button>
          <button
            onClick={async () => {
              log('info', 'Mudando estratégia para merge');
              conflictResolver.setStrategy('merge');
            }}
            className="w-full px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Usar Estratégia: Merge
          </button>
          <button
            onClick={async () => {
              log('info', 'Mudando estratégia para last-write-wins');
              conflictResolver.setStrategy('lastWriteWins');
            }}
            className="w-full px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Usar Estratégia: Last Write Wins
          </button>
        </div>
      </div>

      <div className="resolution-stats">
        <h3 className="font-semibold mb-2">Estatísticas de Resolução</h3>
        <div className="bg-gray-100 p-3 rounded text-sm">
          <p>Estratégia atual: {conflictResolver.getStrategy()}</p>
          <p>Conflitos resolvidos: {conflictResolver.getStats().totalResolved}</p>
          <p>Por estratégia:</p>
          <ul className="ml-4">
            {Object.entries(conflictResolver.getStats().byStrategy).map(([strategy, count]) => (
              <li key={strategy}>{strategy}: {count}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderDatabaseTab = () => {
    const [dbStats, setDbStats] = useState<any>({});

    useEffect(() => {
      const loadStats = async () => {
        const stats = {
          users: await db.select({ count: sql`count(*)` }).from(users),
          issues: await db.select({ count: sql`count(*)` }).from(issues),
          syncQueue: await db.select({ count: sql`count(*)` }).from(syncQueue)
        };
        setDbStats(stats);
      };
      loadStats();
    }, []);

    return (
      <div className="space-y-4">
        <div className="db-stats">
          <h3 className="font-semibold mb-2">Estatísticas do Banco</h3>
          <div className="bg-gray-100 p-3 rounded text-sm">
            <p>Usuários: {dbStats.users?.[0]?.count || 0}</p>
            <p>Issues: {dbStats.issues?.[0]?.count || 0}</p>
            <p>Fila de Sync: {dbStats.syncQueue?.[0]?.count || 0}</p>
          </div>
        </div>

        <div className="db-actions">
          <h3 className="font-semibold mb-2">Ações do Banco</h3>
          <div className="space-y-2">
            <button
              onClick={async () => {
                log('warn', 'Limpando banco de dados...');
                if (confirm('Tem certeza? Isso apagará todos os dados locais!')) {
                  await db.delete(issues);
                  await db.delete(users);
                  await db.delete(syncQueue);
                  log('info', 'Banco de dados limpo');
                  window.location.reload();
                }
              }}
              className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Limpar Banco (PERIGOSO!)
            </button>
            <button
              onClick={exportDebugData}
              className="w-full px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Exportar Dados de Debug
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderNetworkTab = () => (
    <div className="space-y-4">
      <div className="network-status">
        <h3 className="font-semibold mb-2">Status de Rede</h3>
        <div className="bg-gray-100 p-3 rounded text-sm">
          <p>WebSocket: <span className={wsManager.isConnected() ? 'text-green-600' : 'text-red-600'}>
            {wsManager.isConnected() ? 'Conectado' : 'Desconectado'}
          </span></p>
          <p>Online: <span className={navigator.onLine ? 'text-green-600' : 'text-red-600'}>
            {navigator.onLine ? 'Sim' : 'Não'}
          </span></p>
        </div>
      </div>

      <div className="network-actions">
        <h3 className="font-semibold mb-2">Simulações de Rede</h3>
        <div className="space-y-2">
          <button
            onClick={simulateNetworkFailure}
            className="w-full px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Simular Falha de Rede (5s)
          </button>
          <button
            onClick={() => {
              log('info', 'Reconectando WebSocket...');
              wsManager.connect();
            }}
            className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Forçar Reconexão
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-50 px-4 py-2 bg-gray-800 text-white rounded-lg shadow-lg hover:bg-gray-700 flex items-center gap-2"
      >
        <span>🐛</span>
        <span>Debug</span>
      </button>

      {/* Painel Debug */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Debug Panel</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="bg-gray-100 border-b flex">
              {(['sync', 'conflicts', 'database', 'network'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 capitalize ${
                    activeTab === tab 
                      ? 'bg-white border-b-2 border-blue-500' 
                      : 'hover:bg-gray-200'
                  }`}
                >
                  {tab === 'sync' ? 'Sincronização' :
                   tab === 'conflicts' ? 'Conflitos' :
                   tab === 'database' ? 'Banco de Dados' : 'Rede'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              {activeTab === 'sync' && renderSyncTab()}
              {activeTab === 'conflicts' && renderConflictsTab()}
              {activeTab === 'database' && renderDatabaseTab()}
              {activeTab === 'network' && renderNetworkTab()}

              {/* Logs */}
              <div className="mt-6">
                <h3 className="font-semibold mb-2">Logs</h3>
                <div className="bg-gray-900 text-white p-3 rounded h-48 overflow-y-auto text-xs font-mono">
                  {logs.map((log, i) => (
                    <div key={i} className={`mb-1 ${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-yellow-400' : 'text-gray-300'
                    }`}>
                      [{new Date(log.timestamp).toLocaleTimeString('pt-BR')}] {log.level.toUpperCase()}: {log.message}
                      {log.data && <pre className="ml-4 text-gray-500">{JSON.stringify(log.data, null, 2)}</pre>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};