export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private listeners: Set<(update: boolean) => void> = new Set();

  async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return;
    }

    try {
      // Registrar Service Worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', this.registration);

      // Verificar atualizações
      this.setupUpdateListener();
      
      // Verificar periodicamente por atualizações
      setInterval(() => {
        this.registration?.update();
      }, 60000); // A cada minuto

      // Configurar handlers
      this.setupMessageHandlers();
      this.setupSyncHandlers();
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  private setupUpdateListener(): void {
    if (!this.registration) return;

    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nova versão disponível
          this.updateAvailable = true;
          this.notifyUpdateListeners(true);
          
          // Mostrar prompt para usuário
          this.promptUpdate();
        }
      });
    });
  }

  private setupMessageHandlers(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Message from SW:', event.data);
      
      // Processar mensagens do Service Worker
      if (event.data.type === 'CACHE_UPDATED') {
        console.log('Cache updated:', event.data.payload);
      }
    });
  }

  private setupSyncHandlers(): void {
    if (!('sync' in this.registration!)) {
      console.warn('Background Sync not supported');
      return;
    }

    // Registrar sync tags
    this.registerSync('sync-queue');
  }

  async registerSync(tag: string): Promise<void> {
    try {
      await this.registration!.sync.register(tag);
      console.log(`Sync registered: ${tag}`);
    } catch (error) {
      console.error(`Failed to register sync: ${tag}`, error);
    }
  }

  private promptUpdate(): void {
    const shouldUpdate = confirm(
      'Nova versão disponível! Deseja atualizar agora?'
    );

    if (shouldUpdate) {
      this.skipWaiting();
    }
  }

  skipWaiting(): void {
    if (!this.registration?.waiting) return;

    // Dizer ao SW para ativar imediatamente
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Recarregar quando o novo SW assumir
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  // Cache de URLs específicas
  async cacheUrls(urls: string[]): Promise<void> {
    if (!navigator.serviceWorker.controller) return;

    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_URLS',
      payload: urls
    });
  }

  // Verificar se está offline
  isOffline(): boolean {
    return !navigator.onLine;
  }

  // Listeners para atualizações
  onUpdateAvailable(listener: (update: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyUpdateListeners(update: boolean): void {
    this.listeners.forEach(listener => listener(update));
  }

  // Status do Service Worker
  async getStatus(): Promise<{
    registered: boolean;
    active: boolean;
    waiting: boolean;
    updateAvailable: boolean;
  }> {
    const registration = await navigator.serviceWorker.getRegistration();
    
    return {
      registered: !!registration,
      active: !!registration?.active,
      waiting: !!registration?.waiting,
      updateAvailable: this.updateAvailable
    };
  }

  // Limpar caches antigos
  async clearOldCaches(): Promise<void> {
    if (!('caches' in window)) return;

    const cacheNames = await caches.keys();
    const currentCaches = ['todo-rag-v1', 'static-v1', 'dynamic-v1', 'api-v1', 'embeddings-cache'];
    
    await Promise.all(
      cacheNames
        .filter(name => !currentCaches.includes(name))
        .map(name => caches.delete(name))
    );
  }

  // Pré-cache de recursos importantes
  async precacheEssentials(): Promise<void> {
    const essentialUrls = [
      '/offline.html',
      '/manifest.json',
      '/icon-192.png',
      '/icon-512.png'
    ];

    await this.cacheUrls(essentialUrls);
  }

  // Background Sync para fila offline
  async syncOfflineQueue(data: any[]): Promise<void> {
    if (!('sync' in this.registration!)) {
      // Fallback: tentar sync manual
      await this.manualSync(data);
      return;
    }

    // Salvar dados no IndexedDB para o SW processar
    await this.saveToSyncQueue(data);
    
    // Trigger background sync
    await this.registerSync('sync-queue');
  }

  private async saveToSyncQueue(data: any[]): Promise<void> {
    const db = await this.openSyncDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    
    for (const item of data) {
      await store.add(item);
    }
  }

  private async manualSync(data: any[]): Promise<void> {
    // Sync manual quando Background Sync não está disponível
    for (const item of data) {
      try {
        await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body
        });
      } catch (error) {
        console.error('Manual sync failed:', error);
      }
    }
  }

  private openSyncDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OfflineQueue', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // Periodic Background Sync (Chrome only)
  async registerPeriodicSync(tag: string, minInterval: number): Promise<void> {
    if (!('periodicSync' in this.registration!)) {
      console.warn('Periodic Background Sync not supported');
      return;
    }

    try {
      // @ts-ignore - API experimental
      await this.registration.periodicSync.register(tag, {
        minInterval: minInterval
      });
      console.log(`Periodic sync registered: ${tag}`);
    } catch (error) {
      console.error(`Failed to register periodic sync: ${tag}`, error);
    }
  }

  // Push notifications
  async subscribePushNotifications(): Promise<PushSubscription | null> {
    if (!('pushManager' in this.registration!)) {
      console.warn('Push notifications not supported');
      return null;
    }

    try {
      // Pedir permissão
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return null;
      }

      // Subscribe
      const subscription = await this.registration!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.REACT_APP_VAPID_PUBLIC_KEY || ''
        )
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Unregister Service Worker
  async unregister(): Promise<void> {
    if (!this.registration) return;

    await this.registration.unregister();
    console.log('Service Worker unregistered');
  }
}

// Singleton instance
export const swManager = new ServiceWorkerManager();