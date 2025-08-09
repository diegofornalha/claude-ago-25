import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface AutoSyncOptions {
  interval?: number; // em milliseconds (padrão: 30 segundos)
  enabled?: boolean;
  onSync?: () => void;
  onError?: (error: Error) => void;
}

export function useAutoSync(options: AutoSyncOptions = {}) {
  const {
    interval = 30000, // 30 segundos padrão
    enabled = true,
    onSync,
    onError
  } = options;

  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout>();

  const syncFromMCPCache = useCallback(async () => {
    try {
      console.log('🔄 Auto-sync: Verificando cache MCP...');
      
      // Tentar buscar do cache MCP
      const response = await fetch('/mcp-rag-cache/documents.json');
      if (!response.ok) throw new Error('Cache MCP não disponível');
      
      const data = await response.json();
      const documents = data.documents || [];
      
      // Filtrar apenas documentos A2A
      const a2aDocs = documents.filter((doc: any) => 
        doc.tags?.includes('a2a') || 
        doc.category?.includes('a2a') ||
        doc.source?.includes('a2a')
      );

      if (a2aDocs.length > 0) {
        // Salvar no IndexedDB local
        const db = await openIndexedDB();
        const tx = db.transaction(['documents'], 'readwrite');
        const store = tx.objectStore('documents');
        
        for (const doc of a2aDocs) {
          await store.put({
            ...doc,
            syncedAt: new Date().toISOString(),
            source: 'mcp-auto-sync'
          });
        }
        
        // Invalidar queries para atualizar UI
        queryClient.invalidateQueries({ queryKey: ['rag-documents'] });
        
        console.log(`✅ Auto-sync: ${a2aDocs.length} documentos sincronizados`);
        onSync?.();
      }
    } catch (error) {
      console.error('❌ Erro no auto-sync:', error);
      onError?.(error as Error);
    }
  }, [queryClient, onSync, onError]);

  // Função para sincronizar URLs pendentes
  const syncPendingUrls = useCallback(async () => {
    try {
      const pendingUrls = localStorage.getItem('pending-a2a-urls');
      if (!pendingUrls) return;
      
      const urls = JSON.parse(pendingUrls) as string[];
      if (urls.length === 0) return;
      
      console.log(`📥 Processando ${urls.length} URLs pendentes...`);
      
      // Processar URLs em lote
      for (const url of urls) {
        try {
          // Aqui você chamaria o WebFetch ou API apropriada
          await fetchAndStoreUrl(url);
          
          // Remover URL da lista de pendentes
          const remaining = urls.filter(u => u !== url);
          localStorage.setItem('pending-a2a-urls', JSON.stringify(remaining));
        } catch (err) {
          console.error(`Erro ao processar ${url}:`, err);
        }
      }
    } catch (error) {
      console.error('Erro ao processar URLs pendentes:', error);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Sync inicial
    syncFromMCPCache();
    syncPendingUrls();

    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      syncFromMCPCache();
      syncPendingUrls();
    }, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, syncFromMCPCache, syncPendingUrls]);

  // Retornar função para sync manual se necessário
  return {
    syncNow: syncFromMCPCache,
    syncUrls: syncPendingUrls
  };
}

// Função auxiliar para abrir IndexedDB
async function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RAGDatabase', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
    };
  });
}

// Função para buscar e armazenar URL
async function fetchAndStoreUrl(url: string): Promise<void> {
  // Implementar lógica de fetch
  // Pode usar WebFetch API ou outra abordagem
  console.log(`Buscando: ${url}`);
  // TODO: Implementar
}