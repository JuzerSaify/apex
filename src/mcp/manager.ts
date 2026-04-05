/**
 * MCP Manager — loads configured MCP servers and bridges their tools
 * into the KeepCode tool registry.
 *
 * Config file: .keepcode/mcp.json  (per-project)
 * Format:
 *   [
 *     { "name": "filesystem", "transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"] },
 *     { "name": "github",     "transport": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "..." } }
 *   ]
 */
import { promises as fs } from 'fs';
import path from 'path';
import { MCPClient, type MCPServerConfig, type MCPTool } from './client.js';
import type { ToolDefinition } from '../types/index.js';
import { KEEPCODE_DIR } from '../config/defaults.js';

const MCP_CONFIG_FILE = 'mcp.json';

const activeClients = new Map<string, MCPClient>();

export async function loadMCPServers(workingDir: string): Promise<void> {
  const configPath = path.join(workingDir, KEEPCODE_DIR, MCP_CONFIG_FILE);

  let servers: MCPServerConfig[];
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    servers = JSON.parse(raw) as MCPServerConfig[];
  } catch {
    return; // no MCP config — silently skip
  }

  for (const server of servers) {
    if (!server.name || !server.transport) continue;
    try {
      const client = new MCPClient(server);
      await client.connect();
      activeClients.set(server.name, client);
      console.log(`  ✓ MCP: connected to '${server.name}'`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠ MCP: failed to connect '${server.name}': ${msg}`);
    }
  }
}

/**
 * Returns ToolDefinition[] for all tools from all connected MCP servers.
 * Each tool's name is prefixed with the server name to avoid conflicts:
 *   "filesystem__read_file", "github__create_issue", etc.
 */
export async function getMCPToolDefinitions(): Promise<ToolDefinition[]> {
  const defs: ToolDefinition[] = [];

  for (const [serverName, client] of activeClients) {
    if (!client.isConnected) continue;
    try {
      const tools: MCPTool[] = await client.listTools();
      for (const t of tools) {
        defs.push({
          name: `${serverName}__${t.name}`,
          description: `[MCP:${serverName}] ${t.description}`,
          category: 'execute',
          dangerLevel: 'safe',
          emoji: '🔌',
          parameters: t.inputSchema as ToolDefinition['parameters'],
        });
      }
    } catch {
      // Server might have disconnected; skip it
    }
  }

  return defs;
}

/**
 * Execute an MCP tool by its prefixed name (e.g. "filesystem__read_file").
 * Returns null if the tool name doesn't belong to any MCP server.
 */
export async function callMCPTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string | null> {
  const sep = '__';
  const idx = toolName.indexOf(sep);
  if (idx === -1) return null;

  const serverName = toolName.slice(0, idx);
  const realName   = toolName.slice(idx + sep.length);

  const client = activeClients.get(serverName);
  if (!client || !client.isConnected) return null;

  return client.callTool(realName, args);
}

export function isMCPTool(toolName: string): boolean {
  return toolName.includes('__') && activeClients.has(toolName.split('__')[0]);
}

export async function disconnectAll(): Promise<void> {
  for (const client of activeClients.values()) {
    client.disconnect();
  }
  activeClients.clear();
}

/** Add a new MCP server config to .keepcode/mcp.json */
export async function addMCPServer(workingDir: string, server: MCPServerConfig): Promise<void> {
  const configPath = path.join(workingDir, KEEPCODE_DIR, MCP_CONFIG_FILE);
  let existing: MCPServerConfig[] = [];
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    existing = JSON.parse(raw) as MCPServerConfig[];
  } catch {
    // first entry
  }
  existing = existing.filter((s) => s.name !== server.name);
  existing.push(server);
  await fs.mkdir(path.join(workingDir, KEEPCODE_DIR), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

/** List configured MCP servers from .keepcode/mcp.json */
export async function listMCPServers(workingDir: string): Promise<MCPServerConfig[]> {
  const configPath = path.join(workingDir, KEEPCODE_DIR, MCP_CONFIG_FILE);
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw) as MCPServerConfig[];
  } catch {
    return [];
  }
}
