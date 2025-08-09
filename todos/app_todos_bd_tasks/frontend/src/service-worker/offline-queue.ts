import { db } from '../db/pglite-instance';
import { syncQueue } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface QueuedOperation {
  id?: string;
  type: 'create' | 'update' | 'delete' | 'sync';
  entity: 'user' | 'issue' | 'document' | 'embedding';
  data: any;
  timestamp: number;
  retries: number;
  lastError?: string;
}

export class OfflineQueue {
  private static instance: OfflineQueue;
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<(online: boolean) => void> = new Set();
  private processingQueue: boolean = false;

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
    }
    return OfflineQueue.instance;
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners(true);
      this.processQueue(); // Processar fila automaticamente
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners(false);
    });
  }

  async enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const queueItem: QueuedOperation = {
      ...operation,
      timestamp: Date.now(),
      retries: 0
    };

    // Salvar no banco local
    const [result] = await db.insert(syncQueue).values({
      operation: queueItem.type,
      entity: queueItem.entity,
      entityId: queueItem.data.id || `temp-${Date.now()}`,
      data: queueItem.data,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date()
    }).returning();

    // Se online, processar imediatamente
    if (this.isOnline) {
      this.processQueue();
    }

    return result.id;
  }

  async processQueue(): Promise<void> {
    if (this.processingQueue || !this.isOnline) {
      return;
    }

    this.processingQueue = true;

    try {
      // Buscar itens pendentes
      const pending = await db
        .select()
        .from(syncQueue)
        .where(eq(syncQueue.status, 'pending'))
        .orderBy(syncQueue.createdAt);

      for (const item of pending) {
        try {
          await this.processItem(item);
          
          // Marcar como processado
          await db
            .update(syncQueue)
            .set({ status: 'completed' })
            .where(eq(syncQueue.id, item.id));
            
        } catch (error) {
          console.error('Failed to process queue item:', error);
          
          // Incrementar contador de retry
          const newRetryCount = item.retryCount + 1;
          
          if (newRetryCount >= 3) {
            // Marcar como falha após 3 tentativas
            await db
              .update(syncQueue)
              .set({ 
                status: 'failed',
                retryCount: newRetryCount,
                lastError: error instanceof Error ? error.message : 'Unknown error'
              })
              .where(eq(syncQueue.id, item.id));
          } else {
            // Tentar novamente mais tarde
            await db
              .update(syncQueue)
              .set({ 
                retryCount: newRetryCount,
                lastError: error instanceof Error ? error.message : 'Unknown error'
              })
              .where(eq(syncQueue.id, item.id));
          }
        }
      }

      // Registrar sync com Service Worker se houver itens restantes
      const remaining = await this.getQueueSize();
      if (remaining > 0 && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_QUEUE',
          payload: { count: remaining }
        });
      }

    } finally {
      this.processingQueue = false;
    }
  }

  private async processItem(item: any): Promise<void> {
    const endpoint = this.getEndpoint(item.entity, item.operation);
    const method = this.getMethod(item.operation);

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Offline-Queue': 'true',
        'X-Original-Timestamp': item.createdAt.toString()
      },
      body: method !== 'GET' ? JSON.stringify(item.data) : undefined
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    // Para operações de criação, atualizar ID temporário
    if (item.operation === 'create' && item.entityId.startsWith('temp-')) {
      const result = await response.json();
      await this.updateTempId(item.entityId, result.id, item.entity);
    }
  }

  private getEndpoint(entity: string, operation: string): string {
    const baseUrl = process.env.REACT_APP_API_URL || '/api';
    
    const endpoints: Record<string, string> = {
      user: `${baseUrl}/users`,
      issue: `${baseUrl}/issues`,
      document: `${baseUrl}/documents`,
      embedding: `${baseUrl}/embeddings`
    };

    return endpoints[entity] || `${baseUrl}/${entity}`;
  }

  private getMethod(operation: string): string {
    const methods: Record<string, string> = {
      create: 'POST',
      update: 'PUT',
      delete: 'DELETE',
      sync: 'POST'
    };

    return methods[operation] || 'POST';
  }

  private async updateTempId(tempId: string, realId: string, entity: string): Promise<void> {
    // Atualizar referências do ID temporário para o ID real
    switch (entity) {
      case 'issue':
        await db.update(issues)
          .set({ id: realId })
          .where(eq(issues.id, tempId));
        break;
      
      case 'user':
        await db.update(users)
          .set({ id: realId })
          .where(eq(users.id, tempId));
        break;
        
      // Adicionar outros casos conforme necessário
    }
  }

  async getQueueSize(): Promise<number> {
    const result = await db
      .select({ count: sql`count(*)` })
      .from(syncQueue)
      .where(eq(syncQueue.status, 'pending'));
      
    return Number(result[0]?.count || 0);
  }

  async getQueueStatus(): Promise<{
    pending: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    const [pending] = await db
      .select({ count: sql`count(*)` })
      .from(syncQueue)
      .where(eq(syncQueue.status, 'pending'));
      
    const [completed] = await db
      .select({ count: sql`count(*)` })
      .from(syncQueue)
      .where(eq(syncQueue.status, 'completed'));
      
    const [failed] = await db
      .select({ count: sql`count(*)` })
      .from(syncQueue)
      .where(eq(syncQueue.status, 'failed'));

    const pendingCount = Number(pending?.count || 0);
    const completedCount = Number(completed?.count || 0);
    const failedCount = Number(failed?.count || 0);

    return {
      pending: pendingCount,
      completed: completedCount,
      failed: failedCount,
      total: pendingCount + completedCount + failedCount
    };
  }

  async clearCompleted(): Promise<void> {
    await db
      .delete(syncQueue)
      .where(eq(syncQueue.status, 'completed'));
  }

  async retryFailed(): Promise<void> {
    await db
      .update(syncQueue)
      .set({ 
        status: 'pending',
        retryCount: 0,
        lastError: null
      })
      .where(eq(syncQueue.status, 'failed'));
      
    if (this.isOnline) {
      this.processQueue();
    }
  }

  onOnlineStatusChange(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(online: boolean): void {
    this.listeners.forEach(listener => listener(online));
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // RAG-specific offline operations
  async queueEmbeddingGeneration(document: {
    id: string;
    content: string;
    metadata?: any;
  }): Promise<string> {
    return this.enqueue({
      type: 'create',
      entity: 'embedding',
      data: {
        documentId: document.id,
        content: document.content,
        metadata: document.metadata,
        // Placeholder embedding para busca offline
        embedding: Array(384).fill(0)
      }
    });
  }

  async queueDocumentSync(documents: any[]): Promise<void> {
    for (const doc of documents) {
      await this.enqueue({
        type: 'sync',
        entity: 'document',
        data: doc
      });
    }
  }

  // Verificar se um item está na fila
  async isQueued(entityId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(syncQueue)
      .where(eq(syncQueue.entityId, entityId))
      .where(eq(syncQueue.status, 'pending'));
      
    return result.length > 0;
  }
}

// Export singleton instance
export const offlineQueue = OfflineQueue.getInstance();