import { useState, useEffect, useCallback } from 'react';
import { SyncEngine } from '../sync/sync-engine';
import { WebSocketManager } from '../sync/websocket-manager';

export interface DebugLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
  stack?: string;
}

export interface DebugState {
  logs: DebugLog[];
  filters: {
    level: Set<string>;
    category: Set<string>;
    search: string;
  };
  performance: {
    fps: number;
    memory: number;
    latency: Record<string, number>;
  };
}

export function useDebugLogger(maxLogs: number = 1000) {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [filters, setFilters] = useState({
    level: new Set<string>(['info', 'warn', 'error']),
    category: new Set<string>(),
    search: ''
  });

  const log = useCallback((
    level: DebugLog['level'],
    category: string,
    message: string,
    data?: any
  ) => {
    const newLog: DebugLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack: level === 'error' ? new Error().stack : undefined
    };

    setLogs(prev => [...prev, newLog].slice(-maxLogs));

    // Console output em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      const style = {
        info: 'color: blue',
        warn: 'color: orange',
        error: 'color: red',
        debug: 'color: gray'
      };
      
      console.log(
        `%c[${category}] ${message}`,
        style[level],
        data
      );
    }
  }, [maxLogs]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const exportLogs = useCallback(() => {
    const exportData = {
      timestamp: Date.now(),
      logs,
      filters: {
        level: Array.from(filters.level),
        category: Array.from(filters.category),
        search: filters.search
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs, filters]);

  const filteredLogs = logs.filter(log => {
    if (!filters.level.has(log.level)) return false;
    if (filters.category.size > 0 && !filters.category.has(log.category)) return false;
    if (filters.search && !log.message.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return {
    logs: filteredLogs,
    allLogs: logs,
    log,
    clearLogs,
    exportLogs,
    filters,
    setFilters
  };
}

export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState({
    fps: 60,
    memory: 0,
    latency: {} as Record<string, number>
  });

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        setMetrics(prev => ({
          ...prev,
          fps: Math.round((frameCount * 1000) / (currentTime - lastTime))
        }));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };

    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memory: memory.usedJSHeapSize
        }));
      }
    };

    // Iniciar medições
    measureFPS();
    const memoryInterval = setInterval(measureMemory, 1000);

    return () => {
      clearInterval(memoryInterval);
    };
  }, []);

  const measureLatency = useCallback((operation: string, startTime: number) => {
    const latency = performance.now() - startTime;
    setMetrics(prev => ({
      ...prev,
      latency: {
        ...prev.latency,
        [operation]: latency
      }
    }));
  }, []);

  return { metrics, measureLatency };
}

export function useDebugActions(
  syncEngine: SyncEngine,
  wsManager: WebSocketManager
) {
  const [isSimulating, setIsSimulating] = useState(false);

  const simulateSlowNetwork = useCallback(async (delayMs: number = 2000) => {
    setIsSimulating(true);
    
    // Interceptar fetch original
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return originalFetch(...args);
    };

    // Restaurar após 30 segundos
    setTimeout(() => {
      window.fetch = originalFetch;
      setIsSimulating(false);
    }, 30000);
  }, []);

  const simulateOffline = useCallback(() => {
    // Desconectar WebSocket
    wsManager.disconnect();
    
    // Simular offline no navigator
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false
    });

    // Disparar evento offline
    window.dispatchEvent(new Event('offline'));

    // Restaurar após 10 segundos
    setTimeout(() => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: true
      });
      window.dispatchEvent(new Event('online'));
      wsManager.connect();
    }, 10000);
  }, [wsManager]);

  const corruptLocalData = useCallback(async () => {
    if (!confirm('Isso corromperá dados locais para teste. Continuar?')) {
      return;
    }

    // Inserir dados inválidos no IndexedDB
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('TestCorruption', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const transaction = db.transaction(['test'], 'readwrite');
    const store = transaction.objectStore('test');
    
    // Inserir dados corrompidos
    store.put({ corrupted: true, data: null }, 'corrupted-key');
  }, []);

  const triggerMemoryLeak = useCallback(() => {
    const leakyArray: any[] = [];
    const interval = setInterval(() => {
      // Criar objetos grandes que não serão coletados
      for (let i = 0; i < 1000; i++) {
        leakyArray.push(new Array(1000).fill(Math.random()));
      }
    }, 100);

    // Parar após 5 segundos
    setTimeout(() => clearInterval(interval), 5000);
  }, []);

  return {
    isSimulating,
    simulateSlowNetwork,
    simulateOffline,
    corruptLocalData,
    triggerMemoryLeak
  };
}

export function useDebugShortcuts(actions: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + D para abrir debug
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        actions.toggleDebug?.();
      }

      // Outras combinações úteis
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        switch (e.key) {
          case 'L':
            e.preventDefault();
            actions.clearLogs?.();
            break;
          case 'E':
            e.preventDefault();
            actions.exportLogs?.();
            break;
          case 'S':
            e.preventDefault();
            actions.forceSync?.();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [actions]);
}