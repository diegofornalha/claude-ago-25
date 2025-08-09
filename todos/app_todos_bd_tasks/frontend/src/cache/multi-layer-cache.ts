import { QueryClient } from '@tanstack/react-query';
import { getDb } from '../db/pglite-lazy';

export interface CacheOptions {
  layer1TTL?: number;  // React Query TTL (ms)
  layer2TTL?: number;  // PGlite TTL (ms)
  layer3TTL?: number;  // Remote cache TTL (ms)
}

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
}

export class MultiLayerCache {
  private queryClient: QueryClient;
  private defaultOptions: Required<CacheOptions> = {
    layer1TTL: 5 * 60 * 1000,      // 5 minutes in memory
    layer2TTL: 60 * 60 * 1000,     // 1 hour in PGlite
    layer3TTL: 24 * 60 * 60 * 1000, // 24 hours in remote
  };

  constructor(queryClient: QueryClient, options?: CacheOptions) {
    this.queryClient = queryClient;
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get data with multi-layer fallback
   */
  async get<T>(
    key: string | string[],
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cacheKey = Array.isArray(key) ? key : [key];
    const opts = { ...this.defaultOptions, ...options };

    // Layer 1: React Query (in-memory)
    const cached = this.queryClient.getQueryData<T>(cacheKey);
    if (cached !== undefined) {
      // Update access time
      this.queryClient.setQueryData(cacheKey, cached, {
        updatedAt: Date.now(),
      });
      return cached;
    }

    // Layer 2: PGlite (local persistent)
    try {
      const localData = await this.getFromPGlite<T>(cacheKey.join(':'));
      if (localData && !this.isExpired(localData, opts.layer2TTL)) {
        // Promote to Layer 1
        this.queryClient.setQueryData(cacheKey, localData.data);
        return localData.data;
      }
    } catch (error) {
      console.warn('Failed to read from PGlite cache:', error);
    }

    // Layer 3: Remote fetch
    try {
      const freshData = await fetcher();
      
      // Update all layers
      await this.setAllLayers(cacheKey, freshData, opts);
      
      return freshData;
    } catch (error) {
      // If fetch fails, return stale data if available
      if (cached !== undefined) {
        console.warn('Using stale cache due to fetch error:', error);
        return cached;
      }
      
      // Try stale PGlite data
      const staleLocal = await this.getFromPGlite<T>(cacheKey.join(':'));
      if (staleLocal) {
        console.warn('Using stale PGlite cache due to fetch error:', error);
        return staleLocal.data;
      }
      
      throw error;
    }
  }

  /**
   * Invalidate cache across all layers
   */
  async invalidate(key: string | string[]): Promise<void> {
    const cacheKey = Array.isArray(key) ? key : [key];
    
    // Layer 1: React Query
    await this.queryClient.invalidateQueries({ queryKey: cacheKey });
    
    // Layer 2: PGlite
    await this.removeFromPGlite(cacheKey.join(':'));
    
    // Emit invalidation event
    window.dispatchEvent(new CustomEvent('cache-invalidated', {
      detail: { key: cacheKey }
    }));
  }

  /**
   * Prefetch data into cache
   */
  async prefetch<T>(
    key: string | string[],
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<void> {
    const cacheKey = Array.isArray(key) ? key : [key];
    const opts = { ...this.defaultOptions, ...options };

    await this.queryClient.prefetchQuery({
      queryKey: cacheKey,
      queryFn: async () => {
        const data = await fetcher();
        
        // Also store in PGlite for offline
        await this.saveToPGlite(cacheKey.join(':'), data, opts.layer2TTL);
        
        return data;
      },
      staleTime: opts.layer1TTL,
    });
  }

  /**
   * Batch get with optimized fetching
   */
  async batchGet<T>(
    keys: string[][],
    batchFetcher: (keys: string[][]) => Promise<Map<string, T>>,
    options?: CacheOptions
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const missingKeys: string[][] = [];

    // Check Layer 1 for all keys
    for (const key of keys) {
      const cached = this.queryClient.getQueryData<T>(key);
      if (cached !== undefined) {
        results.set(key.join(':'), cached);
      } else {
        missingKeys.push(key);
      }
    }

    // Check Layer 2 for missing keys
    if (missingKeys.length > 0) {
      const pgLiteResults = await this.batchGetFromPGlite<T>(
        missingKeys.map(k => k.join(':'))
      );
      
      const stillMissing: string[][] = [];
      
      for (const key of missingKeys) {
        const keyStr = key.join(':');
        const cached = pgLiteResults.get(keyStr);
        
        if (cached && !this.isExpired(cached, options?.layer2TTL || this.defaultOptions.layer2TTL)) {
          results.set(keyStr, cached.data);
          // Promote to Layer 1
          this.queryClient.setQueryData(key, cached.data);
        } else {
          stillMissing.push(key);
        }
      }
      
      missingKeys.length = 0;
      missingKeys.push(...stillMissing);
    }

    // Fetch missing from remote
    if (missingKeys.length > 0) {
      const fetchedData = await batchFetcher(missingKeys);
      
      // Update all layers
      for (const [keyStr, data] of fetchedData.entries()) {
        const key = keyStr.split(':');
        results.set(keyStr, data);
        await this.setAllLayers(key, data, options);
      }
    }

    return results;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    layer1: { size: number; hits: number; misses: number };
    layer2: { size: number; entries: number };
    hitRate: number;
  }> {
    // Get React Query cache stats
    const queryCache = this.queryClient.getQueryCache();
    const queries = queryCache.getAll();
    
    // Count PGlite entries
    const pgLiteCount = await this.countPGliteEntries();
    
    // Calculate approximate sizes
    const layer1Size = queries.reduce((sum, query) => {
      const data = query.state.data;
      return sum + (data ? JSON.stringify(data).length : 0);
    }, 0);
    
    return {
      layer1: {
        size: layer1Size,
        hits: 0, // Would need custom tracking
        misses: 0,
      },
      layer2: {
        size: 0, // Would need to track
        entries: pgLiteCount,
      },
      hitRate: 0, // Would need custom tracking
    };
  }

  /**
   * Clear all cache layers
   */
  async clearAll(): Promise<void> {
    // Layer 1: React Query
    this.queryClient.clear();
    
    // Layer 2: PGlite
    await this.clearPGliteCache();
    
    console.log('All cache layers cleared');
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(
    keys: Array<{ key: string[]; fetcher: () => Promise<any> }>,
    options?: { parallel?: boolean }
  ): Promise<void> {
    const warmUpTasks = keys.map(({ key, fetcher }) => 
      this.prefetch(key, fetcher)
    );

    if (options?.parallel) {
      await Promise.all(warmUpTasks);
    } else {
      for (const task of warmUpTasks) {
        await task;
      }
    }
  }

  // Private methods

  private async setAllLayers<T>(
    key: string[],
    data: T,
    options: Required<CacheOptions>
  ): Promise<void> {
    // Layer 1: React Query
    this.queryClient.setQueryData(key, data);
    
    // Layer 2: PGlite
    await this.saveToPGlite(key.join(':'), data, options.layer2TTL);
  }

  private async getFromPGlite<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const db = await getDb();
      
      // Use a simple key-value table for caching
      const result = await db.execute(`
        SELECT data, timestamp, ttl 
        FROM cache_entries 
        WHERE key = ? 
        LIMIT 1
      `, [key]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        key,
        data: JSON.parse(row.data as string),
        timestamp: row.timestamp as number,
        ttl: row.ttl as number,
      };
    } catch (error) {
      // Table might not exist yet
      if (error.message.includes('cache_entries')) {
        await this.createCacheTable();
        return null;
      }
      throw error;
    }
  }

  private async saveToPGlite<T>(key: string, data: T, ttl: number): Promise<void> {
    const db = await getDb();
    
    await db.execute(`
      INSERT INTO cache_entries (key, data, timestamp, ttl)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET
        data = EXCLUDED.data,
        timestamp = EXCLUDED.timestamp,
        ttl = EXCLUDED.ttl
    `, [key, JSON.stringify(data), Date.now(), ttl]);
  }

  private async removeFromPGlite(key: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM cache_entries WHERE key = ?', [key]);
  }

  private async batchGetFromPGlite<T>(keys: string[]): Promise<Map<string, CacheEntry<T>>> {
    const db = await getDb();
    const results = new Map<string, CacheEntry<T>>();
    
    if (keys.length === 0) return results;
    
    const placeholders = keys.map(() => '?').join(',');
    const query = `
      SELECT key, data, timestamp, ttl 
      FROM cache_entries 
      WHERE key IN (${placeholders})
    `;
    
    const result = await db.execute(query, keys);
    
    for (const row of result.rows) {
      results.set(row.key as string, {
        key: row.key as string,
        data: JSON.parse(row.data as string),
        timestamp: row.timestamp as number,
        ttl: row.ttl as number,
      });
    }
    
    return results;
  }

  private async countPGliteEntries(): Promise<number> {
    try {
      const db = await getDb();
      const result = await db.execute('SELECT COUNT(*) as count FROM cache_entries');
      return result.rows[0]?.count || 0;
    } catch {
      return 0;
    }
  }

  private async clearPGliteCache(): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM cache_entries');
  }

  private async createCacheTable(): Promise<void> {
    const db = await getDb();
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        ttl INTEGER NOT NULL
      )
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_cache_timestamp 
      ON cache_entries(timestamp)
    `);
  }

  private isExpired(entry: CacheEntry, ttl: number): boolean {
    return Date.now() - entry.timestamp > ttl;
  }

  /**
   * Clean expired entries periodically
   */
  async cleanExpired(): Promise<number> {
    const db = await getDb();
    const now = Date.now();
    
    const result = await db.execute(`
      DELETE FROM cache_entries 
      WHERE timestamp + ttl < ?
    `, [now]);
    
    return result.rowCount || 0;
  }
}