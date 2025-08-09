// Service Worker for Offline-First PWA
const CACHE_NAME = 'todo-rag-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const API_CACHE = 'api-v1';

// Assets para cache estático
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Precaching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // Ativar imediatamente
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    // Limpar caches antigos
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  
  // Assumir controle imediatamente
  self.clients.claim();
});

// Estratégias de cache
const cacheStrategies = {
  // Cache First - para assets estáticos
  cacheFirst: async (request) => {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      // Se falhar, tentar retornar página offline
      const offlineResponse = await caches.match('/offline.html');
      return offlineResponse || new Response('Offline', { status: 503 });
    }
  },

  // Network First - para API calls
  networkFirst: async (request, cacheName = API_CACHE) => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }
      
      // Para requisições de API, retornar erro estruturado
      return new Response(
        JSON.stringify({ 
          error: 'Offline', 
          cached: false,
          timestamp: Date.now() 
        }),
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },

  // Stale While Revalidate - para recursos dinâmicos
  staleWhileRevalidate: async (request) => {
    const cached = await caches.match(request);
    
    const fetchPromise = fetch(request).then((response) => {
      if (response.ok) {
        const cache = caches.open(DYNAMIC_CACHE);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    }).catch(() => null);
    
    return cached || fetchPromise || new Response('Resource not available', { status: 404 });
  },

  // Cache Only - para recursos que nunca mudam
  cacheOnly: async (request) => {
    const cached = await caches.match(request);
    return cached || new Response('Not found in cache', { status: 404 });
  },

  // Network Only - sem cache
  networkOnly: async (request) => {
    try {
      return await fetch(request);
    } catch (error) {
      return new Response('Network error', { status: 503 });
    }
  }
};

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-HTTP(S)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Estratégias baseadas no tipo de recurso
  let responsePromise;

  // API calls - Network First com cache de fallback
  if (url.pathname.startsWith('/api/')) {
    responsePromise = cacheStrategies.networkFirst(request);
  }
  // Assets estáticos (JS, CSS, imagens) - Cache First
  else if (request.destination === 'script' || 
           request.destination === 'style' || 
           request.destination === 'image' ||
           url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/)) {
    responsePromise = cacheStrategies.cacheFirst(request);
  }
  // Documentos HTML - Stale While Revalidate
  else if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    responsePromise = cacheStrategies.staleWhileRevalidate(request);
  }
  // Requisições de dados do RAG - Cache especial
  else if (url.pathname.includes('/embeddings/') || url.pathname.includes('/documents/')) {
    responsePromise = handleRAGRequest(request);
  }
  // Outros - Network First
  else {
    responsePromise = cacheStrategies.networkFirst(request);
  }

  event.respondWith(responsePromise);
});

// Handler especial para requisições RAG
async function handleRAGRequest(request) {
  const url = new URL(request.url);
  
  // Embeddings são imutáveis - Cache Forever
  if (url.pathname.includes('/embeddings/')) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open('embeddings-cache');
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response('Embedding not available offline', { status: 503 });
    }
  }
  
  // Documentos - Stale While Revalidate
  return cacheStrategies.staleWhileRevalidate(request);
}

// Background Sync para operações offline
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

// Sincronizar fila offline
async function syncOfflineQueue() {
  try {
    // Obter dados da fila do IndexedDB
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const queue = await store.getAll();
    
    // Processar cada item da fila
    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body
        });
        
        if (response.ok) {
          // Remover da fila se sucesso
          const deleteTx = db.transaction('syncQueue', 'readwrite');
          await deleteTx.objectStore('syncQueue').delete(item.id);
        }
      } catch (error) {
        console.error('[SW] Sync failed for item:', item.id);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// Abrir IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineQueue', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Push notifications para alertas importantes
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nova atualização disponível',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver detalhes',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/images/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Todo RAG System', options)
  );
});

// Handler para cliques em notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    // Abrir o app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.payload;
    caches.open(DYNAMIC_CACHE).then((cache) => {
      cache.addAll(urls);
    });
  }
});

// Periodic Background Sync (para navegadores que suportam)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-embeddings') {
    event.waitUntil(updateEmbeddings());
  }
});

async function updateEmbeddings() {
  try {
    // Verificar atualizações de embeddings
    const response = await fetch('/api/embeddings/check-updates');
    const updates = await response.json();
    
    if (updates.hasUpdates) {
      // Baixar novos embeddings em background
      const cache = await caches.open('embeddings-cache');
      await Promise.all(
        updates.newEmbeddings.map(url => 
          fetch(url).then(res => cache.put(url, res))
        )
      );
    }
  } catch (error) {
    console.error('[SW] Failed to update embeddings:', error);
  }
}

console.log('[SW] Service Worker loaded');