import { db } from '../db/pglite-instance';
import { users, issues, syncQueue, syncMetrics } from '../shared/schema';
import { eq, gt, sql, desc } from 'drizzle-orm';
import { z } from 'zod';

const BackupMetadataSchema = z.object({
  version: z.number(),
  timestamp: z.number(),
  type: z.enum(['full', 'incremental']),
  checksum: z.string(),
  previousBackupId: z.string().optional(),
  tables: z.record(z.object({
    rowCount: z.number(),
    lastModified: z.number()
  }))
});

type BackupMetadata = z.infer<typeof BackupMetadataSchema>;

interface BackupChunk {
  id: string;
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

export class BackupManager {
  private readonly BACKUP_PREFIX = 'backup_';
  private readonly BACKUP_INDEX_KEY = 'backup_index';
  private readonly MAX_BACKUPS = 10;
  private readonly CHUNK_SIZE = 1000;
  private isBackingUp = false;
  private lastBackupTime = 0;
  private backupInterval: number | null = null;

  constructor(
    private autoBackupIntervalMs: number = 3600000, // 1 hora
    private retentionDays: number = 7
  ) {}

  async initialize(): Promise<void> {
    // Limpar backups antigos
    await this.cleanOldBackups();
    
    // Iniciar backup automático
    this.startAutoBackup();
    
    // Fazer backup inicial se não houver nenhum
    const hasBackup = await this.hasRecentBackup();
    if (!hasBackup) {
      await this.performBackup('full');
    }
  }

  private async hasRecentBackup(): Promise<boolean> {
    const index = await this.getBackupIndex();
    if (index.length === 0) return false;
    
    const mostRecent = index[0];
    const hoursSinceBackup = (Date.now() - mostRecent.timestamp) / (1000 * 60 * 60);
    return hoursSinceBackup < 24;
  }

  private startAutoBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = window.setInterval(async () => {
      try {
        await this.performBackup('incremental');
      } catch (error) {
        console.error('Auto backup failed:', error);
      }
    }, this.autoBackupIntervalMs);
  }

  async performBackup(type: 'full' | 'incremental' = 'incremental'): Promise<string> {
    if (this.isBackingUp) {
      throw new Error('Backup already in progress');
    }

    this.isBackingUp = true;
    const backupId = `${this.BACKUP_PREFIX}${Date.now()}`;

    try {
      const previousBackup = type === 'incremental' ? await this.getLastBackup() : null;
      const sinceTimestamp = previousBackup?.metadata.timestamp || 0;

      // Coletar dados
      const backupData = await this.collectBackupData(sinceTimestamp);
      
      // Criar metadados
      const metadata: BackupMetadata = {
        version: 1,
        timestamp: Date.now(),
        type,
        checksum: await this.calculateChecksum(backupData),
        previousBackupId: previousBackup?.id,
        tables: await this.getTableStats()
      };

      // Salvar backup em chunks
      await this.saveBackupChunks(backupId, metadata, backupData);
      
      // Atualizar índice
      await this.updateBackupIndex(backupId, metadata);
      
      this.lastBackupTime = Date.now();
      
      return backupId;
    } finally {
      this.isBackingUp = false;
    }
  }

  private async collectBackupData(sinceTimestamp: number): Promise<Record<string, any[]>> {
    const data: Record<string, any[]> = {};
    
    // Coletar usuários modificados
    data.users = await db
      .select()
      .from(users)
      .where(gt(users.updatedAt, new Date(sinceTimestamp)));
    
    // Coletar issues modificadas
    data.issues = await db
      .select()
      .from(issues)
      .where(gt(issues.updatedAt, new Date(sinceTimestamp)));
    
    // Coletar fila de sync
    data.syncQueue = await db
      .select()
      .from(syncQueue)
      .where(gt(syncQueue.createdAt, new Date(sinceTimestamp)));
    
    // Coletar métricas
    data.syncMetrics = await db
      .select()
      .from(syncMetrics)
      .where(gt(syncMetrics.timestamp, new Date(sinceTimestamp)));
    
    return data;
  }

  private async saveBackupChunks(
    backupId: string,
    metadata: BackupMetadata,
    data: Record<string, any[]>
  ): Promise<void> {
    const chunks: BackupChunk[] = [];
    let chunkIndex = 0;

    // Dividir dados em chunks
    for (const [tableName, records] of Object.entries(data)) {
      for (let i = 0; i < records.length; i += this.CHUNK_SIZE) {
        const chunk: BackupChunk = {
          id: `${backupId}_chunk_${chunkIndex++}`,
          metadata: chunkIndex === 0 ? metadata : { ...metadata, previousBackupId: undefined },
          data: {
            [tableName]: records.slice(i, i + this.CHUNK_SIZE)
          }
        };
        chunks.push(chunk);
      }
    }

    // Salvar chunks no IndexedDB
    for (const chunk of chunks) {
      await this.saveToIndexedDB(chunk.id, chunk);
    }

    // Salvar metadados principais
    await this.saveToIndexedDB(backupId, { metadata, chunkCount: chunks.length });
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backup = await this.loadFromIndexedDB(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    const { metadata, chunkCount } = backup;
    
    // Validar checksum
    const chunks: BackupChunk[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await this.loadFromIndexedDB(`${backupId}_chunk_${i}`);
      if (chunk) chunks.push(chunk);
    }

    // Restaurar dados
    await db.transaction(async (tx) => {
      for (const chunk of chunks) {
        for (const [tableName, records] of Object.entries(chunk.data)) {
          await this.restoreTable(tx, tableName, records);
        }
      }
    });
  }

  private async restoreTable(tx: any, tableName: string, records: any[]): Promise<void> {
    const tableMap: Record<string, any> = {
      users,
      issues,
      syncQueue,
      syncMetrics
    };

    const table = tableMap[tableName];
    if (!table) return;

    // Inserir ou atualizar registros
    for (const record of records) {
      await tx.insert(table)
        .values(record)
        .onConflictDoUpdate({
          target: table.id,
          set: record
        });
    }
  }

  async listBackups(): Promise<Array<{ id: string; metadata: BackupMetadata }>> {
    return await this.getBackupIndex();
  }

  async deleteBackup(backupId: string): Promise<void> {
    const backup = await this.loadFromIndexedDB(backupId);
    if (!backup) return;

    // Deletar chunks
    const { chunkCount } = backup;
    for (let i = 0; i < chunkCount; i++) {
      await this.deleteFromIndexedDB(`${backupId}_chunk_${i}`);
    }

    // Deletar backup principal
    await this.deleteFromIndexedDB(backupId);
    
    // Atualizar índice
    const index = await this.getBackupIndex();
    const newIndex = index.filter(b => b.id !== backupId);
    await this.saveToIndexedDB(this.BACKUP_INDEX_KEY, newIndex);
  }

  private async cleanOldBackups(): Promise<void> {
    const index = await this.getBackupIndex();
    const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    
    // Manter sempre pelo menos 1 backup full
    let hasFullBackup = false;
    const backupsToKeep: typeof index = [];
    const backupsToDelete: string[] = [];

    for (const backup of index) {
      if (backup.metadata.type === 'full' && !hasFullBackup) {
        backupsToKeep.push(backup);
        hasFullBackup = true;
      } else if (backup.metadata.timestamp > cutoffTime) {
        backupsToKeep.push(backup);
      } else if (backupsToKeep.length < this.MAX_BACKUPS) {
        backupsToKeep.push(backup);
      } else {
        backupsToDelete.push(backup.id);
      }
    }

    // Deletar backups antigos
    for (const backupId of backupsToDelete) {
      await this.deleteBackup(backupId);
    }

    // Atualizar índice
    await this.saveToIndexedDB(this.BACKUP_INDEX_KEY, backupsToKeep);
  }

  private async getBackupIndex(): Promise<Array<{ id: string; metadata: BackupMetadata }>> {
    const index = await this.loadFromIndexedDB(this.BACKUP_INDEX_KEY);
    return index || [];
  }

  private async updateBackupIndex(backupId: string, metadata: BackupMetadata): Promise<void> {
    const index = await this.getBackupIndex();
    index.unshift({ id: backupId, metadata });
    
    // Manter apenas os últimos backups
    const trimmedIndex = index.slice(0, this.MAX_BACKUPS * 2);
    
    await this.saveToIndexedDB(this.BACKUP_INDEX_KEY, trimmedIndex);
  }

  private async getLastBackup(): Promise<{ id: string; metadata: BackupMetadata } | null> {
    const index = await this.getBackupIndex();
    return index.length > 0 ? index[0] : null;
  }

  private async calculateChecksum(data: Record<string, any[]>): Promise<string> {
    const dataStr = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async getTableStats(): Promise<Record<string, { rowCount: number; lastModified: number }>> {
    const stats: Record<string, { rowCount: number; lastModified: number }> = {};
    
    // Users
    const userCount = await db.select({ count: sql`count(*)` }).from(users);
    const lastUser = await db.select().from(users).orderBy(desc(users.updatedAt)).limit(1);
    stats.users = {
      rowCount: Number(userCount[0]?.count || 0),
      lastModified: lastUser[0]?.updatedAt.getTime() || 0
    };
    
    // Issues
    const issueCount = await db.select({ count: sql`count(*)` }).from(issues);
    const lastIssue = await db.select().from(issues).orderBy(desc(issues.updatedAt)).limit(1);
    stats.issues = {
      rowCount: Number(issueCount[0]?.count || 0),
      lastModified: lastIssue[0]?.updatedAt.getTime() || 0
    };
    
    return stats;
  }

  // IndexedDB helpers
  private async saveToIndexedDB(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BackupDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups');
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['backups'], 'readwrite');
        const store = transaction.objectStore('backups');
        
        const putRequest = store.put(value, key);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
    });
  }

  private async loadFromIndexedDB(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BackupDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('backups')) {
          resolve(null);
          return;
        }
        
        const transaction = db.transaction(['backups'], 'readonly');
        const store = transaction.objectStore('backups');
        
        const getRequest = store.get(key);
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  private async deleteFromIndexedDB(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BackupDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['backups'], 'readwrite');
        const store = transaction.objectStore('backups');
        
        const deleteRequest = store.delete(key);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
    });
  }

  destroy(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }
}