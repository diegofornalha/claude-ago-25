import { WebSocketManager } from '../sync/websocket-manager';

export interface NetworkCondition {
  latency: number; // ms
  jitter: number; // ms de variação
  packetLoss: number; // 0-1
  bandwidth: number; // bytes/s (0 = unlimited)
  offline: boolean;
}

export const NetworkProfiles = {
  // Condições normais
  PERFECT: {
    latency: 0,
    jitter: 0,
    packetLoss: 0,
    bandwidth: 0,
    offline: false
  },
  
  // 3G típico
  SLOW_3G: {
    latency: 400,
    jitter: 100,
    packetLoss: 0.01,
    bandwidth: 50000, // 50KB/s
    offline: false
  },
  
  // WiFi ruim
  POOR_WIFI: {
    latency: 150,
    jitter: 50,
    packetLoss: 0.05,
    bandwidth: 100000, // 100KB/s
    offline: false
  },
  
  // Rede congestionada
  CONGESTED: {
    latency: 1000,
    jitter: 500,
    packetLoss: 0.1,
    bandwidth: 10000, // 10KB/s
    offline: false
  },
  
  // Conexão intermitente
  FLAKY: {
    latency: 200,
    jitter: 1000,
    packetLoss: 0.3,
    bandwidth: 50000,
    offline: false
  },
  
  // Offline
  OFFLINE: {
    latency: 0,
    jitter: 0,
    packetLoss: 1,
    bandwidth: 0,
    offline: true
  }
};

export class NetworkChaos {
  private originalFetch: typeof fetch;
  private originalWebSocket: typeof WebSocket;
  private currentCondition: NetworkCondition = NetworkProfiles.PERFECT;
  private isActive: boolean = false;
  private requestQueue: Array<{ resolve: Function; reject: Function; args: any[] }> = [];
  private bandwidthTracker = {
    used: 0,
    reset: Date.now()
  };

  constructor() {
    this.originalFetch = window.fetch.bind(window);
    this.originalWebSocket = window.WebSocket;
  }

  activate(condition: NetworkCondition = NetworkProfiles.PERFECT): void {
    if (this.isActive) return;
    
    this.currentCondition = condition;
    this.isActive = true;
    
    // Interceptar fetch
    window.fetch = this.createChaoticFetch();
    
    // Interceptar WebSocket
    this.interceptWebSocket();
    
    // Simular eventos de rede
    if (condition.offline) {
      this.simulateOffline();
    }
    
    console.log('🔥 Network Chaos activated:', condition);
  }

  deactivate(): void {
    if (!this.isActive) return;
    
    window.fetch = this.originalFetch;
    window.WebSocket = this.originalWebSocket;
    
    // Restaurar online
    if (this.currentCondition.offline) {
      this.simulateOnline();
    }
    
    this.isActive = false;
    this.currentCondition = NetworkProfiles.PERFECT;
    
    console.log('✅ Network Chaos deactivated');
  }

  private createChaoticFetch(): typeof fetch {
    return async (...args: Parameters<typeof fetch>) => {
      // Verificar se está offline
      if (this.currentCondition.offline) {
        throw new Error('NetworkError: Failed to fetch - Offline');
      }
      
      // Simular packet loss
      if (Math.random() < this.currentCondition.packetLoss) {
        throw new Error('NetworkError: Failed to fetch - Packet loss');
      }
      
      // Calcular delay com jitter
      const jitter = (Math.random() - 0.5) * 2 * this.currentCondition.jitter;
      const delay = Math.max(0, this.currentCondition.latency + jitter);
      
      // Aplicar bandwidth throttling
      if (this.currentCondition.bandwidth > 0) {
        await this.throttleBandwidth(args);
      }
      
      // Aplicar delay
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        const response = await this.originalFetch(...args);
        
        // Simular respostas corrompidas ocasionalmente
        if (Math.random() < this.currentCondition.packetLoss / 2) {
          return new Response('', {
            status: 500,
            statusText: 'Network Chaos: Corrupted Response'
          });
        }
        
        return response;
      } catch (error) {
        // Chance de retry automático em condições ruins
        if (Math.random() < 0.3 && this.currentCondition.packetLoss < 0.5) {
          console.log('🔄 Network Chaos: Auto-retry after failure');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.originalFetch(...args);
        }
        
        throw error;
      }
    };
  }

  private interceptWebSocket(): void {
    const chaos = this;
    
    // @ts-ignore - Substituindo classe nativa
    window.WebSocket = class extends this.originalWebSocket {
      constructor(url: string, protocols?: string | string[]) {
        super(url, protocols);
        
        if (chaos.currentCondition.offline) {
          setTimeout(() => {
            this.dispatchEvent(new CloseEvent('close', {
              code: 1006,
              reason: 'Network Chaos: Offline'
            }));
          }, 100);
          return;
        }
        
        // Interceptar mensagens
        const originalSend = this.send.bind(this);
        this.send = function(data: any) {
          // Simular packet loss
          if (Math.random() < chaos.currentCondition.packetLoss) {
            console.log('📦 Network Chaos: WebSocket message dropped');
            return;
          }
          
          // Aplicar delay
          const delay = chaos.currentCondition.latency + 
            (Math.random() - 0.5) * 2 * chaos.currentCondition.jitter;
          
          if (delay > 0) {
            setTimeout(() => originalSend(data), delay);
          } else {
            originalSend(data);
          }
        };
        
        // Simular desconexões aleatórias
        if (chaos.currentCondition.packetLoss > 0.2) {
          const disconnectChance = chaos.currentCondition.packetLoss;
          const checkInterval = setInterval(() => {
            if (Math.random() < disconnectChance / 10) {
              console.log('🔌 Network Chaos: WebSocket disconnected');
              this.close();
              clearInterval(checkInterval);
            }
          }, 5000);
        }
      }
    };
  }

  private async throttleBandwidth(fetchArgs: any[]): Promise<void> {
    // Estimar tamanho da request
    let requestSize = 1000; // Default 1KB
    
    if (fetchArgs[1]?.body) {
      if (typeof fetchArgs[1].body === 'string') {
        requestSize = new Blob([fetchArgs[1].body]).size;
      } else if (fetchArgs[1].body instanceof Blob) {
        requestSize = fetchArgs[1].body.size;
      }
    }
    
    // Reset tracker a cada segundo
    if (Date.now() - this.bandwidthTracker.reset > 1000) {
      this.bandwidthTracker.used = 0;
      this.bandwidthTracker.reset = Date.now();
    }
    
    // Calcular delay baseado em bandwidth
    if (this.bandwidthTracker.used + requestSize > this.currentCondition.bandwidth) {
      const waitTime = ((this.bandwidthTracker.used + requestSize - this.currentCondition.bandwidth) / 
        this.currentCondition.bandwidth) * 1000;
      
      console.log(`⏳ Network Chaos: Throttling ${waitTime.toFixed(0)}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.bandwidthTracker.used += requestSize;
  }

  private simulateOffline(): void {
    // Despachar evento offline
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false
    });
    
    window.dispatchEvent(new Event('offline'));
  }

  private simulateOnline(): void {
    // Despachar evento online
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true
    });
    
    window.dispatchEvent(new Event('online'));
  }

  // Cenários de teste específicos
  async runScenario(scenario: string, duration: number = 30000): Promise<void> {
    console.log(`🎬 Starting network chaos scenario: ${scenario}`);
    
    switch (scenario) {
      case 'INTERMITTENT_CONNECTION':
        await this.intermittentConnection(duration);
        break;
        
      case 'DEGRADING_NETWORK':
        await this.degradingNetwork(duration);
        break;
        
      case 'NETWORK_STORM':
        await this.networkStorm(duration);
        break;
        
      case 'MOBILE_TRAIN':
        await this.mobileTrainScenario(duration);
        break;
        
      default:
        console.error('Unknown scenario:', scenario);
    }
  }

  private async intermittentConnection(duration: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration) {
      // Alterna entre online e offline
      this.activate(NetworkProfiles.PERFECT);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 2000));
      
      this.activate(NetworkProfiles.OFFLINE);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));
    }
    
    this.deactivate();
  }

  private async degradingNetwork(duration: number): Promise<void> {
    const profiles = [
      NetworkProfiles.PERFECT,
      NetworkProfiles.POOR_WIFI,
      NetworkProfiles.SLOW_3G,
      NetworkProfiles.CONGESTED,
      NetworkProfiles.FLAKY
    ];
    
    for (const profile of profiles) {
      this.activate(profile);
      await new Promise(resolve => setTimeout(resolve, duration / profiles.length));
    }
    
    this.deactivate();
  }

  private async networkStorm(duration: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration) {
      // Condições caóticas aleatórias
      const chaosCondition: NetworkCondition = {
        latency: Math.random() * 2000,
        jitter: Math.random() * 1000,
        packetLoss: Math.random() * 0.5,
        bandwidth: Math.random() > 0.5 ? 0 : Math.random() * 100000,
        offline: Math.random() > 0.9
      };
      
      this.activate(chaosCondition);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    }
    
    this.deactivate();
  }

  private async mobileTrainScenario(duration: number): Promise<void> {
    // Simula viagem de trem com túneis e áreas rurais
    const sequence = [
      { condition: NetworkProfiles.PERFECT, duration: 5000 }, // Estação
      { condition: NetworkProfiles.POOR_WIFI, duration: 3000 }, // Saindo
      { condition: NetworkProfiles.SLOW_3G, duration: 8000 }, // Rural
      { condition: NetworkProfiles.OFFLINE, duration: 2000 }, // Túnel
      { condition: NetworkProfiles.FLAKY, duration: 4000 }, // Saindo do túnel
      { condition: NetworkProfiles.SLOW_3G, duration: 6000 }, // Rural
      { condition: NetworkProfiles.CONGESTED, duration: 3000 }, // Cidade próxima
      { condition: NetworkProfiles.PERFECT, duration: 5000 } // Chegada
    ];
    
    const totalSequenceDuration = sequence.reduce((sum, step) => sum + step.duration, 0);
    const loops = Math.ceil(duration / totalSequenceDuration);
    
    for (let i = 0; i < loops; i++) {
      for (const step of sequence) {
        if (Date.now() - duration > duration) break;
        
        this.activate(step.condition);
        await new Promise(resolve => setTimeout(resolve, step.duration));
      }
    }
    
    this.deactivate();
  }

  // Métricas e relatórios
  getMetrics(): any {
    return {
      currentCondition: this.currentCondition,
      isActive: this.isActive,
      bandwidthUsed: this.bandwidthTracker.used,
      queuedRequests: this.requestQueue.length
    };
  }
}