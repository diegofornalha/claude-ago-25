import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePGlite, useDatabase } from '../usePGlite';

// Mock the lazy loader
vi.mock('../../db/pglite-lazy', () => ({
  PGliteLazyLoader: {
    getManager: vi.fn().mockResolvedValue({
      isReady: vi.fn().mockReturnValue(true),
      isEmergencyMode: vi.fn().mockReturnValue(false),
      checkHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        details: { connected: true },
      }),
    }),
  },
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe('usePGlite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize successfully', async () => {
    const { result } = renderHook(() => usePGlite());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isReady).toBe(false);

    // Wait for initialization
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should be ready
    expect(result.current.isReady).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isEmergencyMode).toBe(false);
    expect(result.current.healthStatus).toEqual({
      status: 'healthy',
      syncHealth: 'healthy',
      conflictRate: 0,
      averageLatency: 0,
      errorRate: 0,
      storageUsage: {
        used: 0,
        quota: 0,
        percentUsed: 0,
      },
      connected: true,
    });
  });

  it('should handle initialization errors', async () => {
    const mockError = new Error('Failed to initialize');
    const { PGliteLazyLoader } = await import('../../db/pglite-lazy');
    (PGliteLazyLoader.getManager as any).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => usePGlite());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });

  it('should handle emergency mode', async () => {
    const { PGliteLazyLoader } = await import('../../db/pglite-lazy');
    (PGliteLazyLoader.getManager as any).mockResolvedValueOnce({
      isReady: vi.fn().mockReturnValue(false),
      isEmergencyMode: vi.fn().mockReturnValue(true),
      checkHealth: vi.fn().mockResolvedValue({
        status: 'emergency',
        details: {
          mode: 'in-memory',
          dataSize: 5,
        },
      }),
    });

    const { result } = renderHook(() => usePGlite());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.isEmergencyMode).toBe(true);
    expect(result.current.healthStatus?.status).toBe('emergency');
  });

  it('should provide retry functionality', async () => {
    const mockError = new Error('Failed to initialize');
    const { PGliteLazyLoader } = await import('../../db/pglite-lazy');
    const getManagerMock = PGliteLazyLoader.getManager as any;
    
    // First call fails
    getManagerMock.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => usePGlite());

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
    });

    // Setup successful response for retry
    getManagerMock.mockResolvedValueOnce({
      isReady: vi.fn().mockReturnValue(true),
      isEmergencyMode: vi.fn().mockReturnValue(false),
      checkHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        details: { connected: true },
      }),
    });

    // Retry
    result.current.retry();

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });
});

describe('useDatabase', () => {
  it('should return database instance when ready', async () => {
    const mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const { getDb } = await import('../../db/pglite-lazy');
    (getDb as any).mockResolvedValue(mockDb);

    const { result } = renderHook(() => useDatabase());

    // Initially null
    expect(result.current).toBeNull();

    // Wait for database
    await waitFor(() => {
      expect(result.current).toEqual(mockDb);
    });
  });
});