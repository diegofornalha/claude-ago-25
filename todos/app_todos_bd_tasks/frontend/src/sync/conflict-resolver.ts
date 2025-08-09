import type { SyncConflict, ConflictResolution } from '../shared/types';
import { getDb } from '../db/pglite-lazy';
import { syncConflicts } from '../shared/schema';

export interface ConflictData {
  local: any;
  remote: any;
  type: 'UPDATE_UPDATE' | 'UPDATE_DELETE' | 'DELETE_DELETE' | 'CREATE_CREATE';
}

export interface ResolvedConflict {
  tableName: string;
  recordId: string;
  data: any;
  resolution: ConflictResolution;
  autoResolved: boolean;
}

export class ConflictResolver {
  private strategies = {
    lastWriteWins: this.lastWriteWins.bind(this),
    remoteWins: this.remoteWins.bind(this),
    localWins: this.localWins.bind(this),
    merge: this.merge.bind(this),
  };

  /**
   * Resolve a conflict using configured strategy
   */
  async resolve(conflict: ConflictData): Promise<ResolvedConflict> {
    // Log conflict for debugging
    console.log('Resolving conflict:', conflict);
    
    // Store conflict in database
    const conflictRecord = await this.storeConflict(conflict);
    
    // Determine resolution strategy based on conflict type
    const strategy = this.getStrategyForConflict(conflict);
    
    // Apply strategy
    const resolved = await strategy(conflict);
    
    // Mark as auto-resolved if not requiring user input
    resolved.autoResolved = resolved.resolution !== 'USER_DECISION';
    
    // Update conflict record if auto-resolved
    if (resolved.autoResolved && conflictRecord) {
      await this.markResolved(conflictRecord.id, resolved.resolution);
    }
    
    return resolved;
  }

  /**
   * Get unresolved conflicts for user resolution
   */
  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    const db = await getDb();
    
    return await db
      .select()
      .from(syncConflicts)
      .where(isNull(syncConflicts.resolvedAt))
      .orderBy(desc(syncConflicts.createdAt));
  }

  /**
   * Apply user resolution to conflict
   */
  async applyUserResolution(
    conflictId: string,
    resolution: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MERGED',
    mergedData?: any
  ): Promise<void> {
    const db = await getDb();
    
    // Get conflict details
    const [conflict] = await db
      .select()
      .from(syncConflicts)
      .where(eq(syncConflicts.id, conflictId))
      .limit(1);
    
    if (!conflict) {
      throw new Error('Conflict not found');
    }
    
    // Determine final data based on resolution
    let finalData: any;
    
    switch (resolution) {
      case 'LOCAL_WINS':
        finalData = conflict.localData;
        break;
      case 'REMOTE_WINS':
        finalData = conflict.remoteData;
        break;
      case 'MERGED':
        finalData = mergedData || this.mergeData(conflict.localData, conflict.remoteData);
        break;
    }
    
    // Apply resolution to the actual table
    await this.applyDataToTable(conflict.tableName, conflict.recordId, finalData);
    
    // Mark conflict as resolved
    await this.markResolved(conflictId, resolution);
  }

  private async storeConflict(conflict: ConflictData): Promise<{ id: string } | null> {
    try {
      const db = await getDb();
      
      const [result] = await db.insert(syncConflicts).values({
        tableName: conflict.local.tableName || conflict.remote.tableName,
        recordId: conflict.local.id || conflict.remote.id,
        localData: conflict.local,
        remoteData: conflict.remote,
        conflictType: conflict.type,
      }).returning({ id: syncConflicts.id });
      
      return result;
    } catch (error) {
      console.error('Failed to store conflict:', error);
      return null;
    }
  }

  private async markResolved(conflictId: string, resolution: ConflictResolution): Promise<void> {
    const db = await getDb();
    
    await db
      .update(syncConflicts)
      .set({
        resolvedAt: new Date(),
        resolution,
      })
      .where(eq(syncConflicts.id, conflictId));
  }

  private getStrategyForConflict(conflict: ConflictData): Function {
    // Default strategies based on conflict type
    switch (conflict.type) {
      case 'DELETE_DELETE':
        // Both deleted - no conflict really
        return this.remoteWins;
        
      case 'UPDATE_DELETE':
        // Prefer updates over deletes by default
        return this.localWins;
        
      case 'CREATE_CREATE':
        // Rare with UUIDs - merge if possible
        return this.merge;
        
      case 'UPDATE_UPDATE':
      default:
        // Use configured strategy or last write wins
        const strategy = this.getConfiguredStrategy();
        return this.strategies[strategy] || this.lastWriteWins;
    }
  }

  private getConfiguredStrategy(): string {
    // Get from user settings or environment
    return localStorage.getItem('conflictResolution') || 'lastWriteWins';
  }

  private lastWriteWins(conflict: ConflictData): ResolvedConflict {
    const localTime = new Date(conflict.local.updatedAt || conflict.local.createdAt).getTime();
    const remoteTime = new Date(conflict.remote.updatedAt || conflict.remote.createdAt).getTime();
    
    const winner = localTime > remoteTime ? conflict.local : conflict.remote;
    const resolution: ConflictResolution = localTime > remoteTime ? 'LOCAL_WINS' : 'REMOTE_WINS';
    
    return {
      tableName: winner.tableName || conflict.local.tableName,
      recordId: winner.id || conflict.local.id,
      data: winner,
      resolution,
      autoResolved: true,
    };
  }

  private remoteWins(conflict: ConflictData): ResolvedConflict {
    return {
      tableName: conflict.remote.tableName || conflict.local.tableName,
      recordId: conflict.remote.id || conflict.local.id,
      data: conflict.remote,
      resolution: 'REMOTE_WINS',
      autoResolved: true,
    };
  }

  private localWins(conflict: ConflictData): ResolvedConflict {
    return {
      tableName: conflict.local.tableName || conflict.remote.tableName,
      recordId: conflict.local.id || conflict.remote.id,
      data: conflict.local,
      resolution: 'LOCAL_WINS',
      autoResolved: true,
    };
  }

  private merge(conflict: ConflictData): ResolvedConflict {
    // Simple field-level merge
    const merged = this.mergeData(conflict.local, conflict.remote);
    
    // If merge is too complex, require user decision
    if (this.isMergeComplex(conflict.local, conflict.remote)) {
      return {
        tableName: conflict.local.tableName || conflict.remote.tableName,
        recordId: conflict.local.id || conflict.remote.id,
        data: merged,
        resolution: 'USER_DECISION',
        autoResolved: false,
      };
    }
    
    return {
      tableName: conflict.local.tableName || conflict.remote.tableName,
      recordId: conflict.local.id || conflict.remote.id,
      data: merged,
      resolution: 'MERGED',
      autoResolved: true,
    };
  }

  private mergeData(local: any, remote: any): any {
    const merged = { ...remote };
    
    // Merge non-conflicting fields
    for (const [key, value] of Object.entries(local)) {
      if (remote[key] === undefined || remote[key] === null) {
        // Remote doesn't have this field
        merged[key] = value;
      } else if (key === 'updatedAt' || key === 'version') {
        // Use latest for metadata fields
        merged[key] = new Date(local[key]) > new Date(remote[key]) ? local[key] : remote[key];
      } else if (local[key] !== remote[key]) {
        // Conflict - for now, prefer local for user-generated content
        if (key === 'title' || key === 'description' || key === 'content') {
          merged[key] = local[key];
        }
      }
    }
    
    // Update version
    merged.version = Math.max(local.version || 0, remote.version || 0) + 1;
    merged.updatedAt = new Date();
    
    return merged;
  }

  private isMergeComplex(local: any, remote: any): boolean {
    // Check if there are conflicting changes in critical fields
    const criticalFields = ['title', 'status', 'priority'];
    
    for (const field of criticalFields) {
      if (local[field] && remote[field] && local[field] !== remote[field]) {
        // Both have different values for critical field
        return true;
      }
    }
    
    return false;
  }

  private async applyDataToTable(tableName: string, recordId: string, data: any): Promise<void> {
    const db = await getDb();
    
    // Dynamic update based on table
    // In real implementation, you'd use proper typed tables
    await db.execute(`
      UPDATE ${tableName}
      SET ${Object.keys(data).map(k => `${k} = ?`).join(', ')}
      WHERE id = ?
    `, [...Object.values(data), recordId]);
  }
}

// Missing imports
import { eq, isNull, desc } from 'drizzle-orm';