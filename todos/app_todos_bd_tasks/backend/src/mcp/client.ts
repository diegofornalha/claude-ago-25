import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();
  private buffer = '';
  private initialized = false;

  constructor(private command: string, private args: string[] = []) {
    super();
  }

  async connect(): Promise<void> {
    if (this.process) {
      throw new Error('Already connected');
    }

    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout?.on('data', (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (data) => {
      // Ignorar stderr silenciosamente
    });

    this.process.on('close', (code) => {
      this.cleanup();
    });

    this.process.on('error', (error) => {
      this.cleanup();
    });

    // Initialize the connection
    await this.initialize();
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: MCPResponse = JSON.parse(line);
          this.handleResponse(response);
        } catch (error) {
          // Silenciosamente ignorar erros de parse
        }
      }
    }
  }

  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      
      if (response.error) {
        pending.reject(new Error(response.error.message));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Not connected');
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.process!.stdin!.write(JSON.stringify(request) + '\n');
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      capabilities: {}
    });
    
    this.initialized = true;
    
    // Send initialized notification
    if (this.process?.stdin) {
      this.process.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialized'
      }) + '\n');
    }
    
    return result;
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }
    
    const result = await this.sendRequest('tools/list');
    return result.tools || [];
  }

  async callTool(name: string, arguments: any = {}): Promise<any> {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }
    
    const result = await this.sendRequest('tools/call', {
      name,
      arguments
    });
    
    // Extract text content if present
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent) {
        return textContent.text;
      }
    }
    
    return result;
  }

  async disconnect(): Promise<void> {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    
    this.initialized = false;
    this.buffer = '';
    this.requestId = 0;
  }
}

// Factory function for RAG MCP client
export function createRAGClient(): MCPClient {
  return new MCPClient('/usr/bin/python3', [
    '/Users/agents/.claude/mcp-rag-server/rag_server.py'
  ]);
}