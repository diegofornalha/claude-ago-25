import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PGliteManager } from '../pglite-instance';

// Mock PGlite
vi.mock('@electric-sql/pglite', () => ({
  PGlite: vi.fn().mockImplementation(() => ({
    waitReady: Promise.resolve(),
    exec: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock drizzle
vi.mock('drizzle-orm/pglite', () => ({
  drizzle: vi.fn().mockReturnValue({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe('PGliteManager', () => {
  beforeEach(() => {
    // Reset window state
    delete (window as any).emergencyStore;
    delete (window as any).isEmergencyMode;
    delete (window as any).showNotification;
    
    // Reset manager state
    PGliteManager.reset();
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    
    // Mock indexedDB
    Object.defineProperty(window, 'indexedDB', {
      value: {},
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(PGliteManager.initialize()).resolves.not.toThrow();
      expect(PGliteManager.isReady()).toBe(true);
      expect(PGliteManager.isEmergencyMode()).toBe(false);
    });

    it('should handle missing indexedDB support', async () => {
      delete (window as any).indexedDB;
      
      await expect(PGliteManager.initialize()).rejects.toThrow('IndexedDB not supported');
      expect(window.isEmergencyMode).toBe(true);
    });

    it('should activate emergency mode after max retries', async () => {
      const mockError = new Error('Init failed');
      const PGliteMock = (await import('@electric-sql/pglite')).PGlite as any;
      PGliteMock.mockImplementationOnce(() => {
        throw mockError;
      });

      // Mock setTimeout to speed up test
      vi.useFakeTimers();

      const initPromise = PGliteManager.initialize();
      
      // Advance through retries
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(Math.pow(2, i + 1) * 1000);
      }

      await expect(initPromise).rejects.toThrow();
      expect(window.isEmergencyMode).toBe(true);
      expect(window.emergencyStore).toBeDefined();
      expect(window.emergencyStore!.isActive).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('emergency mode', () => {
    it('should save and recover data from localStorage', async () => {
      // Activate emergency mode
      delete (window as any).indexedDB;
      
      try {
        await PGliteManager.initialize();
      } catch {
        // Expected to fail
      }

      expect(window.isEmergencyMode).toBe(true);
      
      // Add data to emergency store
      window.emergencyStore!.data.set('test-key', { value: 'test-data' });
      
      // Simulate periodic save
      vi.useFakeTimers();
      vi.advanceTimersByTime(30000);
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'emergency_backup',
        expect.stringContaining('test-data')
      );
      
      vi.useRealTimers();
    });
  });

  describe('health checks', () => {
    it('should report healthy status when initialized', async () => {
      await PGliteManager.initialize();
      
      const health = await PGliteManager.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details.connected).toBe(true);
    });

    it('should report emergency status in emergency mode', async () => {
      window.isEmergencyMode = true;
      window.emergencyStore = {
        data: new Map([['key1', 'value1'], ['key2', 'value2']]),
        isActive: true,
      };
      
      const health = await PGliteManager.checkHealth();
      expect(health.status).toBe('emergency');
      expect(health.details.mode).toBe('in-memory');
      expect(health.details.dataSize).toBe(2);
    });

    it('should report degraded status when not initialized', async () => {
      const health = await PGliteManager.checkHealth();
      expect(health.status).toBe('degraded');
      expect(health.details.reason).toBe('Not initialized');
    });
  });

  describe('storage checks', () => {
    it('should check storage quota', async () => {
      // Mock navigator.storage.estimate
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 500 * 1024 * 1024, // 500MB
            quota: 1024 * 1024 * 1024, // 1GB
          }),
        },
        writable: true,
      });

      await expect(PGliteManager.initialize()).resolves.not.toThrow();
    });

    it('should fail when storage is nearly full', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 950 * 1024 * 1024, // 950MB
            quota: 1024 * 1024 * 1024, // 1GB (>90% used)
          }),
        },
        writable: true,
      });

      await expect(PGliteManager.initialize()).rejects.toThrow('Insufficient storage');
    });
  });

  describe('database operations', () => {
    it('should throw error when accessing db before initialization', () => {
      expect(() => PGliteManager.getDb()).toThrow('PGlite not initialized');
      expect(() => PGliteManager.getInstance()).toThrow('PGlite not initialized');
    });

    it('should return db instance after initialization', async () => {
      await PGliteManager.initialize();
      
      expect(() => PGliteManager.getDb()).not.toThrow();
      expect(() => PGliteManager.getInstance()).not.toThrow();
    });
  });

  describe('reset functionality', () => {
    it('should reset all state', async () => {
      await PGliteManager.initialize();
      expect(PGliteManager.isReady()).toBe(true);
      
      await PGliteManager.reset();
      
      expect(PGliteManager.isReady()).toBe(false);
      expect(() => PGliteManager.getDb()).toThrow();
      expect(window.isEmergencyMode).toBe(false);
    });
  });
});