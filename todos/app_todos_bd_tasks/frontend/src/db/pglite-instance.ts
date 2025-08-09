import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../shared/schema';

// Type definitions
export interface EmergencyStore {
  data: Map<string, any>;
  isActive: boolean;
}

declare global {
  interface Window {
    emergencyStore: EmergencyStore;
    isEmergencyMode: boolean;
    showNotification?: (notification: {
      type: 'info' | 'warning' | 'error' | 'success';
      message: string;
      description?: string;
    }) => void;
  }
}

class PGliteManager {
  private static instance: PGlite | null = null;
  private static db: ReturnType<typeof drizzle> | null = null;
  private static initPromise: Promise<void> | null = null;
  private static isInitialized = false;
  private static retryCount = 0;
  private static maxRetries = 3;

  static async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.performInit();
    return this.initPromise;
  }

  private static async performInit(): Promise<void> {
    try {
      // Check browser support
      if (!window.indexedDB) {
        throw new Error('IndexedDB not supported in this browser');
      }

      // Check available storage
      const storageAvailable = await this.checkStorageAvailable();
      if (!storageAvailable) {
        throw new Error('Insufficient storage available');
      }

      console.log('Initializing PGlite...');

      // Initialize PGlite with optimized settings
      this.instance = new PGlite({
        dataDir: 'idb://app-todos-db',
        relaxedDurability: true, // Better performance for non-critical data
      });

      // Wait for PGlite to be ready
      await this.instance.waitReady;

      // Create Drizzle instance
      this.db = drizzle(this.instance, { schema });

      // Run migrations
      await this.runMigrations();

      // Mark as initialized
      this.isInitialized = true;
      this.retryCount = 0;

      console.log('PGlite initialized successfully');

      // Notify success
      if (window.showNotification) {
        window.showNotification({
          type: 'success',
          message: 'Banco de dados local inicializado',
          description: 'Aplicação pronta para uso offline'
        });
      }

    } catch (error) {
      console.error('Failed to initialize PGlite:', error);
      
      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying initialization (${this.retryCount}/${this.maxRetries})...`);
        this.initPromise = null;
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, this.retryCount) * 1000));
        
        return this.initialize();
      }
      
      // Activate emergency mode after all retries failed
      await this.activateEmergencyMode();
      throw error;
    }
  }

  private static async checkStorageAvailable(): Promise<boolean> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const { usage, quota } = await navigator.storage.estimate();
        const percentUsed = usage! / quota!;
        
        // Need at least 10% free space
        if (percentUsed > 0.9) {
          console.warn(`Storage nearly full: ${(percentUsed * 100).toFixed(2)}% used`);
          return false;
        }
      }
      return true;
    } catch {
      // If storage API not available, assume we have space
      return true;
    }
  }

  private static async runMigrations(): Promise<void> {
    if (!this.instance) throw new Error('PGlite not initialized');
    
    try {
      // Create tables based on schema
      await this.instance.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_sync_at TIMESTAMP,
          device_id TEXT
        );

        CREATE TABLE IF NOT EXISTS issues (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          priority TEXT NOT NULL DEFAULT 'medium',
          user_id UUID REFERENCES users(id),
          session_id TEXT,
          claude_task_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          version INTEGER DEFAULT 1,
          locally_modified BOOLEAN DEFAULT false,
          deleted_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          table_name TEXT NOT NULL,
          record_id UUID NOT NULL,
          operation TEXT NOT NULL,
          data JSONB NOT NULL,
          device_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          synced_at TIMESTAMP,
          error TEXT,
          retries INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sync_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          device_id TEXT NOT NULL,
          sync_type TEXT NOT NULL,
          latency INTEGER,
          record_count INTEGER,
          bytes_transferred INTEGER,
          success BOOLEAN NOT NULL,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
        CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues(user_id);
        CREATE INDEX IF NOT EXISTS idx_issues_session_id ON issues(session_id);
        CREATE INDEX IF NOT EXISTS idx_issues_updated_at ON issues(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_synced_at ON sync_queue(synced_at);
        CREATE INDEX IF NOT EXISTS idx_sync_metrics_created_at ON sync_metrics(created_at DESC);
      `);

      console.log('Database migrations completed');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  private static async activateEmergencyMode(): Promise<void> {
    console.warn('Activating emergency mode - using in-memory storage');
    
    // Initialize emergency store
    window.emergencyStore = {
      data: new Map(),
      isActive: true
    };
    window.isEmergencyMode = true;
    
    // Notify user
    if (window.showNotification) {
      window.showNotification({
        type: 'warning',
        message: 'Modo offline limitado ativado',
        description: 'Seus dados serão salvos temporariamente na memória'
      });
    }
    
    // Try to recover data from localStorage if available
    try {
      const savedData = localStorage.getItem('emergency_backup');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        Object.entries(parsed).forEach(([key, value]) => {
          window.emergencyStore.data.set(key, value);
        });
      }
    } catch (error) {
      console.error('Failed to recover emergency backup:', error);
    }
    
    // Save emergency data periodically
    setInterval(() => {
      if (window.emergencyStore?.isActive) {
        try {
          const dataToSave = Object.fromEntries(window.emergencyStore.data);
          localStorage.setItem('emergency_backup', JSON.stringify(dataToSave));
        } catch (error) {
          console.error('Failed to save emergency backup:', error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  static getDb(): ReturnType<typeof drizzle> {
    if (!this.db) {
      throw new Error('PGlite not initialized. Call initialize() first.');
    }
    return this.db;
  }

  static getInstance(): PGlite {
    if (!this.instance) {
      throw new Error('PGlite not initialized. Call initialize() first.');
    }
    return this.instance;
  }

  static isReady(): boolean {
    return this.isInitialized && !window.isEmergencyMode;
  }

  static isEmergencyMode(): boolean {
    return window.isEmergencyMode || false;
  }

  static async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'emergency';
    details: any;
  }> {
    if (window.isEmergencyMode) {
      return {
        status: 'emergency',
        details: {
          mode: 'in-memory',
          dataSize: window.emergencyStore?.data.size || 0
        }
      };
    }

    if (!this.isInitialized) {
      return {
        status: 'degraded',
        details: { reason: 'Not initialized' }
      };
    }

    try {
      // Test database connection
      const result = await this.instance!.query('SELECT 1');
      
      return {
        status: 'healthy',
        details: {
          connected: true,
          tablesReady: true
        }
      };
    } catch (error) {
      return {
        status: 'degraded',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  static async reset(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
    }
    
    this.instance = null;
    this.db = null;
    this.initPromise = null;
    this.isInitialized = false;
    this.retryCount = 0;
    
    // Clear emergency mode
    window.isEmergencyMode = false;
    if (window.emergencyStore) {
      window.emergencyStore.isActive = false;
      window.emergencyStore.data.clear();
    }
  }
}

// Create a proxy object for db that initializes on first use
const dbProxy = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    const actualDb = PGliteManager.getDb();
    return actualDb[prop as keyof typeof actualDb];
  }
});

// Export db directly
export const db = dbProxy;

// Also export PGliteManager
export { PGliteManager };

// Initialize database on module load
PGliteManager.initialize().catch(error => {
  console.error('Failed to initialize database:', error);
});