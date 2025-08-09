export interface PrecacheConfig {
  staticAssets: string[];
  dynamicRoutes: string[];
  apiEndpoints: string[];
  maxAge: number; // em ms
}

export class PrecacheManager {
  private static instance: PrecacheManager;
  private config: PrecacheConfig;
  private cacheNames = {
    static: 'static-v1',
    dynamic: 'dynamic-v1',
    api: 'api-v1',
    images: 'images-v1',
    fonts: 'fonts-v1'
  };

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): PrecacheManager {
    if (!PrecacheManager.instance) {
      PrecacheManager.instance = new PrecacheManager();
    }
    return PrecacheManager.instance;
  }

  private getDefaultConfig(): PrecacheConfig {
    return {
      staticAssets: [
        '/',
        '/index.html',
        '/offline.html',
        '/manifest.json',
        '/favicon.ico',
        '/robots.txt',
        // Ícones PWA
        '/icon-72.png',
        '/icon-96.png',
        '/icon-128.png',
        '/icon-144.png',
        '/icon-152.png',
        '/icon-192.png',
        '/icon-384.png',
        '/icon-512.png',
        '/apple-touch-icon.png',
        // CSS crítico
        '/assets/css/critical.css'
      ],
      dynamicRoutes: [
        '/dashboard',
        '/settings',
        '/backup',
        '/migration'
      ],
      apiEndpoints: [
        '/api/health',
        '/api/config',
        '/api/user/profile'
      ],
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    };
  }

  async precacheAll(): Promise<void> {
    console.log('[Precache] Starting precache process...');
    
    // Precache assets estáticos
    await this.precacheStatic();
    
    // Precache rotas dinâmicas
    await this.precacheDynamicRoutes();
    
    // Precache endpoints críticos da API
    await this.precacheAPIEndpoints();
    
    // Precache assets críticos (fonts, imagens)
    await this.precacheCriticalAssets();
    
    console.log('[Precache] Precache complete');
  }

  private async precacheStatic(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(this.cacheNames.static);
      const assets = this.config.staticAssets;
      
      // Verificar quais assets já estão em cache
      const cached = await Promise.all(
        assets.map(async (asset) => {
          const response = await cache.match(asset);
          return response ? asset : null;
        })
      );
      
      // Filtrar apenas os não cacheados
      const toCache = assets.filter((asset, index) => !cached[index]);
      
      if (toCache.length > 0) {
        console.log(`[Precache] Caching ${toCache.length} static assets`);
        await cache.addAll(toCache);
      }
    } catch (error) {
      console.error('[Precache] Failed to cache static assets:', error);
    }
  }

  private async precacheDynamicRoutes(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(this.cacheNames.dynamic);
      
      for (const route of this.config.dynamicRoutes) {
        try {
          // Fetch com credenciais para rotas autenticadas
          const response = await fetch(route, {
            credentials: 'same-origin',
            headers: {
              'X-Precache': 'true'
            }
          });
          
          if (response.ok) {
            await cache.put(route, response);
          }
        } catch (error) {
          console.warn(`[Precache] Failed to cache route ${route}:`, error);
        }
      }
    } catch (error) {
      console.error('[Precache] Failed to cache dynamic routes:', error);
    }
  }

  private async precacheAPIEndpoints(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(this.cacheNames.api);
      
      for (const endpoint of this.config.apiEndpoints) {
        try {
          const response = await fetch(endpoint, {
            credentials: 'same-origin',
            headers: {
              'X-Precache': 'true',
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            // Clonar response para adicionar headers de cache
            const responseToCache = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: new Headers({
                ...Object.fromEntries(response.headers.entries()),
                'X-Cached-At': new Date().toISOString(),
                'Cache-Control': `max-age=${this.config.maxAge / 1000}`
              })
            });
            
            await cache.put(endpoint, responseToCache);
          }
        } catch (error) {
          console.warn(`[Precache] Failed to cache endpoint ${endpoint}:`, error);
        }
      }
    } catch (error) {
      console.error('[Precache] Failed to cache API endpoints:', error);
    }
  }

  private async precacheCriticalAssets(): Promise<void> {
    if (!('caches' in window)) return;

    // Descobrir assets críticos dinamicamente
    const criticalAssets = await this.discoverCriticalAssets();
    
    // Cache de imagens críticas
    await this.cacheAssets(criticalAssets.images, this.cacheNames.images);
    
    // Cache de fontes
    await this.cacheAssets(criticalAssets.fonts, this.cacheNames.fonts);
  }

  private async discoverCriticalAssets(): Promise<{
    images: string[];
    fonts: string[];
  }> {
    const images: string[] = [];
    const fonts: string[] = [];
    
    // Analisar CSS para encontrar fontes
    const stylesheets = Array.from(document.styleSheets);
    for (const stylesheet of stylesheets) {
      try {
        const rules = Array.from(stylesheet.cssRules || []);
        for (const rule of rules) {
          if (rule instanceof CSSFontFaceRule) {
            const src = rule.style.getPropertyValue('src');
            const urls = src.match(/url\(['"]?([^'"]+)['"]?\)/g);
            if (urls) {
              urls.forEach(url => {
                const cleanUrl = url.replace(/url\(['"]?|['"]?\)/g, '');
                fonts.push(cleanUrl);
              });
            }
          }
        }
      } catch (e) {
        // CORS pode bloquear acesso a algumas stylesheets
      }
    }
    
    // Analisar imagens no viewport atual
    const imgs = document.querySelectorAll('img[src]');
    imgs.forEach(img => {
      const src = (img as HTMLImageElement).src;
      if (src && !src.startsWith('data:')) {
        images.push(src);
      }
    });
    
    // Adicionar logos e ícones comuns
    images.push(
      '/logo.png',
      '/logo.svg',
      '/favicon.ico'
    );
    
    return { 
      images: [...new Set(images)].filter(Boolean),
      fonts: [...new Set(fonts)].filter(Boolean)
    };
  }

  private async cacheAssets(assets: string[], cacheName: string): Promise<void> {
    if (assets.length === 0) return;
    
    try {
      const cache = await caches.open(cacheName);
      
      for (const asset of assets) {
        try {
          const cached = await cache.match(asset);
          if (!cached) {
            const response = await fetch(asset);
            if (response.ok) {
              await cache.put(asset, response);
            }
          }
        } catch (error) {
          console.warn(`[Precache] Failed to cache asset ${asset}:`, error);
        }
      }
    } catch (error) {
      console.error(`[Precache] Failed to open cache ${cacheName}:`, error);
    }
  }

  // Warmup de cache para RAG
  async precacheRAGAssets(): Promise<void> {
    console.log('[Precache] Warming up RAG cache...');
    
    try {
      // Cachear embeddings mais usados
      const popularEmbeddings = await this.getPopularEmbeddings();
      await this.cacheEmbeddings(popularEmbeddings);
      
      // Cachear documentos recentes
      const recentDocs = await this.getRecentDocuments();
      await this.cacheDocuments(recentDocs);
      
    } catch (error) {
      console.error('[Precache] RAG cache warmup failed:', error);
    }
  }

  private async getPopularEmbeddings(): Promise<string[]> {
    // Simular busca de embeddings populares
    try {
      const response = await fetch('/api/embeddings/popular', {
        headers: { 'X-Precache': 'true' }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.embeddings.map((e: any) => `/api/embeddings/${e.id}`);
      }
    } catch (error) {
      console.warn('[Precache] Failed to get popular embeddings:', error);
    }
    
    return [];
  }

  private async getRecentDocuments(): Promise<string[]> {
    try {
      const response = await fetch('/api/documents/recent', {
        headers: { 'X-Precache': 'true' }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.documents.map((d: any) => `/api/documents/${d.id}`);
      }
    } catch (error) {
      console.warn('[Precache] Failed to get recent documents:', error);
    }
    
    return [];
  }

  private async cacheEmbeddings(embeddings: string[]): Promise<void> {
    const cache = await caches.open('embeddings-cache');
    
    for (const url of embeddings) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn(`[Precache] Failed to cache embedding ${url}:`, error);
      }
    }
  }

  private async cacheDocuments(documents: string[]): Promise<void> {
    const cache = await caches.open('documents-cache');
    
    for (const url of documents) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn(`[Precache] Failed to cache document ${url}:`, error);
      }
    }
  }

  // Limpar caches antigos
  async cleanupOldCaches(): Promise<void> {
    if (!('caches' in window)) return;
    
    const validCaches = Object.values(this.cacheNames);
    const cacheNames = await caches.keys();
    
    await Promise.all(
      cacheNames
        .filter(name => !validCaches.includes(name))
        .map(name => caches.delete(name))
    );
  }

  // Atualizar configuração
  updateConfig(config: Partial<PrecacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Obter estatísticas de cache
  async getCacheStats(): Promise<{
    totalSize: number;
    cacheBreakdown: Record<string, number>;
    oldestEntry: Date | null;
  }> {
    let totalSize = 0;
    const cacheBreakdown: Record<string, number> = {};
    let oldestEntry: Date | null = null;
    
    for (const [name, cacheName] of Object.entries(this.cacheNames)) {
      try {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        let cacheSize = 0;
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            cacheSize += blob.size;
            
            // Verificar idade
            const cachedAt = response.headers.get('X-Cached-At');
            if (cachedAt) {
              const date = new Date(cachedAt);
              if (!oldestEntry || date < oldestEntry) {
                oldestEntry = date;
              }
            }
          }
        }
        
        cacheBreakdown[name] = cacheSize;
        totalSize += cacheSize;
      } catch (error) {
        console.error(`Failed to get stats for cache ${cacheName}:`, error);
      }
    }
    
    return { totalSize, cacheBreakdown, oldestEntry };
  }
}

// Export singleton
export const precacheManager = PrecacheManager.getInstance();