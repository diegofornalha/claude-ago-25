import { useEffect, useState, useCallback } from 'react';
import { PGliteLazyLoader, getDb } from '../db/pglite-lazy';
import type { HealthStatus } from '../shared/types';

interface UsePGliteReturn {
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  isEmergencyMode: boolean;
  healthStatus: HealthStatus | null;
  retry: () => void;
}

export function usePGlite(): UsePGliteReturn {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const manager = await PGliteLazyLoader.getManager();
      
      // Check if ready
      const ready = manager.isReady();
      setIsReady(ready);
      
      // Check emergency mode
      const emergency = manager.isEmergencyMode();
      setIsEmergencyMode(emergency);
      
      // Get health status
      const health = await manager.checkHealth();
      setHealthStatus({
        status: health.status,
        syncHealth: health.status === 'healthy' ? 'healthy' : 'degraded',
        conflictRate: 0,
        averageLatency: 0,
        errorRate: 0,
        storageUsage: {
          used: 0,
          quota: 0,
          percentUsed: 0,
        },
        ...health.details,
      });

    } catch (err) {
      console.error('Failed to initialize PGlite:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsReady(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const retry = useCallback(() => {
    initialize();
  }, [initialize]);

  return {
    isReady,
    isLoading,
    error,
    isEmergencyMode,
    healthStatus,
    retry,
  };
}

// Hook for database operations
export function useDatabase() {
  const { isReady, error } = usePGlite();
  const [db, setDb] = useState<Awaited<ReturnType<typeof getDb>> | null>(null);

  useEffect(() => {
    if (isReady && !error) {
      getDb().then(setDb).catch(console.error);
    }
  }, [isReady, error]);

  return db;
}