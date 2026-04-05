import { registerTool } from '../registry.js';
import type { AgentConfig } from '../../types/index.js';

/**
 * environment — read environment variables and system info.
 * Clean way to inspect PATH, env vars, and process details.
 */
registerTool({
  definition: {
    name: 'environment',
    description:
      'Read environment variables and system information. Optionally filter by prefix or list specific keys. Use to check NODE_ENV, PATH, API keys presence (not values), system details, and runtime config.',
    category: 'read',
    dangerLevel: 'safe',
    emoji: '🌍',
    parameters: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          description: 'Specific env var names to read. If omitted, returns system overview.',
          items: { type: 'string' },
        },
        prefix: {
          type: 'string',
          description: 'Filter vars by prefix e.g. "NODE", "REACT_APP", "DATABASE"',
        },
        redact: {
          type: 'boolean',
          description: 'Show only whether sensitive vars exist without revealing values (default: true for keys containing SECRET/KEY/TOKEN/PASSWORD/AUTH)',
        },
      },
      required: [],
    },
  },
  handler: async (args: Record<string, unknown>, config: AgentConfig) => {
    const SENSITIVE = /secret|key|token|password|auth|credential|private|cert/i;
    const redact = args.redact !== false;

    const result: string[] = [];

    if (args.keys) {
      const keys = args.keys as string[];
      for (const k of keys) {
        const val = process.env[k];
        if (val === undefined) {
          result.push(`${k}: (not set)`);
        } else if (redact && SENSITIVE.test(k)) {
          result.push(`${k}: *** (set, ${val.length} chars)`);
        } else {
          result.push(`${k}: ${val}`);
        }
      }
    } else if (args.prefix) {
      const prefix = String(args.prefix).toUpperCase();
      const matching = Object.keys(process.env).filter((k) => k.toUpperCase().startsWith(prefix));
      for (const k of matching.sort()) {
        const val = process.env[k]!;
        if (redact && SENSITIVE.test(k)) {
          result.push(`${k}: *** (set, ${val.length} chars)`);
        } else {
          result.push(`${k}: ${val}`);
        }
      }
      if (matching.length === 0) result.push(`No env vars with prefix "${prefix}"`);
    } else {
      // System overview
      const os = (await import('os')).default;
      result.push(`Platform: ${process.platform}`);
      result.push(`Node.js: ${process.version}`);
      result.push(`CWD: ${config.workingDir}`);
      result.push(`HOME: ${os.homedir()}`);
      result.push(`USER: ${process.env.USERNAME ?? process.env.USER ?? 'unknown'}`);
      result.push(`SHELL: ${process.env.SHELL ?? process.env.PSModulePath ? 'PowerShell' : (process.env.ComSpec ?? 'unknown')}`);
      result.push(`NODE_ENV: ${process.env.NODE_ENV ?? '(not set)'}`);
      result.push(`PATH entries: ${(process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').length}`);
      result.push(`Total env vars: ${Object.keys(process.env).length}`);
    }

    return result.join('\n');
  },
});
