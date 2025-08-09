import React, { useState, useEffect } from 'react';
import { BackupManager } from './backup-manager';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BackupInfo {
  id: string;
  metadata: {
    version: number;
    timestamp: number;
    type: 'full' | 'incremental';
    checksum: string;
    previousBackupId?: string;
    tables: Record<string, { rowCount: number; lastModified: number }>;
  };
}

interface BackupUIProps {
  backupManager: BackupManager;
}

export const BackupUI: React.FC<BackupUIProps> = ({ backupManager }) => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);

  useEffect(() => {
    loadBackups();
    const interval = setInterval(loadBackups, 30000); // Atualizar a cada 30s
    return () => clearInterval(interval);
  }, []);

  const loadBackups = async () => {
    try {
      const backupList = await backupManager.listBackups();
      setBackups(backupList);
      if (backupList.length > 0) {
        setLastBackupTime(backupList[0].metadata.timestamp);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const performManualBackup = async (type: 'full' | 'incremental') => {
    setIsBackingUp(true);
    try {
      await backupManager.performBackup(type);
      await loadBackups();
    } catch (error) {
      console.error('Backup failed:', error);
      alert('Falha ao realizar backup: ' + error);
    } finally {
      setIsBackingUp(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Tem certeza que deseja restaurar este backup? Isso substituirá os dados atuais.')) {
      return;
    }

    try {
      await backupManager.restoreBackup(backupId);
      alert('Backup restaurado com sucesso!');
      window.location.reload();
    } catch (error) {
      console.error('Restore failed:', error);
      alert('Falha ao restaurar backup: ' + error);
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Tem certeza que deseja deletar este backup?')) {
      return;
    }

    try {
      await backupManager.deleteBackup(backupId);
      await loadBackups();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Falha ao deletar backup: ' + error);
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const calculateBackupSize = (backup: BackupInfo): number => {
    let totalRecords = 0;
    Object.values(backup.metadata.tables).forEach(table => {
      totalRecords += table.rowCount;
    });
    // Estimativa: ~200 bytes por registro
    return totalRecords * 200;
  };

  return (
    <div className="backup-manager p-4 bg-gray-50 rounded-lg">
      <div className="header mb-6">
        <h2 className="text-2xl font-bold mb-2">Gerenciador de Backup</h2>
        
        <div className="flex items-center justify-between mb-4">
          <div className="status">
            {lastBackupTime && (
              <p className="text-sm text-gray-600">
                Último backup: {formatDistanceToNow(lastBackupTime, { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            )}
          </div>
          
          <div className="controls flex gap-2">
            <button
              onClick={() => performManualBackup('incremental')}
              disabled={isBackingUp}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isBackingUp ? 'Fazendo backup...' : 'Backup Incremental'}
            </button>
            
            <button
              onClick={() => performManualBackup('full')}
              disabled={isBackingUp}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Backup Completo
            </button>
          </div>
        </div>

        <div className="auto-backup-toggle mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              className="mr-2"
            />
            <span>Backup automático ativado</span>
          </label>
        </div>
      </div>

      <div className="backup-list">
        <h3 className="text-lg font-semibold mb-3">Backups Disponíveis</h3>
        
        {backups.length === 0 ? (
          <p className="text-gray-500">Nenhum backup disponível</p>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className={`backup-item p-4 bg-white rounded border ${
                  selectedBackup === backup.id ? 'border-blue-500' : 'border-gray-200'
                } cursor-pointer hover:border-gray-300`}
                onClick={() => setSelectedBackup(backup.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="backup-info">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge px-2 py-1 text-xs rounded ${
                        backup.metadata.type === 'full' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {backup.metadata.type === 'full' ? 'Completo' : 'Incremental'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {new Date(backup.metadata.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      <p>Tamanho estimado: {formatBytes(calculateBackupSize(backup))}</p>
                      <p>Checksum: {backup.metadata.checksum.substring(0, 8)}...</p>
                    </div>
                    
                    <div className="tables-info mt-2">
                      <p className="text-xs font-semibold">Tabelas:</p>
                      <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                        {Object.entries(backup.metadata.tables).map(([table, info]) => (
                          <span key={table}>
                            {table}: {info.rowCount} registros
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="actions flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreBackup(backup.id);
                      }}
                      className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Restaurar
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBackup(backup.id);
                      }}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedBackup && (
        <div className="backup-details mt-6 p-4 bg-white rounded border border-gray-200">
          <h3 className="text-lg font-semibold mb-2">Detalhes do Backup</h3>
          {(() => {
            const backup = backups.find(b => b.id === selectedBackup);
            if (!backup) return null;
            
            return (
              <div className="space-y-2 text-sm">
                <p><strong>ID:</strong> {backup.id}</p>
                <p><strong>Versão:</strong> {backup.metadata.version}</p>
                <p><strong>Tipo:</strong> {backup.metadata.type}</p>
                <p><strong>Data:</strong> {new Date(backup.metadata.timestamp).toLocaleString('pt-BR')}</p>
                <p><strong>Checksum:</strong> <code className="text-xs">{backup.metadata.checksum}</code></p>
                {backup.metadata.previousBackupId && (
                  <p><strong>Backup anterior:</strong> {backup.metadata.previousBackupId}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};