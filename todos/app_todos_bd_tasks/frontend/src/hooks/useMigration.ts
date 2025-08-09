import { useState, useCallback, useEffect, useRef } from 'react';
import { MigrationManager } from '../migration/migration-manager';
import type { MigrationProgress } from '../shared/types';

interface UseMigrationReturn {
  isComplete: boolean;
  isRunning: boolean;
  isPaused: boolean;
  progress: MigrationProgress | null;
  error: Error | null;
  startMigration: () => Promise<void>;
  pauseMigration: () => void;
  resumeMigration: () => void;
  cancelMigration: () => void;
  retryMigration: () => Promise<void>;
}

export function useMigration(): UseMigrationReturn {
  const [isComplete, setIsComplete] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const managerRef = useRef<MigrationManager | null>(null);

  // Check if migration is already complete
  useEffect(() => {
    const migrationComplete = localStorage.getItem('pglite_migration_completed') === 'true';
    setIsComplete(migrationComplete);
  }, []);

  // Setup event listeners
  useEffect(() => {
    const handlePause = () => {
      if (managerRef.current) {
        managerRef.current.pause();
        setIsPaused(true);
      }
    };

    const handleResume = () => {
      if (managerRef.current) {
        managerRef.current.resume();
        setIsPaused(false);
      }
    };

    const handleRetry = () => {
      retryMigration();
    };

    window.addEventListener('migration-pause', handlePause);
    window.addEventListener('migration-resume', handleResume);
    window.addEventListener('migration-retry', handleRetry);

    return () => {
      window.removeEventListener('migration-pause', handlePause);
      window.removeEventListener('migration-resume', handleResume);
      window.removeEventListener('migration-retry', handleRetry);
    };
  }, []);

  const startMigration = useCallback(async () => {
    if (isRunning || isComplete) return;

    setIsRunning(true);
    setError(null);
    setProgress({
      currentStep: 'Iniciando migração...',
      totalRecords: 0,
      processedRecords: 0,
      percentComplete: 0,
      errors: [],
    });

    try {
      managerRef.current = new MigrationManager({
        batchSize: 100,
        delayBetweenBatches: 50,
        onProgress: (p) => {
          setProgress(p);
        },
        onError: (err) => {
          setError(err);
          setIsRunning(false);
        },
        onComplete: () => {
          setIsComplete(true);
          setIsRunning(false);
          setProgress(null);
          
          // Show success notification
          if (window.showNotification) {
            window.showNotification({
              type: 'success',
              message: 'Migração concluída!',
              description: 'Seus dados foram migrados com sucesso',
            });
          }
        },
      });

      await managerRef.current.migrate();
    } catch (err) {
      console.error('Migration failed:', err);
      setError(err instanceof Error ? err : new Error('Migration failed'));
      setIsRunning(false);
    }
  }, [isRunning, isComplete]);

  const pauseMigration = useCallback(() => {
    if (managerRef.current && isRunning && !isPaused) {
      managerRef.current.pause();
      setIsPaused(true);
    }
  }, [isRunning, isPaused]);

  const resumeMigration = useCallback(() => {
    if (managerRef.current && isRunning && isPaused) {
      managerRef.current.resume();
      setIsPaused(false);
    }
  }, [isRunning, isPaused]);

  const cancelMigration = useCallback(() => {
    if (managerRef.current && isRunning) {
      managerRef.current.cancel();
      setIsRunning(false);
      setIsPaused(false);
      setProgress(null);
    }
  }, [isRunning]);

  const retryMigration = useCallback(async () => {
    setError(null);
    await startMigration();
  }, [startMigration]);

  return {
    isComplete,
    isRunning,
    isPaused,
    progress,
    error,
    startMigration,
    pauseMigration,
    resumeMigration,
    cancelMigration,
    retryMigration,
  };
}