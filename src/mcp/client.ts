/**
 * MCP (Model Context Protocol) client.
 * Supports stdio transport — spawns a process and speaks JSON-RPC 2.0 over stdin/stdout.
 *
 * Protocol spec: https://spec.modelcontextprotocol.io/specification/
 */
import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// ── JSON-RPC 2.0 types ────────────────────────────────────────────────────────

interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ── MCP tool types ─────────────────────────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPServerConfig {
  name:      string;
  transport: 'stdio' | 'sse' | 'http';
  command?:  string;
  args?:     string[];
  url?:      string;
  env?:      Record<string, string>;
  enabled?:  boolean;
}

// ── MCP Client ────────────────────────────────────────────────────────────────

export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<number, {
    resolve: (v: unknown) => void;
    reject:  (e: Error) => void;
  }>();
  private nextId   = 1;
  private buffer   = '';
  private ready    = false;

  constructor(private readonly config: MCPServerConfig) {
    super();
  }

  get isConnected(): boolean {
    return this.ready;
  }

  async connect(): Promise<void> {
    if (this.config.transport !== 'stdio') {
      throw new Error(`MCP transport '${this.config.transport}' is not yet supported. Use 'stdio'.`);
    }
    if (!this.config.command) {
      throw new Error('MCP stdio transport requires a command');
    }

    this.process = spawn(this.config.command, this.config.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(this.config.env ?? {}) },
    });

    this.process.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8');
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed) as RpcResponse;
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
            } else {
              pending.resolve(msg.result);
            }
          }
        } catch {
          // skip malformed lines (server might write non-JSON)
        }
      }
    });

    this.process.stderr!.on('data', (chunk: Buffer) => {
      // suppress stderr noise; optionally emit for debugging
      const text = chunk.toString('utf8').trim();
      if (text) this.emit('server_log', text);
    });

    this.process.on('exit', (code) => {
      this.ready = false;
      this.emit('disconnected', code);
      // Reject all pending requests
      for (const [, { reject }] of this.pendingRequests) {
        reject(new Error(`MCP server '${this.config.name}' exited`));
      }
      this.pendingRequests.clear();
    });

    // Initialize the MCP session
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'keepcode', version: '1.4.0' },
    });

    // Send initialized notification (no response expected)
    this.send({ jsonrpc: '2.0', id: 0, method: 'notifications/initialized' } as RpcRequest);
    this.ready = true;
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.ready) throw new Error('MCP client not connected');
    const result = await this.request('tools/list', {}) as { tools?: MCPTool[] };
    return result.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.ready) throw new Error('MCP client not connected');
    const result = await this.request('tools/call', { name, arguments: args }) as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    const text = (result.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');
    return result.isError ? `MCP tool error: ${text}` : (text || 'Done');
  }

  disconnect(): void {
    this.ready = false;
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = null;
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const id = this.nextId++;
      this.pendingRequests.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });

      // 30-second timeout per MCP request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request '${method}' timed out`));
        }
      }, 30_000);
    });
  }

  private send(msg: RpcRequest): void {
    if (!this.process?.stdin) return;
    this.process.stdin.write(JSON.stringify(msg) + '\n', 'utf8');
  }
}
