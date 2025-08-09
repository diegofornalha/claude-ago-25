import { getDb } from '../db/pglite-lazy';
import { LocalStorageReader } from './localStorage-reader';
import { MigrationProgress } from './migration-progress';
import { issues, users } from '../shared/schema';
import type { MigrationProgress as MigrationProgressType } from '../shared/types';

export interface MigrationOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  onProgress?: (progress: MigrationProgressType) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class MigrationManager {
  private progress: MigrationProgress;
  private reader: LocalStorageReader;
  private abortController: AbortController | null = null;
  private isPaused = false;
  private pausePromise: Promise<void> | null = null;
  private pauseResolve: (() => void) | null = null;
  
  // State for resume capability
  private migrationState = {
    usersCompleted: false,
    issuesCompleted: false,
    lastProcessedUserIndex: 0,
    lastProcessedIssueIndex: 0,
  };

  private options: Required<MigrationOptions> = {
    batchSize: 100,
    delayBetweenBatches: 100,
    onProgress: () => {},
    onError: () => {},
    onComplete: () => {},
  };

  constructor(options?: MigrationOptions) {
    this.options = { ...this.options, ...options };
    this.progress = new MigrationProgress();
    this.reader = new LocalStorageReader();
    this.loadMigrationState();
  }

  /**
   * Start or resume migration
   */
  async migrate(): Promise<void> {
    // Check if already migrated
    if (this.isMigrated() && !this.hasIncompleteMigration()) {
      console.log('Data already migrated');
      this.options.onComplete();
      return;
    }

    try {
      this.abortController = new AbortController();
      
      // Show progress UI
      this.progress.show();
      
      // Validate data before migration
      const validation = this.reader.validateData();
      if (!validation.isValid) {
        throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Perform migration
      await this.performMigration();
      
      // Mark as completed
      this.markAsMigrated();
      
      // Hide progress UI
      this.progress.hide();
      
      // Notify completion
      this.options.onComplete();
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('Migration paused by user');
          this.saveMigrationState();
        } else {
          console.error('Migration failed:', error);
          this.options.onError(error);
          this.handleMigrationError(error);
        }
      }
    }
  }

  /**
   * Pause the migration
   */
  pause(): void {
    if (!this.abortController || this.isPaused) return;
    
    this.isPaused = true;
    this.pausePromise = new Promise(resolve => {
      this.pauseResolve = resolve;
    });
    
    this.progress.setPaused(true);
    console.log('Migration paused');
  }

  /**
   * Resume the migration
   */
  resume(): void {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    if (this.pauseResolve) {
      this.pauseResolve();
      this.pauseResolve = null;
      this.pausePromise = null;
    }
    
    this.progress.setPaused(false);
    console.log('Migration resumed');
  }

  /**
   * Cancel the migration
   */
  cancel(): void {
    this.abortController?.abort();
    this.saveMigrationState();
    this.progress.hide();
  }

  private async performMigration(): Promise<void> {
    const db = await getDb();
    
    // Analyze data size
    this.updateProgress({ step: 'Analisando dados...', percent: 0 });
    const dataInfo = await this.reader.analyzeData();
    const totalRecords = dataInfo.users.count + dataInfo.issues.count;
    
    // Migrate users if not completed
    if (!this.migrationState.usersCompleted) {
      this.updateProgress({ step: 'Migrando usuários...', percent: 10 });
      await this.migrateUsers(db, dataInfo.users.count);
      this.migrationState.usersCompleted = true;
      this.saveMigrationState();
    }
    
    // Migrate issues if not completed
    if (!this.migrationState.issuesCompleted) {
      this.updateProgress({ step: 'Migrando issues...', percent: 30 });
      await this.migrateIssuesInBatches(db, dataInfo.issues.count);
      this.migrationState.issuesCompleted = true;
      this.saveMigrationState();
    }
    
    // Verify migration
    this.updateProgress({ step: 'Verificando dados...', percent: 90 });
    await this.verifyMigration(db, dataInfo);
    
    // Create backup
    this.updateProgress({ step: 'Criando backup...', percent: 95 });
    await this.backupLocalStorage();
    
    this.updateProgress({ step: 'Concluído!', percent: 100 });
  }

  private async migrateUsers(db: any, totalCount: number): Promise<void> {
    const allUsers = await this.reader.getUsers();
    const startIndex = this.migrationState.lastProcessedUserIndex;
    
    for (let i = startIndex; i < allUsers.length; i++) {
      await this.checkPauseOrAbort();
      
      const user = allUsers[i];
      
      try {
        await db.insert(users).values({
          ...user,
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
          deviceId: this.getDeviceId(),
        });
        
        this.migrationState.lastProcessedUserIndex = i + 1;
        
        // Update progress
        const percent = 10 + (20 * (i + 1) / totalCount);
        this.updateProgress({
          step: `Migrando usuários... (${i + 1}/${totalCount})`,
          percent,
        });
      } catch (error) {
        console.error(`Failed to migrate user ${user.id}:`, error);
        this.progress.addError({
          record: user.id,
          error: String(error),
        });
      }
    }
  }

  private async migrateIssuesInBatches(db: any, totalCount: number): Promise<void> {
    const batchSize = this.options.batchSize;
    const startIndex = this.migrationState.lastProcessedIssueIndex;
    const batches = Math.ceil((totalCount - startIndex) / batchSize);
    
    for (let i = 0; i < batches; i++) {
      await this.checkPauseOrAbort();
      
      const offset = startIndex + (i * batchSize);
      const batch = await this.reader.getIssuesBatch(offset, batchSize);
      
      await db.transaction(async (tx: any) => {
        for (const issue of batch) {
          try {
            await tx.insert(issues).values({
              ...issue,
              status: issue.status || 'pending',
              priority: issue.priority || 'medium',
              version: 1,
              locallyModified: true,
              createdAt: issue.createdAt ? new Date(issue.createdAt) : new Date(),
              updatedAt: issue.updatedAt ? new Date(issue.updatedAt) : new Date(),
              completedAt: issue.completedAt ? new Date(issue.completedAt) : null,
              metadata: issue.metadata ? JSON.stringify(issue.metadata) : null,
            });
          } catch (error) {
            console.error(`Failed to migrate issue ${issue.id}:`, error);
            this.progress.addError({
              record: issue.id,
              error: String(error),
            });
          }
        }
      });
      
      this.migrationState.lastProcessedIssueIndex = offset + batch.length;
      
      // Update progress
      const processedTotal = offset + batch.length;
      const percent = 30 + (60 * processedTotal / totalCount);
      
      // Calculate time estimate
      const timePerRecord = this.progress.getElapsedTime() / processedTotal;
      const remainingRecords = totalCount - processedTotal;
      const estimatedTime = timePerRecord * remainingRecords;
      
      this.updateProgress({
        step: `Migrando issues... (${processedTotal}/${totalCount})`,
        percent,
        estimatedTime,
      });
      
      // Save state after each batch
      this.saveMigrationState();
      
      // Small delay to prevent UI blocking
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, this.options.delayBetweenBatches));
      }
    }
  }

  private async verifyMigration(db: any, dataInfo: any): Promise<void> {
    const [userCount] = await db.select({ count: db.count() }).from(users);
    const [issueCount] = await db.select({ count: db.count() }).from(issues);
    
    if (userCount.count < dataInfo.users.count || issueCount.count < dataInfo.issues.count) {
      console.warn('Migration verification: counts do not match');
      this.progress.addError({
        record: 'verification',
        error: 'Record counts do not match after migration',
      });
    }
  }

  private async backupLocalStorage(): Promise<void> {
    try {
      const backup = await this.reader.createBackup();
      const backupKey = `localStorage_backup_${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(backup));
      
      // Keep only last 3 backups
      this.cleanOldBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  }

  private cleanOldBackups(): void {
    const backupKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('localStorage_backup_'))
      .sort()
      .reverse();
    
    // Remove old backups (keep only 3)
    backupKeys.slice(3).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  private async checkPauseOrAbort(): Promise<void> {
    // Check if aborted
    if (this.abortController?.signal.aborted) {
      throw new Error('Migration aborted');
    }
    
    // Check if paused
    if (this.isPaused && this.pausePromise) {
      await this.pausePromise;
    }
  }

  private updateProgress(update: Partial<MigrationProgressType>): void {
    const currentProgress = this.progress.getProgress();
    const updatedProgress = { ...currentProgress, ...update };
    
    this.progress.update(updatedProgress);
    this.options.onProgress(updatedProgress);
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  private isMigrated(): boolean {
    return localStorage.getItem('pglite_migration_completed') === 'true';
  }

  private hasIncompleteMigration(): boolean {
    const state = this.loadMigrationState();
    return !state.usersCompleted || !state.issuesCompleted;
  }

  private markAsMigrated(): void {
    localStorage.setItem('pglite_migration_completed', 'true');
    localStorage.setItem('pglite_migration_date', new Date().toISOString());
    
    // Clear migration state
    localStorage.removeItem('pglite_migration_state');
    this.migrationState = {
      usersCompleted: true,
      issuesCompleted: true,
      lastProcessedUserIndex: 0,
      lastProcessedIssueIndex: 0,
    };
  }

  private saveMigrationState(): void {
    localStorage.setItem('pglite_migration_state', JSON.stringify(this.migrationState));
  }

  private loadMigrationState(): void {
    const saved = localStorage.getItem('pglite_migration_state');
    if (saved) {
      try {
        this.migrationState = JSON.parse(saved);
      } catch (error) {
        console.error('Failed to load migration state:', error);
      }
    }
  }

  private handleMigrationError(error: Error): void {
    this.progress.showError(error.message);
    
    // Save state for resume capability
    this.saveMigrationState();
    
    // Log detailed error
    console.error('Migration error details:', {
      error,
      state: this.migrationState,
      progress: this.progress.getProgress(),
    });
  }
}