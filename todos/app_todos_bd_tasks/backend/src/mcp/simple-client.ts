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

export class SimpleMCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();
  private buffer = '';

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
      // Ignorar stderr - servidor Python pode enviar logs para stderr
    });

    this.process.on('close', (code) => {
      this.cleanup();
    });

    this.process.on('error', (error) => {
      this.cleanup();
    });

    // Initialize the connection
    await this.sendRequest('initialize', { capabilities: {} });
    
    // Send initialized notification
    if (this.process?.stdin) {
      this.process.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialized'
      }) + '\n');
    }
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response: MCPResponse = JSON.parse(line);
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        } catch (error) {
          // Ignorar linhas que não são JSON válido
        }
      }
    }
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Not connected');
    }

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
    
    // Extract text content if present
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent) {
        return JSON.parse(textContent.text);
      }
    }
    
    return result;
  }

  async listTools(): Promise<any[]> {
    const result = await this.sendRequest('tools/list');
    return result.tools || [];
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
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
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
    
    this.buffer = '';
    this.requestId = 0;
  }
}

// Factory function for RAG MCP client
export function createRAGClient(): SimpleMCPClient {
  return new SimpleMCPClient('/usr/bin/python3', [
    '/Users/agents/.claude/mcp-rag-server/rag_server.py'
  ]);
}