import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface SyncStatus {
  cache: {
    total: number;
    types: Record<string, number>;
  };
  database: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  };
  lastSync: string;
}

export function RAGSyncManager() {
  const [autoSync, setAutoSync] = useState(false);
  
  // Buscar status da sincronização
  const { data: status, isLoading, refetch } = useQuery<SyncStatus>({
    queryKey: ['rag-sync-status'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3344/api/rag/sync/status');
      if (!response.ok) throw new Error('Erro ao buscar status');
      const result = await response.json();
      return result.data;
    },
    refetchInterval: autoSync ? 30000 : false // Atualiza a cada 30s se auto sync ativo
  });
  
  // Mutation para sincronizar cache → DB
  const syncCacheToDb = useMutation({
    mutationFn: async () => {
      const response = await fetch('http://localhost:3344/api/rag/sync/cache-to-db', {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Erro na sincronização');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Sincronização concluída!');
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    }
  });
  
  // Mutation para verificar DB → Cache
  const syncDbToCache = useMutation({
    mutationFn: async () => {
      const response = await fetch('http://localhost:3344/api/rag/sync/db-to-cache', {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Erro na verificação');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.result.missing > 0) {
        toast.warning(`${data.result.missing} documentos precisam ser re-indexados`);
      } else {
        toast.success('Tudo sincronizado!');
      }
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    }
  });
  
  // Mutation para ativar sync automático
  const toggleAutoSync = useMutation({
    mutationFn: async () => {
      const response = await fetch('http://localhost:3344/api/rag/sync/auto', {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Erro ao configurar sync automático');
      return response.json();
    },
    onSuccess: () => {
      setAutoSync(true);
      toast.success('Sincronização automática ativada!');
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    }
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  const isSyncing = syncCacheToDb.isPending || syncDbToCache.isPending;
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">🔄 Sincronização RAG</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => {
                if (e.target.checked) {
                  toggleAutoSync.mutate();
                } else {
                  setAutoSync(false);
                }
              }}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-600">Auto-sync</span>
          </label>
          <button
            onClick={() => refetch()}
            className="text-gray-500 hover:text-gray-700"
            title="Atualizar status"
          >
            🔄
          </button>
        </div>
      </div>
      
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Cache Local */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            💾 Cache Local MCP
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              ~/.claude/mcp-rag-cache
            </span>
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total de documentos:</span>
              <span className="font-mono font-semibold">{status?.cache.total || 0}</span>
            </div>
            {status?.cache.types && Object.entries(status.cache.types).map(([type, count]) => (
              <div key={type} className="flex justify-between text-sm">
                <span className="text-gray-500 capitalize">{type}:</span>
                <span className="font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* PostgreSQL */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            🗄️ PostgreSQL
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              webfetch_docs
            </span>
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total de documentos:</span>
              <span className="font-mono font-semibold">{status?.database.total || 0}</span>
            </div>
            {status?.database.byCategory && Object.entries(status.database.byCategory).map(([cat, count]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-gray-500">{cat}:</span>
                <span className="font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Sync Actions */}
      <div className="border-t pt-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => syncCacheToDb.mutate()}
            disabled={isSyncing}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              isSyncing 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {syncCacheToDb.isPending ? (
              <>
                <span className="animate-spin inline-block mr-2">⏳</span>
                Sincronizando...
              </>
            ) : (
              <>
                📤 Cache → PostgreSQL
              </>
            )}
          </button>
          
          <button
            onClick={() => syncDbToCache.mutate()}
            disabled={isSyncing}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              isSyncing 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {syncDbToCache.isPending ? (
              <>
                <span className="animate-spin inline-block mr-2">⏳</span>
                Verificando...
              </>
            ) : (
              <>
                🔍 Verificar Sincronização
              </>
            )}
          </button>
        </div>
        
        {/* Last Sync Info */}
        {status?.lastSync && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Última atualização: {format(new Date(status.lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}
      </div>
      
      {/* Sync Results */}
      {(syncCacheToDb.data || syncDbToCache.data) && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">Resultado da Sincronização:</h4>
          <pre className="text-xs text-blue-700 overflow-auto">
            {JSON.stringify(syncCacheToDb.data?.result || syncDbToCache.data?.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}