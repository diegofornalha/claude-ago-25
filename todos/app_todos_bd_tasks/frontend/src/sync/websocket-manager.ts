import type { WSMessage } from '../shared/types';

export interface WebSocketOptions {
  url: string;
  reconnectOptions?: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    factor?: number;
  };
  heartbeatInterval?: number;
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private isClosed = false;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private missedPongs = 0;
  private messageQueue: WSMessage[] = [];
  private eventHandlers = new Map<string, Set<Function>>();
  
  private options: Required<WebSocketOptions['reconnectOptions']> = {
    maxAttempts: 10,
    baseDelay: 1000,
    maxDelay: 30000,
    factor: 2,
  };
  
  private heartbeatInterval: number;
  private callbacks: {
    onMessage?: (message: WSMessage) => void;
    onConnect?: () => void;
    onDisconnect?: (event: CloseEvent) => void;
    onError?: (error: Event) => void;
  };

  constructor(options: WebSocketOptions) {
    this.url = options.url;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.callbacks = {
      onMessage: options.onMessage,
      onConnect: options.onConnect,
      onDisconnect: options.onDisconnect,
      onError: options.onError,
    };
    
    if (options.reconnectOptions) {
      this.options = { ...this.options, ...options.reconnectOptions };
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isClosed = false;
    this.createConnection();
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isClosed = true;
    this.clearTimers();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send a message
   */
  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
      console.warn('WebSocket not connected, message queued');
    }
  }

  /**
   * Send a batch of messages
   */
  sendBatch(messages: WSMessage[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const batchId = crypto.randomUUID();
      const batchMessage: WSMessage = {
        type: 'batch',
        payload: {
          batchId,
          messages,
        },
        timestamp: new Date(),
      };

      // Set up response handler
      const handler = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          if (response.type === 'batch-response' && response.payload?.batchId === batchId) {
            this.ws?.removeEventListener('message', handler);
            resolve(response.payload);
          }
        } catch (error) {
          console.error('Failed to parse batch response:', error);
        }
      };

      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify(batchMessage));

      // Timeout after 30 seconds
      setTimeout(() => {
        this.ws?.removeEventListener('message', handler);
        reject(new Error('Batch request timeout'));
      }, 30000);
    });
  }

  /**
   * Subscribe to events
   */
  on(event: string, handler: Function): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    this.eventHandlers.get(event)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    reconnecting: boolean;
    reconnectAttempts: number;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      reconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private createConnection(): void {
    try {
      console.log(`Connecting to WebSocket: ${this.url}`);
      this.ws = new WebSocket(this.url);
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Send queued messages
      this.flushMessageQueue();
      
      // Emit connect event
      this.emit('connected');
      this.callbacks.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage;
        
        // Handle heartbeat
        if (message.type === 'pong') {
          this.missedPongs = 0;
          return;
        }
        
        // Emit message event
        this.emit('message', message);
        this.emit(message.type, message.payload);
        this.callbacks.onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
      this.callbacks.onError?.(error);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.ws = null;
      this.clearTimers();
      
      this.emit('disconnected', event);
      this.callbacks.onDisconnect?.(event);
      
      // Attempt reconnection if not closed intentionally
      if (!this.isClosed && !this.isReconnecting) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.isClosed || this.reconnectAttempts >= this.options.maxAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('reconnect-failed');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.options.baseDelay * Math.pow(this.options.factor, this.reconnectAttempts - 1),
      this.options.maxDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxAttempts})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Check missed pongs
        if (this.missedPongs >= 3) {
          console.warn('No pong received, connection may be dead');
          this.ws.close();
          return;
        }
        
        // Send ping
        this.missedPongs++;
        this.send({
          type: 'ping',
          timestamp: new Date(),
        });
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.missedPongs = 0;
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;
    
    console.log(`Sending ${this.messageQueue.length} queued messages`);
    
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}