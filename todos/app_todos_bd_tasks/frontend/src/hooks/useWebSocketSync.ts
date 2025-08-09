import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface WebSocketSyncOptions {
  enabled?: boolean;
  wsUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onSync?: () => void;
  onError?: (error: Error) => void;
}

interface SyncData {
  documents: any[];
  metadata: {
    total: number;
    lastSync: string;
    source: string;
  };
}

export function useWebSocketSync(options: WebSocketSyncOptions = {}) {
  const {
    enabled = true,
    wsUrl = 'ws://localhost:8766',
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    onSync,
    onError
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncCount, setSyncCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  const queryClient = useQueryClient();

  // Função para salvar no IndexedDB
  const saveToIndexedDB = useCallback(async (documents: any[]) => {
    try {
      const dbName = 'rag-cache';
      const storeName = 'documents';
      
      // Abrir conexão com IndexedDB
      const request = indexedDB.open(dbName, 1);
      
      request.onerror = () => {
        throw new Error('Erro ao abrir IndexedDB');
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // Limpar store antigo
        store.clear();
        
        // Adicionar novos documentos
        documents.forEach(doc => {
          store.add(doc);
        });
        
        transaction.oncomplete = () => {
          console.log(`✅ ${documents.length} documentos salvos no IndexedDB`);
          queryClient.invalidateQueries({ queryKey: ['rag-documents'] });
        };
      };
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      
    } catch (error) {
      console.error('Erro ao salvar no IndexedDB:', error);
      throw error;
    }
  }, [queryClient]);

  // Processar mensagem de sincronização
  const processSyncMessage = useCallback(async (data: SyncData) => {
    try {
      const { documents, metadata } = data;
      
      // Salvar no IndexedDB
      await saveToIndexedDB(documents);
      
      // Atualizar estado
      setLastSync(new Date(metadata.lastSync));
      setSyncCount(prev => prev + 1);
      
      // Notificar sucesso
      toast.success(`Sincronizado! ${metadata.total} documentos A2A`, {
        description: 'Cache atualizado em tempo real'
      });
      
      // Callback opcional
      onSync?.();
      
    } catch (error) {
      console.error('Erro ao processar sincronização:', error);
      onError?.(error as Error);
    }
  }, [saveToIndexedDB, onSync, onError]);

  // Conectar ao WebSocket
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      console.log(`🔌 Conectando ao WebSocket: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket conectado');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        
        // Limpar timeout de reconexão
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        toast.success('Sincronização em tempo real ativada', {
          description: 'Mudanças serão detectadas instantaneamente'
        });
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Mensagem recebida:', message.type);
          
          if (message.type === 'initial' || message.type === 'sync') {
            await processSyncMessage(message.data);
          } else if (message.type === 'pong') {
            console.log('🏓 Pong recebido');
          }
          
        } catch (error) {
          console.error('Erro ao processar mensagem:', error);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ Erro no WebSocket:', event);
        const err = new Error('Erro na conexão WebSocket');
        setError(err);
        onError?.(err);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket desconectado');
        setIsConnected(false);
        wsRef.current = null;
        
        // Tentar reconectar se ainda estiver habilitado
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Tentando reconectar (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          toast.error('Não foi possível conectar ao servidor de sincronização', {
            description: 'Verifique se o servidor está rodando'
          });
        }
      };

    } catch (error) {
      console.error('Erro ao criar WebSocket:', error);
      setError(error as Error);
      onError?.(error as Error);
    }
  }, [enabled, wsUrl, reconnectInterval, maxReconnectAttempts, processSyncMessage, onError]);

  // Desconectar WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    setIsConnected(false);
  }, []);

  // Enviar ping para manter conexão viva
  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  // Solicitar sincronização manual
  const requestSync = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'request_sync',
        timestamp: new Date().toISOString()
      }));
      
      toast.info('Solicitando sincronização...');
    } else {
      toast.error('WebSocket não está conectado');
    }
  }, []);

  // Efeito para conectar/desconectar
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }
    
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Efeito para manter conexão viva com ping
  useEffect(() => {
    if (!isConnected) return;
    
    const pingInterval = setInterval(sendPing, 30000); // Ping a cada 30s
    
    return () => {
      clearInterval(pingInterval);
    };
  }, [isConnected, sendPing]);

  return {
    isConnected,
    lastSync,
    syncCount,
    error,
    requestSync,
    disconnect,
    reconnect: connect
  };
}