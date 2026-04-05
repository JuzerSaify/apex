import { exec } from 'child_process';
import { promisify } from 'util';
import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

const execAsync = promisify(exec);

/**
 * process_info — list running processes, find by name, and check ports.
 */
registerTool({
  definition: {
    name: 'process_info',
    description:
      'Get information about running processes and port usage. Use to check if a server is running, find what is using a port, or list processes by name. Works on Windows (tasklist/netstat) and Unix (ps/lsof).',
    category: 'read',
    dangerLevel: 'safe',
    emoji: '⚙️',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'One of: list (all processes), find (by name), port (check a port)',
          enum: ['list', 'find', 'port'],
        },
        name: {
          type: 'string',
          description: 'Process name to search for (used with action=find)',
        },
        port: {
          type: 'number',
          description: 'Port number to check (used with action=port)',
        },
      },
      required: ['action'],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const action = String(args.action);
    const isWin = process.platform === 'win32';

    let cmd = '';
    switch (action) {
      case 'list':
        cmd = isWin ? 'tasklist /fo csv /nh | head -30' : 'ps aux --no-header | head -30';
        break;
      case 'find': {
        const name = String(args.name ?? '');
        cmd = isWin
          ? `tasklist /fo csv /nh | findstr /i "${name}"`
          : `ps aux | grep -i "${name}" | grep -v grep`;
        break;
      }
      case 'port': {
        const port = Number(args.port ?? 0);
        cmd = isWin
          ? `netstat -ano | findstr ":${port}"`
          : `lsof -i :${port} 2>/dev/null || ss -tlnp | grep :${port}`;
        break;
      }
      default:
        return `Unknown action: ${action}`;
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: config.workingDir, timeout: 10_000 });
      const out = stdout.trim() || stderr.trim();
      return out || `No results for ${action}${args.name ? ` "${args.name}"` : ''}${args.port ? ` port ${args.port}` : ''}`;
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      const out = err.stdout?.trim() || err.stderr?.trim();
      return out || `Error: ${err.message ?? String(e)}`;
    }
  },
});
