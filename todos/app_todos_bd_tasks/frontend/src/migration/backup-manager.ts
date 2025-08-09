export interface BackupMetadata {
  id: string;
  timestamp: Date;
  version: string;
  size: number;
  dataKeys: string[];
  compressed: boolean;
}

export interface BackupData {
  metadata: BackupMetadata;
  data: Record<string, any>;
}

export class BackupManager {
  private static readonly BACKUP_PREFIX = 'app_backup_';
  private static readonly METADATA_KEY = 'backup_metadata';
  private static readonly MAX_BACKUPS = 5;
  private static readonly COMPRESSION_THRESHOLD = 100 * 1024; // 100KB

  /**
   * Create a new backup
   */
  static async createBackup(description?: string): Promise<string> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    
    // Collect all app data
    const data = this.collectAppData();
    const dataString = JSON.stringify(data);
    const size = new Blob([dataString]).size;
    
    // Compress if large
    const compressed = size > this.COMPRESSION_THRESHOLD;
    const finalData = compressed ? await this.compress(dataString) : dataString;
    
    // Create metadata
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      version: '1.0',
      size,
      dataKeys: Object.keys(data),
      compressed,
    };
    
    // Store backup
    this.storeBackup(backupId, finalData, metadata);
    
    // Clean old backups
    this.cleanOldBackups();
    
    return backupId;
  }

  /**
   * Restore from backup
   */
  static async restoreBackup(backupId: string): Promise<void> {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    // Clear current data
    this.clearAppData();
    
    // Restore data
    for (const [key, value] of Object.entries(backup.data)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
    
    // Mark restoration
    localStorage.setItem('last_restore', JSON.stringify({
      backupId,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * List all available backups
   */
  static listBackups(): BackupMetadata[] {
    const metadataStr = localStorage.getItem(this.METADATA_KEY);
    if (!metadataStr) return [];
    
    try {
      const metadata = JSON.parse(metadataStr);
      return Object.values(metadata)
        .sort((a: any, b: any) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    } catch {
      return [];
    }
  }

  /**
   * Delete a backup
   */
  static deleteBackup(backupId: string): void {
    // Remove backup data
    localStorage.removeItem(this.BACKUP_PREFIX + backupId);
    
    // Update metadata
    const metadata = this.getMetadata();
    delete metadata[backupId];
    this.saveMetadata(metadata);
  }

  /**
   * Export backup to file
   */
  static async exportBackup(backupId: string): Promise<void> {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${backup.metadata.timestamp.toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import backup from file
   */
  static async importBackup(file: File): Promise<string> {
    const text = await file.text();
    const backup: BackupData = JSON.parse(text);
    
    // Validate backup structure
    if (!backup.metadata || !backup.data) {
      throw new Error('Invalid backup file format');
    }
    
    // Generate new ID for imported backup
    const newId = this.generateBackupId();
    backup.metadata.id = newId;
    backup.metadata.timestamp = new Date();
    
    // Store imported backup
    const dataString = JSON.stringify(backup.data);
    this.storeBackup(newId, dataString, backup.metadata);
    
    return newId;
  }

  /**
   * Auto backup before risky operations
   */
  static async createAutoBackup(operation: string): Promise<string> {
    const backupId = await this.createBackup();
    
    // Store auto backup reference
    const autoBackups = this.getAutoBackups();
    autoBackups.push({
      id: backupId,
      operation,
      timestamp: new Date().toISOString(),
    });
    
    // Keep only last 10 auto backups
    if (autoBackups.length > 10) {
      const toRemove = autoBackups.shift();
      if (toRemove) {
        this.deleteBackup(toRemove.id);
      }
    }
    
    localStorage.setItem('auto_backups', JSON.stringify(autoBackups));
    
    return backupId;
  }

  /**
   * Verify backup integrity
   */
  static async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const backup = await this.getBackup(backupId);
      if (!backup) return false;
      
      // Check metadata consistency
      const actualSize = new Blob([JSON.stringify(backup.data)]).size;
      const tolerance = 0.1; // 10% tolerance for compression
      
      return Math.abs(actualSize - backup.metadata.size) / backup.metadata.size < tolerance;
    } catch {
      return false;
    }
  }

  // Private methods

  private static generateBackupId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static collectAppData(): Record<string, any> {
    const data: Record<string, any> = {};
    const appKeys = ['users', 'issues', 'tags', 'settings'];
    
    for (const key of appKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }
    
    return data;
  }

  private static clearAppData(): void {
    const appKeys = ['users', 'issues', 'tags', 'settings'];
    for (const key of appKeys) {
      localStorage.removeItem(key);
    }
  }

  private static async getBackup(backupId: string): Promise<BackupData | null> {
    const metadata = this.getMetadata()[backupId];
    if (!metadata) return null;
    
    const dataStr = localStorage.getItem(this.BACKUP_PREFIX + backupId);
    if (!dataStr) return null;
    
    const data = metadata.compressed 
      ? JSON.parse(await this.decompress(dataStr))
      : JSON.parse(dataStr);
    
    return { metadata, data };
  }

  private static storeBackup(id: string, data: string, metadata: BackupMetadata): void {
    // Store data
    localStorage.setItem(this.BACKUP_PREFIX + id, data);
    
    // Update metadata
    const allMetadata = this.getMetadata();
    allMetadata[id] = metadata;
    this.saveMetadata(allMetadata);
  }

  private static getMetadata(): Record<string, BackupMetadata> {
    const str = localStorage.getItem(this.METADATA_KEY);
    return str ? JSON.parse(str) : {};
  }

  private static saveMetadata(metadata: Record<string, BackupMetadata>): void {
    localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
  }

  private static cleanOldBackups(): void {
    const backups = this.listBackups();
    
    if (backups.length > this.MAX_BACKUPS) {
      const toRemove = backups.slice(this.MAX_BACKUPS);
      for (const backup of toRemove) {
        this.deleteBackup(backup.id);
      }
    }
  }

  private static getAutoBackups(): any[] {
    const str = localStorage.getItem('auto_backups');
    return str ? JSON.parse(str) : [];
  }

  private static async compress(data: string): Promise<string> {
    // Simple compression using browser's CompressionStream if available
    if ('CompressionStream' in window) {
      const encoder = new TextEncoder();
      const stream = new Response(
        new Blob([encoder.encode(data)]).stream().pipeThrough(
          new (window as any).CompressionStream('gzip')
        )
      );
      const compressed = await stream.blob();
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressed);
      });
    }
    
    // Fallback: no compression
    return data;
  }

  private static async decompress(data: string): Promise<string> {
    // Decompress if browser supports it
    if ('DecompressionStream' in window && data.startsWith('data:')) {
      const response = await fetch(data);
      const blob = await response.blob();
      const stream = new Response(
        blob.stream().pipeThrough(
          new (window as any).DecompressionStream('gzip')
        )
      );
      return await stream.text();
    }
    
    // Fallback: assume not compressed
    return data;
  }
}