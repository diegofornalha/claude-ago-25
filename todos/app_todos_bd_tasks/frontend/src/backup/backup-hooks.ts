import { useEffect, useRef, useState } from 'react';
import { BackupManager } from './backup-manager';
import { useQueryClient } from '@tanstack/react-query';

export interface BackupStatus {
  isBackingUp: boolean;
  lastBackupTime: number | null;
  nextBackupTime: number | null;
  backupCount: number;
  totalSize: number;
}

export function useBackupManager(
  autoBackupInterval?: number,
  retentionDays?: number
) {
  const [status, setStatus] = useState<BackupStatus>({
    isBackingUp: false,
    lastBackupTime: null,
    nextBackupTime: null,
    backupCount: 0,
    totalSize: 0
  });
  
  const managerRef = useRef<BackupManager | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const manager = new BackupManager(autoBackupInterval, retentionDays);
    managerRef.current = manager;

    // Inicializar
    manager.initialize().then(() => {
      updateStatus();
    });

    // Atualizar status periodicamente
    const statusInterval = setInterval(updateStatus, 30000);

    return () => {
      clearInterval(statusInterval);
      manager.destroy();
    };
  }, [autoBackupInterval, retentionDays]);

  const updateStatus = async () => {
    if (!managerRef.current) return;

    try {
      const backups = await managerRef.current.listBackups();
      const lastBackup = backups[0];
      
      let totalSize = 0;
      backups.forEach(backup => {
        Object.values(backup.metadata.tables).forEach(table => {
          totalSize += table.rowCount * 200; // Estimativa
        });
      });

      setStatus(prev => ({
        ...prev,
        lastBackupTime: lastBackup?.metadata.timestamp || null,
        nextBackupTime: lastBackup 
          ? lastBackup.metadata.timestamp + (autoBackupInterval || 3600000)
          : null,
        backupCount: backups.length,
        totalSize
      }));
    } catch (error) {
      console.error('Failed to update backup status:', error);
    }
  };

  const performBackup = async (type: 'full' | 'incremental' = 'incremental') => {
    if (!managerRef.current) return;

    setStatus(prev => ({ ...prev, isBackingUp: true }));
    
    try {
      const backupId = await managerRef.current.performBackup(type);
      
      // Invalidar queries para forçar recarregamento
      queryClient.invalidateQueries();
      
      await updateStatus();
      
      return backupId;
    } finally {
      setStatus(prev => ({ ...prev, isBackingUp: false }));
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!managerRef.current) return;

    await managerRef.current.restoreBackup(backupId);
    
    // Invalidar todas as queries
    queryClient.clear();
    
    // Recarregar a página para garantir estado limpo
    window.location.reload();
  };

  const deleteBackup = async (backupId: string) => {
    if (!managerRef.current) return;

    await managerRef.current.deleteBackup(backupId);
    await updateStatus();
  };

  const listBackups = async () => {
    if (!managerRef.current) return [];
    return await managerRef.current.listBackups();
  };

  return {
    status,
    performBackup,
    restoreBackup,
    deleteBackup,
    listBackups,
    backupManager: managerRef.current
  };
}

// Hook para monitorar espaço de backup
export function useBackupStorage() {
  const [storage, setStorage] = useState({
    used: 0,
    quota: 0,
    percentage: 0
  });

  useEffect(() => {
    const checkStorage = async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentage = quota > 0 ? (used / quota) * 100 : 0;

        setStorage({ used, quota, percentage });
      }
    };

    checkStorage();
    const interval = setInterval(checkStorage, 60000); // A cada minuto

    return () => clearInterval(interval);
  }, []);

  return storage;
}

// Hook para backup automático antes de mudanças críticas
export function useAutoBackupOnChange(
  triggerFn: () => boolean,
  dependencies: any[] = []
) {
  const { performBackup } = useBackupManager();
  const previousValueRef = useRef<any>();

  useEffect(() => {
    const currentValue = JSON.stringify(dependencies);
    
    if (previousValueRef.current && 
        previousValueRef.current !== currentValue && 
        triggerFn()) {
      // Fazer backup incremental antes da mudança
      performBackup('incremental').catch(console.error);
    }
    
    previousValueRef.current = currentValue;
  }, dependencies);
}