import { useEffect, useState, useCallback } from 'react';
import { precacheManager } from '../service-worker/precache-manager';

export interface PrecacheStatus {
  isLoading: boolean;
  progress: number;
  totalAssets: number;
  cachedAssets: number;
  error: string | null;
}

export function usePrecache() {
  const [status, setStatus] = useState<PrecacheStatus>({
    isLoading: false,
    progress: 0,
    totalAssets: 0,
    cachedAssets: 0,
    error: null
  });

  const startPrecache = useCallback(async () => {
    setStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Iniciar precache
      await precacheManager.precacheAll();
      
      // Precache específico do RAG
      await precacheManager.precacheRAGAssets();
      
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        progress: 100,
        error: null
      }));
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erro ao fazer precache'
      }));
    }
  }, []);

  const getCacheStats = useCallback(async () => {
    try {
      const stats = await precacheManager.getCacheStats();
      return stats;
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }, []);

  const cleanupCache = useCallback(async () => {
    try {
      await precacheManager.cleanupOldCaches();
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }, []);

  // Auto precache ao montar o componente
  useEffect(() => {
    // Verificar se Service Worker está ativo
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        // Iniciar precache após 2 segundos
        setTimeout(startPrecache, 2000);
      });
    }
  }, [startPrecache]);

  return {
    status,
    startPrecache,
    getCacheStats,
    cleanupCache
  };
}

// Hook para precache de rotas específicas
export function useRoutePrecache(routes: string[]) {
  const [isPrecached, setIsPrecached] = useState(false);

  useEffect(() => {
    if (!('caches' in window) || routes.length === 0) return;

    const precacheRoutes = async () => {
      try {
        const cache = await caches.open('routes-cache');
        
        const uncachedRoutes = [];
        for (const route of routes) {
          const cached = await cache.match(route);
          if (!cached) {
            uncachedRoutes.push(route);
          }
        }

        if (uncachedRoutes.length > 0) {
          await cache.addAll(uncachedRoutes);
        }
        
        setIsPrecached(true);
      } catch (error) {
        console.error('Route precache failed:', error);
      }
    };

    precacheRoutes();
  }, [routes]);

  return isPrecached;
}

// Hook para precache de assets críticos baseado em visibilidade
export function useVisibilityPrecache(
  assetUrls: string[],
  options: {
    threshold?: number;
    rootMargin?: string;
  } = {}
) {
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [isPrecached, setIsPrecached] = useState(false);

  useEffect(() => {
    if (!ref || !('IntersectionObserver' in window) || assetUrls.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !isPrecached) {
          try {
            const cache = await caches.open('visibility-cache');
            await cache.addAll(assetUrls);
            setIsPrecached(true);
          } catch (error) {
            console.error('Visibility precache failed:', error);
          }
          observer.disconnect();
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '50px'
      }
    );

    observer.observe(ref);

    return () => observer.disconnect();
  }, [ref, assetUrls, isPrecached, options.threshold, options.rootMargin]);

  return { setRef, isPrecached };
}

// Hook para monitorar uso de cache
export function useCacheMonitor() {
  const [cacheUsage, setCacheUsage] = useState({
    used: 0,
    quota: 0,
    percentage: 0
  });

  useEffect(() => {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      return;
    }

    const checkUsage = async () => {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentage = quota > 0 ? (used / quota) * 100 : 0;

        setCacheUsage({ used, quota, percentage });
      } catch (error) {
        console.error('Failed to estimate storage:', error);
      }
    };

    checkUsage();
    const interval = setInterval(checkUsage, 60000); // A cada minuto

    return () => clearInterval(interval);
  }, []);

  return cacheUsage;
}