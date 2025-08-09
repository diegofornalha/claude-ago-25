import type { PGliteManager } from './pglite-instance';

// Lazy loading wrapper for PGlite
class PGliteLazyLoader {
  private static managerPromise: Promise<typeof PGliteManager> | null = null;
  private static manager: typeof PGliteManager | null = null;

  /**
   * Dynamically import and initialize PGliteManager
   * This reduces initial bundle size by ~500KB
   */
  static async getManager(): Promise<typeof PGliteManager> {
    if (this.manager) {
      return this.manager;
    }

    if (!this.managerPromise) {
      this.managerPromise = this.loadManager();
    }

    return this.managerPromise;
  }

  private static async loadManager(): Promise<typeof PGliteManager> {
    try {
      // Show loading indicator
      if (window.showNotification) {
        window.showNotification({
          type: 'info',
          message: 'Carregando banco de dados...',
        });
      }

      // Dynamic import
      const { PGliteManager } = await import('./pglite-instance');
      this.manager = PGliteManager;

      // Initialize automatically
      await PGliteManager.initialize();

      return PGliteManager;
    } catch (error) {
      console.error('Failed to load PGliteManager:', error);
      
      // Fallback notification
      if (window.showNotification) {
        window.showNotification({
          type: 'error',
          message: 'Erro ao carregar banco de dados',
          description: 'Modo offline limitado ativado',
        });
      }

      throw error;
    }
  }

  /**
   * Pre-load PGlite in background (call after critical path)
   */
  static preload(): void {
    // Don't await, just trigger the load
    this.getManager().catch(error => {
      console.error('Background preload failed:', error);
    });
  }

  /**
   * Check if manager is loaded
   */
  static isLoaded(): boolean {
    return this.manager !== null;
  }

  /**
   * Get manager synchronously if already loaded
   */
  static getManagerSync(): typeof PGliteManager | null {
    return this.manager;
  }
}

// Convenience functions for common operations
export async function getDb() {
  const manager = await PGliteLazyLoader.getManager();
  return manager.getDb();
}

export async function getInstance() {
  const manager = await PGliteLazyLoader.getManager();
  return manager.getInstance();
}

export async function checkHealth() {
  const manager = await PGliteLazyLoader.getManager();
  return manager.checkHealth();
}

export async function isReady() {
  const manager = await PGliteLazyLoader.getManager();
  return manager.isReady();
}

export async function isEmergencyMode() {
  const manager = await PGliteLazyLoader.getManager();
  return manager.isEmergencyMode();
}

export { PGliteLazyLoader };